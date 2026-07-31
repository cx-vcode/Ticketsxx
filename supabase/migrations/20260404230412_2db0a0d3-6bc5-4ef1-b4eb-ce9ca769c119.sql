
-- Fix 1: Restrict tenants SELECT to members/owner/admins only
DROP POLICY IF EXISTS "Authenticated users can view active tenants" ON public.tenants;

CREATE POLICY "Members and admins can view tenants"
ON public.tenants FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_members.tenant_id = tenants.id
      AND tenant_members.user_id = auth.uid()
  )
);

-- Fix 2: Invert developer_can_access_ticket to deny by default
CREATE OR REPLACE FUNCTION public.developer_can_access_ticket(_developer_id uuid, _ticket_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
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
