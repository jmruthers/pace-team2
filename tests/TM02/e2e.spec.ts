/**
 * TM02 — Member directory
 * End-to-end tests (Playwright)
 *
 * Slice ID: TM02
 * Depends on: TM01 (app shell, ToastProvider, AuthenticatedShell)
 *
 * Automatable scenarios: S-01, S-02, S-05, S-07, S-09, S-10,
 *   S-14, S-15, S-16, S-17, S-18, S-19, S-22
 *
 * Escalated / skipped scenarios (see generator-ambiguity.json):
 *   S-03 (AC-03): Empty Members state — no primitive to create an org with zero
 *     Active/Suspended members (createTestUser always creates an Active member).
 *   S-04 (AC-04): Pending tab populated — createTestMemberRequest absent;
 *     team_member_request table absent from dev-db.
 *   S-06 (AC-06): Provisional without request excluded — same as S-04.
 *   S-08 (AC-08): Membership-type filter — createTestMembershipType absent.
 *   S-11 (AC-11): AccessDenied — no primitive to assign a deny-only RBAC role
 *     for page.members (same constraint as TM01 S-06).
 *   S-12 (AC-12): Error state — no mechanism to inject a deterministic query failure.
 *   S-13 (AC-13): Org switch refetch — no primitive for multi-org user membership.
 *   S-20 (AC-20): Picker soft cap (700 members) — impractical fixture size.
 *   S-21 (AC-21): Picker hard cap (2001 members) — impractical fixture size.
 *   S-23 (AC-23): Org switch in picker mode — same as S-13.
 */

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@solvera/pace-core/playwright';
import type { Page } from '@playwright/test';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';
import { seedWorld, EXPECTED_MEMBER_COUNT } from './fixtures';

// Serial mode: picker-mode tests manipulate sessionStorage; sequential execution
// prevents cross-test state contamination within a worker.
test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Shared world — seeded once for the full suite
// ---------------------------------------------------------------------------

let world: SeededWorld;

