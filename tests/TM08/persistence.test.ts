/**
 * TM08 — Organisation settings (Financial)
 * Persistence tests — lite tier
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestClient, persistWorld } from '@solvera/pace-core/test-helpers';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, SLICE_ID } from './fixtures';

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
  if (error) throw new Error(`TM08 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

describe('TM08 F-02/F-03 (AC-01/AC-03) — core_org_settings read', () => {
  it('F-02 (AC-01): service-role query returns seeded settings row', async () => {
    // requirement_ref: F-02 — SELECT filtered by organisation_id
    const { data, error } = await supabase
      .from('core_org_settings')
      .select(
        'id, organisation_id, base_currency, joining_fee, recurring_fee, fee_recurrence_days, tax_rate, bank_account_name',
      )
      .eq('organisation_id', world.org.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('F-03 (AC-03): saved row has expected financial field values', async () => {
    // requirement_ref: F-03 — form pre-populated from stored row
    const { data, error } = await supabase
      .from('core_org_settings')
      .select('base_currency, joining_fee, recurring_fee, fee_recurrence_days, tax_rate')
      .eq('organisation_id', world.org.id)
      .single();

    expect(error).toBeNull();
    expect(data!.base_currency).toBe('AUD');
    expect(Number(data!.joining_fee)).toBeCloseTo(25.0, 2);
    expect(Number(data!.recurring_fee)).toBeCloseTo(10.0, 2);
    expect(data!.fee_recurrence_days).toBe(30);
    expect(Number(data!.tax_rate)).toBeCloseTo(0.1, 4); // column numeric(5,4); real-bug BUG-TM08-01: app sends 0-100 but col max is 9.9999
  });

  it('AC-17: nullable optional fields default to NULL when not set', async () => {
    // requirement_ref: AC-17 — empty optional fields persist as SQL NULL
    const { data, error } = await supabase
      .from('core_org_settings')
      .select('bank_bsb, bank_account_number')
      .eq('organisation_id', world.org.id)
      .single();

    expect(error).toBeNull();
    expect(data!.bank_bsb).toBeNull();
    expect(data!.bank_account_number).toBeNull();
  });
});

describe('TM08 RLS — authenticated user access', () => {
  it('RLS-01: authenticated admin reads org settings row', async () => {
    // requirement_ref: §10 — SELECT policy (org member path)
    const { data, error } = await userClient
      .from('core_org_settings')
      .select('id, base_currency')
      .eq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].base_currency).toBe('AUD');
  });

  it('RLS-02: authenticated admin gets zero rows from different org', async () => {
    // requirement_ref: §10 — cross-org isolation
    // eslint-disable-next-line pace-core-compliance/tenant-scoped-assertions
    const { data, error } = await userClient
      .from('core_org_settings')
      .select('id')
      .neq('organisation_id', world.org.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
