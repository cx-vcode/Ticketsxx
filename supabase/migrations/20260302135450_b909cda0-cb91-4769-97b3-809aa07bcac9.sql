
-- Add foreign key for approver_id to profiles for join support
ALTER TABLE public.ticket_approvals
ADD CONSTRAINT ticket_approvals_approver_id_fkey
FOREIGN KEY (approver_id) REFERENCES public.profiles(id);
