-- ====================================================================
-- 1) Detect approval-stage match for a given service_id (used by NewTicket warning)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.preview_approval_stages_for_service(_service_id uuid)
RETURNS TABLE(
  stage_id uuid,
  stage_name text,
  stage_order int,
  match_reason text,
  department_id uuid,
  department_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH svc AS (
    SELECT id, system_id, default_assignment_group
    FROM public.services
    WHERE id = _service_id
  )
  SELECT
    s.id AS stage_id,
    s.stage_name,
    s.stage_order,
    CASE
      WHEN s.service_id = (SELECT id FROM svc) THEN 'service_match'
      WHEN s.department_id = (SELECT default_assignment_group FROM svc)
           AND (s.service_id IS NULL OR s.service_id = (SELECT id FROM svc))
        THEN 'department_match'
      WHEN s.service_id IS NULL AND EXISTS (
        SELECT 1 FROM public.services sv
        WHERE sv.system_id = (SELECT system_id FROM svc)
          AND sv.default_assignment_group = s.department_id
      ) THEN 'system_match'
      ELSE 'other'
    END AS match_reason,
    s.department_id,
    d.name AS department_name
  FROM public.approval_stages s
  LEFT JOIN public.departments d ON d.id = s.department_id
  WHERE
    s.service_id = (SELECT id FROM svc)
    OR (s.department_id = (SELECT default_assignment_group FROM svc)
        AND (s.service_id IS NULL OR s.service_id = (SELECT id FROM svc)))
    OR (s.service_id IS NULL AND EXISTS (
      SELECT 1 FROM public.services sv
      WHERE sv.system_id = (SELECT system_id FROM svc)
        AND sv.default_assignment_group = s.department_id
    ))
  ORDER BY s.stage_order;
$$;

-- ====================================================================
-- 2) Diagnose why a specific ticket has no approvals (for /admin/approval-stages)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.diagnose_ticket_approvals(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket public.tickets;
  _svc RECORD;
  _existing_count int;
  _service_match int;
  _dept_match int;
  _system_match int;
  _skipped_by_conditions int;
  _matched_stages jsonb;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE id = _ticket_id;
  IF _ticket IS NULL THEN
    RETURN jsonb_build_object('error', 'ticket_not_found');
  END IF;

  SELECT id, system_id, default_assignment_group, name
    INTO _svc
  FROM public.services
  WHERE id = _ticket.service_id;

  SELECT COUNT(*) INTO _existing_count
  FROM public.ticket_approvals WHERE ticket_id = _ticket_id;

  SELECT COUNT(*) INTO _service_match
  FROM public.approval_stages s
  WHERE _ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id;

  SELECT COUNT(*) INTO _dept_match
  FROM public.approval_stages s
  WHERE COALESCE(_ticket.department_id, _svc.default_assignment_group) IS NOT NULL
    AND s.department_id = COALESCE(_ticket.department_id, _svc.default_assignment_group)
    AND (s.service_id IS NULL OR s.service_id = _ticket.service_id);

  SELECT COUNT(*) INTO _system_match
  FROM public.approval_stages s
  WHERE _svc.system_id IS NOT NULL AND s.service_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.services sv
      WHERE sv.system_id = _svc.system_id
        AND sv.default_assignment_group = s.department_id
    );

  SELECT COUNT(*) INTO _skipped_by_conditions
  FROM public.approval_stages s
  WHERE (
    (_ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id)
    OR (COALESCE(_ticket.department_id, _svc.default_assignment_group) IS NOT NULL
        AND s.department_id = COALESCE(_ticket.department_id, _svc.default_assignment_group)
        AND (s.service_id IS NULL OR s.service_id = _ticket.service_id))
    OR (_svc.system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (SELECT 1 FROM public.services sv
          WHERE sv.system_id = _svc.system_id AND sv.default_assignment_group = s.department_id))
  )
  AND public.approval_stage_should_skip(_ticket, COALESCE(s.conditions, '{}'::jsonb));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stage_id', s.id,
    'stage_name', s.stage_name,
    'stage_order', s.stage_order,
    'match_reason', CASE
      WHEN _ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id THEN 'service_match'
      WHEN COALESCE(_ticket.department_id, _svc.default_assignment_group) IS NOT NULL
           AND s.department_id = COALESCE(_ticket.department_id, _svc.default_assignment_group)
           AND (s.service_id IS NULL OR s.service_id = _ticket.service_id)
        THEN 'department_match'
      ELSE 'system_match'
    END,
    'will_skip', public.approval_stage_should_skip(_ticket, COALESCE(s.conditions, '{}'::jsonb))
  ) ORDER BY s.stage_order), '[]'::jsonb)
  INTO _matched_stages
  FROM public.approval_stages s
  WHERE
    (_ticket.service_id IS NOT NULL AND s.service_id = _ticket.service_id)
    OR (COALESCE(_ticket.department_id, _svc.default_assignment_group) IS NOT NULL
        AND s.department_id = COALESCE(_ticket.department_id, _svc.default_assignment_group)
        AND (s.service_id IS NULL OR s.service_id = _ticket.service_id))
    OR (_svc.system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (SELECT 1 FROM public.services sv
          WHERE sv.system_id = _svc.system_id AND sv.default_assignment_group = s.department_id));

  RETURN jsonb_build_object(
    'ticket_id', _ticket.id,
    'ticket_number', _ticket.ticket_number,
    'ticket_title', _ticket.title,
    'service_id', _ticket.service_id,
    'service_name', _svc.name,
    'department_id', _ticket.department_id,
    'derived_department_id', COALESCE(_ticket.department_id, _svc.default_assignment_group),
    'system_id', _svc.system_id,
    'service_has_default_group', _svc.default_assignment_group IS NOT NULL,
    'existing_approvals_count', _existing_count,
    'service_match_count', _service_match,
    'department_match_count', _dept_match,
    'system_match_count', _system_match,
    'skipped_by_conditions_count', _skipped_by_conditions,
    'total_potential_matches', _service_match + _dept_match + _system_match,
    'matched_stages', _matched_stages
  );
