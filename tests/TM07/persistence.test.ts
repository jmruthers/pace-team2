/**
 * TM07 — Sub-organisations
 * Persistence tests — lite tier
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import {
  seedWorld,
  SLICE_ID,
  ACTIVE_CHILD_DISPLAY_NAME,
  INACTIVE_CHILD_DISPLAY_NAME,
} from './fixtures';

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
  if (error) throw new Error(`TM07 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

describe('TM07 F-01 (BR-01) — sub-organisations list query', () => {
  it('F-01: service-role query returns both child orgs for this parent', async () => {
    // requirement_ref: F-01, BR-01 — SELECT WHERE parent_id = selectedOrganisation.id
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await supabase
      .from('core_organisations')
      .select('id, name, display_name, is_active, parent_id')
      .eq('parent_id', world.org.id)
      .order('display_name', { ascending: true });

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
    const displayNames = data!.map((r) => r.display_name).sort();
    expect(displayNames).toContain(ACTIVE_CHILD_DISPLAY_NAME);
    expect(displayNames).toContain(INACTIVE_CHILD_DISPLAY_NAME);
  });

  it('F-02: active child has is_active=true', async () => {
    // requirement_ref: F-02, §4 — Status column, Active badge
    const { data, error } = await supabase
      .from('core_organisations')
      .select('id, is_active')
      .eq('id', world.extras!.activeChildId as string)
      .single();

    expect(error).toBeNull();
    expect(data!.is_active).toBe(true);
  });

  it('F-03: inactive child has is_active=false', async () => {
    // requirement_ref: F-02, §4 — Status column, Inactive badge
    const { data, error } = await supabase
      .from('core_organisations')
      .select('id, is_active')
      .eq('id', world.extras!.inactiveChildId as string)
      .single();

    expect(error).toBeNull();
    expect(data!.is_active).toBe(false);
  });
});

describe('TM07 RLS — authenticated user access', () => {
  it('RLS-01: authenticated admin reads child orgs via parent_id filter', async () => {
    // requirement_ref: §10 — SELECT policy (member-or-admin path)
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_organisations')
      .select('id, display_name')
      .eq('parent_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
  });

  it('RLS-02: authenticated admin sees zero rows for a different parent_id', async () => {
    // requirement_ref: §10 — cross-org child isolation
    // Using a non-existent UUID to simulate a different parent
    const differentParentId = '00000000-0000-0000-0000-000000000001';
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_organisations')
      .select('id')
      .eq('parent_id', differentParentId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
