/**
 * TM09 — Org form authoring
 * Persistence tests — lite tier
 *
 * NOTE: workflow_type='org_signup' is gated by core_forms_workflow_type_check until
 * Q-DB-2 platform migration lands. Fixtures use 'information_collection' instead.
 * Tests using org_signup workflow type are escalated in generator-ambiguity.json.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, SLICE_ID, FORM_NAME } from './fixtures';

let supabase: SupabaseClient;
let world: SeededWorld;
let userClient: SupabaseClient;

beforeAll(async () => {
  supabase = getSupabaseTestClient();
  world = await seedWorld();
  persistWorld(world, SLICE_ID);

  userClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  );
  const { error } = await userClient.auth.signInWithPassword({
    email: world.users.admin.email,
    password: process.env.TEST_USER_PASSWORD!,
  });
  if (error) throw new Error(`TM09 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

describe('TM09 F-02 (AC list) — core_forms list query', () => {
  it('F-02: service-role query returns seeded form for this org', async () => {
    // requirement_ref: F-02 — page fetches all core_forms for org regardless of status/is_active
    const { data, error } = await supabase
      .from('core_forms')
      .select('id, name, workflow_type, status, is_active, organisation_id')
      .eq('organisation_id', world.org.id)
      .is('event_id', null);

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].name).toBe(FORM_NAME);
    expect(data![0].workflow_type).toBe('information_collection');
  });

  it('F-fields: service-role query returns seeded field for this form', async () => {
    // requirement_ref: F-05 — form fetch includes core_form_fields
    const { data, error } = await supabase
      .from('core_form_fields')
      .select('id, form_id, field_key, field_type, is_active')
      .eq('form_id', world.extras!.formId as string)
      .eq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].field_key).toBe('test.first_name');
    expect(data![0].field_type).toBe('text');
    expect(data![0].is_active).toBe(true);
  });
});

describe('TM09 F-02 — RLS via authenticated user', () => {
  it('RLS-01: authenticated admin reads org-scoped forms', async () => {
    // requirement_ref: F-02, §10 — SELECT policy (org-member path)
    const { data, error } = await userClient
      .from('core_forms')
      .select('id, name')
      .eq('organisation_id', world.org.id)
      .is('event_id', null);

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it('RLS-02: authenticated admin receives zero rows from different org', async () => {
    // requirement_ref: §10 — cross-org isolation
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_forms')
      .select('id')
      .neq('organisation_id', world.org.id)
      .is('event_id', null);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
