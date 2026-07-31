
-- 1) Add department_id and is_active to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Tickets: add code, SLA due dates, last_activity_at
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS code text UNIQUE,
  ADD COLUMN IF NOT EXISTS sla_first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

-- Generate code for existing tickets
UPDATE public.tickets 
SET code = 'TCK-' || EXTRACT(YEAR FROM created_at)::text || '-' || LPAD(ticket_number::text, 6, '0')
WHERE code IS NULL;

-- Auto-generate ticket code on insert
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := 'TCK-' || EXTRACT(YEAR FROM NEW.created_at)::text || '-' || LPAD(NEW.ticket_number::text, 6, '0');
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_ticket_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_code();

-- Auto-compute SLA due dates on insert based on priority
CREATE OR REPLACE FUNCTION public.set_sla_due_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _response_mins int;
  _resolution_mins int;
BEGIN
  SELECT first_response_minutes, resolution_minutes 
  INTO _response_mins, _resolution_mins
  FROM public.sla_policies 
  WHERE priority = NEW.priority
  LIMIT 1;

  IF _response_mins IS NOT NULL THEN
    NEW.sla_first_response_due_at := NEW.created_at + (_response_mins || ' minutes')::interval;
  END IF;
  IF _resolution_mins IS NOT NULL THEN
    NEW.sla_resolution_due_at := NEW.created_at + (_resolution_mins || ' minutes')::interval;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_sla_due_dates
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sla_due_dates();

-- Update last_activity_at on ticket update
CREATE OR REPLACE FUNCTION public.update_ticket_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_ticket_activity
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_activity();

-- 3) SLA policies: rename hours to minutes
ALTER TABLE public.sla_policies 
  ADD COLUMN IF NOT EXISTS first_response_minutes int NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS resolution_minutes int NOT NULL DEFAULT 1440;

-- Migrate existing data from hours to minutes
UPDATE public.sla_policies 
SET first_response_minutes = response_time_hours * 60,
    resolution_minutes = resolution_time_hours * 60;

-- Drop old columns
ALTER TABLE public.sla_policies 
  DROP COLUMN IF EXISTS response_time_hours,
  DROP COLUMN IF EXISTS resolution_time_hours;

-- 4) Ticket attachments: add mime_type, storage_key
ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_key text UNIQUE;

-- 5) Create ticket_event_type enum and restructure audit_logs → ticket_events
DO $$ BEGIN
  CREATE TYPE public.ticket_event_type AS ENUM (
    'status_changed', 'assigned', 'priority_changed', 
    'department_changed', 'comment_added', 'attachment_added',
    'created', 'resolved', 'closed', 'reopened'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS event_type public.ticket_event_type,
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- 6) Notifications: add type, data json
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb;

-- Migrate existing message to body
UPDATE public.notifications SET body = message WHERE body IS NULL;

-- 7) NEW: devices table for mobile push
CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  fcm_token text NOT NULL UNIQUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices"
  ON public.devices FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON public.tickets(code);
CREATE INDEX IF NOT EXISTS idx_tickets_last_activity ON public.tickets(last_activity_at DESC);
