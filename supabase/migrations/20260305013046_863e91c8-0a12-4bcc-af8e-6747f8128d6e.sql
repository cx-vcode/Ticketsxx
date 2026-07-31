
-- 1. Ticket templates table
CREATE TABLE public.ticket_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  system_id UUID REFERENCES public.systems(id),
  service_id UUID REFERENCES public.services(id),
  category_id UUID REFERENCES public.service_categories(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view templates" ON public.ticket_templates
  FOR SELECT TO authenticated
  USING (is_shared = true OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can create templates" ON public.ticket_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role))
    AND created_by = auth.uid()
  );

CREATE POLICY "Staff can update own templates" ON public.ticket_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can delete own templates" ON public.ticket_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Round Robin auto-assignment function
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _department_id UUID;
  _agent_id UUID;
BEGIN
  -- Only auto-assign if no agent is already assigned
  IF NEW.assigned_agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get department from service's default_assignment_group
  IF NEW.service_id IS NOT NULL THEN
    SELECT default_assignment_group INTO _department_id
    FROM services WHERE id = NEW.service_id;
  END IF;

  -- If no department from service, use ticket's department
  IF _department_id IS NULL THEN
    _department_id := NEW.department_id;
  END IF;

  -- If still no department, skip auto-assignment
  IF _department_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Round Robin: pick agent in department with fewest open tickets
  SELECT p.id INTO _agent_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('agent', 'admin')
    AND p.department_id = _department_id
    AND p.is_active = true
  ORDER BY (
    SELECT COUNT(*) FROM tickets t
    WHERE t.assigned_agent_id = p.id
      AND t.status NOT IN ('closed', 'resolved')
  ) ASC, random()
  LIMIT 1;

  IF _agent_id IS NOT NULL THEN
    NEW.assigned_agent_id := _agent_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_ticket
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_ticket();
