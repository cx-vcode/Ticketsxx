-- 1. Improved trigger function: more flexible matching (department, service, OR system-level)
CREATE OR REPLACE FUNCTION public.create_ticket_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _inserted_count INT := 0;
  _ticket_system_id UUID;
BEGIN
  -- Get system_id from service if available (for system-wide approval stages)
  IF NEW.service_id IS NOT NULL THEN
    SELECT system_id INTO _ticket_system_id FROM public.services WHERE id = NEW.service_id;
  END IF;

  -- Insert approval records matching by service, department, or system
  INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
  SELECT NEW.id, s.id,
    CASE WHEN s.deadline_hours IS NOT NULL 
      THEN now() + (s.deadline_hours || ' hours')::interval 
      ELSE NULL 
    END
  FROM public.approval_stages s
  WHERE
    -- Match by exact service (highest priority)
    (NEW.service_id IS NOT NULL AND s.service_id = NEW.service_id)
    OR
    -- Match by department + service compatibility (when both set)
    (NEW.department_id IS NOT NULL AND s.department_id = NEW.department_id
     AND (s.service_id IS NULL OR s.service_id = NEW.service_id))
    OR
    -- Match by system-wide stages: stage has no service/department restriction tied to a department of this system
    (_ticket_system_id IS NOT NULL AND s.service_id IS NULL 
     AND EXISTS (
       SELECT 1 FROM public.services sv 
       WHERE sv.system_id = _ticket_system_id 
       AND sv.default_assignment_group = s.department_id
     ))
  ORDER BY s.stage_order;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  RAISE LOG 'create_ticket_approvals: ticket=% dept=% service=% system=% inserted=%',
    NEW.id, NEW.department_id, NEW.service_id, _ticket_system_id, _inserted_count;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'create_ticket_approvals ERROR: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- 2. Manual backfill function: re-create approval records for an existing ticket (admin-only via RLS)
CREATE OR REPLACE FUNCTION public.backfill_ticket_approvals(_ticket_id uuid)
RETURNS TABLE(inserted_count int, matched_stages int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ticket RECORD;
  _system_id UUID;
  _inserted INT := 0;
  _matched INT := 0;
BEGIN
  -- Permission check: admin only
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE id = _ticket_id;
  IF _ticket IS NULL THEN
    RAISE EXCEPTION 'Ticket not found: %', _ticket_id;
  END IF;

  IF _ticket.service_id IS NOT NULL THEN
    SELECT system_id INTO _system_id FROM public.services WHERE id = _ticket.service_id;
  END IF;

  -- Count matching stages
  SELECT COUNT(*) INTO _matched
  FROM public.approval_stages s
  WHERE
    (_ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id)
    OR (_ticket.department_id IS NOT NULL AND s.department_id = _ticket.department_id
        AND (s.service_id IS NULL OR s.service_id = _ticket.service_id))
    OR (_system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.system_id = _system_id AND sv.default_assignment_group = s.department_id));

  -- Only insert stages that don't already exist for this ticket
  INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
  SELECT _ticket_id, s.id,
    CASE WHEN s.deadline_hours IS NOT NULL 
      THEN now() + (s.deadline_hours || ' hours')::interval 
      ELSE NULL 
    END
  FROM public.approval_stages s
  WHERE (
    (_ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id)
    OR (_ticket.department_id IS NOT NULL AND s.department_id = _ticket.department_id
        AND (s.service_id IS NULL OR s.service_id = _ticket.service_id))
    OR (_system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.system_id = _system_id AND sv.default_assignment_group = s.department_id))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_approvals ta WHERE ta.ticket_id = _ticket_id AND ta.stage_id = s.id
  )
  ORDER BY s.stage_order;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  
  RETURN QUERY SELECT _inserted, _matched;
END;
$$;

-- 3. Admin diagnostic function: list services without approval stages
CREATE OR REPLACE FUNCTION public.services_without_approval_coverage()
RETURNS TABLE(
  service_id uuid, 
  service_name text, 
  system_name text,
  active_tickets_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    sv.id as service_id,
    sv.name as service_name,
    sys.name as system_name,
    (SELECT COUNT(*) FROM public.tickets t WHERE t.service_id = sv.id AND t.status NOT IN ('closed', 'resolved'))::bigint as active_tickets_count
  FROM public.services sv
  LEFT JOIN public.systems sys ON sys.id = sv.system_id
  WHERE sv.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.approval_stages s
    WHERE s.service_id = sv.id
    OR (sv.default_assignment_group IS NOT NULL AND s.department_id = sv.default_assignment_group AND s.service_id IS NULL)
  )
  AND has_role(auth.uid(), 'admin'::app_role);
$$;

-- 4. Admin diagnostic: tickets missing approvals (where matching stages exist but no records)
CREATE OR REPLACE FUNCTION public.tickets_missing_approvals()
RETURNS TABLE(
  ticket_id uuid,
  ticket_number int,
  ticket_title text,
  service_name text,
  expected_stages_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    t.id as ticket_id,
    t.ticket_number,
    t.title as ticket_title,
    sv.name as service_name,
    (SELECT COUNT(*) FROM public.approval_stages s 
     WHERE (t.service_id IS NOT NULL AND s.service_id = t.service_id)
        OR (t.department_id IS NOT NULL AND s.department_id = t.department_id 
            AND (s.service_id IS NULL OR s.service_id = t.service_id))
    )::bigint as expected_stages_count
  FROM public.tickets t
  LEFT JOIN public.services sv ON sv.id = t.service_id
  WHERE t.status NOT IN ('closed', 'resolved')
  AND NOT EXISTS (SELECT 1 FROM public.ticket_approvals ta WHERE ta.ticket_id = t.id)
  AND EXISTS (
    SELECT 1 FROM public.approval_stages s
    WHERE (t.service_id IS NOT NULL AND s.service_id = t.service_id)
       OR (t.department_id IS NOT NULL AND s.department_id = t.department_id 
           AND (s.service_id IS NULL OR s.service_id = t.service_id))
  )
  AND has_role(auth.uid(), 'admin'::app_role)
  ORDER BY t.created_at DESC
  LIMIT 100;
$$;