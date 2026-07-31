
-- 1) WhatsApp messages INSERT tightening
DROP POLICY IF EXISTS "System can insert whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Admins or assigned agents can insert whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    ticket_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.assigned_agent_id = auth.uid())
    )
  )
);

-- 2) Storage SELECT for ticket-attachments: include developers with access
DROP POLICY IF EXISTS "View ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "View attachments for accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Ticket attachments select" ON storage.objects;

CREATE POLICY "Ticket attachments accessible read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      JOIN public.tickets t ON t.id = ta.ticket_id
      WHERE ta.storage_key = storage.objects.name
        AND (
          t.requester_id = auth.uid()
          OR t.assigned_agent_id = auth.uid()
          OR (public.has_role(auth.uid(), 'developer'::app_role)
              AND public.developer_can_access_ticket(auth.uid(), t.id))
        )
    )
  )
);

-- 3) user_roles: explicit admin-only INSERT policy (defense in depth alongside ALL admin policy)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Restrict listing on public branding buckets (still allow individual public reads via CDN/public URL)
-- Block authenticated SELECT/list on these buckets unless admin.
CREATE POLICY "Admins only can list system-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'system-assets' AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins only can list email-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 5) Revoke EXECUTE on internal admin/diagnostic functions from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.approval_health_overview() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_ticket_approvals(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_ticket_approvals_for_service(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_approval_template(uuid, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_ticket_approval_creation(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnose_ticket_approvals(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.services_without_approval_coverage() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.services_without_assignment_group() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tickets_missing_approvals() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approval_coverage_by_service() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_approval_stages_for_service(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_approval_stages_for_prospective_ticket(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_email_notification_via_edge(uuid, text, text, text, integer, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_ticket_by_number(integer) FROM anon, authenticated;

-- Re-grant to authenticated only where the function checks roles internally and is needed by the UI:
GRANT EXECUTE ON FUNCTION public.approval_health_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_ticket_approvals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.services_without_approval_coverage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.services_without_assignment_group() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tickets_missing_approvals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_coverage_by_service() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_approval_stages_for_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_approval_stages_for_prospective_ticket(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_ticket_approvals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_ticket_approvals_for_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_approval_template(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_ticket_approval_creation(uuid, uuid) TO authenticated;
