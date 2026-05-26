/**
 * TM10 — Events & attendees
 * Test fixtures — lite tier
 *
 * Slice ID: TM10
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - No event rows seeded: both RPCs (app_org_event_summaries, app_org_event_attendees)
 *     are SECURITY DEFINER functions not yet deployed on dev (§15 implementation gate).
 *     Direct seeding would require inserting into core_events + base_application which
 *     is out of scope for lite-tier test primitives.
 *
 * Escalated: all data-dependent scenarios due to RPC schema gate.
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM10';

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
