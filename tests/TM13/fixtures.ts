/**
 * TM13 — Communications via PUMP
 * Test fixtures — lite tier
 *
 * Slice ID: TM13
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - No PUMP data seeded: CommComposer depends on PUMP Edge functions
 *     (pump-resolve-pool, pump-send, pump-load-templates, etc.) and
 *     pump_get_effective_sender_identity RPC — all require PUMP deployment gate.
 *
 * Escalated: all send/schedule/template scenarios due to PUMP Edge gate.
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM13';

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
