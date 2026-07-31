-- ============ 1) Multi-approver fields on approval_stages ============
ALTER TABLE public.approval_stages
  ADD COLUMN IF NOT EXISTS min_approvers integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS require_all boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_to_manager boolean NOT NULL DEFAULT false;

-- ============ 2) Approval templates ============
CREATE TABLE IF NOT EXISTS public.approval_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage approval templates" ON public.approval_templates;
CREATE POLICY "Admins manage approval templates"
  ON public.approval_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff view approval templates" ON public.approval_templates;
CREATE POLICY "Staff view approval templates"
  ON public.approval_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role));

CREATE TRIGGER trg_approval_templates_updated
  BEFORE UPDATE ON public.approval_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system templates
INSERT INTO public.approval_templates (name, description, category, stages, is_system)
VALUES
  ('اعتماد مالي قياسي', 'مرحلتان: المدير المباشر ثم المالية', 'finance',
   '[{"stage_name":"موافقة المدير المباشر","stage_order":1,"stage_type":"sequential","approver_role":"agent","deadline_hours":24},{"stage_name":"موافقة الإدارة المالية","stage_order":2,"stage_type":"sequential","approver_role":"admin","deadline_hours":48}]'::jsonb,
   true),
  ('اعتماد تقني', 'مرحلة واحدة: قائد الفريق التقني', 'technical',
   '[{"stage_name":"مراجعة تقنية","stage_order":1,"stage_type":"sequential","approver_role":"agent","deadline_hours":12}]'::jsonb,
   true),
  ('اعتماد موارد بشرية', 'ثلاث مراحل: المدير، HR، الإدارة العليا', 'hr',
   '[{"stage_name":"موافقة المدير المباشر","stage_order":1,"stage_type":"sequential","approver_role":"agent","deadline_hours":24},{"stage_name":"موافقة الموارد البشرية","stage_order":2,"stage_type":"sequential","approver_role":"agent","deadline_hours":48},{"stage_name":"الإدارة العليا","stage_order":3,"stage_type":"sequential","approver_role":"admin","deadline_hours":72}]'::jsonb,
   true)
ON CONFLICT DO NOTHING;

-- ============ 3) Preview stages for prospective ticket ============
CREATE OR REPLACE FUNCTION public.preview_approval_stages_for_prospective_ticket(
  _service_id uuid,
  _department_id uuid DEFAULT NULL,
  _priority text DEFAULT 'medium'
)
RETURNS TABLE(stage_id uuid, stage_name text, stage_order integer, stage_type text, deadline_hours integer, department_id uuid, department_name text, match_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH svc AS (
    SELECT id, system_id, default_assignment_group FROM public.services WHERE id = _service_id
  ),
  derived_dept AS (
    SELECT COALESCE(_department_id, (SELECT default_assignment_group FROM svc)) AS dept_id
  )
  SELECT
    s.id, s.stage_name, s.stage_order, s.stage_type::text, s.deadline_hours,
    s.department_id, d.name,
    CASE
      WHEN s.service_id = (SELECT id FROM svc) THEN 'service_match'
      WHEN s.department_id = (SELECT dept_id FROM derived_dept)
        AND (s.service_id IS NULL OR s.service_id = (SELECT id FROM svc)) THEN 'department_match'
      ELSE 'system_match'
    END
  FROM public.approval_stages s
  LEFT JOIN public.departments d ON d.id = s.department_id
  WHERE
    (s.service_id = (SELECT id FROM svc))
    OR (s.department_id = (SELECT dept_id FROM derived_dept)
        AND (s.service_id IS NULL OR s.service_id = (SELECT id FROM svc)))
    OR (s.service_id IS NULL AND EXISTS (
      SELECT 1 FROM public.services sv
      WHERE sv.system_id = (SELECT system_id FROM svc)
        AND sv.default_assignment_group = s.department_id
    ))
  ORDER BY s.stage_order;
$$;

-- ============ 4) Health overview ============
CREATE OR REPLACE FUNCTION public.approval_health_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _services_total int; _services_no_group int; _services_no_coverage int;
  _depts_total int; _depts_no_stages int;
  _tickets_pending_no_approvals int;
  _stages_total int; _avg_per_dept numeric;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'agent'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT COUNT(*) INTO _services_total FROM public.services WHERE is_active = true;
  SELECT COUNT(*) INTO _services_no_group FROM public.services WHERE is_active = true AND default_assignment_group IS NULL;
  SELECT COUNT(*) INTO _services_no_coverage FROM public.services sv
    WHERE sv.is_active = true AND NOT EXISTS (
      SELECT 1 FROM public.approval_stages s
      WHERE s.service_id = sv.id
         OR (sv.default_assignment_group IS NOT NULL AND s.department_id = sv.default_assignment_group)
    );

  SELECT COUNT(*) INTO _depts_total FROM public.departments;
  SELECT COUNT(*) INTO _depts_no_stages FROM public.departments d
    WHERE NOT EXISTS (SELECT 1 FROM public.approval_stages s WHERE s.department_id = d.id);

  SELECT COUNT(*) INTO _tickets_pending_no_approvals
    FROM public.tickets t
    WHERE t.status NOT IN ('closed','resolved')
      AND NOT EXISTS (SELECT 1 FROM public.ticket_approvals ta WHERE ta.ticket_id = t.id);

  SELECT COUNT(*) INTO _stages_total FROM public.approval_stages;
  SELECT ROUND(AVG(c)::numeric, 1) INTO _avg_per_dept FROM (
    SELECT COUNT(*)::numeric AS c FROM public.approval_stages GROUP BY department_id
  ) x;

  RETURN jsonb_build_object(
    'services_total', _services_total,
    'services_no_assignment_group', _services_no_group,
    'services_no_approval_coverage', _services_no_coverage,
    'departments_total', _depts_total,
    'departments_no_stages', _depts_no_stages,
    'tickets_pending_without_approvals', _tickets_pending_no_approvals,
    'stages_total', _stages_total,
    'avg_stages_per_department', COALESCE(_avg_per_dept, 0),
    'health_score', GREATEST(0, 100 - (_services_no_group * 5) - (_services_no_coverage * 7) - (_depts_no_stages * 4) - (_tickets_pending_no_approvals * 2))
  );
