CREATE OR REPLACE FUNCTION public.increment_views(article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE knowledge_base_articles
  SET views_count = views_count + 1
  WHERE id = article_id AND is_published = true;
END;
$$;