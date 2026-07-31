
-- 1. Make ticket-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'ticket-attachments';

-- 2. Fix ticket_attachments SELECT policy (was USING true)
DROP POLICY IF EXISTS "View attachments for accessible tickets" ON public.ticket_attachments;
CREATE POLICY "View attachments for accessible tickets"
ON public.ticket_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND (
      tickets.requester_id = auth.uid()
      OR tickets.assigned_agent_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'agent')
      OR (public.has_role(auth.uid(), 'developer') AND public.developer_can_access_ticket(auth.uid(), tickets.id))
    )
  )
);

-- 3. Fix ticket_comments private notes policy
DROP POLICY IF EXISTS "Public comments visible to ticket participants" ON public.ticket_comments;
CREATE POLICY "Comments visible to ticket participants"
ON public.ticket_comments FOR SELECT TO authenticated
USING (
  note_type = 'public'
  OR (
    note_type = 'private' AND EXISTS (
      SELECT 1 FROM tickets
      WHERE id = ticket_comments.ticket_id
      AND (
        assigned_agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
    )
  )
);

-- 4. Add storage RLS policies for ticket-attachments
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users upload to accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users download from accessible tickets" ON storage.objects;

CREATE POLICY "Users upload to accessible tickets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[1] = 'avatars'
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM tickets
      WHERE requester_id = auth.uid()
        OR assigned_agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
    )
  )
);

CREATE POLICY "Users download from accessible tickets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[1] = 'avatars'
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM tickets
      WHERE requester_id = auth.uid()
        OR assigned_agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'agent')
    )
  )
);