END;
$$;

-- ====================================================================
-- 3) Test ticket creation: create + count approvals + cleanup
-- ====================================================================
CREATE OR REPLACE FUNCTION public.test_ticket_approval_creation(_service_id uuid, _department_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket_id uuid;
  _approvals_count int;
  _service_name text;
  _stage_details jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT name INTO _service_name FROM public.services WHERE id = _service_id;
  IF _service_name IS NULL THEN
    RAISE EXCEPTION 'Service not found: %', _service_id;
  END IF;

  -- Create dry-run ticket (will be deleted at the end)
  INSERT INTO public.tickets (title, description, requester_id, service_id, department_id, status, priority, source_system)
  VALUES (
    '[TEST] Approval matching probe — ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    'Auto-generated test ticket for approval-stage matching diagnostics. Safe to delete.',
    auth.uid(),
    _service_id,
    _department_id,
    'new',
    'low',
    'PORTAL'
  )
  RETURNING id INTO _ticket_id;

  SELECT COUNT(*) INTO _approvals_count
  FROM public.ticket_approvals WHERE ticket_id = _ticket_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'stage_name', s.stage_name,
    'stage_order', s.stage_order,
    'status', ta.status
  ) ORDER BY s.stage_order), '[]'::jsonb)
  INTO _stage_details
  FROM public.ticket_approvals ta
  JOIN public.approval_stages s ON s.id = ta.stage_id
  WHERE ta.ticket_id = _ticket_id;

  -- Cleanup
  DELETE FROM public.ticket_approvals WHERE ticket_id = _ticket_id;
  DELETE FROM public.tickets WHERE id = _ticket_id;

  RETURN jsonb_build_object(
    'service_id', _service_id,
    'service_name', _service_name,
    'department_id', _department_id,
    'approvals_created', _approvals_count,
    'stages', _stage_details,
    'success', _approvals_count > 0
  );
END;
$$;

-- ====================================================================
-- 4) Trigger: backfill ticket_approvals when service is updated
--    (re-derive approvals for impacted active tickets)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.backfill_ticket_approvals_for_service(_service_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t RECORD;
  _total int := 0;
  _result RECORD;
BEGIN
  FOR _t IN
    SELECT id FROM public.tickets
    WHERE service_id = _service_id
      AND status NOT IN ('closed', 'resolved')
  LOOP
    BEGIN
      SELECT * INTO _result FROM public.backfill_ticket_approvals(_t.id);
      _total := _total + COALESCE(_result.inserted_count, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'backfill_ticket_approvals_for_service: failed for ticket % - %', _t.id, SQLERRM;
    END;
  END LOOP;
  RETURN _total;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_service_backfill_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted int;
BEGIN
  -- Only re-run when routing-affecting fields change (or on insert)
  IF TG_OP = 'UPDATE' AND (
    NEW.default_assignment_group IS NOT DISTINCT FROM OLD.default_assignment_group
    AND NEW.system_id IS NOT DISTINCT FROM OLD.system_id
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT public.backfill_ticket_approvals_for_service(NEW.id) INTO _inserted;
    RAISE LOG 'Service % triggered backfill: % approvals inserted', NEW.id, _inserted;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trg_service_backfill_approvals failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_backfill_approvals ON public.services;
CREATE TRIGGER trg_service_backfill_approvals
AFTER INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.trg_service_backfill_approvals();

-- ====================================================================
-- 5) Helper RPC: list services missing default_assignment_group
-- ====================================================================
CREATE OR REPLACE FUNCTION public.services_without_assignment_group()
RETURNS TABLE(
  service_id uuid,
  service_name text,
  system_name text,
  active_tickets_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sv.id,
    sv.name,
    sys.name,
    (SELECT COUNT(*) FROM public.tickets t
      WHERE t.service_id = sv.id AND t.status NOT IN ('closed','resolved'))::bigint
  FROM public.services sv
  LEFT JOIN public.systems sys ON sys.id = sv.system_id
  WHERE sv.is_active = true
    AND sv.default_assignment_group IS NULL
    AND has_role(auth.uid(), 'admin'::app_role);
$$;

-- ====================================================================
-- 6) Helper: lookup ticket by ticket_number for diagnostics UI
-- ====================================================================
CREATE OR REPLACE FUNCTION public.find_ticket_by_number(_ticket_number int)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tickets
  WHERE ticket_number = _ticket_number
  LIMIT 1;
$$;