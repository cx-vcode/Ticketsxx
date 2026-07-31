
-- ========================================
-- 1. ENUMS
-- ========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'requester');

CREATE TYPE public.ticket_status AS ENUM (
  'new', 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'reopened'
);

CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE public.note_type AS ENUM ('public', 'private');

-- ========================================
-- 2. PROFILES TABLE
-- ========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 3. USER ROLES TABLE
-- ========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'requester',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. SECURITY DEFINER FUNCTIONS
-- ========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ========================================
-- 5. DEPARTMENTS TABLE
-- ========================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Insert default departments
INSERT INTO public.departments (name, description) VALUES
  ('تقنية المعلومات', 'دعم تقني وبرمجيات'),
  ('الشبكات', 'مشاكل الشبكات والاتصالات'),
  ('الأجهزة', 'صيانة الأجهزة والطابعات'),
  ('الصلاحيات', 'إدارة الصلاحيات والحسابات'),
  ('عام', 'استفسارات عامة');

-- ========================================
-- 6. TICKETS TABLE
-- ========================================
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  department_id UUID REFERENCES public.departments(id),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tickets_requester ON public.tickets(requester_id);
CREATE INDEX idx_tickets_agent ON public.tickets(assigned_agent_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_department ON public.tickets(department_id);

-- ========================================
-- 7. TICKET COMMENTS TABLE
-- ========================================
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  note_type note_type NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comments_ticket ON public.ticket_comments(ticket_id);

-- ========================================
-- 8. TICKET ATTACHMENTS TABLE
-- ========================================
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 9. AUDIT LOG TABLE
-- ========================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_ticket ON public.audit_logs(ticket_id);

-- ========================================
-- 10. NOTIFICATIONS TABLE
-- ========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, is_read);

-- ========================================
-- 11. STORAGE BUCKET FOR ATTACHMENTS
-- ========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true);

-- ========================================
-- 12. RLS POLICIES
-- ========================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DEPARTMENTS
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- TICKETS
CREATE POLICY "Requesters see own tickets" ON public.tickets FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
CREATE POLICY "Agents see assigned or unassigned tickets" ON public.tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agent') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Requesters can create tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Agents and admins can update tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'agent') OR public.has_role(auth.uid(), 'admin') OR requester_id = auth.uid());

-- TICKET COMMENTS
CREATE POLICY "Public comments visible to ticket participants" ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    note_type = 'public' OR
    public.has_role(auth.uid(), 'agent') OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Authenticated users can add comments" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- TICKET ATTACHMENTS
CREATE POLICY "View attachments for accessible tickets" ON public.ticket_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Upload attachments" ON public.ticket_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- AUDIT LOGS
CREATE POLICY "Agents and admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agent') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- STORAGE POLICIES
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');

-- ========================================
-- 13. TRIGGERS
-- ========================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'requester');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
