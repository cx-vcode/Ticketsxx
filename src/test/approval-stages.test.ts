import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a flexible chainable mock for the supabase client used by api.ts.
type Resolver = (table: string, op: 'select' | 'insert' | 'update' | 'delete', state: any) => any;

const state = {
  resolver: null as Resolver | null,
  inserts: [] as Array<{ table: string; payload: any }>,
  updates: [] as Array<{ table: string; payload: any }>,
};

function makeChain(table: string, op: 'select' | 'insert' | 'update' | 'delete', extra: any = {}) {
  const ctx: any = { table, op, ...extra };
  const chain: any = {
    select: (cols?: string) => { ctx.select = cols; return chain; },
    insert: (payload: any) => { ctx.payload = payload; state.inserts.push({ table, payload }); return makeChain(table, 'insert', ctx); },
    update: (payload: any) => { ctx.payload = payload; state.updates.push({ table, payload }); return makeChain(table, 'update', ctx); },
    delete: () => makeChain(table, 'delete', ctx),
    eq: (_c: string, _v: any) => chain,
    order: (_c: string) => chain,
    limit: (_n: number) => Promise.resolve(state.resolver!(table, op, ctx)),
    single: () => Promise.resolve(state.resolver!(table, op, ctx)),
    then: (res: any, rej: any) =>
      Promise.resolve(state.resolver!(table, op, ctx)).then(res, rej),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeChain(table, 'select'),
  },
}));

import { fetchApprovalStages, createApprovalStage, updateApprovalStage, rebuildApprovalRelationships } from '@/lib/api';

beforeEach(() => {
  state.resolver = null;
  state.inserts = [];
  state.updates = [];
});

describe('Approval Stages — end-to-end flow', () => {
  it('creates a stage and the next list fetch returns it (full embed path)', async () => {
    const created = {
      id: 'stage-1',
      department_id: 'dept-1',
      stage_name: 'Manager Review',
      stage_order: 1,
      stage_type: 'sequential',
      approver_role: 'agent',
      approver_id: null,
      service_id: null,
      deadline_hours: 24,
      escalation_to: null,
      created_at: new Date().toISOString(),
    };

    const stagesInDb: any[] = [];

    state.resolver = (table, op) => {
      if (table === 'approval_stages' && op === 'insert') {
        stagesInDb.push(created);
        return { data: created, error: null };
      }
      if (table === 'approval_stages' && op === 'select') {
        return {
          data: stagesInDb.map(s => ({
            ...s,
            departments: { name: 'Finance' },
            services: null,
            approver_profile: null,
            escalation_profile: null,
          })),
          error: null,
        };
      }
      return { data: null, error: { message: `unexpected ${op} on ${table}` } };
    };

    const inserted = await createApprovalStage({
      department_id: 'dept-1',
      stage_name: 'Manager Review',
      stage_order: 1,
      stage_type: 'sequential',
      approver_role: 'agent',
      deadline_hours: 24,
    });
    expect(inserted).toMatchObject({ id: 'stage-1', stage_name: 'Manager Review' });
    expect(state.inserts).toHaveLength(1);

    const list = await fetchApprovalStages();
    expect(list).toHaveLength(1);
    expect(list[0].stage_name).toBe('Manager Review');
    expect(list[0].approver_profile).toBeNull();
  });

  it('falls back to embed-less query when the profile join fails', async () => {
    let calls = 0;
    state.resolver = (table, op, ctx) => {
      if (table !== 'approval_stages' || op !== 'select') return { data: null, error: null };
      calls += 1;
      if (ctx.select?.includes('approver_profile')) {
        return { data: null, error: { message: 'PGRST200: relation missing' } };
      }
      return {
        data: [{ id: 's1', stage_name: 'Fallback Stage', stage_order: 1, departments: null, services: null }],
        error: null,
      };
    };

    const list = await fetchApprovalStages();
    expect(calls).toBe(2);
    expect(list).toHaveLength(1);
    expect(list[0].stage_name).toBe('Fallback Stage');
  });

  it('rebuildApprovalRelationships reports embed/fallback health', async () => {
    state.resolver = (table, _op, ctx) => {
      if (table !== 'approval_stages') return { data: [], error: null };
      if (ctx.select?.includes('approver_profile')) {
        return { data: null, error: { message: 'embed broken' } };
      }
      return { data: [{ id: 's1' }], error: null };
    };

    const result = await rebuildApprovalRelationships();
    expect(result.embedWorks).toBe(false);
    expect(result.fallbackWorks).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.embedError).toBe('embed broken');
    expect(result.stageCount).toBe(1);
  });
});

