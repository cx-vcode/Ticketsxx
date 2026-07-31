-- Add new columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text DEFAULT 'السعودية';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date date;

-- Notification preferences columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_ticket_created boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_ticket_assigned boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_status_changed boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_comment_added boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_sla_breach boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_approval boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_weekly_report boolean DEFAULT true;