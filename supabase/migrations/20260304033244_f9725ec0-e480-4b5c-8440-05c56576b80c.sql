
-- Server-side validation trigger for file uploads
CREATE OR REPLACE FUNCTION public.validate_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate file extension
  IF NOT (NEW.file_name ~* '\.(jpg|jpeg|png|gif|webp|pdf|docx|xlsx|txt|csv)$') THEN
    RAISE EXCEPTION 'نوع الملف غير مسموح به';
  END IF;

  -- Validate file size (10MB max)
  IF NEW.file_size IS NOT NULL AND NEW.file_size > 10485760 THEN
    RAISE EXCEPTION 'حجم الملف يتجاوز 10 ميجابايت';
  END IF;

  -- Sanitize file name - remove path traversal attempts
  IF NEW.file_name ~ '\.\.' OR NEW.file_name ~ '/' OR NEW.file_name ~ '\\' THEN
    RAISE EXCEPTION 'اسم الملف غير صالح';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_file_upload
  BEFORE INSERT ON public.ticket_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_file_upload();
