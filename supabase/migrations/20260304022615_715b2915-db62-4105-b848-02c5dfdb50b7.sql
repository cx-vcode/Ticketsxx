
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send email notification via edge function
CREATE OR REPLACE FUNCTION public.send_email_notification_via_edge(
  _ticket_id uuid,
  _event_type text,
  _recipient_email text,
  _recipient_name text,
  _ticket_number int,
  _ticket_title text,
  _details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- If settings not available, try environment
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://yoamlepdjzsjwppxhuov.supabase.co';
  END IF;
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYW1sZXBkanpzandwcHhodW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTMxMDcsImV4cCI6MjA4ODAyOTEwN30.M4cYFcsHEyPXl572uaRN-9VrBJ9OLEC5Ojp-LXqwJgE';
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-email-notification',
    body := jsonb_build_object(
      'ticket_id', _ticket_id,
      'event_type', _event_type,
      'recipient_email', _recipient_email,
      'recipient_name', _recipient_name,
      'ticket_number', _ticket_number,
      'ticket_title', _ticket_title,
      'details', _details
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the transaction if email sending fails
  RAISE WARNING 'Failed to send email notification: %', SQLERRM;
END;
$$;

-- Update the ticket status change trigger to also send email
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _requester RECORD;
  _agent RECORD;
BEGIN
  -- Get requester info
  SELECT full_name, email INTO _requester FROM profiles WHERE id = NEW.requester_id;

  -- Notify requester when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.requester_id, NEW.id,
      'تغيير حالة التذكرة',
      'تم تغيير حالة التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.status,
      'status_changed'
    );
    
    -- Send email to requester
    PERFORM send_email_notification_via_edge(
      NEW.id, 'status_changed', _requester.email, _requester.full_name,
      NEW.ticket_number, NEW.title,
      'تم تغيير حالة التذكرة من ' || OLD.status || ' إلى ' || NEW.status
    );

    -- Also notify assigned agent if different from requester
    IF NEW.assigned_agent_id IS NOT NULL AND NEW.assigned_agent_id != NEW.requester_id THEN
      SELECT full_name, email INTO _agent FROM profiles WHERE id = NEW.assigned_agent_id;
      
      INSERT INTO notifications (user_id, ticket_id, title, message, type)
      VALUES (
        NEW.assigned_agent_id, NEW.id,
        'تغيير حالة التذكرة',
        'تم تغيير حالة التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.status,
        'status_changed'
      );
      
      PERFORM send_email_notification_via_edge(
        NEW.id, 'status_changed', _agent.email, _agent.full_name,
        NEW.ticket_number, NEW.title,
        'تم تغيير حالة التذكرة من ' || OLD.status || ' إلى ' || NEW.status
      );
    END IF;
  END IF;

  -- Notify assigned agent when ticket is assigned to them
  IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id AND NEW.assigned_agent_id IS NOT NULL THEN
    SELECT full_name, email INTO _agent FROM profiles WHERE id = NEW.assigned_agent_id;
    
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.assigned_agent_id, NEW.id,
      'تذكرة جديدة معيّنة لك',
      'تم تعيين التذكرة #' || NEW.ticket_number || ' لك',
      'assigned'
    );
    
    PERFORM send_email_notification_via_edge(
      NEW.id, 'assigned', _agent.email, _agent.full_name,
      NEW.ticket_number, NEW.title,
      'تم تعيين التذكرة #' || NEW.ticket_number || ' لك'
    );
  END IF;

  -- Notify requester when priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.requester_id, NEW.id,
      'تغيير أولوية التذكرة',
      'تم تغيير أولوية التذكرة #' || NEW.ticket_number || ' إلى ' || NEW.priority,
      'priority_changed'
    );
    
    PERFORM send_email_notification_via_edge(
      NEW.id, 'priority_changed', _requester.email, _requester.full_name,
      NEW.ticket_number, NEW.title,
      'تم تغيير أولوية التذكرة إلى ' || NEW.priority
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update ticket created trigger to send email
CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin RECORD;
  _requester RECORD;
BEGIN
  SELECT full_name, email INTO _requester FROM profiles WHERE id = NEW.requester_id;
  
  -- Notify all admins about new ticket
  FOR _admin IN 
    SELECT ur.user_id, p.full_name, p.email 
    FROM user_roles ur 
    JOIN profiles p ON p.id = ur.user_id 
    WHERE ur.role = 'admin' AND ur.user_id != NEW.requester_id
  LOOP
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (
      _admin.user_id, NEW.id,
      'تذكرة جديدة',
      'تم إنشاء تذكرة جديدة #' || NEW.ticket_number || ': ' || LEFT(NEW.title, 50),
      'ticket_created'
    );
    
    PERFORM send_email_notification_via_edge(
      NEW.id, 'created', _admin.email, _admin.full_name,
      NEW.ticket_number, NEW.title,
      'تم إنشاء تذكرة جديدة بواسطة ' || _requester.full_name
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Update comment notification to send email
CREATE OR REPLACE FUNCTION public.notify_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ticket RECORD;
  _requester RECORD;
  _agent RECORD;
  _author RECORD;
BEGIN
  IF NEW.note_type = 'private' THEN
    RETURN NEW;
  END IF;

  SELECT id, ticket_number, title, requester_id, assigned_agent_id INTO _ticket
  FROM tickets WHERE id = NEW.ticket_id;
  
  SELECT full_name INTO _author FROM profiles WHERE id = NEW.author_id;

  -- Notify requester
  IF _ticket.requester_id != NEW.author_id THEN
    SELECT full_name, email INTO _requester FROM profiles WHERE id = _ticket.requester_id;
    
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (_ticket.requester_id, NEW.ticket_id, 'تعليق جديد',
      'تم إضافة تعليق على التذكرة #' || _ticket.ticket_number, 'comment_added');
    
    PERFORM send_email_notification_via_edge(
      NEW.ticket_id, 'comment_added', _requester.email, _requester.full_name,
      _ticket.ticket_number, _ticket.title,
      'تعليق جديد من ' || _author.full_name
    );
  END IF;

  -- Notify assigned agent
  IF _ticket.assigned_agent_id IS NOT NULL AND _ticket.assigned_agent_id != NEW.author_id THEN
    SELECT full_name, email INTO _agent FROM profiles WHERE id = _ticket.assigned_agent_id;
    
    INSERT INTO notifications (user_id, ticket_id, title, message, type)
    VALUES (_ticket.assigned_agent_id, NEW.ticket_id, 'تعليق جديد',
      'تم إضافة تعليق على التذكرة #' || _ticket.ticket_number, 'comment_added');
    
    PERFORM send_email_notification_via_edge(
      NEW.ticket_id, 'comment_added', _agent.email, _agent.full_name,
      _ticket.ticket_number, _ticket.title,
      'تعليق جديد من ' || _author.full_name
    );
  END IF;

  RETURN NEW;
END;
$$;