test.beforeAll(async () => {
  // requirement_ref: AC-01 — seed org + admin + 26 named members before all e2e scenarios.
  // Prefer the world.json written by the persistence beforeAll (same TEST_RUN_ID) so we
  // do not double-seed: createTestPerson/createTestMember are not idempotent and calling
  // seedWorld() twice in one run would create duplicate member rows in the test org.
  const worldPath = path.join(process.cwd(), 'tests', 'TM02', 'world.json');
  const runId = process.env.TEST_RUN_ID;
  if (runId && fs.existsSync(worldPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(worldPath, 'utf8')) as SeededWorld;
      if (parsed.runId === runId) {
        world = parsed;
        return;
      }
    } catch (err) {
      console.warn('TM02 e2e: world.json unreadable, falling back to seedWorld()', err);
    }
  }
  world = await seedWorld();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Scope tbody rows to the active tab panel to avoid counting rows from the
// inactive Pending DataTable (which renders an empty-state TableRow in its tbody).
// The custom TabsContent uses aria-hidden="false" on the active panel (not Radix data-state).
function activeTabRows(page: Page) {
  return page.locator('[role="tabpanel"][aria-hidden="false"] tbody tr');
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}

async function loginAndGoToMembers(page: Page): Promise<void> {
  await loginAsAdmin(page);
  await page.goto('/members');
  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
  // Wait for actual member data to load (not just the empty-state row)
  await expect(page.locator('tbody').getByText('Adams')).toBeVisible({ timeout: 15000 });
}

async function navigateToPickerMode(page: Page): Promise<void> {
  // React Router v6 (BrowserRouter) stores user state under window.history.state.usr —
  // useLocation().state maps to state.usr, not the root state object.
  // pushState alone does NOT fire popstate; we dispatch it manually after.
  await page.evaluate(() => {
    const historyState = { usr: { intent: 'commsManualPick' }, key: 'picker' };
    window.history.pushState(historyState, '', '/members');
    window.dispatchEvent(new PopStateEvent('popstate', { state: historyState }));
  });
  await expect(page).toHaveURL('/members');
}

// ---------------------------------------------------------------------------
// S-01 (AC-01) — Page entry
// ---------------------------------------------------------------------------

test('S-01 (AC-01): authenticated admin can access /members — Members tab default, Pending tab visible', async ({
  page,
}) => {
  // requirement_ref: AC-01, F-01, F-03, F-04, F-15
  await loginAndGoToMembers(page);

  // Page heading is "Members"
  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();

  // Members tab is the default active tab
  const membersTab = page.getByRole('tab', { name: 'Members' });
  await expect(membersTab).toBeVisible();
  await expect(membersTab).toHaveAttribute('aria-selected', 'true');

  // Pending tab is visible alongside
  await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();

  // DataTable renders (table element present)
  await expect(page.locator('table').first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-02 (AC-02) — Default sort (last name ascending)
// ---------------------------------------------------------------------------

test('S-02 (AC-02): Members tab renders rows in last-name-ascending order', async ({ page }) => {
  // requirement_ref: AC-02, F-16, F-33, BR-04
  // Fixture seeds Adams (position 1), Brown (position 2), Carter (position 3)
  // in non-alphabetical insertion order. The DataTable must reorder them.
  await loginAndGoToMembers(page);

  const rowTexts = await activeTabRows(page).allTextContents();

  const adamsIdx = rowTexts.findIndex((t) => t.includes('Adams'));
  const brownIdx = rowTexts.findIndex((t) => t.includes('Brown'));
  const carterIdx = rowTexts.findIndex((t) => t.includes('Carter'));

  expect(adamsIdx, 'Adams row not found').toBeGreaterThanOrEqual(0);
  expect(brownIdx, 'Brown row not found').toBeGreaterThanOrEqual(0);
  expect(carterIdx, 'Carter row not found').toBeGreaterThanOrEqual(0);

  expect(adamsIdx, 'Adams must sort before Brown').toBeLessThan(brownIdx);
  expect(brownIdx, 'Brown must sort before Carter').toBeLessThan(carterIdx);
});

// ---------------------------------------------------------------------------
// S-03 (AC-03) — Members empty state [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-03 (AC-03): Members tab renders empty state when org has zero active/suspended members', async () => {
  // requirement_ref: AC-03, F-11
  // SKIP: createTestUser always creates an Active core_member row for the admin,
  // so the test org cannot be seeded with zero Active/Suspended members.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-04 (AC-04) — Pending tab populated [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-04 (AC-04): Pending tab renders rows when qualifying provisional requests exist', async () => {
  // requirement_ref: AC-04, F-06, F-21, F-22, F-23, F-24
  // SKIP: seeding team_member_request rows requires createTestMemberRequest, which does not
  // exist. The team_member_request table is absent from dev-db.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-05 (AC-05) — Pending empty state
// ---------------------------------------------------------------------------

test('S-05 (AC-05): Pending tab renders empty state when no qualifying pending requests exist', async ({
  page,
}) => {
  // requirement_ref: AC-05, F-12
  // No team_member_request rows are seeded → Pending tab must show the empty state.
  await loginAndGoToMembers(page);

  await page.getByRole('tab', { name: 'Pending' }).click();

  await expect(page.getByText('No pending members.')).toBeVisible();
  await expect(
    page.getByText('New join requests appear here once submitted via your org signup form.'),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-06 (AC-06) — Provisional without request excluded [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-06 (AC-06): Provisional member with no open request is excluded from Pending tab', async () => {
  // requirement_ref: AC-06, F-49, BR-03
  // SKIP: seeding a Provisional core_member requires createTestMember with a status
  // override (not in the primitive signature). The team_member_request table is also
  // absent from dev-db. Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-07 (AC-07) — Search filters in-memory
// ---------------------------------------------------------------------------

test('S-07 (AC-07): search input filters Members rows; clearing restores full list', async ({
  page,
}) => {
  // requirement_ref: AC-07, F-31, BR-05
  await loginAndGoToMembers(page);

  const initialCount = await activeTabRows(page).count();
  expect(initialCount).toBeGreaterThan(1);

  // Search for "smit" — only the "Smith" row should remain
  const searchInput = page.getByRole('textbox', { name: /search table/i });
  await searchInput.fill('smit');

  // Wait for client-side filter to apply
  await expect(activeTabRows(page)).toHaveCount(1);
  await expect(activeTabRows(page).first()).toContainText('Smith');

  // Clear the search → full list restores
  await searchInput.clear();
  await expect(activeTabRows(page)).toHaveCount(initialCount);
});

// ---------------------------------------------------------------------------
// S-08 (AC-08) — Membership-type filter [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-08 (AC-08): selecting a membership-type filter shows only rows of that type', async () => {
  // requirement_ref: AC-08, F-32
  // SKIP: no createTestMembershipType primitive is available to seed core_membership_type
  // rows for the test org. Without seeded types the filter dropdown has no options.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-09 (AC-09) — Pagination
// ---------------------------------------------------------------------------

test('S-09 (AC-09): Members tab page 1 shows 25 rows; page 2 shows the remainder', async ({
  page,
}) => {
  // requirement_ref: AC-09, F-34
  // Fixture seeds 27 members (26 named + 1 admin). initialPageSize = 25.
  // Page 1: 25 rows. Page 2: EXPECTED_MEMBER_COUNT - 25 rows.
  // AC-09 references a 60-row dataset; this test covers the equivalent pagination
  // behaviour with the seeded 27 rows (same logic, fewer fixtures).
  await loginAndGoToMembers(page);

  // Page 1 must show exactly 25 rows
  await expect(activeTabRows(page)).toHaveCount(25);

  // Navigate to page 2
  await page.getByRole('button', { name: /next/i }).click();

  // Page 2 must show the remaining rows
  await expect(activeTabRows(page)).toHaveCount(EXPECTED_MEMBER_COUNT - 25);
});

// ---------------------------------------------------------------------------
// S-10 (AC-10) — Row click navigates to Member 360
// ---------------------------------------------------------------------------

test('S-10 (AC-10): clicking a Members tab row navigates to /members/:memberId', async ({
  page,
}) => {
  // requirement_ref: AC-10, F-26, BR-06
  await loginAndGoToMembers(page);

  // Click the first visible row (whichever sorts first)
  await activeTabRows(page).first().click();

  // Must navigate to /members/<uuid>
  await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}/);
});

// ---------------------------------------------------------------------------
// S-11 (AC-11) — AccessDenied [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-11 (AC-11): user without read:page.members sees AccessDenied', async () => {
  // requirement_ref: AC-11, F-14, F-36
  // SKIP: no v1.5 primitive is available to seed a user with a deny-only RBAC role
  // for page.members. Same constraint as TM01 S-06.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-12 (AC-12) — Error state [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-12 (AC-12): Members list query failure renders destructive Alert with Retry', async () => {
  // requirement_ref: AC-12, F-13
  // SKIP: no mechanism exists in the test environment to inject a deterministic
  // query failure against the live dev-db without intercepting at the network layer.
  // Escalated in generator-ambiguity.json (kind: spec-ambiguity).
});

// ---------------------------------------------------------------------------
// S-13 (AC-13) — Org switch refetch [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-13 (AC-13): switching org context refetches both lists', async () => {
  // requirement_ref: AC-13, F-42, BR-01, BR-11
  // SKIP: requires the admin user to have access to a second org so the org
  // context selector can switch between them. No multi-org membership primitive
  // is available.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-14 (AC-14) — Picker mode entry
// ---------------------------------------------------------------------------

test('S-14 (AC-14): navigating to /members with commsManualPick state activates picker mode', async ({
  page,
}) => {
  // requirement_ref: AC-14, F-04, F-07, F-44, BR-08
  await loginAsAdmin(page);
  await navigateToPickerMode(page);

  // Picker banner must render above the tabs
  await expect(page.getByText('Selecting members for a comms send')).toBeVisible();

  // Action bar: Done is disabled (no selection), Cancel is enabled
  await expect(page.getByRole('button', { name: /^done$/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^cancel$/i })).toBeVisible();

  // Pending tab is hidden in picker mode
  await expect(page.getByRole('tab', { name: 'Pending' })).not.toBeVisible();

  // Helper copy for empty selection
  await expect(page.getByText('Select at least one member.')).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-15 (AC-15) — Picker hydration when org matches
// ---------------------------------------------------------------------------

test('S-15 (AC-15): entering picker mode hydrates selection from sessionStorage when org matches', async ({
  page,
}) => {
  // requirement_ref: AC-15, F-08, BR-07
  await loginAsAdmin(page);

  // Pre-populate sessionStorage with a payload whose organisationId matches the test org
  const memberId1 = world.members[0].id as string;
  const memberId2 = world.members[1].id as string;
  await page.evaluate(
    ([orgId, ids]) => {
      sessionStorage.setItem(
        'pace:team:comms:manual-pick',
        JSON.stringify({ organisationId: orgId, memberIds: ids, updatedAt: Date.now() }),
      );
    },
    [world.org.id, [memberId1, memberId2]] as [string, string[]],
  );

  await navigateToPickerMode(page);

  // Banner counter must reflect the two pre-selected members
  // Scope to footer to avoid strict-mode violation: AlertDescription also renders "N selected".
  await expect(page.locator('footer').getByText('2 selected')).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-16 (AC-16) — Picker hydration when org mismatches
// ---------------------------------------------------------------------------

test('S-16 (AC-16): entering picker mode starts empty when sessionStorage org does not match', async ({
  page,
}) => {
  // requirement_ref: AC-16, F-48, BR-07
  await loginAsAdmin(page);

  // Pre-populate sessionStorage with a different organisationId
  await page.evaluate((memberId) => {
    sessionStorage.setItem(
      'pace:team:comms:manual-pick',
      JSON.stringify({
        organisationId: '00000000-0000-0000-0000-000000000001',
        memberIds: [memberId],
        updatedAt: Date.now(),
      }),
    );
  }, world.members[0].id as string);

  await navigateToPickerMode(page);

  // Selection must start empty (org mismatch prevents hydration)
  // Scope to footer to avoid strict-mode violation: AlertDescription also renders "0 selected".
  await expect(page.locator('footer').getByText('0 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: /^done$/i })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// S-17 (AC-17) — Picker Done writes payload and navigates
// ---------------------------------------------------------------------------

test('S-17 (AC-17): clicking Done writes sessionStorage payload and navigates to /communications', async ({
  page,
}) => {
  // requirement_ref: AC-17, F-29, BR-10
  await loginAsAdmin(page);
  // Clear any prior sessionStorage payload before the test
  await page.evaluate(() => sessionStorage.removeItem('pace:team:comms:manual-pick'));

  await navigateToPickerMode(page);

  // Wait for actual member data to load (DataTable shows a spinner <tr> while loading;
  // clicking it would miss onPrimaryAction and leave Done disabled).
  await expect(
    page.locator('[role="tabpanel"][aria-hidden="false"] tbody').getByText('Adams'),
  ).toBeVisible({ timeout: 15000 });

  // Select the first row via its checkbox (more reliable than clicking the <tr> center
  // which may not hit a child interactive element in all viewport configurations).
  await activeTabRows(page).first().locator('input[type="checkbox"]').click();
  await expect(page.getByRole('button', { name: /^done$/i })).toBeEnabled({ timeout: 5000 });

  // Click Done
  await page.getByRole('button', { name: /^done$/i }).click();

  // Must navigate to /communications
  await expect(page).toHaveURL(/\/communications/);

  // sessionStorage must contain the payload
  const stored = await page.evaluate(() =>
    sessionStorage.getItem('pace:team:comms:manual-pick'),
  );
  expect(stored).not.toBeNull();
  const payload = JSON.parse(stored!) as {
    organisationId: string;
    memberIds: string[];
    updatedAt: number;
  };
  expect(payload.organisationId).toBe(world.org.id);
  expect(payload.memberIds.length).toBeGreaterThan(0);
  expect(typeof payload.updatedAt).toBe('number');
});

// ---------------------------------------------------------------------------
// S-18 (AC-18) — Picker Cancel does not write payload
// ---------------------------------------------------------------------------

test('S-18 (AC-18): clicking Cancel navigates to /communications without overwriting sessionStorage', async ({
  page,
}) => {
  // requirement_ref: AC-18, F-30, BR-10
  await loginAsAdmin(page);

  // Pre-set a sentinel payload to verify it is not overwritten on Cancel
  const sentinelPayload = {
    organisationId: world.org.id,
    memberIds: ['__sentinel_id__'],
    updatedAt: 42,
  };
  await page.evaluate((p) => {
    sessionStorage.setItem('pace:team:comms:manual-pick', JSON.stringify(p));
  }, sentinelPayload);

  await navigateToPickerMode(page);

  // Click Cancel without selecting any rows
  await page.getByRole('button', { name: /^cancel$/i }).click();

  // Must navigate to /communications
  await expect(page).toHaveURL(/\/communications/);

  // sessionStorage must remain unchanged (TEAM-13 reads-and-clears on mount, not TEAM-02)
  const stored = await page.evaluate(() =>
    sessionStorage.getItem('pace:team:comms:manual-pick'),
  );
  expect(stored).not.toBeNull();
  const payload = JSON.parse(stored!) as { memberIds: string[]; updatedAt: number };
  expect(payload.memberIds).toEqual(['__sentinel_id__']);
  expect(payload.updatedAt).toBe(42);
});

// ---------------------------------------------------------------------------
// S-19 (AC-19) — Picker empty selection blocks Done
// ---------------------------------------------------------------------------

test('S-19 (AC-19): picker mode with empty selection keeps Done disabled and shows helper copy', async ({
  page,
}) => {
  // requirement_ref: AC-19, F-44, BR-09
  await loginAsAdmin(page);
  await navigateToPickerMode(page);

  // No rows selected → Done must be disabled
  await expect(page.getByRole('button', { name: /^done$/i })).toBeDisabled();

  // Helper copy must be visible
  await expect(page.getByText('Select at least one member.')).toBeVisible();

  // Banner counter reads 0 selected (scope to footer: AlertDescription also renders "0 selected")
  await expect(page.locator('footer').getByText('0 selected')).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-20 (AC-20) — Picker soft cap [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-20 (AC-20): selecting 700 members shows soft-cap warning with Done still enabled', async () => {
  // requirement_ref: AC-20, F-45, BR-09
  // SKIP: seeding 700 members is impractical with the current primitives due to
  // Supabase rate limits and fixture execution time.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-21 (AC-21) — Picker hard cap [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-21 (AC-21): selecting 2001 members shows hard-cap destructive warning and disables Done', async () => {
  // requirement_ref: AC-21, F-46, BR-09
  // SKIP: seeding 2001 members is impractical with the current primitives.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-22 (AC-22) — URL-only picker entry does not activate picker mode
// ---------------------------------------------------------------------------

test('S-22 (AC-22): navigating to /members?pick=comms without state intent does not activate picker mode', async ({
  page,
}) => {
  // requirement_ref: AC-22, F-47, BR-07
  await loginAsAdmin(page);
  await page.goto('/members?pick=comms');

  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();

  // Both tabs must be visible (normal mode)
  await expect(page.getByRole('tab', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();

  // Picker banner and action bar must NOT be present
  await expect(page.getByText('Selecting members for a comms send')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^done$/i })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// S-23 (AC-23) — Org switch in picker mode [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-23 (AC-23): switching org in picker mode clears selection and shows toast', async () => {
  // requirement_ref: AC-23, F-43, BR-11
  // SKIP: requires the admin user to have access to a second org.
  // No multi-org membership primitive is available. Same constraint as S-13.
  // Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-24 (AC-24) — Cross-org leakage prevention
// (covered by RLS-02 in persistence.test.ts; no separate e2e assertion needed)
// ---------------------------------------------------------------------------
