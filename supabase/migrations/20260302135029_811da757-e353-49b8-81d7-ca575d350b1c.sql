
-- Enum for approval stage execution type
CREATE TYPE public.approval_stage_type AS ENUM ('sequential', 'parallel');

-- Enum for individual approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Approval stages template per department
CREATE TABLE public.approval_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 1,
  stage_type approval_stage_type NOT NULL DEFAULT 'sequential',
  approver_role app_role NOT NULL DEFAULT 'agent',
  approver_id UUID, -- specific user, NULL means any user with the role in that department
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage approval stages"
  ON public.approval_stages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view approval stages"
  ON public.approval_stages FOR SELECT
  USING (true);

-- Ticket approvals - tracks each approval action per ticket
CREATE TABLE public.ticket_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.approval_stages(id) ON DELETE CASCADE,
  approver_id UUID, -- who actually approved/rejected
  status approval_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and agents can view all approvals"
  ON public.ticket_approvals FOR SELECT
  USING (has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Requesters can view own ticket approvals"
  ON public.ticket_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets WHERE tickets.id = ticket_approvals.ticket_id AND tickets.requester_id = auth.uid()
  ));

CREATE POLICY "Agents and admins can update approvals"
  ON public.ticket_approvals FOR UPDATE
  USING (has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert approvals"
  ON public.ticket_approvals FOR INSERT
  WITH CHECK (true);

-- Function to auto-create approval records when a ticket is created
CREATE OR REPLACE FUNCTION public.create_ticket_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert approval records based on department's approval stages
  IF NEW.department_id IS NOT NULL THEN
    INSERT INTO public.ticket_approvals (ticket_id, stage_id)
    SELECT NEW.id, s.id
    FROM public.approval_stages s
    WHERE s.department_id = NEW.department_id
    ORDER BY s.stage_order;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_ticket_approvals
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ticket_approvals();

-- Function to handle approval logic (close ticket on rejection, advance stages)
CREATE OR REPLACE FUNCTION public.handle_approval_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket_id UUID;
  _stage_order INT;
  _stage_type approval_stage_type;
  _department_id UUID;
  _all_current_approved BOOLEAN;
  _any_current_rejected BOOLEAN;
  _next_stages RECORD;
BEGIN
  -- Only act when status changes from pending
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  _ticket_id := NEW.ticket_id;
  
  -- Get stage info
  SELECT s.stage_order, s.stage_type, s.department_id
  INTO _stage_order, _stage_type, _department_id
  FROM approval_stages s WHERE s.id = NEW.stage_id;

  -- On rejection: close the ticket
  IF NEW.status = 'rejected' THEN
    UPDATE tickets SET status = 'closed', closed_at = now() WHERE id = _ticket_id;
    
    -- Cancel remaining pending approvals
    UPDATE ticket_approvals SET status = 'rejected', decided_at = now()
    WHERE ticket_id = _ticket_id AND status = 'pending' AND id != NEW.id;
    
    -- Notify requester
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    SELECT t.requester_id, _ticket_id, 'تم رفض التذكرة', 
           'تم رفض التذكرة #' || t.ticket_number || ' في مرحلة الاعتماد', 'status_changed'
    FROM tickets t WHERE t.id = _ticket_id;
    
    RETURN NEW;
  END IF;

  -- On approval: check if all stages at current order are approved
  IF NEW.status = 'approved' THEN
    SELECT 
      NOT EXISTS (
        SELECT 1 FROM ticket_approvals ta
        JOIN approval_stages s ON s.id = ta.stage_id
        WHERE ta.ticket_id = _ticket_id AND s.stage_order = _stage_order AND ta.status = 'pending'
      )
    INTO _all_current_approved;

    IF _all_current_approved THEN
      -- Check if there are next stages
      IF EXISTS (
        SELECT 1 FROM approval_stages s
        WHERE s.department_id = _department_id AND s.stage_order > _stage_order
      ) THEN
        -- Notify requester about progress
        INSERT INTO notifications (user_id, ticket_id, title, message, type)
        SELECT t.requester_id, _ticket_id, 'تقدم في الاعتماد',
               'تم اعتماد المرحلة ' || _stage_order || ' للتذكرة #' || t.ticket_number, 'status_changed'
        FROM tickets t WHERE t.id = _ticket_id;
      ELSE
        -- All stages complete - move ticket to open
        UPDATE tickets SET status = 'open' WHERE id = _ticket_id;
        
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

CREATE TRIGGER trg_handle_approval_decision
  AFTER UPDATE ON public.ticket_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_approval_decision();
