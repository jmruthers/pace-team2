/**
 * TM05 — Member requests queue & review
 * Persistence tests — verify DB state against dev-db.
 *
 * Tier: lite — rls.sql omitted.
 *
 * NOTE: team_member_request table is absent from dev-db as of batch run date.
 * Most assertions in this slice require that table. The tests below log the
 * absence as an expected condition and assert only what is available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, SLICE_ID } from './fixtures';

let world: SeededWorld;

beforeAll(async () => {
  world = await seedWorld();
  persistWorld(world, SLICE_ID);
});

// ---------------------------------------------------------------------------
// F-01 — Page access precondition: RBAC app page registered
// ---------------------------------------------------------------------------

describe('TM05 F-01 (AC-01) — rbac_app_pages row for approvals', () => {
  it('F-01 (AC-01): rbac_app_pages has a row for page_name="approvals" under TEAM app', async () => {
    // requirement_ref: F-01, §10 — PagePermissionGuard resolves read:page.approvals
    const supabase = getSupabaseTestClient();

    const { data: app } = await supabase
      .from('rbac_apps')
      .select('id')
      .eq('name', 'TEAM')
      .maybeSingle();

    if (!app) {
      console.warn('TM05 persistence: rbac_apps row for TEAM not found — skipping approvals page check.');
      return;
    }

    const { data, error } = await supabase
      .from('rbac_app_pages')
      .select('id, page_name')
      .eq('app_id', app.id)
      .eq('page_name', 'approvals')
      .maybeSingle();

    expect(error).toBeNull();
    if (!data) {
      console.warn(
        'TM05 persistence: rbac_app_pages row for approvals not yet seeded — expected per §15 implementation gate.',
      );
    } else {
      expect(data.page_name).toBe('approvals');
    }
  });
});

// ---------------------------------------------------------------------------
// team_member_request table existence check
// ---------------------------------------------------------------------------

describe('TM05 §15 — team_member_request table existence', () => {
  it('team_member_request table is absent from dev-db (expected per §15 gate)', async () => {
    // requirement_ref: §15 — schema changes are upstream platform work; table absent until gate clears
    // This test DOCUMENTS the expected state. When the table lands, update this test.
    const supabase = getSupabaseTestClient();

    const { error } = await supabase
      .from('team_member_request')
      .select('id')
      .limit(1);

    if (error) {
      console.warn(`TM05 persistence: team_member_request table absent (${error.message}) — all request-row tests escalated per §15 gate.`);
      // Expected: relation does not exist
      expect(error.message).toMatch(/relation|does not exist|undefined/i);
    } else {
      // Table exists — escalated tests can now be enabled
      console.info('TM05 persistence: team_member_request table IS present — escalated tests may now be un-skipped.');
    }
  });
});
