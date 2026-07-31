
-- Source system enum
CREATE TYPE public.source_system AS ENUM ('PORTAL', 'ERP', 'LMS', 'CPAY');

-- Systems table (ERP, LMS, CPAY, etc.)
CREATE TABLE public.systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view systems"
ON public.systems FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage systems"
ON public.systems FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Services / Modules table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_assignment_group UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  sla_policy_id UUID REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view services"
ON public.services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage services"
ON public.services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service categories (subcategories)
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view categories"
ON public.service_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
ON public.service_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Update tickets table with new fields
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS source_system public.source_system NOT NULL DEFAULT 'PORTAL';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS external_payload JSONB;

-- Unique constraint on external reference per source system to prevent duplicates
CREATE UNIQUE INDEX idx_tickets_external_ref ON public.tickets (source_system, external_reference) WHERE external_reference IS NOT NULL;

-- Seed systems
INSERT INTO public.systems (code, name, description) VALUES
  ('ERP', 'نظام ERP', 'نظام تخطيط موارد المؤسسة'),
  ('LMS', 'المنصة التعليمية', 'نظام إدارة التعلم'),
  ('CPAY', 'CPAY', 'نظام الدفع الإلكتروني');

-- Seed ERP services
INSERT INTO public.services (system_id, name) VALUES
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'الدخل'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'الموارد البشرية'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'حسابات الطلاب'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'الحسابات العامة'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'المستودعات'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'التوظيف'),
  ((SELECT id FROM public.systems WHERE code = 'ERP'), 'التسجيل الإلكتروني');

-- Seed LMS service
INSERT INTO public.services (system_id, name) VALUES
  ((SELECT id FROM public.systems WHERE code = 'LMS'), 'المنصة التعليمية');

-- Seed CPAY service
INSERT INTO public.services (system_id, name) VALUES
  ((SELECT id FROM public.systems WHERE code = 'CPAY'), 'نظام الدفع');
