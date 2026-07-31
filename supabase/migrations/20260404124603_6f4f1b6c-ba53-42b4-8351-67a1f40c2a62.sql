
-- Add new source systems for Classera modules
ALTER TYPE public.source_system ADD VALUE IF NOT EXISTS 'SIS';
ALTER TYPE public.source_system ADD VALUE IF NOT EXISTS 'EDUMALLS';
ALTER TYPE public.source_system ADD VALUE IF NOT EXISTS 'SMART_SCHOOL';
ALTER TYPE public.source_system ADD VALUE IF NOT EXISTS 'DASHBOARD';
ALTER TYPE public.source_system ADD VALUE IF NOT EXISTS 'HR';

-- Create integration_configs table for managing Classera module connections
CREATE TABLE public.integration_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_code TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description TEXT,
  api_endpoint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sync_direction TEXT NOT NULL DEFAULT 'inbound' CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
  error_message TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  tickets_received INTEGER NOT NULL DEFAULT 0,
  tickets_synced_back INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integration configs"
  ON public.integration_configs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can view integration configs"
  ON public.integration_configs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'agent'));

-- Seed Classera modules
INSERT INTO public.integration_configs (module_code, module_name, description, sync_direction) VALUES
  ('LMS', 'نظام إدارة التعلم', 'تذاكر المحتوى التعليمي والفصول الافتراضية والواجبات', 'bidirectional'),
  ('ERP', 'تخطيط الموارد', 'تذاكر الفوترة وإدارة المستخدمين والموارد المالية', 'bidirectional'),
  ('SIS', 'نظام معلومات الطلاب', 'تذاكر السجلات الأكاديمية والتسجيل والحضور', 'bidirectional'),
  ('CPAY', 'بوابة الدفع', 'تذاكر المدفوعات والاشتراكات والفواتير', 'inbound'),
  ('EDUMALLS', 'المتجر التعليمي', 'تذاكر المحتوى الرقمي والتراخيص', 'inbound'),
  ('SMART_SCHOOL', 'المدرسة الذكية', 'تذاكر إدارة المدارس والأجهزة والبنية التحتية', 'bidirectional'),
  ('DASHBOARD', 'لوحة التحكم المركزية', 'تذاكر التقارير والإحصائيات والمراقبة', 'inbound'),
  ('HR', 'الموارد البشرية', 'تذاكر شؤون الموظفين والإجازات والرواتب', 'bidirectional'),
  ('PORTAL', 'بوابة الدعم', 'التذاكر المنشأة من بوابة الدعم المباشر', 'bidirectional')
ON CONFLICT (module_code) DO NOTHING;
