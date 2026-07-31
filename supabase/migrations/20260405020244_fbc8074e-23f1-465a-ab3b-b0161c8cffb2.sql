
-- Create internal_kb_articles table for staff-only knowledge base
CREATE TABLE public.internal_kb_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}'::text[],
  is_published BOOLEAN NOT NULL DEFAULT true,
  views_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  service_id UUID REFERENCES public.services(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_kb_articles ENABLE ROW LEVEL SECURITY;

-- Only admins and agents can manage internal articles
CREATE POLICY "Staff can manage internal articles"
ON public.internal_kb_articles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role));

-- Developers can view published internal articles
CREATE POLICY "Developers can view internal articles"
ON public.internal_kb_articles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role) AND is_published = true);

-- Updated_at trigger
CREATE TRIGGER update_internal_kb_updated_at
  BEFORE UPDATE ON public.internal_kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
