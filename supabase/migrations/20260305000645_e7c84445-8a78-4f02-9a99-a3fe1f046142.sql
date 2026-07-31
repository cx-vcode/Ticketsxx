
-- 1. Canned Responses (Quick Reply Templates)
CREATE TABLE public.canned_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  shortcut TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Agents/admins can view shared responses or their own
CREATE POLICY "Staff can view canned responses"
  ON public.canned_responses FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'developer')
    OR (created_by = auth.uid())
  );

CREATE POLICY "Staff can create canned responses"
  ON public.canned_responses FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'agent'))
    AND created_by = auth.uid()
  );

CREATE POLICY "Staff can update own canned responses"
  ON public.canned_responses FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can delete own canned responses"
  ON public.canned_responses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 2. Ticket Time Entries (Time Tracking)
CREATE TABLE public.ticket_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  is_running BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view time entries"
  ON public.ticket_time_entries FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'developer')
    OR user_id = auth.uid()
  );

CREATE POLICY "Staff can create time entries"
  ON public.ticket_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'developer'))
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own time entries"
  ON public.ticket_time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own time entries"
  ON public.ticket_time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Enable realtime for comments (already exists but ensure)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_time_entries;
