
-- Notification trigger for ticket status changes
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify requester when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.requester_id,
      NEW.id,
      'تغيير حالة التذكرة',
      'تم تغيير حالة التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.status,
      'status_changed'
    );
    
    -- Also notify assigned agent if different from requester
    IF NEW.assigned_agent_id IS NOT NULL AND NEW.assigned_agent_id != NEW.requester_id THEN
      INSERT INTO notifications (user_id, ticket_id, title, message, type)
      VALUES (
        NEW.assigned_agent_id,
        NEW.id,
        'تغيير حالة التذكرة',
        'تم تغيير حالة التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.status,
        'status_changed'
      );
    END IF;
  END IF;

  -- Notify assigned agent when ticket is assigned to them
  IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id AND NEW.assigned_agent_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.assigned_agent_id,
      NEW.id,
      'تذكرة جديدة معيّنة لك',
      'تم تعيين التذكرة #' || NEW.ticket_number || ' لك',
      'assigned'
    );
  END IF;

  -- Notify requester when priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.requester_id,
      NEW.id,
      'تغيير أولوية التذكرة',
      'تم تغيير أولوية التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.priority,
      'priority_changed'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_update
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_status_change();

-- Notification trigger for new tickets (notify admins)
CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  -- Notify all admins about new ticket
  FOR _admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    IF _admin_id != NEW.requester_id THEN
      INSERT INTO notifications (user_id, ticket_id, title, message, type)
      VALUES (
        _admin_id,
        NEW.id,
        'تذكرة جديدة',
        'تم إنشاء تذكرة جديدة #' || NEW.ticket_number || ': ' || LEFT(NEW.title, 50),
        'ticket_created'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_created();

-- Notification trigger for comments
CREATE OR REPLACE FUNCTION public.notify_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket RECORD;
BEGIN
  -- Only notify for public comments
  IF NEW.note_type = 'private' THEN
    RETURN NEW;
  END IF;

  SELECT id, ticket_number, requester_id, assigned_agent_id INTO _ticket
  FROM tickets WHERE id = NEW.ticket_id;

  -- Notify requester (if comment is not from them)
  IF _ticket.requester_id != NEW.author_id THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      _ticket.requester_id,
      NEW.ticket_id,
      'تعليق جديد',
      'تم إضافة تعليق على التذكرة #' || _ticket.ticket_number,
      'comment_added'
    );
  END IF;

  -- Notify assigned agent (if comment is not from them)
  IF _ticket.assigned_agent_id IS NOT NULL AND _ticket.assigned_agent_id != NEW.author_id THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      _ticket.assigned_agent_id,
      NEW.ticket_id,
      'تعليق جديد',
      'تم إضافة تعليق على التذكرة #' || _ticket.ticket_number,
      'comment_added'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_comment_added
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_added();
