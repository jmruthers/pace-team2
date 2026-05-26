/**
 * TM08 — Organisation settings (Financial)
 * Test fixtures — lite tier
 *
 * Slice ID: TM08
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - 1 core_org_settings row seeded directly via service-role client
 *     (joining_fee, recurring_fee, tax_rate, base_currency, bank_account_name)
 *
 * Escalated: Save happy path (INSERT/UPDATE) requires form mutation + RBAC-checked
 *   RLS policies not yet deployed; upsert mutation gate is upstream platform work.
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
  getSupabaseTestClient,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM08';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);
  await seedOrgPagePermissions(org.id, 'TEAM');
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  const supabase = getSupabaseTestClient();

  const { data: settings, error: settingsErr } = await supabase
    .from('core_org_settings')
    .insert({
      organisation_id: org.id,
      base_currency: 'AUD',
      joining_fee: 25.0,
      recurring_fee: 10.0,
      fee_recurrence_days: 30,
      tax_rate: 0.1, // NOTE: numeric(5,4) col — app stores 0-100 pct, so >= 10.0 overflows (real-bug BUG-TM08-01)
      bank_account_name: 'Test Operating Account',
    })
    .select('id')
    .single();
  if (settingsErr || !settings) {
    throw new Error(
      `TM08 fixture: core_org_settings insert failed: ${settingsErr?.message ?? 'no row'}`,
    );
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    extras: { settingsId: settings.id },
  };
}
