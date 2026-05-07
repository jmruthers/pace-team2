# TM01 QA Pack

## Slice metadata

- slice_id: TM01
- app: TEAM
- requirement_path: docs/requirements/TM01-app-shell-auth-layout-requirements.md
- queue_row: TEAM-01
- depends_on: -

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/` | Open `/` while unauthenticated. | Redirects to `/login`; no admin content visible. | [Pass/Fail] |  |
| S-02 | AC-02 | `/login` | Enter valid credentials and submit. | Auth succeeds and redirects to `/`. | [Pass/Fail] |  |
| S-03 | AC-03 | `/login` | Enter invalid credentials and submit. | Inline error is shown; no redirect. | [Pass/Fail] |  |
| S-04 | AC-04 | `/` | Log in with org membership and open `/`. | Home renders with org name and shortcut tiles in app chrome. | [Pass/Fail] |  |
| S-05 | AC-05 | authenticated route | Log in as user with no org membership. | Shell shows no-org message and hides feature content. | [Pass/Fail] |  |
| S-06 | AC-06 | `/` | Log in with org but without `read:page.home`; open `/`. | `AccessDenied` renders in content area; header/footer remain visible. | [Pass/Fail] |  |
| S-07 | AC-07 | app load | Load app with valid existing session token. | Session restoration loader appears, then app loads without re-login. | [Pass/Fail] |  |
| S-08 | AC-08 | inactivity modal | Stay idle for 28 minutes. | Inactivity warning modal appears with second countdown. | [Pass/Fail] |  |
| S-09 | AC-09 | inactivity modal | While warning modal is open, click Stay signed in. | Modal closes, timer resets, session continues. | [Pass/Fail] |  |
| S-10 | AC-10 | inactivity modal | While warning modal is open, take no action for warning duration. | User is signed out and redirected to `/login`. | [Pass/Fail] |  |
| S-11 | AC-11 | unmatched route | Navigate to an unbuilt route (for example `/members`). | NotFound page renders without unhandled error. | [Pass/Fail] |  |
| S-12 | AC-12 | authenticated route header | Open any authenticated route with org selected. | Header shows logo, nav trigger, org selector, and user menu. | [Pass/Fail] |  |
| S-13 | AC-13 | nav dropdown | Open navigation dropdown and expand Settings. | All 9 top-level items are visible and Settings shows 3 sub-items. | [Pass/Fail] |  |
| S-14 | AC-14 | user menu | Click Sign out from user menu. | Session clears and redirects to `/login`. | [Pass/Fail] |  |
| S-15 | AC-15 | change-password dialog | Open Change password from user menu and submit valid password. | Password updates; dialog closes; no redirect. | [Pass/Fail] |  |
| S-16 | AC-16 | change-password dialog | Submit invalid password in Change password dialog. | Inline validation error is shown and dialog stays open. | [Pass/Fail] |  |
| S-17 | AC-17 | local validation command | Run `npm run validate`. | Command exits 0 with no TypeScript/lint errors. | [Pass/Fail] |  |
| S-18 | AC-18 | authenticated shell | Trigger `toast(...)` from a descendant component. | Toast appears bottom-right without provider error and auto-dismisses. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
