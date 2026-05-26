/**
 * TM09 — Org form authoring
 * Test fixtures — lite tier
 *
 * Slice ID: TM09
 * Seeding strategy:
 *   - 1 admin user → org_admin RBAC role
 *   - 1 core_forms row (workflow_type='information_collection') + 1 core_form_fields row
 *     seeded directly via service-role client.
 *   - NOTE: workflow_type='org_signup' is gated by core_forms_workflow_type_check until
 *     Q-DB-2 platform migration lands. Using 'information_collection' for fixture.
 *
 * Escalated: Create/Edit/Delete form mutations; org_signup type gate; RPC delete-dependency check
 */

import {
  createTestOrg,
  createTestUser,
  seedOrgPagePermissions,
  requireRunId,
  getSupabaseTestClient,
} from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

export const SLICE_ID = 'TM09';
export const FORM_NAME = 'TM09 Information Form';

export async function seedWorld(): Promise<SeededWorld> {
  const runId = requireRunId();
  const org = await createTestOrg(runId, SLICE_ID);
  await seedOrgPagePermissions(org.id, 'TEAM');
  const admin = await createTestUser(runId, SLICE_ID, 'admin', org.id);

  const supabase = getSupabaseTestClient();

  const formSlug = `tm09-info-form-${runId.toLowerCase()}`;

  const { data: form, error: formErr } = await supabase
    .from('core_forms')
    .insert({
      name: FORM_NAME,
      slug: formSlug,
      workflow_type: 'information_collection',
      status: 'draft',
      is_active: false,
      is_primary_entrypoint: false,
      access_mode: 'authenticated_member',
      organisation_id: org.id,
      event_id: null,
    })
    .select('id')
    .single();
  if (formErr || !form) {
    throw new Error(`TM09 fixture: core_forms insert failed: ${formErr?.message ?? 'no row'}`);
  }

  const { data: field, error: fieldErr } = await supabase
    .from('core_form_fields')
    .insert({
      form_id: form.id,
      field_key: 'test.first_name',
      field_label: 'First name',
      field_type: 'text',
      is_required: true,
      is_active: true,
      sort_order: 1,
      organisation_id: org.id,
    })
    .select('id')
    .single();
  if (fieldErr || !field) {
    throw new Error(
      `TM09 fixture: core_form_fields insert failed: ${fieldErr?.message ?? 'no row'}`,
    );
  }

  return {
    runId,
    sliceId: SLICE_ID,
    org,
    users: { admin },
    extras: { formId: form.id, fieldId: field.id, formSlug },
  };
}
