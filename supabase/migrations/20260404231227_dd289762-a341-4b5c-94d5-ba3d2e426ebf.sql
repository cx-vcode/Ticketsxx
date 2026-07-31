
-- Add DELETE policy for ticket-attachments storage
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      WHERE ta.storage_key = name
      AND ta.uploaded_by = auth.uid()
    )
  )
);

-- Add UPDATE policy for ticket-attachments storage
CREATE POLICY "Users can update own uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      WHERE ta.storage_key = name
      AND ta.uploaded_by = auth.uid()
    )
  )
);
