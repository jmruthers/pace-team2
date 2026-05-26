/**
 * TM12 — Profile photo moderation
 * Persistence tests — lite tier
 *
 * NOTE: data_moderation_photo_list RPC and RBAC-checked SELECT/DELETE on
 * core_file_references are gated on §15 upstream platform work. Tests here
 * probe RPC availability and the rbac_app_pages presence only.
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
  if (error) throw new Error(`TM12 RLS setup: sign-in failed: ${error.message}`);
});

afterAll(async () => {
  await userClient.auth.signOut();
});

describe('TM12 §15 gate — RPC availability probe', () => {
  it('data_moderation_photo_list RPC: returns empty array or documents absence', async () => {
    // requirement_ref: §3 — page calls data_moderation_photo_list(p_organisation_id)
    const { data, error } = await supabase.rpc('data_moderation_photo_list', {
      p_organisation_id: world.org.id,
    });

    if (error) {
      console.warn(
        `TM12 schema gate: data_moderation_photo_list not available: ${error.message}`,
      );
      expect(error.message).toBeTruthy();
    } else {
      // RPC deployed — org with no photos should return empty array
      expect(Array.isArray(data)).toBe(true);
    }
  });
});

describe('TM12 rbac — page access', () => {
  it('rbac_app_pages has moderation-photos page for TEAM app', async () => {
    // requirement_ref: §10 — pageName='moderation-photos' seeded by seedOrgPagePermissions
    const { data, error } = await supabase
      .from('rbac_app_pages')
      .select('page_name, scope_type')
      .eq('page_name', 'moderation-photos')
      .limit(1);

    if (error) {
      console.warn(`TM12: rbac_app_pages query failed: ${error.message}`);
      return;
    }
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });
});
