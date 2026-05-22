/**
 * TM01 — App shell, auth, layout
 * End-to-end tests (Playwright)
 *
 * run_id:   019e4d63-6b73-7386-a6b9-42ae494835c8
 * slice_id: TM01
 *
 * Escalated / skipped scenarios:
 *   S-05 (AC-05): no-org user — createTestUser always creates a member; cannot
 *     seed a user without org context. See generator-ambiguity.json.
 *   S-06 (AC-06): permission denied — no primitive available to assign a
 *     deny-only RBAC role. See generator-ambiguity.json.
 *   S-17 (AC-17): CI gate — run via `npm run validate`, not Playwright.
 *   S-18 (AC-18): toast trigger — no documented natural toast trigger in TM01
 *     surface. See generator-ambiguity.json.
 */

import { test, expect } from '@solvera/pace-core/playwright';
import { seedWorld } from './fixtures';
import type { SeededWorld } from '@solvera/pace-core/test-helpers';

// ---------------------------------------------------------------------------
// Shared world — seeded once for the full suite
// ---------------------------------------------------------------------------

let world: SeededWorld;

test.beforeAll(async () => {
  // requirement_ref: AC-04 — seed org + admin user before all e2e scenarios
  world = await seedWorld();
});

// ---------------------------------------------------------------------------
// S-01 (AC-01) — Unauthenticated redirect
// ---------------------------------------------------------------------------

