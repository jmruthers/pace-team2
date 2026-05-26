/**
 * TM07 — Sub-organisations
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios: S-01 (page loads with seeded child orgs), S-02 (Create button visible)
 *
 * Escalated / skipped:
 *   S-03 (AC-03): Create dialog saves new child org — form mutation test; unique-name
 *                  constraint testing hard to isolate
 *   S-06 (AC-06): Edit happy path — dialog mutation test
 *   S-07 (AC-07): Edit — name read-only field — dialog state inspection
 *   S-08 (AC-08): Deactivate — toggle + save + cascade check
 *   S-09 (AC-09): AccessDenied — no primitive to seed deny-only RBAC
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@solvera/pace-core/playwright';
import type { Page } from '@playwright/test';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, ACTIVE_CHILD_DISPLAY_NAME, INACTIVE_CHILD_DISPLAY_NAME } from './fixtures';

test.describe.configure({ mode: 'serial' });

let world: SeededWorld;

test.beforeAll(async () => {
  const worldPath = path.join(process.cwd(), 'tests', 'TM07', 'world.json');
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

async function loginAndGoToSubOrgs(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/settings/organisations');
  await expect(page.getByText(ACTIVE_CHILD_DISPLAY_NAME)).toBeVisible({ timeout: 15000 });
}

test('S-01 (AC-01): admin can access /settings/organisations — table renders with seeded child orgs', async ({
  page,
}) => {
  // requirement_ref: AC-01 — page renders with sub-organisations DataTable
  await loginAndGoToSubOrgs(page);

  await expect(page.getByText(ACTIVE_CHILD_DISPLAY_NAME)).toBeVisible();
  await expect(page.getByText(INACTIVE_CHILD_DISPLAY_NAME)).toBeVisible();

  // Active/Inactive status badges visible
  await expect(page.getByText('Active').first()).toBeVisible();
  await expect(page.getByText('Inactive').first()).toBeVisible();
});

test('S-02 (AC-10): Create button visible for admin with create permission', async ({ page }) => {
  // requirement_ref: AC-10 — "+ New sub-organisation" button visible when canCreate=true
  await loginAndGoToSubOrgs(page);

  await expect(
    page.getByRole('button', { name: /new sub-organisation/i }).first(),
  ).toBeVisible();
});

test.skip('S-03 (AC-03): Create dialog saves new sub-organisation', async () => {
  // SKIP: form mutation test; unique-name constraint requires careful global isolation.
  // Escalated in generator-ambiguity.json.
});

test.skip('S-06 (AC-06): Edit dialog saves display name change', async () => {
  // SKIP: dialog mutation test.
  // Escalated in generator-ambiguity.json.
});
