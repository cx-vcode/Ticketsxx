-- Drop existing FKs that point to auth.users and recreate pointing to profiles
ALTER TABLE public.ticket_comments DROP CONSTRAINT ticket_comments_author_id_fkey;
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);

ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);