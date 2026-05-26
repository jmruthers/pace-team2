/**
 * TM07 — Sub-organisations
 * Test fixtures — lite tier
 *
 * Slice ID: TM07
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - 2 child orgs seeded directly via service-role client (INSERT into core_organisations
 *     with parent_id = org.id). Names are globally unique via runId.
 *   - Active child: is_active = true
 *   - Inactive child: is_active = false
 *
 * Escalated: createTestSubOrg absent → S-03/S-06 (create dialog), S-07/S-08 (edit dialog)
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
  getSupabaseTestClient,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM07';
export const ACTIVE_CHILD_DISPLAY_NAME = 'Active Child Org';
export const INACTIVE_CHILD_DISPLAY_NAME = 'Inactive Child Org';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);
  await seedOrgPagePermissions(org.id, 'TEAM');
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  const supabase = getSupabaseTestClient();

  const activeChildName = `tm07-active-${runId}`;
  const inactiveChildName = `tm07-inactive-${runId}`;

  const { data: activeChild, error: acErr } = await supabase
    .from('core_organisations')
    .insert({
      name: activeChildName,
      display_name: ACTIVE_CHILD_DISPLAY_NAME,
      is_active: true,
      parent_id: org.id,
    })
    .select('id')
    .single();
  if (acErr || !activeChild) {
    throw new Error(`TM07 fixture: active child insert failed: ${acErr?.message ?? 'no row'}`);
  }

  const { data: inactiveChild, error: icErr } = await supabase
    .from('core_organisations')
    .insert({
      name: inactiveChildName,
      display_name: INACTIVE_CHILD_DISPLAY_NAME,
      is_active: false,
      parent_id: org.id,
    })
    .select('id')
    .single();
  if (icErr || !inactiveChild) {
    throw new Error(`TM07 fixture: inactive child insert failed: ${icErr?.message ?? 'no row'}`);
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    extras: {
      activeChildId: activeChild.id,
      inactiveChildId: inactiveChild.id,
      activeChildName,
      inactiveChildName,
    },
  };
}
