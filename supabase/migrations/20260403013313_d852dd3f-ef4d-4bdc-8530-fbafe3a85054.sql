
-- Create tenants table for multi-tenant white-labeling
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  accent_color TEXT DEFAULT '#8b5cf6',
  custom_domain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'free',
  max_users INTEGER DEFAULT 10,
  max_tickets_per_month INTEGER DEFAULT 500,
  features JSONB DEFAULT '{"ai_copilot": true, "omni_channel": false, "custom_reports": false}'::jsonb,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Policies: owners and admins can manage their tenant
CREATE POLICY "Tenant owners can manage their tenant" ON public.tenants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Create tenant_members table to associate users with tenants
CREATE TABLE public.tenant_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own membership" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and owners can manage members" ON public.tenant_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_members.tenant_id AND owner_id = auth.uid()
  ))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_members.tenant_id AND owner_id = auth.uid()
  ));

-- Create whatsapp_messages table for tracking WhatsApp conversations
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT,
  media_url TEXT,
  twilio_sid TEXT,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role));

CREATE POLICY "System can insert whatsapp messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'agent'::app_role));