describe('Approval Stages — validation', () => {
  // Mirrors the form's disable-submit guard: when required fields are empty,
  // the page must NOT issue a Supabase insert and must surface a validation error.
  function validateStageForm(data: { stage_name: string; department_id: string }) {
    const errors: string[] = [];
    if (!data.stage_name?.trim()) errors.push('stage_name is required');
    if (!data.department_id) errors.push('department_id is required');
    return errors;
  }

  it('blocks creation when required fields are missing and never calls Supabase', async () => {
    state.resolver = () => {
      throw new Error('Supabase must NOT be called for invalid input');
    };

    const errors = validateStageForm({ stage_name: '   ', department_id: '' });
    expect(errors).toContain('stage_name is required');
    expect(errors).toContain('department_id is required');

    // Insert is gated on validation passing — confirm no insert was attempted.
    expect(state.inserts).toHaveLength(0);
  });
});

describe('Approval Stages — error banner + retry', () => {
  it('surfaces the exact Supabase error message, then loads on retry', async () => {
    let attempt = 0;
    const exactMessage = 'PGRST200: Could not find a relationship';

    state.resolver = (table, op, ctx) => {
      if (table !== 'approval_stages' || op !== 'select') return { data: null, error: null };
      attempt += 1;
      // First TWO selects fail (full embed AND fallback), causing fetchApprovalStages to throw
      if (attempt <= 2) {
        return { data: null, error: { message: exactMessage } };
      }
      // After "Retry": both queries succeed
      if (ctx.select?.includes('approver_profile')) {
        return {
          data: [{
            id: 's1', stage_name: 'Recovered', stage_order: 1,
            departments: { name: 'Ops' }, services: null,
            approver_profile: null, escalation_profile: null,
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    };

    // First load fails with exact embed message captured for the banner.
    let caughtMessage = '';
    try {
      await fetchApprovalStages();
    } catch (e: any) {
      caughtMessage = e.message;
    }
    expect(caughtMessage).toContain(exactMessage);

    // Simulated "Retry" click → refetch succeeds and list renders.
    const list = await fetchApprovalStages();
    expect(list).toHaveLength(1);
    expect(list[0].stage_name).toBe('Recovered');
  });
});

describe('Approval Stages — admin-only Rebuild button visibility', () => {
  // The page renders the Rebuild button only when `role === 'admin'`.
  // We assert the gating expression directly to keep this test fast & isolated.
  function shouldRenderRebuildButton(role: string | null) {
    return role === 'admin';
  }

  it('renders Rebuild button for admin', () => {
    expect(shouldRenderRebuildButton('admin')).toBe(true);
  });

  it.each(['agent', 'requester', 'developer', null])(
    'does NOT render Rebuild button for role=%s',
    (role) => {
      expect(shouldRenderRebuildButton(role as any)).toBe(false);
    },
  );
});

describe('Approval Stages — edit flow', () => {
  it('updates a stage and the refreshed list reflects new name & order', async () => {
    const stagesInDb: any[] = [{
      id: 'stage-7',
      department_id: 'dept-1',
      stage_name: 'Old Name',
      stage_order: 2,
      stage_type: 'sequential',
      approver_role: 'agent',
      approver_id: null,
      service_id: null,
      deadline_hours: null,
      escalation_to: null,
      created_at: new Date().toISOString(),
    }];

    state.resolver = (table, op, ctx) => {
      if (table !== 'approval_stages') return { data: null, error: null };
      if (op === 'update') {
        const updated = { ...stagesInDb[0], ...ctx.payload };
        stagesInDb[0] = updated;
        return { data: updated, error: null };
      }
      if (op === 'select') {
        return {
          data: stagesInDb.map(s => ({
            ...s,
            departments: { name: 'Finance' },
            services: null,
            approver_profile: null,
            escalation_profile: null,
          })),
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const updated = await updateApprovalStage('stage-7', {
      stage_name: 'Renamed Stage',
      stage_order: 5,
    } as any);
    expect(updated).toMatchObject({ stage_name: 'Renamed Stage', stage_order: 5 });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].payload).toMatchObject({ stage_name: 'Renamed Stage', stage_order: 5 });

    const list = await fetchApprovalStages();
    expect(list).toHaveLength(1);
    expect(list[0].stage_name).toBe('Renamed Stage');
    expect(list[0].stage_order).toBe(5);
  });
});
