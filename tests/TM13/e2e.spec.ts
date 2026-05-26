/**
 * TM13 — Communications via PUMP
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios:
 *   S-01: admin can access /communications — page renders
 *
 * Escalated / skipped:
 *   All send/schedule/template scenarios blocked by §15 PUMP Edge deployment gate.
 *   pump_get_effective_sender_identity RPC not yet deployed.
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
  const worldPath = path.join(process.cwd(), 'tests', 'TM13', 'world.json');
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

async function loginAndGoToCommunications(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/communications');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

test('S-01 (F-01): admin can access /communications — page renders', async ({ page }) => {
  // requirement_ref: F-01 — page renders for authenticated org admin
  // NOTE: CommComposer may show errors if PUMP RPCs are not deployed (sender identity fetch).
  await loginAndGoToCommunications(page);

  await expect(page).toHaveURL('/communications');
  await expect(page.getByRole('heading', { name: /communications/i }).first()).toBeVisible({
    timeout: 10000,
  });
});

test.skip('S-send: Compose and send email to org members', async () => {
  // SKIP: requires PUMP Edge functions deployment. §15 gate.
});

test.skip('S-schedule: Schedule message for future delivery', async () => {
  // SKIP: requires PUMP Edge functions deployment. §15 gate.
});
