
-- Add resolution summary and first response tracking to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolution_summary TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Create SLA policies table
CREATE TABLE public.sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority public.ticket_priority NOT NULL UNIQUE,
  response_time_hours INTEGER NOT NULL DEFAULT 4,
  resolution_time_hours INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view SLA policies"
ON public.sla_policies FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage SLA policies"
ON public.sla_policies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default SLA values
INSERT INTO public.sla_policies (priority, response_time_hours, resolution_time_hours) VALUES
  ('urgent', 1, 4),
  ('high', 2, 8),
  ('medium', 4, 24),
  ('low', 8, 48);

-- Add updated_at trigger for sla_policies
CREATE TRIGGER update_sla_policies_updated_at
BEFORE UPDATE ON public.sla_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
