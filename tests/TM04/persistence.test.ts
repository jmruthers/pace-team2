/**
 * TM04 — Standing roles
 * Persistence tests — verify DB state and RLS against dev-db.
 *
 * Tier: lite — rls.sql omitted; RLS coverage lives here via authenticated PostgREST.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, SLICE_ID } from './fixtures';

let supabase: SupabaseClient;
let world: SeededWorld;
let userClient: SupabaseClient;

beforeAll(async () => {
  supabase = getSupabaseTestClient();
  world = await seedWorld();
  persistWorld(world, SLICE_ID);

  userClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  );
  const { error } = await userClient.auth.signInWithPassword({
    email: world.users.admin.email,
    password: process.env.TEST_USER_PASSWORD!,
  });
  if (error) throw new Error(`TM04 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

// ---------------------------------------------------------------------------
// F-04 — Role-history query
// ---------------------------------------------------------------------------

describe('TM04 F-04 (AC-01) — core_member_role + core_role_type query', () => {
  it('F-04 (AC-01): role-history query returns seeded rows joined to core_role_type', async () => {
    // requirement_ref: F-04 — role-history fetched for member ordered by start_date desc
    const { data, error } = await supabase
      .from('core_member_role')
      .select('id, start_date, end_date, organisation_id, core_role_type!inner(id, name)')
      .eq('member_id', world.members![0].id)
      .eq('organisation_id', world.org.id)
      .order('start_date', { ascending: false });

    expect(error).toBeNull();
    // 3 rows: 1 rbac setup row (role_id=4) + 1 active + 1 ended
    // We seeded 3 core_member_role rows for Jane (role_id 4 from fixture setup + active + ended)
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });

  it('F-12 (AC-16): member with zero non-setup roles returns empty for custom role types', async () => {
    // requirement_ref: F-12 — zero custom role rows → empty state for Bob
    const roleTypeId = world.extras!.roleTypeId as number;
    const { data, error } = await supabase
      .from('core_member_role')
      .select('id')
      .eq('member_id', world.members![1].id)
      .eq('organisation_id', world.org.id)
      .eq('role_id', roleTypeId);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it('F-25 (AC-02): active role has end_date null; ended role has end_date set', async () => {
    // requirement_ref: F-24, F-25 — Status badge derived from end_date
    const activeRoleId = world.extras!.activeRoleId as string;
    const endedRoleId = world.extras!.endedRoleId as string;

    const { data: activeData } = await supabase
      .from('core_member_role')
      .select('id, end_date')
      .eq('id', activeRoleId)
      .eq('organisation_id', world.org.id)
      .single();
    expect(activeData!.end_date).toBeNull();

    const { data: endedData } = await supabase
      .from('core_member_role')
      .select('id, end_date')
      .eq('id', endedRoleId)
      .eq('organisation_id', world.org.id)
      .single();
    expect(endedData!.end_date).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F-48 — RLS cross-org isolation (authenticated PostgREST)
// ---------------------------------------------------------------------------

describe('TM04 F-48 (AC-24) — RLS via authenticated user session', () => {
  it('RLS-01 (F-48): authenticated admin reads own-org role rows', async () => {
    // requirement_ref: F-48 — RLS permits SELECT on core_member_role for org members
    const { data, error } = await userClient
      .from('core_member_role')
      .select('id, organisation_id')
      .eq('member_id', world.members![0].id)
      .eq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it('RLS-02 (F-48): authenticated admin receives zero rows from different org', async () => {
    // requirement_ref: F-48 — cross-org role reads blocked by RLS
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_member_role')
      .select('id')
      .neq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
