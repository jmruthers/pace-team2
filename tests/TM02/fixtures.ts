/**
 * TM02 — Member directory
 * Test fixtures — v1.5 primitives
 *
 * Slice ID: TM02
 * Depends on: TM01 (app shell, ToastProvider, AuthenticatedShell, navItems)
 *
 * Seeding strategy:
 *   - 1 admin user (via createTestUser) → 1 Active core_member row
 *   - 26 named persons (via createTestPerson + createTestMember) → 26 core_member rows
 *   - Total: 27 Active members, which exceeds initialPageSize (25) and enables the
 *     pagination test (S-09 / AC-09: page 1 = 25 rows, page 2 = 2 rows).
 *   - Names are seeded in non-alphabetical order to exercise default-sort logic
 *     (S-02 / AC-02): the table must render Adams before Brown before Carter.
 *   - "Smith" is included as the search target for S-07 / AC-07.
 *
 * Escalated (no primitive available):
 *   - team_member_request rows (createTestMemberRequest absent; table absent from dev-db)
 *     → Pending tab content tests (S-04, S-06) are in generator-ambiguity.json.
 *   - Membership-type rows (no createTestMembershipType) → S-08 escalated.
 *   - See generator-ambiguity.json for the full escalation list.
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

export const SLICE_ID = 'TM02';

// Seeded in non-alphabetical insertion order so the sort test (S-02) proves
// the DataTable reorders them, not just reflects insertion order.
const NAMED_PERSONS = [
  { firstName: 'Carol', lastName: 'Carter' },     // sort position 3
  { firstName: 'Zara',  lastName: 'Adams' },      // sort position 1
  { firstName: 'Alice', lastName: 'Brown' },      // sort position 2
  { firstName: 'Dan',   lastName: 'Davis' },
  { firstName: 'Eve',   lastName: 'Ellis' },
  { firstName: 'Frank', lastName: 'Foster' },
  { firstName: 'Grace', lastName: 'Garcia' },
  { firstName: 'Henry', lastName: 'Harris' },
  { firstName: 'Isla',  lastName: 'Irving' },
  { firstName: 'Jack',  lastName: 'Jones' },
  { firstName: 'Kate',  lastName: 'King' },
  { firstName: 'Leo',   lastName: 'Lewis' },
  { firstName: 'Mia',   lastName: 'Martin' },
  { firstName: 'Noah',  lastName: 'Nelson' },
  { firstName: 'Olivia',lastName: 'Owen' },
  { firstName: 'Peter', lastName: 'Parker' },
  { firstName: 'Quinn', lastName: 'Quinn' },
  { firstName: 'Rose',  lastName: 'Roberts' },
  { firstName: 'Sam',   lastName: 'Smith' },      // S-07 search target: "smit" matches "Smith"
  { firstName: 'Tina',  lastName: 'Thomas' },
  { firstName: 'Uma',   lastName: 'Underwood' },
  { firstName: 'Victor',lastName: 'Vance' },
  { firstName: 'Wendy', lastName: 'Wilson' },
  { firstName: 'Xena',  lastName: 'Xavier' },
  { firstName: 'Yara',  lastName: 'Young' },
  { firstName: 'Zoe',   lastName: 'Zhou' },
] as const;

export const NAMED_PERSON_COUNT = NAMED_PERSONS.length;   // 26
export const EXPECTED_MEMBER_COUNT = NAMED_PERSON_COUNT + 1;  // +1 for admin = 27

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);

  // Page permissions — rbac_page_permissions is per-organisation and a fresh
  // test org has none. PagePermissionGuard reads this table and denies access
  // to every page (including /members) without it. Seed before any
  // navigation-based e2e test. Default seeds read for org_admin + super_admin
  // across all TEAM pages, which is what this slice needs.
  await seedOrgPagePermissions(org.id, 'TEAM');

  // Admin — createTestUser reads password from process.env.TEST_USER_PASSWORD internally.
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  // Named persons + members created sequentially to stay within Supabase rate limits.
  const persons: Awaited<ReturnType<typeof createTestPerson>>[] = [];
  const members: Awaited<ReturnType<typeof createTestMember>>[] = [];
  const supabase = getSupabaseTestClient();

  for (const spec of NAMED_PERSONS) {
    const person = await createTestPerson(org.id, {
      firstName: spec.firstName,
      lastName: spec.lastName,
    });
    const member = await createTestMember(org.id, person.id, { membershipStatus: 'Active' });
    // core_member_role row required so rbac_select_core_member passes for org_admin viewers.
    // Without it, RLS only grants a user visibility of their own member row (via person.user_id match).
    await supabase.from('core_member_role').insert({
      member_id: member.id,
      organisation_id: org.id,
      role_id: 4, // Youth Member — any valid role_id satisfies the policy
      start_date: '2020-01-01',
    });
    persons.push(person);
    members.push(member);
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    persons,
    members,
  };
}
