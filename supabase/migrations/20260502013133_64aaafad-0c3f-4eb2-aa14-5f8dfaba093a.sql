-- =====================================================
-- INTEGRATION PLATFORM: Unified Schema
-- =====================================================

-- 1) integration_providers: catalog of supported platforms
CREATE TABLE IF NOT EXISTS public.integration_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  logo_url TEXT,
  brand_color TEXT,
  auth_type TEXT NOT NULL DEFAULT 'oauth2',
  supports_inbound BOOLEAN NOT NULL DEFAULT true,
  supports_outbound BOOLEAN NOT NULL DEFAULT true,
  supports_webhooks BOOLEAN NOT NULL DEFAULT false,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  documentation_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active providers"
ON public.integration_providers FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage providers"
ON public.integration_providers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) integration_connections: actual tenant connections
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  auth_type TEXT NOT NULL DEFAULT 'oauth2',
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_url TEXT,
  webhook_secret TEXT,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional',
  trigger_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'inactive',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  total_synced INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  retry_policy JSONB NOT NULL DEFAULT '{"max_retries": 3, "backoff_seconds": 60}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage connections"
ON public.integration_connections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agents view active connections"
ON public.integration_connections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'agent'::app_role) AND is_active = true);

CREATE INDEX idx_int_connections_provider ON public.integration_connections(provider_id);
CREATE INDEX idx_int_connections_status ON public.integration_connections(status, is_active);

-- 3) integration_field_mappings
CREATE TABLE IF NOT EXISTS public.integration_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'ticket',
  internal_field TEXT NOT NULL,
  external_field TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'bidirectional',
  transform_rule JSONB DEFAULT NULL,
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage field mappings"
ON public.integration_field_mappings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_int_mappings_connection ON public.integration_field_mappings(connection_id);

-- 4) integration_sync_logs
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL,
  direction TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  external_id TEXT,
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  http_status INTEGER,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sync logs"
ON public.integration_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_int_logs_connection_time ON public.integration_sync_logs(connection_id, created_at DESC);
CREATE INDEX idx_int_logs_status ON public.integration_sync_logs(status, created_at DESC);

-- 5) integration_events_queue (outbound queue)
CREATE TABLE IF NOT EXISTS public.integration_events_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_events_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view events queue"
ON public.integration_events_queue FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_int_queue_status_time ON public.integration_events_queue(status, scheduled_for);

-- updated_at triggers
CREATE TRIGGER trg_int_providers_updated
BEFORE UPDATE ON public.integration_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_int_connections_updated
BEFORE UPDATE ON public.integration_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Seed: 3 starter providers (Slack, Teams, Jira)
-- =====================================================
INSERT INTO public.integration_providers (code, name, display_name_ar, description, description_ar, category, brand_color, auth_type, supports_webhooks, available_events, available_actions, documentation_url, sort_order)
VALUES
('slack', 'Slack', 'سلاك',
 'Send ticket notifications and updates to Slack channels in real time.',
 'إرسال إشعارات التذاكر وتحديثاتها إلى قنوات سلاك في الوقت الفعلي.',
 'messaging', '#4A154B', 'oauth2', true,
 '["ticket.created","ticket.assigned","ticket.status_changed","ticket.commented","ticket.resolved","sla.breached"]'::jsonb,
 '["send_message","create_channel","update_message","add_reaction"]'::jsonb,
 'https://api.slack.com/', 1),

('microsoft_teams', 'Microsoft Teams', 'مايكروسوفت تيمز',
 'Post ticket activity to Teams channels and create Adaptive Cards for quick actions.',
 'نشر نشاط التذاكر في قنوات تيمز وإنشاء بطاقات تفاعلية للإجراءات السريعة.',
 'messaging', '#5059C9', 'oauth2', true,
 '["ticket.created","ticket.assigned","ticket.status_changed","ticket.commented","sla.breached"]'::jsonb,
 '["send_message","create_card","mention_user"]'::jsonb,
 'https://learn.microsoft.com/en-us/microsoftteams/platform/', 2),

('jira', 'Jira', 'جيرا',
 'Create Jira issues automatically from tickets and sync status changes both ways.',
 'إنشاء مهام جيرا تلقائياً من التذاكر ومزامنة تغييرات الحالة في الاتجاهين.',
 'project_management', '#0052CC', 'oauth2', true,
 '["ticket.created","ticket.status_changed","ticket.priority_changed","ticket.resolved"]'::jsonb,
 '["create_issue","update_issue","transition_status","add_comment","link_issue"]'::jsonb,
 'https://developer.atlassian.com/cloud/jira/platform/', 3)
ON CONFLICT (code) DO NOTHING;