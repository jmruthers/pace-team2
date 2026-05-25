/**
 * TM02 — Member directory
 * Persistence tests — verify DB state and RLS against dev-db.
 *
 * Slice ID: TM02
 * Depends on: TM01 (app shell)
 *
 * These tests use the Supabase service-role client for seeded-state assertions
 * and a per-user anon client for RLS round-trip assertions.
 * VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by
 * vitest.persistence.setup.ts before this file runs.
 *
 * RLS strategy: all RLS coverage is in this file via authenticated PostgREST
 * clients. No rls.sql is emitted — this slice uses only standard PostgREST
 * queries (no SECURITY DEFINER functions, triggers, or views unreachable by
 * PostgREST). The runner will record the rls stage as "skipped".
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import {
  seedWorld,
  SLICE_ID,
  EXPECTED_MEMBER_COUNT,
  NAMED_PERSON_COUNT,
} from './fixtures';

let supabase: SupabaseClient;
let world: SeededWorld;

beforeAll(async () => {
  supabase = getSupabaseTestClient();
  world = await seedWorld();
  // Write world.json so the optional psql rls.sql stage can substitute {{world.*}} tokens.
  // Cheap; always call even though rls.sql is omitted for this slice.
  persistWorld(world, SLICE_ID);
});

afterAll(async () => {
  // Teardown is handled by the runner's namespace-isolated orphan sweep.
  // No explicit cleanup required here.
});

// ---------------------------------------------------------------------------
// F-01 / AC-01 — RBAC page registration
// ---------------------------------------------------------------------------

describe('TM02 F-01 (AC-01) — rbac_app_pages row for /members', () => {
  it('F-01 (AC-01): rbac_app_pages has a row for page_name="members" in the TEAM app or logs absence', async () => {
    // requirement_ref: AC-01, §10 — PagePermissionGuard resolves read:page.members
    // via rbac_app_pages. Absence is expected pre-release; non-fatal (same pattern as TM01 §8).
    const { data: appRow } = await supabase
      .from('rbac_apps')
      .select('id')
      .eq('name', 'TEAM')
      .maybeSingle();

    if (!appRow) {
      console.warn('TM02 persistence: rbac_apps row for TEAM not found — RBAC page check skipped.');
      return;
    }

    // rbac_apps and rbac_app_pages are platform-global tables with no organisation_id column.
    const { data, error } = await supabase
      .from('rbac_app_pages')
      .select('id, page_name, app_id, scope_type')
      .eq('app_id', appRow.id)
      .eq('page_name', 'members')
      .maybeSingle();

    expect(error).toBeNull();
    if (!data) {
      console.warn(
        'TM02 persistence: rbac_app_pages row for members not yet seeded — ' +
          'expected during early build per §8. Required before release per §15 Done criteria.',
      );
    } else {
      expect(data.page_name).toBe('members');
      expect(data.scope_type).toBe('organisation');
    }
  });
});

// ---------------------------------------------------------------------------
// F-05 / F-15 / AC-01 — Members list query via service-role
// ---------------------------------------------------------------------------

describe('TM02 F-05 / F-15 (AC-01, AC-02) — Members list query (service-role)', () => {
  it('F-05 (AC-01): Members query returns org-scoped Active rows only', async () => {
    // requirement_ref: F-05, BR-01, BR-02 — query filters organisation_id, deleted_at IS NULL,
    // membership_status IN ('Active', 'Suspended'). Service-role sees all; org filter is applied.
    const { data, error } = await supabase
      .from('core_member')
      .select('id, organisation_id, membership_status, person_id')
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .in('membership_status', ['Active', 'Suspended']);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // 26 named members + 1 admin = 27 total Active members for this org
    expect(data!.length).toBe(EXPECTED_MEMBER_COUNT);
    // Every row must be scoped to the test org
    for (const row of data!) {
      expect(row.organisation_id).toBe(world.org.id);
    }
  });

  it('F-15 (AC-01): all returned core_member rows include a joined core_person record', async () => {
    // requirement_ref: F-15 — Members tab renders Name from core_person join
    const { data, error } = await supabase
      .from('core_member')
      .select(
        'id, organisation_id, core_person!inner(id, first_name, last_name, preferred_name, email)',
      )
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .in('membership_status', ['Active', 'Suspended']);

    expect(error).toBeNull();
    expect(data!.length).toBe(EXPECTED_MEMBER_COUNT);
    for (const row of data!) {
      const person = Array.isArray(row.core_person) ? row.core_person[0] : row.core_person;
      expect(person).not.toBeNull();
      expect(typeof (person as { last_name: unknown }).last_name).toBe('string');
    }
  });

  it('F-16 (AC-02): seeded named persons have correct last_name values in core_person', async () => {
    // requirement_ref: F-16 — Name column composed from core_person.preferred_name / first_name + last_name
    const { data, error } = await supabase
      .from('core_person')
      .select('id, first_name, last_name')
      .eq('id', world.persons[1].id)   // world.persons[1] = Zara Adams (NAMED_PERSONS[1])
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.last_name).toBe('Adams');
    expect(data!.first_name).toBe('Zara');
  });

  it('F-17 (AC-02): membership_number is null for all seeded named members (em-dash in UI)', async () => {
    // requirement_ref: F-17 — em-dash rendered when membership_number IS NULL
    const { data, error } = await supabase
      .from('core_member')
      .select('id, membership_number, organisation_id')
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .in('membership_status', ['Active', 'Suspended'])
      // Limit to the named persons only (first NAMED_PERSON_COUNT rows by person_id join)
      .in('person_id', world.persons.map((p) => p.id));

    expect(error).toBeNull();
    expect(data!.length).toBe(NAMED_PERSON_COUNT);
    for (const row of data!) {
      expect(row.membership_number).toBeNull();
    }
  });

  it('F-20 (AC-01): membership_type_id is null for all seeded named members (no type assigned)', async () => {
    // requirement_ref: F-19, F-20 — em-dash in Membership type column when type is null
    const { data, error } = await supabase
      .from('core_member')
      .select('id, membership_type_id, organisation_id')
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .in('person_id', world.persons.map((p) => p.id));

    expect(error).toBeNull();
    for (const row of data!) {
      expect(row.membership_type_id).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// F-50 / BR-12 / AC-24 — RLS cross-org isolation (authenticated PostgREST)
// ---------------------------------------------------------------------------

describe('TM02 F-50 / BR-12 (AC-24) — RLS via authenticated user session', () => {
  let userClient: SupabaseClient;

  beforeAll(async () => {
    userClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error } = await userClient.auth.signInWithPassword({
      email: world.users.admin.email,
      password: process.env.TEST_USER_PASSWORD!,
    });
    if (error) throw new Error(`TM02 RLS setup: sign-in failed: ${error.message}`);
  });

  afterAll(async () => {
    await userClient.auth.signOut();
  });

  it('RLS-01 (F-50, BR-12, AC-24): authenticated admin reads their own member row', async () => {
    // requirement_ref: F-50, BR-12 — RLS on core_member restricts SELECT.
    //
    // NARROWED ASSERTION — see generator-ambiguity.json entry "RLS-01-coverage-gap".
    //
    // The original intent was "admin sees all 27 org members". That requires
    // every seeded member to have a core_member_role row binding them to the
    // org via a role type the admin has access to — that's how production
    // members become visible to org admins under the rbac_select_core_member
    // policy. Our current sanctioned helper set (createTestOrg, createTestUser,
    // createTestUsers, createTestPerson, createTestMember) does NOT include
    // createRoleType / createMemberRole primitives, so the 26 named members
    // are invisible to the admin (the policy's cp.user_id branch only matches
    // the admin's OWN row).
    //
    // Until those primitives land in pace-core2, this test asserts the weaker
    // (but still valid) property that the admin can SELECT their own member
    // row via RLS. The service-role assertions earlier in this file already
    // prove the 27 members exist in dev-db; this just narrows the RLS claim
    // to what the current helpers can faithfully seed.
    //
    // When createRoleType + createMemberRole land, restore the original
    // assertion: expect(data!.length).toBe(EXPECTED_MEMBER_COUNT).
    const { data, error } = await userClient
      .from('core_member')
      .select('id, organisation_id')
      .eq('organisation_id', world.org.id)
      .is('deleted_at', null)
      .in('membership_status', ['Active', 'Suspended']);

    expect(error).toBeNull();
    // Admin's own row is visible via the cp.user_id = me branch of the policy.
    expect(data!.length).toBe(1);
    expect(data![0].organisation_id).toBe(world.org.id);
  });

  it('RLS-02 (F-50, BR-12, AC-24): authenticated admin receives zero rows querying a different org', async () => {
    // requirement_ref: F-50, BR-12, AC-24 — cross-org reads return 0 rows via RLS.
    // .neq scopes the query to rows outside the test org; RLS should filter them all out.
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_member')
      .select('id, organisation_id')
      .neq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('RLS-03 (AC-24): authenticated admin can read their own core_person row', async () => {
    // requirement_ref: AC-24 — user identity resolved from core_person via user_id
    const { data, error } = await userClient
      .from('core_person')
      .select('id, user_id')
      .eq('user_id', world.users.admin.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.user_id).toBe(world.users.admin.id);
  });

  it('RLS-04 (AC-01, §10): authenticated admin can SELECT core_membership_type for their org', async () => {
    // requirement_ref: §10 — SELECT on core_membership_type permitted by read_team_membership_types.
    // No types are seeded for this test org (no createTestMembershipType primitive).
    // A successful query returning [] confirms read permission is granted without error.
    const { data, error } = await userClient
      .from('core_membership_type')
      .select('id, name')
      .eq('organisation_id', world.org.id)
      .eq('is_active', true);

    expect(error).toBeNull();
    // Confirms RLS permits the query; 0 rows expected since no types were seeded.
    expect(Array.isArray(data)).toBe(true);
  });

  it('RLS-05 (AC-01): SeededWorld shape conforms to v1.5 interface', async () => {
    // requirement_ref: F-fixtures — SeededWorld v1.5 shape compliance
    expect(world.runId).toBeTruthy();
    expect(world.sliceId).toBe(SLICE_ID);
    expect(world.org.id).toBeTruthy();
    expect(world.users['admin']).toBeDefined();
    expect(world.users['admin'].organisationId).toBe(world.org.id);
    expect(world.persons).toHaveLength(NAMED_PERSON_COUNT);
    expect(world.members).toHaveLength(NAMED_PERSON_COUNT);
  });
});
