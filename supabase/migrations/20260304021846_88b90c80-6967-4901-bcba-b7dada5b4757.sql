-- Allow developers to view all tickets (like agents)
CREATE POLICY "Developers can view all tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Allow developers to update tickets (assign, change status, etc.)
CREATE POLICY "Developers can update tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Allow developers to create tickets
CREATE POLICY "Developers can create tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer') AND requester_id = auth.uid());

-- Allow developers to view audit logs
CREATE POLICY "Developers can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Allow developers to insert audit logs
CREATE POLICY "Developers can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer') AND user_id = auth.uid());

-- Allow developers to view all approvals
CREATE POLICY "Developers can view approvals"
ON public.ticket_approvals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Allow developers to add comments
CREATE POLICY "Developers can view all comments"
ON public.ticket_comments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

-- Allow developers to insert notifications
CREATE POLICY "Developers can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer'));