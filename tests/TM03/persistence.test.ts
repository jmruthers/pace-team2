/**
 * TM03 — Member 360
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
  if (error) throw new Error(`TM03 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

// ---------------------------------------------------------------------------
// F-02 — Member 360 member fetch query
// ---------------------------------------------------------------------------

describe('TM03 F-02 (AC-01) — core_member + core_person fetch for navigation target', () => {
  it('F-02 (AC-01): member query returns single org-scoped row joined to core_person', async () => {
    // requirement_ref: F-02 — member fetch: core_member joined to core_person filtered by id + org
    const { data, error } = await supabase
      .from('core_member')
      .select('id, organisation_id, membership_status, core_person!inner(id, first_name, last_name)')
      .eq('id', world.members![0].id)
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.organisation_id).toBe(world.org.id);
    const person = Array.isArray(data!.core_person) ? data!.core_person[0] : data!.core_person;
    expect((person as { last_name: unknown }).last_name).toBe('Doe');
    expect((person as { first_name: unknown }).first_name).toBe('Jane');
  });

  it('F-10 (AC-10): unknown member id returns zero rows (member-not-found path)', async () => {
    // requirement_ref: F-10 — zero rows → "Member not found" page
    const { data, error } = await supabase
      .from('core_member')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .eq('organisation_id', world.org.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('F-74 (AC-01): cross-org member id returns zero rows for this org (service-role)', async () => {
    // requirement_ref: F-74 — defensive org filter prevents cross-org member leak
    const { data, error } = await supabase
      .from('core_member')
      .select('id')
      .eq('id', world.members![0].id)
      .eq('organisation_id', '00000000-0000-0000-0000-000000000002')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F-02 / F-11 — contacts query empty state
// ---------------------------------------------------------------------------

describe('TM03 F-11 (AC-14) — contacts query returns empty for unseeded member', () => {
  it('F-11 (AC-14): core_contact query for unseeded member returns zero rows', async () => {
    // requirement_ref: F-11 — empty contacts → "No additional contacts recorded."
    const { data, error } = await supabase
      .from('core_contact')
      .select('id')
      .eq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// F-74 / F-75 — RLS cross-org isolation (authenticated PostgREST)
// ---------------------------------------------------------------------------

describe('TM03 F-74 / F-75 (AC-24) — RLS via authenticated user session', () => {
  it('RLS-01 (F-74, AC-24): authenticated admin reads own-org member row', async () => {
    // requirement_ref: F-74 — RLS permits SELECT for org members
    const { data, error } = await userClient
      .from('core_member')
      .select('id, organisation_id')
      .eq('id', world.members![0].id)
      .eq('organisation_id', world.org.id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.organisation_id).toBe(world.org.id);
  });

  it('RLS-02 (F-74, AC-24): authenticated admin receives zero rows querying a different org', async () => {
    // requirement_ref: F-74, F-75 — cross-org reads return 0 rows via RLS
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_member')
      .select('id, organisation_id')
      .neq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('RLS-03 (F-02, AC-24): authenticated admin can read own core_person row', async () => {
    // requirement_ref: F-02 — member resolved from core_person via user_id
    const { data, error } = await userClient
      .from('core_person')
      .select('id, user_id')
      .eq('user_id', world.users.admin.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.user_id).toBe(world.users.admin.id);
  });
});
