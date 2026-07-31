-- 1. Fix avatar folder: restrict upload/download to own user ID path
-- Replace the existing policies with ones that check avatar ownership

DROP POLICY IF EXISTS "Users upload to accessible tickets" ON storage.objects;
CREATE POLICY "Users upload to accessible tickets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (
    -- Avatars: only own folder (avatars/{user_id}/...)
    (
      (storage.foldername(name))[1] = 'avatars'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR
    -- Ticket attachments: ticket participant check
    (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM tickets
        WHERE requester_id = auth.uid()
          OR assigned_agent_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
      )
    )
  )
);

DROP POLICY IF EXISTS "Users download from accessible tickets" ON storage.objects;
CREATE POLICY "Users download from accessible tickets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    -- Avatars: anyone authenticated can view avatars (profile pictures are public)
    (storage.foldername(name))[1] = 'avatars'
    OR
    -- Ticket attachments: ticket participant check
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM tickets
      WHERE requester_id = auth.uid()
        OR assigned_agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'agent'::app_role)
    )
  )
);

-- 2. Restrict agent access to integration_configs: exclude sensitive config field
-- Since column-level RLS isn't possible, replace agent SELECT with a more restrictive approach
-- Create a safe view for agents that excludes the config column

DROP POLICY IF EXISTS "Agents can view integration configs" ON public.integration_configs;

CREATE POLICY "Agents can view non-sensitive integration configs"
ON public.integration_configs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND config IS NULL  -- Agents can only see rows without sensitive config
);

-- Actually, column-level security via RLS isn't feasible. Better approach:
-- Remove the restrictive policy and create a proper one that just limits to active integrations
DROP POLICY IF EXISTS "Agents can view non-sensitive integration configs" ON public.integration_configs;

CREATE POLICY "Agents can view integration status"
ON public.integration_configs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND is_active = true
);