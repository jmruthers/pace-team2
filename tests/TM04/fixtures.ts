/**
 * TM04 — Standing roles
 * Test fixtures — lite tier
 *
 * Slice ID: TM04
 * Depends on: TM01 (app shell), TM03 (Member 360 entry)
 *
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role + Active member
 *   - 1 named person (Jane Doe) + Active core_member → navigation target
 *   - 1 core_role_type row for the test org ("Coach") — seeded via service-role
 *     because no createTestRoleType primitive exists
 *   - 1 active core_member_role row (no end_date) — exercises S-01, S-02 badge
 *   - 1 ended core_member_role row (end_date set) — exercises S-02 Ended badge
 *   - 1 second named member (Bob Role) with zero role rows — exercises S-16 empty state
 *
 * Escalated (no primitive available):
 *   - Add-role form flows (S-04, S-05) — require UI mutation tests needing full
 *     role-type selection; escalated in generator-ambiguity.json
 *   - End-role dialog flows (S-09, S-10, S-11) — mutation tests escalated
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

export const SLICE_ID = 'TM04';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);

  await seedOrgPagePermissions(org.id, 'TEAM');

  // seedOrgPagePermissions only seeds 'read'; add 'update' so canUpdate=true in MemberRolesPage
  const supabaseEarly = getSupabaseTestClient();
  const { data: memberRolesPage } = await supabaseEarly
    .from('rbac_app_pages')
    .select('id')
    .eq('page_name', 'member-roles')
    .eq('scope_type', 'organisation')
    .maybeSingle();
  if (memberRolesPage) {
    await supabaseEarly.from('rbac_page_permissions').insert([
      { app_page_id: memberRolesPage.id, operation: 'update', role_name: 'org_admin', allowed: true, organisation_id: org.id },
      { app_page_id: memberRolesPage.id, operation: 'update', role_name: 'super_admin', allowed: true, organisation_id: org.id },
    ]);
  }

  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  // Primary navigation target (Jane Doe — has two role rows for table rendering)
  const janePerson = await createTestPerson(org.id, { firstName: 'Jane', lastName: 'Doe' });
  const janeMember = await createTestMember(org.id, janePerson.id, { membershipStatus: 'Active' });

  // Second member (Bob Role — zero role rows, for empty-state test)
  const bobPerson = await createTestPerson(org.id, { firstName: 'Bob', lastName: 'Role' });
  const bobMember = await createTestMember(org.id, bobPerson.id, { membershipStatus: 'Active' });

  const supabase = getSupabaseTestClient();

  // core_member_role rows required for org_admin to view Jane's member row (RLS)
  await supabase.from('core_member_role').insert({
    member_id: janeMember.id,
    organisation_id: org.id,
    role_id: 4, // Youth Member — satisfies rbac_select_core_member policy
    start_date: '2020-01-01',
  });
  // Also for Bob
  await supabase.from('core_member_role').insert({
    member_id: bobMember.id,
    organisation_id: org.id,
    role_id: 4,
    start_date: '2020-01-01',
  });

  // Seed a core_role_type row for the test org so the Add-role dropdown is non-empty
  // and the standing roles table has at least one recognisable role name.
  const { data: roleType, error: rtErr } = await supabase
    .from('core_role_type')
    .insert({ name: 'Coach', organisation_id: org.id })
    .select('id, name')
    .single();
  if (rtErr || !roleType) {
    throw new Error(`TM04 fixture: core_role_type insert failed: ${rtErr?.message ?? 'no row'}`);
  }

  // Active role row for Jane
  const { data: activeRole, error: arErr } = await supabase
    .from('core_member_role')
    .insert({
      member_id: janeMember.id,
      organisation_id: org.id,
      role_id: roleType.id,
      start_date: '2023-01-15',
    })
    .select('id')
    .single();
  if (arErr || !activeRole) {
    throw new Error(`TM04 fixture: active role insert failed: ${arErr?.message ?? 'no row'}`);
  }

  // Ended role row for Jane (older, so it sorts below the active row)
  const { data: endedRole, error: erErr } = await supabase
    .from('core_member_role')
    .insert({
      member_id: janeMember.id,
      organisation_id: org.id,
      role_id: roleType.id,
      start_date: '2020-03-01',
      end_date: '2022-12-31',
    })
    .select('id')
    .single();
  if (erErr || !endedRole) {
    throw new Error(`TM04 fixture: ended role insert failed: ${erErr?.message ?? 'no row'}`);
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    persons: [janePerson, bobPerson],
    members: [janeMember, bobMember],
    extras: {
      roleTypeId: roleType.id,
      activeRoleId: activeRole.id,
      endedRoleId: endedRole.id,
    },
  };
}
