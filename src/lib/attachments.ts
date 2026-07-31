import { supabase } from '@/integrations/supabase/client';

const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes — short-lived
const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolve a downloadable URL for a ticket attachment.
 *
 * - If we have a `storage_key`, generate a fresh short-lived signed URL on demand.
 *   This means even if the URL leaks, it expires in 5 minutes AND the request still
 *   passes through Supabase Storage RLS at the moment of signing.
 * - Falls back to the legacy long-lived `file_url` for older rows that didn't
 *   record a `storage_key`. Those rows should be migrated over time.
 */
export async function getAttachmentUrl(att: {
  storage_key?: string | null;
  file_url?: string | null;
}): Promise<string | null> {
  if (att.storage_key) {
    const cached = cache.get(att.storage_key);
    if (cached && cached.expiresAt > Date.now() + 5_000) return cached.url;

    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(att.storage_key, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;

    cache.set(att.storage_key, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  }
  return att.file_url ?? null;
}

/**
 * Click handler that fetches a signed URL on demand and opens it in a new tab.
 * Use this instead of putting `att.file_url` directly in `<a href>`.
 */
export async function openAttachment(att: {
  storage_key?: string | null;
  file_url?: string | null;
  file_name?: string;
}) {
  const url = await getAttachmentUrl(att);
  if (!url) return;
  // Use noopener to prevent the opened tab from manipulating window.opener
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    // Popup blocked — fall back to navigation
    window.location.href = url;
  }
}
