
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system settings"
ON public.system_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

-- Insert default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('system_name', 'TicketFlow'),
  ('system_subtitle', 'HELPDESK'),
  ('primary_color', '217 72% 50%'),
  ('accent_color', '217 72% 55%'),
  ('logo_url', NULL);
