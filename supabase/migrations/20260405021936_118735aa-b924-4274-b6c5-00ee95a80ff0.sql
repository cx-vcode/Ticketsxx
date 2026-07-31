-- Create increment_helpful function for knowledge_base_articles
CREATE OR REPLACE FUNCTION public.increment_helpful(article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE knowledge_base_articles
  SET helpful_count = helpful_count + 1
  WHERE id = article_id AND is_published = true;
END;
$$;

-- Create decrement_helpful function
CREATE OR REPLACE FUNCTION public.decrement_helpful(article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE knowledge_base_articles
  SET helpful_count = GREATEST(helpful_count - 1, 0)
  WHERE id = article_id AND is_published = true;
END;
$$;