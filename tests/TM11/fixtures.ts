/**
 * TM11 — Report builder
 * Test fixtures — lite tier
 *
 * Slice ID: TM11
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - No report template rows seeded for the basic check
 *   - core_field_list is platform-seeded; we verify its presence but don't seed it
 *
 * Escalated: ReportBuilder UI interactions; template save/load/delete.
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM11';

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
