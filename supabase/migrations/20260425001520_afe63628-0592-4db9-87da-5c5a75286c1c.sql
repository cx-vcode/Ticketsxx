-- Add missing foreign key for approver_id so PostgREST embed works
ALTER TABLE public.approval_stages
  ADD CONSTRAINT approval_stages_approver_id_fkey
  FOREIGN KEY (approver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;