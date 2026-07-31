-- 1. Remove overly broad storage upload policy (fix permissive OR issue)
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;

-- 2. Fix public ticket comments: restrict to ticket participants only
DROP POLICY IF EXISTS "Comments visible to ticket participants" ON public.ticket_comments;

CREATE POLICY "Comments visible to ticket participants"
ON public.ticket_comments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR (
    note_type = 'public'::note_type
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.requester_id = auth.uid()
        OR tickets.assigned_agent_id = auth.uid()
      )
    )
  )
  OR (
    note_type = 'private'::note_type
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.assigned_agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  )
);

-- 3. Add storage policies for email-assets bucket (restrict writes to admins)
CREATE POLICY "Admins can upload email assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update email assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete email assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Anyone can view email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');