-- 1) تحسين دالة create_ticket_approvals لدعم المطابقة بالخدمة فقط أيضاً + سجلات تشخيصية
CREATE OR REPLACE FUNCTION public.create_ticket_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inserted_count INT := 0;
BEGIN
  -- Match by department_id OR by service_id (allow service-scoped stages without department match)
  INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
  SELECT NEW.id, s.id,
    CASE WHEN s.deadline_hours IS NOT NULL 
      THEN now() + (s.deadline_hours || ' hours')::interval 
      ELSE NULL 
    END
  FROM public.approval_stages s
  WHERE
    (
      -- match by department when ticket has a department
      (NEW.department_id IS NOT NULL AND s.department_id = NEW.department_id
       AND (s.service_id IS NULL OR s.service_id = NEW.service_id))
      OR
      -- match by service when ticket has a service (covers tickets without department)
      (NEW.service_id IS NOT NULL AND s.service_id = NEW.service_id)
    )
  ORDER BY s.stage_order;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  RAISE LOG 'create_ticket_approvals: ticket=% dept=% service=% inserted=%',
    NEW.id, NEW.department_id, NEW.service_id, _inserted_count;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'create_ticket_approvals ERROR: % %', SQLERRM, SQLSTATE;
  RETURN NEW;  -- never block ticket creation
END;
$function$;

-- 2) Ensure trigger exists and is attached AFTER INSERT on tickets
DROP TRIGGER IF EXISTS trg_create_ticket_approvals ON public.tickets;
CREATE TRIGGER trg_create_ticket_approvals
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ticket_approvals();

-- 3) Backfill: create approvals for existing tickets that match stages but have no approvals yet
INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
SELECT t.id, s.id,
  CASE WHEN s.deadline_hours IS NOT NULL 
    THEN now() + (s.deadline_hours || ' hours')::interval 
    ELSE NULL 
  END
FROM public.tickets t
JOIN public.approval_stages s ON
  (
    (t.department_id IS NOT NULL AND s.department_id = t.department_id
     AND (s.service_id IS NULL OR s.service_id = t.service_id))
    OR
    (t.service_id IS NOT NULL AND s.service_id = t.service_id)
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.ticket_approvals ta
  WHERE ta.ticket_id = t.id AND ta.stage_id = s.id
);

-- 4) Update RLS for approval_stages to allow requesters to view stages tied to their ticket's service too
DROP POLICY IF EXISTS "Staff and relevant requesters can view approval stages" ON public.approval_stages;
CREATE POLICY "Staff and relevant requesters can view approval stages"
ON public.approval_stages
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.requester_id = auth.uid()
      AND (
        t.department_id = approval_stages.department_id
        OR (approval_stages.service_id IS NOT NULL AND t.service_id = approval_stages.service_id)
      )
  )
);