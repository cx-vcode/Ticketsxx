
-- CSAT ratings table
CREATE TABLE public.ticket_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id)
);

ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;

-- Requesters can rate their own tickets
CREATE POLICY "Requesters can rate own tickets"
ON public.ticket_ratings FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM tickets WHERE tickets.id = ticket_ratings.ticket_id AND tickets.requester_id = auth.uid())
);

-- Anyone authenticated can view ratings
CREATE POLICY "Anyone can view ratings"
ON public.ticket_ratings FOR SELECT
TO authenticated
USING (true);
