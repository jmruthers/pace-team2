# TEAM-01 QA Pack

## Slice metadata

- slice_id: TEAM-01
- app: TEAM
- requirement_path: docs/requirements/TM01-app-shell-auth-layout-requirements.md
- queue_row: TEAM-01
- depends_on: -

## Acceptance criteria checklist

| scenario_id | requirement_ref | route_or_screen | expected_result | evidence_ref | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/` | Unauthenticated users are redirected to `/login` without admin content flash. | `src/App.tsx` (`ProtectedRoute`) | [Pass/Fail] |  |
| S-02 | AC-02 | `/login` | Valid sign in redirects to `/`. | `src/App.tsx` (`PaceLoginPage`) | [Pass/Fail] |  |
| S-03 | AC-03 | `/login` | Invalid credentials show inline error and no redirect. | `PaceLoginPage` runtime behavior | [Pass/Fail] |  |
| S-04 | AC-04 | `/` | Home renders org name + shortcuts in shell chrome. | `src/App.tsx`, `src/components/layout/AuthenticatedShell.tsx` | [Pass/Fail] |  |
| S-05 | AC-05 | authenticated route | No-org empty state message renders and feature content is hidden. | `src/components/layout/AuthenticatedShell.tsx` | [Pass/Fail] |  |
| S-06 | AC-06 | `/` | Access denied fallback renders in PaceMain when `read:page.home` is denied. | `src/App.tsx` (`PagePermissionGuard` + `AccessDenied`) | [Pass/Fail] |  |
| S-07 | AC-07 | app load | Session restoration loader appears while auth restoration runs. | `src/main.tsx` (`SessionRestorationLoader`) | [Pass/Fail] |  |
| S-08 | AC-08 | inactivity modal | Warning modal appears at 28 minutes idle with seconds countdown. | `src/main.tsx` (`idleTimeoutMs`, `warnBeforeMs`, `renderInactivityWarning`) | [Pass/Fail] |  |
| S-09 | AC-09 | inactivity modal | Stay signed in closes modal and resets idle timer. | `InactivityWarningModal` callback wiring in `src/main.tsx` | [Pass/Fail] |  |
| S-10 | AC-10 | inactivity modal | No action in warning window signs user out to `/login`. | `src/main.tsx` (`onIdleLogout`) | [Pass/Fail] |  |
| S-11 | AC-11 | unmatched route | NotFound page renders for unbuilt routes with no unhandled error. | `src/App.tsx` (`path="*"`) | [Pass/Fail] |  |
| S-12 | AC-12 | authenticated route header | Header shows logo, nav menu trigger, org selector, and user menu. | `src/components/layout/AuthenticatedShell.tsx` (`PaceAppLayout`) | [Pass/Fail] |  |
| S-13 | AC-13 | nav dropdown | 9 top-level nav items + 3 settings children render in dropdown. | `src/App.tsx` (`NAV_ITEMS`) | [Pass/Fail] |  |
| S-14 | AC-14 | user menu | User menu sign out clears session and routes to `/login`. | `src/components/layout/AuthenticatedShell.tsx` (`handleSignOut`) | [Pass/Fail] |  |
| S-15 | AC-15 | change-password dialog | Valid password update closes dialog with no redirect. | `src/components/layout/AuthenticatedShell.tsx` (`PasswordChangeForm`) | [Pass/Fail] |  |
| S-16 | AC-16 | change-password dialog | Invalid password returns inline error and dialog remains open. | `PasswordChangeForm` submit result wiring | [Pass/Fail] |  |
| S-17 | AC-17 | validation command | `npm run validate` exits with status 0. | validation run evidence | [Pass/Fail] |  |
| S-18 | AC-18 | authenticated shell | `toast(...)` from descendants renders bottom-right toast and auto-dismisses. | `src/components/layout/AuthenticatedShell.tsx` (`ToastProvider`) | [Pass/Fail] |  |

## TM01 post-build RBAC seeding reminder

Before release, seed the canonical TEAM `rbac_app_pages` rows (`scope_type='organisation'`):

- `home`
- `members`
- `member-roles`
- `approvals`
- `membership-types`
- `organisations`
- `org-settings`
- `forms`
- `events`
- `reports`
- `moderation-photos`
- `CommsLog`

Remove legacy rows in the same change window:

- `Activities`
- `dashboard`
- `Dashboard`
- `Members`
- `Reports`
- `team-crm`
- `team-relationships`

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
