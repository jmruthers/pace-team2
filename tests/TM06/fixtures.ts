/**
 * TM06 — Membership types
 * Test fixtures — lite tier
 *
 * Slice ID: TM06
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - 1 active membership type ("Junior") and 1 inactive type ("Legacy") seeded
 *     directly via service-role client (createTestMembershipType absent)
 *
 * Escalated: createTestMembershipType absent → S-02 (create) escalated
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
  getSupabaseTestClient,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM06';
export const ACTIVE_TYPE_NAME = 'Junior';
export const INACTIVE_TYPE_NAME = 'Legacy';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);
  await seedOrgPagePermissions(org.id, 'TEAM');
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  const supabase = getSupabaseTestClient();

  const { data: activeType, error: atErr } = await supabase
    .from('core_membership_type')
    .insert({ name: ACTIVE_TYPE_NAME, organisation_id: org.id, is_active: true })
    .select('id')
    .single();
  if (atErr || !activeType) {
    throw new Error(`TM06 fixture: active type insert failed: ${atErr?.message ?? 'no row'}`);
  }

  const { data: inactiveType, error: itErr } = await supabase
    .from('core_membership_type')
    .insert({ name: INACTIVE_TYPE_NAME, organisation_id: org.id, is_active: false })
    .select('id')
    .single();
  if (itErr || !inactiveType) {
    throw new Error(`TM06 fixture: inactive type insert failed: ${itErr?.message ?? 'no row'}`);
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    extras: { activeTypeId: activeType.id, inactiveTypeId: inactiveType.id },
  };
}
