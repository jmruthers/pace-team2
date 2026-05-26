/**
 * TM03 — Member 360
 * Test fixtures — lite tier
 *
 * Slice ID: TM03
 * Depends on: TM01 (app shell), TM02 (directory)
 *
 * Seeding strategy:
 *   - 1 admin user (via createTestUser) → active core_member row for org access
 *   - 1 named person (Jane Doe) + Active core_member → the navigation target
 *     for e2e tests at /members/:memberId
 *   - 1 core_member_role row for Jane → satisfies rbac_select_core_member RLS
 *
 * Escalated (no primitive available):
 *   - core_member_card rows (createTestMemberCard absent) → S-15, S-16 in generator-ambiguity.json
 *   - core_contact rows (createTestContact absent) → S-13 escalated
 *   - base_application rows (createTestApplication absent) → S-17 escalated
 */

import {
  createTestOrg,
  createTestUser,
  createTestPerson,
  createTestMember,
  seedOrgPagePermissions,
  requireRunId,
  getSupabaseTestClient,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM03';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);

  // PagePermissionGuard reads rbac_page_permissions; test org is born empty.
  // Seeds read for org_admin + super_admin across all TEAM pages (includes
  // 'members' and 'member-roles') so navigation tests don't land on AccessDenied.
  await seedOrgPagePermissions(org.id, 'TEAM');

  // Admin user — org_admin RBAC role, Active membership
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  // Navigation target: a plain member the e2e tests drive to /members/:memberId
  const janePerson = await createTestPerson(org.id, { firstName: 'Jane', lastName: 'Doe' });
  const janeMember = await createTestMember(org.id, janePerson.id, { membershipStatus: 'Active' });

  // core_member_role row — rbac_select_core_member policy requires the viewed
  // member to have a role row in an org the viewer has access to.
  const supabase = getSupabaseTestClient();
  await supabase.from('core_member_role').insert({
    member_id: janeMember.id,
    organisation_id: org.id,
    role_id: 4, // Youth Member — any valid role_id satisfies the policy
    start_date: '2020-01-01',
  });

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    persons: [janePerson],
    members: [janeMember],
  };
}
