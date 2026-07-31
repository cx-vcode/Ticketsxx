
-- Fix permissive INSERT policy on ticket_approvals
DROP POLICY "System can insert approvals" ON public.ticket_approvals;

CREATE POLICY "Authenticated can insert approvals"
  ON public.ticket_approvals FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'agent'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tickets WHERE tickets.id = ticket_approvals.ticket_id AND tickets.requester_id = auth.uid()
    )
  );
