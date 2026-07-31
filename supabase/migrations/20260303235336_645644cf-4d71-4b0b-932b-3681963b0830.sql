
ALTER TABLE public.tickets DROP CONSTRAINT tickets_requester_id_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT tickets_assigned_agent_id_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_requester_id_fkey
FOREIGN KEY (requester_id) REFERENCES public.profiles(id);

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_assigned_agent_id_fkey
FOREIGN KEY (assigned_agent_id) REFERENCES public.profiles(id);
