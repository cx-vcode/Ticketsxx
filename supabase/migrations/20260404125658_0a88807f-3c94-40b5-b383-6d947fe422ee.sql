
-- Create a function to call the sync-to-classera edge function when ticket status changes
CREATE OR REPLACE FUNCTION public.sync_ticket_to_classera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only sync if source_system is not PORTAL and status actually changed
  IF NEW.source_system = 'PORTAL' THEN
    RETURN NEW;
  END IF;

  _supabase_url := 'https://yoamlepdjzsjwppxhuov.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYW1sZXBkanpzandwcHhodW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTMxMDcsImV4cCI6MjA4ODAyOTEwN30.M4cYFcsHEyPXl572uaRN-9VrBJ9OLEC5Ojp-LXqwJgE';

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-to-classera',
    body := jsonb_build_object(
      'ticket_id', NEW.id,
      'status', NEW.status,
      'resolution_summary', NEW.resolution_summary,
      'event_type', CASE 
        WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed'
        WHEN OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN 'assigned'
        WHEN OLD.priority IS DISTINCT FROM NEW.priority THEN 'priority_changed'
        ELSE 'updated'
      END
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to sync ticket to Classera: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-sync on ticket updates
CREATE TRIGGER trigger_sync_ticket_to_classera
  AFTER UPDATE OF status, priority, assigned_agent_id, resolution_summary ON public.tickets
  FOR EACH ROW
  WHEN (OLD.source_system != 'PORTAL')
  EXECUTE FUNCTION public.sync_ticket_to_classera();
