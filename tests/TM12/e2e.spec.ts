/**
 * TM12 — Profile photo moderation
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios:
 *   S-01: admin can access /moderation/photos — page renders (empty state expected)
 *
 * Escalated / skipped:
 *   S-remove: Remove photo — requires data_moderation_photo_list RPC + seeded photos
 *   S-preview: Photo preview dialog — requires photo rows
 *   All data-dependent scenarios blocked by §15 RPC + RBAC-checked RLS gate
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@solvera/pace-core/playwright';
import type { Page } from '@playwright/test';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld } from './fixtures';

test.describe.configure({ mode: 'serial' });

let world: SeededWorld;

test.beforeAll(async () => {
  const worldPath = path.join(process.cwd(), 'tests', 'TM12', 'world.json');
  const runId = process.env.TEST_RUN_ID;
  if (runId && fs.existsSync(worldPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(worldPath, 'utf8')) as SeededWorld;
      if (parsed.runId === runId) { world = parsed; return; }
    } catch (err) {
      console.warn('world.json cache miss, falling back to seedWorld()', err);
    }
  }
  world = await seedWorld();
});

async function loginAndGoToModeration(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/moderation/photos');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

test('S-01 (AC-01): admin can access /moderation/photos — page renders', async ({ page }) => {
  // requirement_ref: AC-01 — page renders for authenticated moderator
  // NOTE: With RPC not yet deployed, the page may show error or loading state.
  await loginAndGoToModeration(page);

  await expect(page).toHaveURL('/moderation/photos');
  await expect(page.getByRole('heading', { name: /photo moderation/i }).first()).toBeVisible({
    timeout: 10000,
  });
});

test.skip('S-remove: Remove photo permanently deletes file + metadata', async () => {
  // SKIP: requires data_moderation_photo_list RPC + seeded photos. §15 gate.
});
