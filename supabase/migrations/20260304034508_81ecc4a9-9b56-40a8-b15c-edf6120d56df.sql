
-- 1. PROFILES: Restrict to own profile, admin/agent/developer, or ticket participants
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view relevant profiles" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'agent')
  OR has_role(auth.uid(), 'developer')
  OR EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.requester_id = auth.uid()
    AND (tickets.assigned_agent_id = profiles.id OR tickets.requester_id = profiles.id)
  )
);

-- 2. TICKET_RATINGS: Restrict to ticket participants + admin/agent
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ticket_ratings;

CREATE POLICY "Ticket participants and staff can view ratings" ON public.ticket_ratings
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'agent')
  OR EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_ratings.ticket_id
    AND (tickets.requester_id = auth.uid() OR tickets.assigned_agent_id = auth.uid())
  )
);

-- 3. SYSTEM_SETTINGS: Only expose safe UI keys to all, rest admin-only
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.system_settings;

CREATE POLICY "Anyone can view public UI settings" ON public.system_settings
FOR SELECT USING (
  key IN ('system_name', 'system_subtitle', 'primary_color', 'accent_color', 'logo_url')
  OR has_role(auth.uid(), 'admin')
);

-- 4. TICKET_FIELD_VALUES: Restrict to ticket participants + admin/agent
DROP POLICY IF EXISTS "Anyone authenticated can view field values" ON public.ticket_field_values;

CREATE POLICY "Ticket participants and staff can view field values" ON public.ticket_field_values
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'agent')
  OR has_role(auth.uid(), 'developer')
  OR EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_field_values.ticket_id
    AND tickets.requester_id = auth.uid()
  )
);

-- 5. SLA_POLICIES: Restrict to admin/agent only
DROP POLICY IF EXISTS "Anyone authenticated can view SLA policies" ON public.sla_policies;

CREATE POLICY "Admins and agents can view SLA policies" ON public.sla_policies
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'agent')
);

-- 6. APPROVAL_STAGES: Restrict to admin/agent + requesters with relevant tickets
DROP POLICY IF EXISTS "Authenticated can view approval stages" ON public.approval_stages;

CREATE POLICY "Staff and relevant requesters can view approval stages" ON public.approval_stages
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'agent')
  OR EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.requester_id = auth.uid()
    AND tickets.department_id = approval_stages.department_id
  )
);
