# TM06 QA Pack

## Slice metadata

- slice_id: TM06
- app: TEAM
- requirement_path: docs/requirements/TM06-membership-types-requirements.md
- queue_row: TEAM-06
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/settings/membership-types` | Sign in with org; open route with `read:page.membership-types`. | Page shows title "Membership types" and table of all types for current org (active and inactive). | [Pass/Fail] | Post-build: `rbac_app_pages` row for `membership-types` under TEAM. |
| S-02 (AC-02) | `/settings/membership-types` | Open for org with zero membership types and `canCreate`. | Empty state heading and description render; Create visible in toolbar. | [Pass/Fail] |  |
| S-03 (AC-03) | `/settings/membership-types` | Click Create; complete DataTable create handoff; in editor set name, min/max age, Active on; submit. | Editor closes; new row appears; success toast "Membership type created.". | [Pass/Fail] |  |
| S-04 (AC-04) | `/settings/membership-types` | Open Edit on saved row; change name; submit. | Dialog closes; name updates in table; success toast "Membership type updated.". | [Pass/Fail] |  |
| S-05 (AC-05) | `/settings/membership-types` | Create second row with same name as existing (case-insensitive); submit. | Dialog stays open; Name inline error with duplicate-org copy; no new row. | [Pass/Fail] |  |
| S-06 (AC-06) | `/settings/membership-types` | Set min_age greater than max_age; submit. | Submit blocked; field error "Maximum age must be greater than or equal to minimum age.". | [Pass/Fail] |  |
| S-07 (AC-07) | `/settings/membership-types` | Set min_age out of allowed range (e.g. 200); submit. | Submit blocked; field error for minimum age range. | [Pass/Fail] |  |
| S-08 (AC-08) | `/settings/membership-types` | On active row, Deactivate and confirm. | Row becomes inactive; badge "Inactive"; success toast `"{name} deactivated.". | [Pass/Fail] |  |
| S-09 (AC-09) | `/settings/membership-types` | Open Deactivate confirmation; Cancel or Escape. | Dialog closes; no mutation; row stays active. | [Pass/Fail] |  |
| S-10 (AC-10) | `/settings/membership-types` | On inactive row, click Reactivate. | No confirmation; row active; badge "Active"; success toast `"{name} reactivated.". | [Pass/Fail] |  |
| S-11 (AC-11) | `/settings/membership-types` | Open without `read:page.membership-types`. | `AccessDenied` with required copy inside shell. | [Pass/Fail] |  |
| S-12 (AC-12) | `/settings/membership-types` | View with read but no create/update. | Create hidden; no Edit/Deactivate/Reactivate on rows. | [Pass/Fail] |  |
| S-13 (AC-13) | `/settings/membership-types` | Load list for org A; switch header org to org B. | List refetches; shows org B rows or empty state. | [Pass/Fail] |  |
| S-14 (AC-14) | `/settings/membership-types` | Open create or edit; switch org in header. | Dialog closes; default toast "Editing cancelled — organisation changed.". | [Pass/Fail] |  |
| S-15 (AC-15) | `/settings/membership-types` | Use type with known member assignment count. | Members column shows correct integer count (including zero). | [Pass/Fail] |  |
| S-16 (AC-16) | `/settings/membership-types` | Open editor; inspect form and network payload on save. | No audit fields in UI; payload omits created/updated columns. | [Pass/Fail] |  |
| S-17 (AC-17) | `/settings/membership-types` | Type in search; apply Active column filter to Inactive. | Only matching rows; only inactive rows when filtered. | [Pass/Fail] |  |
| S-18 (AC-18) | `/settings/membership-types` | Load rows "Bravo", "Alpha", "Charlie". | Default Name sort: Alpha, Bravo, Charlie. | [Pass/Fail] |  |
| S-19 (AC-19) | `/settings/membership-types` | Submit valid create when server returns 5xx. | Editor stays open; destructive toast with normalised message. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