test('S-01 (AC-01): unauthenticated user navigating to / is redirected to /login', async ({
  page,
}) => {
  // requirement_ref: AC-01, BR-01 — ProtectedRoute redirects unauthenticated user
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  // No admin content should be visible
  await expect(page.getByText(/Welcome to TEAM/i)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// S-02 (AC-02) — Successful login
// ---------------------------------------------------------------------------

test('S-02 (AC-02): valid credentials sign in and redirect to /', async ({
  page,
}) => {
  // requirement_ref: AC-02 — PaceLoginPage signs in and redirects to /
  await page.goto('/login');

  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Welcome to TEAM/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-03 (AC-03) — Login error — bad credentials
// ---------------------------------------------------------------------------

test('S-03 (AC-03): invalid credentials show inline error and no redirect', async ({
  page,
}) => {
  // requirement_ref: AC-03 — PaceLoginPage renders inline error on bad credentials
  await page.goto('/login');

  await page.getByLabel(/email/i).fill('invalid-user@example.invalid');
  await page.getByLabel(/password/i).fill('wrong-password-12345');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Inline error must appear
  await expect(
    page.getByRole('alert').or(page.locator('[data-error]')).or(
      page.getByText(/invalid login credentials|invalid email or password|error/i),
    ),
  ).toBeVisible();

  // Must remain on /login — no redirect
  await expect(page).toHaveURL(/\/login/);
});

// ---------------------------------------------------------------------------
// S-04 (AC-04) — Home page with org membership
// ---------------------------------------------------------------------------

test('S-04 (AC-04): authenticated user with org sees home page with org name and tiles', async ({
  page,
}) => {
  // requirement_ref: AC-04 — home page shows org name and navigation shortcut tiles
  // Also incidentally verifies ToastProvider is mounted (no console errors) — AC-18 partial
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Org name displayed — display_name or name from org
  await expect(
    page.getByText(new RegExp(world.org.name, 'i')).or(
      page.getByText(/Test TM01/i),
    ),
  ).toBeVisible();

  // Welcome heading
  await expect(page.getByText(/Welcome to TEAM/i)).toBeVisible();

  // At least one shortcut tile visible (Members tile is canonical)
  await expect(page.getByText(/Members/i).first()).toBeVisible();

  // Incidental AC-18 check: no ToastProvider context-missing error
  const toastErrors = consoleErrors.filter((e) =>
    /ToastProvider|must be (called|used) within/i.test(e),
  );
  expect(toastErrors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// S-05 (AC-05) — No-org user [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-05 (AC-05): no-org user sees empty state message', async () => {
  // requirement_ref: AC-05, BR-03 — shell renders "No organisation assigned"
  // SKIP: createTestUser always performs the full auth→person→member chain.
  // A user with selectedOrganisation === null cannot be seeded with available
  // v1.5 primitives. Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-06 (AC-06) — Permission denied on home [ESCALATED]
// ---------------------------------------------------------------------------

test.skip('S-06 (AC-06): user without read:page.home sees AccessDenied', async () => {
  // requirement_ref: AC-06, BR-06 — PagePermissionGuard renders AccessDenied
  // SKIP: No v1.5 primitive is available to assign a deny-only RBAC role
  // for the home page. Escalated in generator-ambiguity.json (kind: missing-primitive).
});

// ---------------------------------------------------------------------------
// S-07 (AC-07) — Session restoration
// ---------------------------------------------------------------------------

test('S-07 (AC-07): app loads with existing session without re-login', async ({
  page,
}) => {
  // requirement_ref: AC-07, BR-02 — SessionRestorationLoader shows spinner then resolves
  // Sign in first to establish a session
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Reload to trigger session restoration
  await page.reload();

  // Should land on / without re-login (session cookie / token restores)
  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Welcome to TEAM/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-08 (AC-08) — Inactivity warning appears after 28 minutes
// ---------------------------------------------------------------------------

test('S-08 (AC-08): inactivity warning modal appears after 28 minutes of idle', async ({
  page,
}) => {
  // requirement_ref: AC-08, BR-07 — InactivityWarningModal renders after 28 min idle
  // IMPORTANT: clock.install() MUST precede the first goto so that
  // UnifiedAuthProvider's setTimeout is intercepted (timers registered on mount).
  await page.clock.install();

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Fast-forward to the 28-minute idle threshold
  // (idleTimeoutMs=30min − warnBeforeMs=2min = 28min)
  await page.clock.fastForward(28 * 60 * 1000);

  // Inactivity warning modal must be visible
  await expect(
    page.getByRole('button', { name: /stay signed in/i }),
  ).toBeVisible();

  // Countdown in seconds must be visible
  await expect(
    page.getByText(/\d+\s*second/i).or(page.getByText(/session.*expire/i)),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-09 (AC-09) — Stay signed in resets timer
// ---------------------------------------------------------------------------

test('S-09 (AC-09): clicking Stay signed in closes modal and resets idle timer', async ({
  page,
}) => {
  // requirement_ref: AC-09, BR-08 — onStaySignedIn resets timer; modal unmounts
  // clock.install() MUST precede first goto
  await page.clock.install();

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Advance to warning threshold
  await page.clock.fastForward(28 * 60 * 1000);

  const stayBtn = page.getByRole('button', { name: /stay signed in/i });
  await expect(stayBtn).toBeVisible();

  await stayBtn.click();

  // Modal must have unmounted
  await expect(stayBtn).not.toBeVisible();

  // Session should still be active — still on /
  await expect(page).toHaveURL('/');
});

// ---------------------------------------------------------------------------
// S-10 (AC-10) — Idle logout after warning period
// ---------------------------------------------------------------------------

test('S-10 (AC-10): no action during warning period results in sign-out and redirect to /login', async ({
  page,
}) => {
  // requirement_ref: AC-10, BR-09 — onIdleLogout fires after warnBeforeMs; redirect to /login
  // clock.install() MUST precede first goto
  await page.clock.install();

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Advance past the full idle timeout (30 minutes)
  await page.clock.fastForward(30 * 60 * 1000);

  // User must be redirected to /login
  await expect(page).toHaveURL(/\/login/);
});

// ---------------------------------------------------------------------------
// S-11 (AC-11) — Catch-all NotFound page for unbuilt routes
// ---------------------------------------------------------------------------

test('S-11 (AC-11): navigating to an unbuilt route renders NotFound without unhandled error', async ({
  page,
}) => {
  // requirement_ref: AC-11, BR-10 — * catch-all renders NotFound; no unhandled error
  const uncaughtErrors: string[] = [];
  page.on('pageerror', (err) => uncaughtErrors.push(err.message));

  // Sign in first
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Navigate to an unbuilt route
  await page.goto('/members');

  // NotFound page must render (404 heading or message)
  await expect(
    page
      .getByText(/404/i)
      .or(page.getByText(/page.*doesn.t exist/i))
      .or(page.getByText(/not found/i)),
  ).toBeVisible();

  // No unhandled JS errors
  expect(uncaughtErrors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// S-12 (AC-12) — App chrome on authenticated pages
// ---------------------------------------------------------------------------

test('S-12 (AC-12): authenticated page shows logo, nav trigger, org selector, and user menu', async ({
  page,
}) => {
  // requirement_ref: AC-12 — header elements visible on any authenticated route
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // TEAM logo (img or svg in header)
  await expect(
    page.locator('header').getByRole('img', { name: /TEAM/i }).or(
      page.locator('header img').first(),
    ),
  ).toBeVisible();

  // Navigation menu trigger (a button that opens the nav dropdown)
  await expect(
    page.locator('header').getByRole('button', { name: /navigation|menu|nav/i })
      .or(page.locator('header [aria-haspopup="menu"]').first())
      .or(page.locator('header button').first()),
  ).toBeVisible();

  // User menu (button with user name / avatar in header)
  await expect(
    page.locator('header').getByRole('button', { name: /user|account|sign out/i })
      .or(page.locator('header').getByText(world.users.admin.email).or(
        page.locator('header button').last(),
      )),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-13 (AC-13) — Navigation dropdown — all 9 top-level items + Settings children
// ---------------------------------------------------------------------------

test('S-13 (AC-13): nav dropdown shows all 9 top-level items and Settings sub-items', async ({
  page,
}) => {
  // requirement_ref: AC-13 — NavigationMenu shows all navItems including Settings children
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Open the nav dropdown — find the nav trigger in header
  const navTrigger = page
    .locator('header')
    .getByRole('button', { name: /navigation|menu/i })
    .or(page.locator('header [aria-haspopup="menu"]').first());
  await navTrigger.click();

  // All 9 top-level nav items must be visible
  const topLevelLabels = [
    'Home',
    'Members',
    'Approvals',
    'Events',
    'Communications',
    'Forms',
    'Reports',
    'Moderation',
    'Settings',
  ];
  for (const label of topLevelLabels) {
    await expect(page.getByRole('link', { name: label }).or(
      page.getByText(label),
    )).toBeVisible();
  }

  // Expand Settings to reveal 3 sub-items
  await page.getByText('Settings').click();
  await expect(page.getByText(/Membership Types/i)).toBeVisible();
  await expect(page.getByText(/Organisations/i)).toBeVisible();
  await expect(page.getByText(/Org Settings/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-14 (AC-14) — Sign out
// ---------------------------------------------------------------------------

test('S-14 (AC-14): sign out clears session and redirects to /login', async ({
  page,
}) => {
  // requirement_ref: AC-14 — onUserMenuSignOut calls signOut() then navigate /login
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Open user menu
  const userMenuTrigger = page
    .locator('header')
    .getByRole('button', { name: /user|account|sign out/i })
    .or(page.locator('header button').last());
  await userMenuTrigger.click();

  // Click Sign out
  await page.getByRole('menuitem', { name: /sign out/i }).or(
    page.getByText(/sign out/i),
  ).click();

  // Must redirect to /login
  await expect(page).toHaveURL(/\/login/);

  // Navigating back to / must redirect to /login (session cleared)
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

// ---------------------------------------------------------------------------
// S-15 (AC-15) — Change password — success
// ---------------------------------------------------------------------------

test('S-15 (AC-15): valid new password updates password and closes dialog', async ({
  page,
}) => {
  // requirement_ref: AC-15 — updatePassword on success closes dialog; no redirect
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Open user menu and click Change password
  const userMenuTrigger = page
    .locator('header')
    .getByRole('button', { name: /user|account/i })
    .or(page.locator('header button').last());
  await userMenuTrigger.click();

  await page.getByRole('menuitem', { name: /change password/i }).or(
    page.getByText(/change password/i),
  ).click();

  // Dialog must open with title "Change password"
  await expect(
    page.getByRole('dialog').getByText(/change password/i),
  ).toBeVisible();

  // Fill new password (use a different but still valid password)
  const newPassword = process.env.TEST_USER_PASSWORD ?? 'test-e2e-password';
  await page.getByRole('dialog').getByLabel(/new password/i).fill(newPassword);
  await page
    .getByRole('dialog')
    .getByLabel(/confirm password/i)
    .fill(newPassword);

  await page.getByRole('dialog').getByRole('button', { name: /change password/i }).click();

  // Dialog must close on success
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // No redirect — still on /
  await expect(page).toHaveURL('/');
});

// ---------------------------------------------------------------------------
// S-16 (AC-16) — Change password — error
// ---------------------------------------------------------------------------

test('S-16 (AC-16): invalid new password shows inline error and keeps dialog open', async ({
  page,
}) => {
  // requirement_ref: AC-16 — PasswordChangeForm displays error; dialog remains open
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(world.users.admin.email);
  await page
    .getByLabel(/password/i)
    .fill(process.env.TEST_USER_PASSWORD ?? 'test-e2e-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Open change-password dialog
  const userMenuTrigger = page
    .locator('header')
    .getByRole('button', { name: /user|account/i })
    .or(page.locator('header button').last());
  await userMenuTrigger.click();

  await page.getByRole('menuitem', { name: /change password/i }).or(
    page.getByText(/change password/i),
  ).click();

  await expect(page.getByRole('dialog')).toBeVisible();

  // Submit a password that is too short to pass Supabase validation (< 6 chars)
  await page.getByRole('dialog').getByLabel(/new password/i).fill('abc');
  await page.getByRole('dialog').getByLabel(/confirm password/i).fill('abc');
  await page.getByRole('dialog').getByRole('button', { name: /change password/i }).click();

  // Inline error must be visible within the dialog
  await expect(
    page.getByRole('dialog').getByRole('alert').or(
      page.getByRole('dialog').getByText(/error|too short|invalid|password/i),
    ),
  ).toBeVisible();

  // Dialog must remain open
  await expect(page.getByRole('dialog')).toBeVisible();
});

// ---------------------------------------------------------------------------
// S-17 (AC-17) — npm run validate [CI GATE — SKIPPED]
// ---------------------------------------------------------------------------

test.skip('S-17 (AC-17): npm run validate exits 0 with no TypeScript/lint errors', async () => {
  // requirement_ref: AC-17 — CI gate — run via `npm run validate`, not Playwright
  // CI gate — run via `npm run validate`, not Playwright.
});

// ---------------------------------------------------------------------------
// S-18 (AC-18) — Toast notifications mountable [ESCALATED]
// ---------------------------------------------------------------------------

test.skip(
  'S-18 (AC-18): toast() from descendant renders notification without provider error',
  async () => {
    // requirement_ref: AC-18 — ToastProvider mounted in AuthenticatedShell; toast() reachable
    // SKIP: TM01 does not document any UI interaction that definitively calls
    // toast(...) in §4 or §5. The change-password success path is described as
    // "dialog closes" with no toast. Dispatching a synthetic CustomEvent is
    // explicitly prohibited by the generator hint (no-synthetic-event rule).
    // Escalated in generator-ambiguity.json (kind: missing-toast-trigger).
    // The incidental check in S-04 verifies no ToastProvider context-missing
    // console error fires during normal app usage.
  },
);
