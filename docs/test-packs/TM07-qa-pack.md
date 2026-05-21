# TM07 QA Pack

## Slice metadata

- slice_id: TM07
- app: TEAM
- requirement_path: docs/requirements/TM07-sub-organisations-requirements.md
- queue_row: TEAM-07
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/settings/organisations` | Sign in with `read:page.organisations`; open route. | Title "Sub-organisations"; table of direct children sorted by display name ascending. | [Pass/Fail] |  |
| S-02 (AC-02) | `/settings/organisations` | Open when parent has zero children and user can create. | Empty placeholder copy; "+ New sub-organisation" visible. | [Pass/Fail] |  |
| S-03 (AC-03) | `/settings/organisations` | Open Create; fill valid internal name, display name, empty description; submit. | Dialog closes; success toast "Sub-organisation created."; row appears in correct sort order. | [Pass/Fail] |  |
| S-04 (AC-04) | `/settings/organisations` | Submit Create with internal name that collides platform-wide (23505). | Dialog stays open; inline destructive Alert and name field error with required copy. | [Pass/Fail] |  |
| S-05 (AC-05) | `/settings/organisations` | Submit Create with empty internal name. | Submit blocked; top Alert "Please fix the errors below."; internal name required error. | [Pass/Fail] |  |
| S-06 (AC-06) | `/settings/organisations` | Edit row; change display name; Save changes. | Dialog closes; success toast "Sub-organisation updated."; column updates. | [Pass/Fail] |  |
| S-07 (AC-07) | `/settings/organisations` | Open Edit. | Internal name disabled; helper states immutability after create. | [Pass/Fail] |  |
| S-08 (AC-08) | `/settings/organisations` | Edit; set Active off; save. | Status column shows Inactive; success feedback. | [Pass/Fail] |  |
| S-09 (AC-09) | `/settings/organisations` | Open route without `read:page.organisations`. | `AccessDenied` in PaceMain with required copy; shell chrome visible. | [Pass/Fail] |  |
| S-10 (AC-10) | `/settings/organisations` | Read only; no create permission. | "+ New sub-organisation" not rendered. | [Pass/Fail] |  |
| S-11 (AC-11) | `/settings/organisations` | Read only; no update permission. | No Edit on any row. | [Pass/Fail] |  |
| S-12 (AC-12) | `/settings/organisations` | Open Edit; switch org in header. | Dialog closes; default toast "Editing cancelled — organisation changed."; table refetches. | [Pass/Fail] |  |
| S-13 (AC-13) | `/settings/organisations` | With more than 25 children, use search, column sort, pagination, page-size [10,25,50]. | Search matches name/display_name substrings; sort and pagination behave per requirement. | [Pass/Fail] |  |
| S-14 (AC-14) | `/settings/organisations` | Filter Status to Active then Inactive. | Only matching `is_active` rows each time. | [Pass/Fail] |  |
| S-15 (AC-15) | `/settings/organisations` | Submit Create or Edit when server returns non-23505 error. | Dialog stays open; destructive toast "Could not save sub-organisation" with message. | [Pass/Fail] |  |
| S-16 (AC-16) | `/settings/organisations` | Open Edit. | Read-only Parent organisation shows current org display name; no parent_id control. | [Pass/Fail] |  |

## Post-build RBAC seeding

Before release, ensure `rbac_app_pages` includes a row for `pageName = 'organisations'` (`scope_type = 'organisation'`, TEAM `app_id`).

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
