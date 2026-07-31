
INSERT INTO storage.buckets (id, name, public) VALUES ('system-assets', 'system-assets', true);

CREATE POLICY "Admins can upload system assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'system-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update system assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'system-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete system assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'system-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view system assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'system-assets');
