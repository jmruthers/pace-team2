/**
 * TM01 — App shell, auth, layout
 * Persistence tests — verify DB state seeded by fixtures matches expectations.
 *
 * run_id:   019e4d63-6b73-7386-a6b9-42ae494835c8
 * slice_id: TM01
 *
 * These tests use the Supabase service-role client directly.
 * VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by
 * vitest.persistence.setup.ts before this file runs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient } from '@solvera/pace-core/test-helpers';
import { seedWorld, RUN_ID, SLICE_ID } from './fixtures';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

let supabase: SupabaseClient;
let world: SeededWorld;

beforeAll(async () => {
  // requirement_ref: AC-04 — seed an org and admin user before all persistence assertions
  supabase = getSupabaseTestClient();
  world = await seedWorld();
});

afterAll(async () => {
  // No teardown required; test data is namespace-isolated by runId + sliceId.
});

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------

describe('S-04: TM01 — core_organisations', () => {
  it('S-04 (AC-04): org row exists with display_name set', async () => {
    // requirement_ref: AC-04 — org must have name and display_name (both NOT NULL)
    // core_organisations IS the tenant boundary table; it has no organisation_id column —
    // filtering by primary key `id` is the correct and only scope available.
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data: orgRow, error: orgError } = await supabase
      .from('core_organisations')
      .select('id, name, display_name')
      .eq('id', world.org.id)
      .maybeSingle();

    expect(orgError).toBeNull();
    expect(orgRow).not.toBeNull();
    expect(orgRow!.name).toMatch(/test_e2e/);
    expect(orgRow!.display_name).not.toBeNull();
    expect(orgRow!.display_name.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Auth user + person + member chain
// ---------------------------------------------------------------------------

describe('S-02 / S-04: TM01 — admin user full chain', () => {
  it('S-02 (AC-02): admin auth user was created', async () => {
    // requirement_ref: AC-02 — admin user must have a valid Supabase auth entry
    expect(world.users.admin).toBeDefined();
    expect(world.users.admin.id).toBeTruthy();
    expect(world.users.admin.email).toMatch(/test_e2e/);
    expect(world.users.admin.role).toBe('admin');
  });

  it('S-04 (AC-04): core_person row exists for admin user', async () => {
    // requirement_ref: AC-04 — person record must exist for authenticated user
    // core_person has no organisation_id column; person↔org relationship is via core_member.
    // Filtering by user_id uniquely identifies the test user's person record.
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await supabase
      .from('core_person')
      .select('id, user_id, first_name, last_name, email')
      .eq('user_id', world.users.admin.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.user_id).toBe(world.users.admin.id);
  });

  it('S-04 (AC-04): core_member row exists linking person to org', async () => {
    // requirement_ref: AC-04 — member record must link person to org so org context can resolve
    const { data, error } = await supabase
      .from('core_member')
      .select('id, organisation_id, person_id, membership_status')
      .eq('organisation_id', world.org.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.organisation_id).toBe(world.org.id);
    expect(data!.person_id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RBAC tables — platform-global, no organisation_id filter required
// (exempt from tenant-scoped-assertions ESLint rule)
// ---------------------------------------------------------------------------

describe('S-04: TM01 — RBAC platform tables', () => {
  it('S-04 (AC-04): rbac_apps row for TEAM exists and is active', async () => {
    // requirement_ref: AC-04, §8 — TEAM app must be registered in rbac_apps before
    // PagePermissionGuard can resolve; no organisation_id column on this table
    const { data, error } = await supabase
      .from('rbac_apps')
      .select('id, name, is_active')
      .eq('name', 'TEAM')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe('TEAM');
    expect(data!.is_active).toBe(true);
  });

  it('S-04 (AC-04): rbac_app_pages row for home page is present or noted absent', async () => {
    // requirement_ref: AC-04, §8 — home page_name row needed for PagePermissionGuard;
    // absence is expected during early build and is non-fatal per requirements §8
    // no organisation_id column on rbac_app_pages — exempt from tenant-scope rule
    const { data: appRow } = await supabase
      .from('rbac_apps')
      .select('id')
      .eq('name', 'TEAM')
      .maybeSingle();

    if (!appRow) {
      // If TEAM app row is missing the RBAC page check is moot; skip gracefully
      return;
    }

    const { data, error } = await supabase
      .from('rbac_app_pages')
      .select('id, page_name, app_id')
      .eq('app_id', appRow.id)
      .eq('page_name', 'home')
      .maybeSingle();

    expect(error).toBeNull();
    // Absence is expected pre-release; just log state rather than hard-fail
    if (!data) {
      console.warn(
        'TM01 persistence: rbac_app_pages row for home not yet seeded — ' +
          'expected during early build per §8. Run post-build RBAC seeding before release.',
      );
    } else {
      expect(data.page_name).toBe('home');
    }
  });
});

// ---------------------------------------------------------------------------
// SeededWorld shape integrity
// ---------------------------------------------------------------------------

describe('F-01: TM01 — SeededWorld v1.5 shape', () => {
  it('F-01: world conforms to SeededWorld interface', async () => {
    // requirement_ref: F-fixtures — SeededWorld v1.5 shape compliance
    expect(world.runId).toBe(RUN_ID);
    expect(world.sliceId).toBe(SLICE_ID);
    expect(world.org).toBeDefined();
    expect(world.org.id).toBeTruthy();
    expect(world.users).toBeDefined();
    expect(world.users['admin']).toBeDefined();
    expect(world.users['admin'].organisationId).toBe(world.org.id);
  });
});
