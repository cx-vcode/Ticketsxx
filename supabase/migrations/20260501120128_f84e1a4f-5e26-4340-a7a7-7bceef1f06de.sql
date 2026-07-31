
-- ============================================================
-- 1) Storage: branding buckets (system-assets, email-assets)
-- ============================================================

-- Drop broad public listing policies
DROP POLICY IF EXISTS "Anyone can view system assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view email assets" ON storage.objects;

-- Add WITH CHECK to admin upload policies
DROP POLICY IF EXISTS "Admins can upload system assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload email assets" ON storage.objects;

CREATE POLICY "Admins can upload system assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'system-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload email assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2) Storage: ticket-attachments — single canonical SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Users download from accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Ticket attachments accessible read" ON storage.objects;

CREATE POLICY "Ticket attachments accessible read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    -- Avatar folder is per-user
    ((storage.foldername(name))[1] = 'avatars'
      AND (storage.foldername(name))[2] = auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::app_role)
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
    -- Fallback: folder-based access for legacy rows where storage_key is NULL
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          t.requester_id = auth.uid()
          OR t.assigned_agent_id = auth.uid()
          OR (public.has_role(auth.uid(), 'developer'::app_role)
              AND public.developer_can_access_ticket(auth.uid(), t.id))
        )
    )
  )
);

-- ============================================================
-- 3) Revoke execute on trigger-only DEFINER functions
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.auto_assign_ticket() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_ticket_approvals() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fallback_approval_to_manager() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_approval_decision() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_comment_added() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_ticket_department_from_service() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_ticket_to_classera() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_service_backfill_approvals() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.send_email_notification_via_edge(uuid, text, text, text, integer, text, text) FROM anon, authenticated, public;

-- helper utilities only used internally
REVOKE EXECUTE ON FUNCTION public.find_ticket_by_number(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_ticket_by_number(integer) TO authenticated;
