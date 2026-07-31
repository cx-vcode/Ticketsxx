-- 1) Trigger: اشتقاق department_id من الخدمة قبل إدراج التذكرة
CREATE OR REPLACE FUNCTION public.set_ticket_department_from_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- إذا لم يحدد قسم، نأخذه من الخدمة
  IF NEW.department_id IS NULL AND NEW.service_id IS NOT NULL THEN
    SELECT default_assignment_group INTO NEW.department_id
    FROM public.services
    WHERE id = NEW.service_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_department_from_service ON public.tickets;
CREATE TRIGGER trg_set_ticket_department_from_service
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_department_from_service();

-- 2) تحديث create_ticket_approvals لتوسيع المطابقة + دعم المراحل العامة
CREATE OR REPLACE FUNCTION public.create_ticket_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inserted_count INT := 0;
  _ticket_system_id UUID;
  _derived_dept_id UUID;
BEGIN
  -- استخراج system_id من الخدمة
  IF NEW.service_id IS NOT NULL THEN
    SELECT system_id, default_assignment_group
      INTO _ticket_system_id, _derived_dept_id
    FROM public.services
    WHERE id = NEW.service_id;
  END IF;

  -- استخدام القسم المباشر للتذكرة أو القسم المشتق من الخدمة
  _derived_dept_id := COALESCE(NEW.department_id, _derived_dept_id);

  INSERT INTO public.ticket_approvals (ticket_id, stage_id, deadline_at)
  SELECT NEW.id, s.id,
    CASE WHEN s.deadline_hours IS NOT NULL
      THEN now() + (s.deadline_hours || ' hours')::interval
      ELSE NULL
    END
  FROM public.approval_stages s
  WHERE
    (
      -- مطابقة بالخدمة (الأولوية الأعلى)
      (NEW.service_id IS NOT NULL AND s.service_id = NEW.service_id)
      OR
      -- مطابقة بالقسم (المباشر أو المشتق) — مع توافق الخدمة إن وُجد
      (_derived_dept_id IS NOT NULL AND s.department_id = _derived_dept_id
        AND (s.service_id IS NULL OR s.service_id = NEW.service_id))
      OR
      -- مراحل النظام: مرتبطة بقسم تخدمه خدمات نفس النظام
      (_ticket_system_id IS NOT NULL AND s.service_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.services sv
          WHERE sv.system_id = _ticket_system_id
            AND sv.default_assignment_group = s.department_id
        ))
    )
    AND NOT public.approval_stage_should_skip(NEW, COALESCE(s.conditions, '{}'::jsonb))
  ORDER BY s.stage_order;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  RAISE LOG 'create_ticket_approvals: ticket=% dept=%(derived=%) service=% system=% inserted=%',
    NEW.id, NEW.department_id, _derived_dept_id, NEW.service_id, _ticket_system_id, _inserted_count;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'create_ticket_approvals ERROR: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- 3) ضمان وجود trigger الاعتماد
DROP TRIGGER IF EXISTS trg_create_ticket_approvals ON public.tickets;
CREATE TRIGGER trg_create_ticket_approvals
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ticket_approvals();