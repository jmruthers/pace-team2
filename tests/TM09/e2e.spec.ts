/**
 * TM09 — Org form authoring
 * End-to-end tests (Playwright) — lite tier
 *
 * Automatable scenarios:
 *   S-01 (list page renders with seeded form)
 *   S-02 (Create form button visible)
 *
 * Escalated / skipped:
 *   S-create (AC-create): Create form — WorkflowFormAuthoringShell mutation test
 *   S-edit (AC-edit): Edit form — shell mutation test
 *   S-delete (AC-delete): Delete form — dependency check + ConfirmationDialog
 *   S-org_signup: org_signup workflow type — blocked by core_forms_workflow_type_check (Q-DB-2 gate)
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@solvera/pace-core/playwright';
import type { Page } from '@playwright/test';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, FORM_NAME } from './fixtures';

test.describe.configure({ mode: 'serial' });

let world: SeededWorld;

test.beforeAll(async () => {
  const worldPath = path.join(process.cwd(), 'tests', 'TM09', 'world.json');
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

async function loginAndGoToForms(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/forms');
  await expect(page.getByText(FORM_NAME)).toBeVisible({ timeout: 15000 });
}

test('S-01 (F-02): admin can access /forms — DataTable renders with seeded form', async ({
  page,
}) => {
  // requirement_ref: F-02, F-01 — list page renders with org-scoped forms
  await loginAndGoToForms(page);

  await expect(page.getByText(FORM_NAME)).toBeVisible();
  // Workflow type label
  await expect(page.getByText('Information collection')).toBeVisible();
  // Status badge
  await expect(page.getByText('Draft').first()).toBeVisible();
});

test('S-02 (F-37): Create form button visible for admin', async ({ page }) => {
  // requirement_ref: F-37 — Create form toolbar button visible when canCreate=true
  await loginAndGoToForms(page);

  await expect(
    page.getByRole('button', { name: /create form/i }).first(),
  ).toBeVisible();
});

test('S-03 (F-38): Edit action navigates to form authoring page', async ({ page }) => {
  // requirement_ref: F-38 — row Edit action navigates to /forms/:formId
  await loginAndGoToForms(page);

  const editButton = page.getByRole('button', { name: /edit/i }).first();
  await expect(editButton).toBeVisible();
  await editButton.click();

  await expect(page).toHaveURL(new RegExp(`/forms/${world.extras!.formId as string}`), {
    timeout: 10000,
  });
  // Form name should appear as heading
  await expect(page.getByText(FORM_NAME).first()).toBeVisible({ timeout: 10000 });
});

test.skip('S-create: Create form dialog saves new form', async () => {
  // SKIP: WorkflowFormAuthoringShell mutation test.
  // Escalated in generator-ambiguity.json.
});

test.skip('S-org_signup: org_signup workflow type is available', async () => {
  // SKIP: core_forms_workflow_type_check does not permit org_signup until Q-DB-2 lands.
  // Schema gate documented in generator-ambiguity.json.
});
