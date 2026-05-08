# TM07 QA Pack

## Slice metadata

- slice_id: TM07
- app: TEAM
- requirement_path: docs/requirements/TM07-sub-organisations-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | /settings/organisations | Open route as authenticated org admin with read permission. | Page renders with "Sub-organisations" title and child-org table sorted by display name. | Not run | - |
| S-02 | AC-02 | /settings/organisations | Open route when current org has no child organisations. | Empty placeholder renders and Create button is visible when create permission is present. | Not run | - |
| S-03 | AC-03 | /settings/organisations (Create dialog) | Click + New sub-organisation, enter valid fields, submit. | Dialog closes; success toast appears; new row appears in table. | Not run | - |
| S-04 | AC-04 | /settings/organisations (Create dialog) | Submit create form with duplicate internal name. | Inline destructive error appears and dialog remains open. | Not run | - |
| S-05 | AC-06 | /settings/organisations (Edit dialog) | Open Edit on existing row, change display name, save. | Dialog closes; success toast appears; row updates in table. | Not run | - |
| S-06 | AC-07 | /settings/organisations (Edit dialog) | Open Edit dialog and inspect Internal name field. | Internal name is disabled/read-only with helper text indicating immutability. | Not run | - |
| S-07 | AC-08 | /settings/organisations (Edit dialog) | Toggle Active off and save. | Status column updates to Inactive and update success feedback appears. | Not run | - |
| S-08 | AC-10 | /settings/organisations | View page with read permission but without create permission. | + New sub-organisation button is hidden. | Not run | - |
| S-09 | AC-11 | /settings/organisations | View page with read permission but without update permission. | Row Edit action is hidden for all rows. | Not run | - |
| S-10 | AC-12 | /settings/organisations | Open Edit dialog, then switch selected organisation. | Dialog closes; toast indicates editing cancelled due to organisation change; list refetches. | Not run | - |

## Test run summary

- overall result: Automated checks passed; manual scenarios pending execution
- failed scenarios: -
- defect links: N/A
- retest needed: No
- automated coverage:
  - `src/pages/settings/SubOrganisationsPage.test.tsx` (8 tests)
  - `src/lib/settings/subOrganisations.validation.test.ts` (5 tests)
  - `npm run validate` passed on `202605081430` (98 tests pass, 0 fail)
