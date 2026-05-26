/**
 * TM12 — Profile photo moderation
 * Test fixtures — lite tier
 *
 * Slice ID: TM12
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - No photo rows seeded: data_moderation_photo_list RPC is not yet deployed (§15 gate).
 *     Seeding would require inserting into core_file_references with Supabase Storage
 *     objects which is out of scope for lite-tier test primitives.
 *
 * Escalated: all photo-dependent scenarios due to RPC + RBAC-checked RLS gate.
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM12';

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
