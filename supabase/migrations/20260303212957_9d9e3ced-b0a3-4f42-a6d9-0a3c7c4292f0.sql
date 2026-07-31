
-- Knowledge Base articles table
CREATE TABLE public.knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  views_count integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read published articles
CREATE POLICY "Anyone can view published articles"
ON public.knowledge_base_articles FOR SELECT
TO authenticated
USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

-- Admins and agents can manage articles
CREATE POLICY "Admins and agents can manage articles"
ON public.knowledge_base_articles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role));
