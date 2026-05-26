/**
 * TM06 — Membership types
 * Persistence tests — lite tier
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, SLICE_ID, ACTIVE_TYPE_NAME, INACTIVE_TYPE_NAME } from './fixtures';

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
  if (error) throw new Error(`TM06 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

describe('TM06 F-02 (AC-01) — core_membership_type list query', () => {
  it('F-02 (AC-01): service-role query returns both seeded types for this org', async () => {
    // requirement_ref: F-02 — page fetches all membership types for org regardless of is_active
    const { data, error } = await supabase
      .from('core_membership_type')
      .select('id, name, is_active, organisation_id')
      .eq('organisation_id', world.org.id)
      .order('name', { ascending: true });

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
    expect(data!.map((r) => r.name).sort()).toEqual([ACTIVE_TYPE_NAME, INACTIVE_TYPE_NAME].sort());
  });

  it('F-15 (AC-01): active badge — active row has is_active=true', async () => {
    // requirement_ref: F-15 — "Active" badge when is_active=true
    const { data, error } = await supabase
      .from('core_membership_type')
      .select('id, name, is_active')
      .eq('id', world.extras!.activeTypeId as number)
      .eq('organisation_id', world.org.id)
      .single();

    expect(error).toBeNull();
    expect(data!.is_active).toBe(true);
  });

  it('F-15 (AC-01): inactive badge — inactive row has is_active=false', async () => {
    // requirement_ref: F-15 — "Inactive" badge when is_active=false
    const { data, error } = await supabase
      .from('core_membership_type')
      .select('id, name, is_active')
      .eq('id', world.extras!.inactiveTypeId as number)
      .eq('organisation_id', world.org.id)
      .single();

    expect(error).toBeNull();
    expect(data!.is_active).toBe(false);
  });
});

describe('TM06 F-02 (AC-01) — RLS via authenticated user', () => {
  it('RLS-01: authenticated admin reads org-scoped membership types', async () => {
    // requirement_ref: F-02, §10 — read_team_membership_types RLS policy
    const { data, error } = await userClient
      .from('core_membership_type')
      .select('id, name')
      .eq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
  });

  it('RLS-02: authenticated admin receives zero rows from different org', async () => {
    // requirement_ref: §10 — cross-org isolation
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_membership_type')
      .select('id')
      .neq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