END;
$$;

-- ============ 5) Apply approval template to a service ============
CREATE OR REPLACE FUNCTION public.apply_approval_template(
  _template_id uuid,
  _service_id uuid,
  _department_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stages jsonb; _stage jsonb; _inserted int := 0;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT stages INTO _stages FROM public.approval_templates WHERE id = _template_id;
  IF _stages IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  FOR _stage IN SELECT * FROM jsonb_array_elements(_stages)
  LOOP
    INSERT INTO public.approval_stages (
      stage_name, stage_order, stage_type, approver_role,
      service_id, department_id, deadline_hours
    ) VALUES (
      _stage->>'stage_name',
      (_stage->>'stage_order')::int,
      COALESCE(_stage->>'stage_type','sequential')::approval_stage_type,
      COALESCE(_stage->>'approver_role','agent')::app_role,
      _service_id,
      _department_id,
      NULLIF(_stage->>'deadline_hours','')::int
    );
    _inserted := _inserted + 1;
  END LOOP;

  -- Trigger backfill for existing tickets
  PERFORM public.backfill_ticket_approvals_for_service(_service_id);

  RETURN jsonb_build_object('inserted_stages', _inserted, 'service_id', _service_id);
END;
$$;

-- ============ 6) Update handle_approval_decision for multi-approver ============
CREATE OR REPLACE FUNCTION public.handle_approval_decision()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ticket_id uuid; _stage_order int; _stage_id uuid;
  _min_approvers int; _require_all boolean; _department_id uuid;
  _approved_count int; _rejected_count int; _total_at_order int;
  _stage_completed boolean;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  _ticket_id := NEW.ticket_id;
  _stage_id := NEW.stage_id;

  SELECT s.stage_order, s.min_approvers, s.require_all, s.department_id
    INTO _stage_order, _min_approvers, _require_all, _department_id
    FROM approval_stages s WHERE s.id = _stage_id;

  -- Reject -> close
  IF NEW.status = 'rejected' THEN
    UPDATE tickets SET status='closed', closed_at=now() WHERE id=_ticket_id;
    UPDATE ticket_approvals SET status='rejected', decided_at=now()
      WHERE ticket_id=_ticket_id AND status='pending' AND id <> NEW.id;
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    SELECT t.requester_id, _ticket_id, 'تم رفض التذكرة',
           'تم رفض التذكرة #' || t.ticket_number, 'status_changed'
    FROM tickets t WHERE t.id = _ticket_id;
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    SELECT COUNT(*) FILTER (WHERE ta.status='approved'),
           COUNT(*) FILTER (WHERE ta.status='rejected'),
           COUNT(*)
      INTO _approved_count, _rejected_count, _total_at_order
      FROM ticket_approvals ta
      JOIN approval_stages s ON s.id = ta.stage_id
      WHERE ta.ticket_id = _ticket_id AND s.stage_order = _stage_order;

    IF _require_all THEN
      _stage_completed := (_approved_count = _total_at_order);
    ELSE
      _stage_completed := (_approved_count >= GREATEST(_min_approvers, 1));
    END IF;

    IF _stage_completed THEN
      -- Auto-approve any remaining pending in the same stage_order to advance flow
      UPDATE ticket_approvals SET status='approved', decided_at=now()
        WHERE ticket_id=_ticket_id AND status='pending'
          AND stage_id IN (SELECT id FROM approval_stages WHERE stage_order=_stage_order AND department_id=_department_id);

      IF EXISTS (SELECT 1 FROM approval_stages WHERE department_id=_department_id AND stage_order > _stage_order) THEN
        INSERT INTO notifications (user_id, ticket_id, title, message, type)
        SELECT t.requester_id, _ticket_id, 'تقدم في الاعتماد',
               'تم اعتماد المرحلة ' || _stage_order || ' للتذكرة #' || t.ticket_number, 'status_changed'
        FROM tickets t WHERE t.id = _ticket_id;
      ELSE
        UPDATE tickets SET status='open' WHERE id=_ticket_id;
        INSERT INTO notifications (user_id, ticket_id, title, message, type)
        SELECT t.requester_id, _ticket_id, 'تم اعتماد التذكرة ✅',
               'تم اعتماد جميع مراحل التذكرة #' || t.ticket_number, 'status_changed'
        FROM tickets t WHERE t.id = _ticket_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ 7) Fallback to manager when no approvals created ============
