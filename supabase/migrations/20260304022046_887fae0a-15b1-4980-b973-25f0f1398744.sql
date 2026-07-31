-- Table to restrict developer access to specific systems/services
CREATE TABLE public.developer_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  system_id uuid REFERENCES public.systems(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_access_unique UNIQUE (developer_id, system_id, service_id)
);

ALTER TABLE public.developer_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage developer access
CREATE POLICY "Admins can manage developer access"
ON public.developer_access
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Developers can view their own access
CREATE POLICY "Developers can view own access"
ON public.developer_access
FOR SELECT
TO authenticated
USING (developer_id = auth.uid());

-- Function to check if developer has access to a ticket's system/service
CREATE OR REPLACE FUNCTION public.developer_can_access_ticket(_developer_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- If no access restrictions exist for this developer, allow all
    NOT EXISTS (
      SELECT 1 FROM developer_access WHERE developer_id = _developer_id
    )
    OR
    -- Otherwise check if ticket's system or service matches
    EXISTS (
      SELECT 1 
      FROM tickets t
      LEFT JOIN services s ON s.id = t.service_id
      JOIN developer_access da ON da.developer_id = _developer_id
      WHERE t.id = _ticket_id
        AND (
          (da.system_id IS NOT NULL AND s.system_id = da.system_id)
          OR (da.service_id IS NOT NULL AND da.service_id = t.service_id)
        )
    )
$$;

-- Drop old developer ticket policies and recreate with access check
DROP POLICY IF EXISTS "Developers can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Developers can update tickets" ON public.tickets;

CREATE POLICY "Developers can view accessible tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'developer') 
  AND public.developer_can_access_ticket(auth.uid(), id)
);

CREATE POLICY "Developers can update accessible tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'developer')
  AND public.developer_can_access_ticket(auth.uid(), id)
);