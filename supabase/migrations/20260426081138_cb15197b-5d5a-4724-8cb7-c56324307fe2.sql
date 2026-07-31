-- Add conditions column to approval_stages for dynamic skip rules
ALTER TABLE public.approval_stages
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.approval_stages.conditions IS
  'Dynamic conditions for skipping this stage. Shape: { "skip_if": [ { "field": "priority|department_id|service_id|category_id", "operator": "eq|neq|in|nin", "value": <any> } ] }. Stage is skipped when ANY skip_if rule matches.';

-- Helper: evaluate skip conditions for a ticket+stage. Returns true when stage should be SKIPPED.
CREATE OR REPLACE FUNCTION public.approval_stage_should_skip(
  _ticket public.tickets,
  _conditions jsonb
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _rule jsonb;
  _field text;
  _operator text;
  _value jsonb;
  _ticket_value text;
BEGIN
  IF _conditions IS NULL OR _conditions = '{}'::jsonb OR NOT (_conditions ? 'skip_if') THEN
    RETURN false;
  END IF;

  FOR _rule IN SELECT * FROM jsonb_array_elements(_conditions -> 'skip_if')
  LOOP
    _field := _rule ->> 'field';
    _operator := COALESCE(_rule ->> 'operator', 'eq');
    _value := _rule -> 'value';

    -- Resolve ticket value for known fields
    _ticket_value := CASE _field
      WHEN 'priority' THEN _ticket.priority::text
      WHEN 'department_id' THEN _ticket.department_id::text
      WHEN 'service_id' THEN _ticket.service_id::text
      WHEN 'category_id' THEN _ticket.category_id::text
      WHEN 'source_system' THEN _ticket.source_system::text
      ELSE NULL
    END;

    IF _ticket_value IS NULL THEN
      CONTINUE;
    END IF;

    IF _operator = 'eq' AND _ticket_value = (_value #>> '{}') THEN
      RETURN true;
    ELSIF _operator = 'neq' AND _ticket_value <> (_value #>> '{}') THEN
      RETURN true;
    ELSIF _operator = 'in' AND jsonb_typeof(_value) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(_value) v WHERE v = _ticket_value) THEN
      RETURN true;
    ELSIF _operator = 'nin' AND jsonb_typeof(_value) = 'array'
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_value) v WHERE v = _ticket_value) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Update create_ticket_approvals trigger to skip stages whose conditions match
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
  IF NEW.service_id IS NOT NULL THEN
    SELECT system_id INTO _ticket_system_id FROM public.services WHERE id = NEW.service_id;
  END IF;

  INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
  SELECT NEW.id, s.id,
    CASE WHEN s.deadline_hours IS NOT NULL
      THEN now() + (s.deadline_hours || ' hours')::interval
      ELSE NULL
    END
  FROM public.approval_stages s
  WHERE
    (
      (NEW.service_id IS NOT NULL AND s.service_id = NEW.service_id)
      OR
      (NEW.department_id IS NOT NULL AND s.department_id = NEW.department_id
        AND (s.service_id IS NULL OR s.service_id = NEW.service_id))
      OR
      (_ticket_system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.services sv
          WHERE sv.system_id = _ticket_system_id
            AND sv.default_assignment_group = s.department_id
        ))
    )
    -- Skip stages whose conditions match the ticket
    AND NOT public.approval_stage_should_skip(NEW, COALESCE(s.conditions, '{}'::jsonb))
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

-- Mirror skip logic in backfill function
CREATE OR REPLACE FUNCTION public.backfill_ticket_approvals(_ticket_id uuid)
 RETURNS TABLE(inserted_count integer, matched_stages integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ticket public.tickets;
  _system_id UUID;
  _inserted INT := 0;
  _matched INT := 0;
BEGIN
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

  SELECT COUNT(*) INTO _matched
  FROM public.approval_stages s
  WHERE
    (
      (_ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id)
      OR (_ticket.department_id IS NOT NULL AND s.department_id = _ticket.department_id
          AND (s.service_id IS NULL OR s.service_id = _ticket.service_id))
      OR (_system_id IS NOT NULL AND s.service_id IS NULL
          AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.system_id = _system_id AND sv.default_assignment_group = s.department_id))
    )
    AND NOT public.approval_stage_should_skip(_ticket, COALESCE(s.conditions, '{}'::jsonb));

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
  AND NOT public.approval_stage_should_skip(_ticket, COALESCE(s.conditions, '{}'::jsonb))
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_approvals ta WHERE ta.ticket_id = _ticket_id AND ta.stage_id = s.id
  )
  ORDER BY s.stage_order;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  RETURN QUERY SELECT _inserted, _matched;
END;
$function$;