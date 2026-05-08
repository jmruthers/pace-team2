# TM06 QA Pack

## Slice metadata

- slice_id: TM06
- app: TEAM
- requirement_path: docs/requirements/TM06-membership-types-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | /settings/membership-types | Open route as authenticated user with org context and read permission. | Membership types page and table render for selected org. | Passed | Covered by automated page test (`Membership types` title render). |
| S-02 | AC-02 | /settings/membership-types | Load route for org with zero membership type rows. | Empty state copy renders and Create button is visible when canCreate is true. | Passed | Covered by automated page test (empty-state title/description). |
| S-03 | AC-03 | /settings/membership-types (Create dialog) | Create a membership type with valid name and age range; submit. | Dialog closes; row appears; success toast "Membership type created." appears. | Passed | Covered by automated page test (create success toast path). |
| S-04 | AC-04 | /settings/membership-types (Edit dialog) | Edit an existing row and save. | Dialog closes; table refreshes; success toast "Membership type updated." appears. | Passed | Covered by automated page test (edit success toast path). |
| S-05 | AC-05 | /settings/membership-types (Create dialog) | Attempt to create duplicate name in same org; submit. | Inline Name error appears and dialog remains open. | Passed | Covered by automated test `src/pages/settings/MembershipTypesPage.test.tsx` (23505 inline error, no destructive toast). |
| S-06 | AC-08 | /settings/membership-types (Deactivate flow) | Click Deactivate on active row and confirm destructive dialog. | Row becomes inactive and success toast `"{name} deactivated."` appears. | Passed | Covered by automated page test (deactivate confirm + success toast). |
| S-07 | AC-10 | /settings/membership-types (Reactivate action) | Click Reactivate on inactive row. | Row becomes active with no confirm dialog; success toast `"{name} reactivated."` appears. | Passed | Covered by automated page test (reactivate row action + success toast). |
| S-08 | AC-12 | /settings/membership-types | View page with canRead true but canCreate/canUpdate false. | Create button hidden; Edit/Deactivate/Reactivate actions hidden. | Passed | Covered by automated page tests for `canCreate === false` and `canUpdate === false`. |
| S-09 | AC-14 | /settings/membership-types | Open create/edit dialog, then switch selected organisation. | Dialog closes; edits discarded; default toast indicates editing cancelled due to org change. | Passed | Covered by automated test `src/pages/settings/MembershipTypesPage.test.tsx` (org switch closes dialog + BR-07 toast). |
| S-10 | AC-17 | /settings/membership-types (table toolbar + filters) | Use search input and Active column filter. | Search narrows rows; Active filter shows only selected status. | Not run | Manual browser QA still required for true DataTable interaction coverage. |

## Test run summary

- overall result: Partial
- failed scenarios: -
- defect links: N/A
- retest needed: Yes (manual in-app pass required for remaining scenarios)

## Verification evidence (TM06 §12)

- Automated validation: `npm run validate` passed (`202605081411`), including lint/build/tests.
- Automated tests: `78` passed, `0` failed.
- Supabase MCP checks (dev-db `rkytnffgmwnnmewevqgp`) completed:
  - `data_get_app_id('TEAM')` returns a non-null UUID and `data_check_rbac_permission_with_context(...)` exists.
  - `core_membership_type.is_active` is `NOT NULL` with default `true`.
  - Unique constraint `core_membership_type_name_organisation_id_key` exists on `(name, organisation_id)`.
  - RLS policies present for membership-type mutations: `rbac_insert_core_membership_type`, `rbac_update_core_membership_type`, each scoped to `membership-types` RBAC checks.
  - RLS bypass probe (authenticated role + synthetic user id without permissions): INSERT attempt fails with `42501` (`new row violates row-level security policy for table core_membership_type`).
  - RLS bypass probe for UPDATE under same identity returns `updated_rows = 0` (no row writable without permission).