CREATE OR REPLACE FUNCTION public.fallback_approval_to_manager()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _approvals_count int;
  _manager_id uuid;
  _dept_id uuid;
BEGIN
  -- Only run for portal-created tickets that need approval
  IF NEW.source_system != 'PORTAL' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO _approvals_count FROM public.ticket_approvals WHERE ticket_id = NEW.id;
  IF _approvals_count > 0 THEN RETURN NEW; END IF;

  -- Find requester's manager
  SELECT manager_id, department_id INTO _manager_id, _dept_id
    FROM public.profiles WHERE id = NEW.requester_id;

  IF _manager_id IS NOT NULL THEN
    -- Notify all admins
    INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
    SELECT ur.user_id, NEW.id,
      '⚠️ تذكرة بلا مراحل اعتماد',
      'التذكرة #' || NEW.ticket_number || ' لم تجد مراحل اعتماد، تم توجيهها للمدير المباشر',
      'system_alert'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fallback_approval ON public.tickets;
CREATE TRIGGER trg_fallback_approval
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.fallback_approval_to_manager();

-- ============ 8) Helper: list services with active counts and coverage status ============
CREATE OR REPLACE FUNCTION public.approval_coverage_by_service()
RETURNS TABLE(
  service_id uuid, service_name text, system_name text,
  has_default_group boolean, stages_count int, active_tickets int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    sv.id, sv.name, sys.name,
    sv.default_assignment_group IS NOT NULL,
    (SELECT COUNT(*)::int FROM public.approval_stages s
      WHERE s.service_id = sv.id
         OR (sv.default_assignment_group IS NOT NULL AND s.department_id = sv.default_assignment_group)),
    (SELECT COUNT(*)::int FROM public.tickets t
      WHERE t.service_id = sv.id AND t.status NOT IN ('closed','resolved'))
  FROM public.services sv
  LEFT JOIN public.systems sys ON sys.id = sv.system_id
  WHERE sv.is_active = true
    AND has_role(auth.uid(),'admin'::app_role);
$$;