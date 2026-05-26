/**
 * TM05 — Member requests queue & review
 * Test fixtures — lite tier
 *
 * Slice ID: TM05
 * Depends on: TM01 (app shell, Approvals nav cell)
 *
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role, Active membership
 *   - No request rows — team_member_request table is absent from dev-db;
 *     seeding would require createTestMemberRequest which does not exist.
 *     All tests that require request rows are escalated.
 *
 * Escalated (no primitive available):
 *   - createTestMemberRequest absent; team_member_request table absent from dev-db
 *     → nearly all S-NN scenarios escalated in generator-ambiguity.json
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM05';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);

  await seedOrgPagePermissions(org.id, 'TEAM');

  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
  };
}
