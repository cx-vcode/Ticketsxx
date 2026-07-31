
-- 1. Add new columns to approval_stages
ALTER TABLE public.approval_stages
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deadline_hours integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add new columns to ticket_approvals
ALTER TABLE public.ticket_approvals
  ADD COLUMN IF NOT EXISTS delegated_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_escalated boolean DEFAULT false;

-- 3. Update create_ticket_approvals trigger function to set deadline_at
CREATE OR REPLACE FUNCTION public.create_ticket_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
    SELECT NEW.id, s.id,
      CASE WHEN s.deadline_hours IS NOT NULL 
        THEN now() + (s.deadline_hours || ' hours')::interval 
        ELSE NULL 
      END
    FROM public.approval_stages s
    WHERE s.department_id = NEW.department_id
      AND (s.service_id IS NULL OR s.service_id = NEW.service_id)
    ORDER BY s.stage_order;
  END IF;
  RETURN NEW;
END;
$function$;
