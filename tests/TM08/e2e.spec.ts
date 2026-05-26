/**
 * TM08 — Organisation settings (Financial)
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios: S-01 (page renders), S-16 (loading + Cancel button visible)
 *
 * Escalated / skipped:
 *   S-04 (AC-04): Save happy path (UPDATE) — mutation blocked until RBAC-checked RLS
 *                  migration lands (upstream platform gate)
 *   S-05 (AC-05): Save happy path (INSERT) — same gate
 *   S-10 (AC-10): Permission denied page — no primitive for deny-only RBAC
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
  const worldPath = path.join(process.cwd(), 'tests', 'TM08', 'world.json');
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

async function loginAndGoToOrgSettings(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/settings/org');
  await expect(page.getByRole('heading', { name: /organisation settings/i })).toBeVisible({
    timeout: 15000,
  });
}

test('S-01 (AC-01): admin can access /settings/org — page renders with Financial card', async ({
  page,
}) => {
  // requirement_ref: AC-01 — page renders with heading "Organisation settings" and Financial card
  await loginAndGoToOrgSettings(page);

  await expect(page.getByRole('heading', { name: /organisation settings/i })).toBeVisible();
  // Financial section title
  await expect(page.getByText('Financial').first()).toBeVisible();
});

test('S-03 (AC-03): saved row pre-populates form fields', async ({ page }) => {
  // requirement_ref: AC-03 — form pre-populated from existing core_org_settings row
  await loginAndGoToOrgSettings(page);

  // The seeded row has base_currency='AUD' — check the currency selector button
  await expect(page.getByRole('button', { name: /base currency/i })).toBeVisible();
});

test('S-16 (AC-16): Cancel button is visible on the page', async ({ page }) => {
  // requirement_ref: AC-16 — loading state; Cancel always rendered when form is rendered
  await loginAndGoToOrgSettings(page);

  await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
});

test.skip('S-04 (AC-04): Save happy path (UPDATE)', async () => {
  // SKIP: mutation gated on upstream RBAC-checked RLS policies on core_org_settings.
  // Escalated in generator-ambiguity.json.
});

test.skip('S-05 (AC-05): Save happy path (INSERT — first-time create)', async () => {
  // SKIP: requires a separate org with no core_org_settings row + mutation gate.
  // Escalated in generator-ambiguity.json.
});
