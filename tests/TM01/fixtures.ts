/**
 * TM01 — App shell, auth, layout
 * Test fixtures — v1.5 primitives
 *
 * run_id:   019e4d63-6b73-7386-a6b9-42ae494835c8
 * slice_id: TM01
 */

import {
  createTestOrg,
  createTestUser,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const RUN_ID = '019e4d63-6b73-7386-a6b9-42ae494835c8';
export const SLICE_ID = 'TM01';

/**
 * seedWorld — seeds a minimal org + admin user for TM01 e2e and persistence
 * tests.
 *
 * The admin role is used as the default authenticated user for scenarios that
 * only require a valid authenticated session with org context (S-01 through
 * S-16, excluding the escalated scenarios S-05, S-06, S-17, S-18).
 */
export async function seedWorld(): Promise<SeededWorld> {
  // requirement_ref: AC-04 — home page requires an authenticated user with org membership

  const org = await createTestOrg(RUN_ID, SLICE_ID);

  const adminUser = await createTestUser(
    RUN_ID,
    SLICE_ID,
    'admin',
    org.id,
    process.env.TEST_USER_PASSWORD,
  );

  return {
    runId: RUN_ID,
    sliceId: SLICE_ID,
    org,
    users: {
      admin: adminUser,
    },
  };
}
