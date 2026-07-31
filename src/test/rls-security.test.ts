import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS smoke tests against the live Supabase project using the anon key.
 * These verify that an unauthenticated client cannot read or subscribe to
 * sensitive tables — the core promise of our row-level security setup.
 *
 * If any of these expectations fail, an RLS regression has been introduced.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yoamlepdjzsjwppxhuov.supabase.co';
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYW1sZXBkanpzandwcHhodW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTMxMDcsImV4cCI6MjA4ODAyOTEwN30.M4cYFcsHEyPXl572uaRN-9VrBJ9OLEC5Ojp-LXqwJgE';

const anon = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe('RLS: anonymous clients are denied access to private data', () => {
  it('cannot read tickets', async () => {
    const { data, error } = await anon.from('tickets').select('id').limit(1);
    // Either an explicit RLS error OR an empty result set — never a row.
    expect(data ?? []).toHaveLength(0);
    if (error) expect(error.code).toBeTruthy();
  });

  it('cannot read ticket_comments', async () => {
    const { data } = await anon.from('ticket_comments').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot read ticket_attachments', async () => {
    const { data } = await anon.from('ticket_attachments').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot read notifications', async () => {
    const { data } = await anon.from('notifications').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot read audit_logs', async () => {
    const { data } = await anon.from('audit_logs').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot read user_roles of other users', async () => {
    const { data } = await anon.from('user_roles').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot insert into user_roles (privilege escalation guard)', async () => {
    const { error } = await anon
      .from('user_roles')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', role: 'admin' });
    expect(error).toBeTruthy();
  });

  it('cannot insert tickets without auth', async () => {
    const { error } = await anon.from('tickets').insert({
      title: 'unauthorized',
      description: 'should be blocked',
      requester_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeTruthy();
  });

  it('cannot insert whatsapp_messages', async () => {
    const { error } = await anon.from('whatsapp_messages').insert({
      direction: 'inbound',
      from_number: '+1', to_number: '+2', body: 'x',
    });
    expect(error).toBeTruthy();
  });

  it('cannot list ticket-attachments storage bucket', async () => {
    const { data, error } = await anon.storage.from('ticket-attachments').list();
    // Listing should be blocked OR return empty
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it('cannot list system-assets storage bucket', async () => {
    const { data, error } = await anon.storage.from('system-assets').list();
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it('cannot list email-assets storage bucket', async () => {
    const { data, error } = await anon.storage.from('email-assets').list();
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it('cannot execute internal admin RPC (approval_health_overview)', async () => {
    const { error } = await anon.rpc('approval_health_overview' as never);
    expect(error).toBeTruthy();
  });
});

describe('Realtime: anonymous subscribers receive no rows for protected tables', () => {
  it('subscribing to tickets postgres_changes yields no payloads', async () => {
    let received = 0;
    const channel = anon
      .channel('rls-test-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        received += 1;
      })
      .subscribe();

    // Wait briefly to allow any leaked events to arrive
    await new Promise((r) => setTimeout(r, 1500));
    await anon.removeChannel(channel);

    expect(received).toBe(0);
  });
});
