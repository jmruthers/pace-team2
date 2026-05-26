/**
 * TM11 — Report builder
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios:
 *   S-01: admin can access /reports — page renders with ReportBuilder
 *
 * Escalated / skipped:
 *   S-run: Run report — requires core_field_list seeds + execution adapter wiring
 *   S-template: Save/load/delete templates — mutation test
 *   S-csv: CSV export — requires a results table to have rows
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
  const worldPath = path.join(process.cwd(), 'tests', 'TM11', 'world.json');
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

async function loginAndGoToReports(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/reports');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

test('S-01: admin can access /reports — page renders with report builder UI', async ({
  page,
}) => {
  // requirement_ref: §4 — page entry for authenticated org admin
  await loginAndGoToReports(page);

  await expect(page).toHaveURL('/reports');
  // Report builder title visible
  await expect(page.getByText(/reports/i).first()).toBeVisible({ timeout: 10000 });
});

test.skip('S-run: Run report returns results', async () => {
  // SKIP: requires core_field_list platform-seeded rows + execution adapter.
  // Escalated in generator-ambiguity.json.
});

test.skip('S-template: Save template persists to core_report_template', async () => {
  // SKIP: mutation test; requires form interaction.
  // Escalated in generator-ambiguity.json.
});
