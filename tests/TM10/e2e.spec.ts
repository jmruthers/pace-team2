/**
 * TM10 — Events & attendees
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios:
 *   S-01: admin can access /events — page renders (empty state or error if RPCs absent)
 *
 * Escalated / skipped:
 *   S-list (AC-01 data): event list rows — requires app_org_event_summaries RPC + event seed
 *   S-detail (AC detail): event detail / attendee list — requires app_org_event_attendees RPC
 *   All data-dependent scenarios blocked by §15 RPC deployment gate
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
  const worldPath = path.join(process.cwd(), 'tests', 'TM10', 'world.json');
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

async function loginAndGoToEvents(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/events');
  // Page either loads content or shows an error/empty state — either is acceptable
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

test('S-01 (AC-01): admin can access /events — page renders without crash', async ({ page }) => {
  // requirement_ref: AC-01, F-01 — page renders for authenticated org admin
  // NOTE: With RPCs not yet deployed, the page may show an error state or loading
  // indefinitely. We only assert the URL is correct and no unhandled crash occurs.
  await loginAndGoToEvents(page);

  await expect(page).toHaveURL('/events');
  // Page heading should be visible
  await expect(page.getByRole('heading', { name: /events/i }).first()).toBeVisible({
    timeout: 10000,
  });
});

test.skip('S-list: events list shows rows for org with events', async () => {
  // SKIP: requires app_org_event_summaries RPC + seeded core_events + base_application rows.
  // §15 implementation gate.
});

test.skip('S-detail: event detail page shows attendee list', async () => {
  // SKIP: requires app_org_event_attendees RPC. §15 implementation gate.
});
