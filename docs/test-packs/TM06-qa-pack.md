# TM06 QA Pack

## Slice metadata

- slice_id: TM06
- app: TEAM
- requirement_path: docs/requirements/TM06-membership-types-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | /settings/membership-types | Open route as authenticated user with org context and read permission. | Membership types page and table render for selected org. | Not run | - |
| S-02 | AC-02 | /settings/membership-types | Load route for org with zero membership type rows. | Empty state copy renders and Create button is visible when canCreate is true. | Not run | - |
| S-03 | AC-03 | /settings/membership-types (Create dialog) | Create a membership type with valid name and age range; submit. | Dialog closes; row appears; success toast "Membership type created." appears. | Not run | - |
| S-04 | AC-04 | /settings/membership-types (Edit dialog) | Edit an existing row and save. | Dialog closes; table refreshes; success toast "Membership type updated." appears. | Not run | - |
| S-05 | AC-05 | /settings/membership-types (Create dialog) | Attempt to create duplicate name in same org; submit. | Inline Name error appears and dialog remains open. | Not run | - |
| S-06 | AC-08 | /settings/membership-types (Deactivate flow) | Click Deactivate on active row and confirm destructive dialog. | Row becomes inactive and success toast `"{name} deactivated."` appears. | Not run | - |
| S-07 | AC-10 | /settings/membership-types (Reactivate action) | Click Reactivate on inactive row. | Row becomes active with no confirm dialog; success toast `"{name} reactivated."` appears. | Not run | - |
| S-08 | AC-12 | /settings/membership-types | View page with canRead true but canCreate/canUpdate false. | Create button hidden; Edit/Deactivate/Reactivate actions hidden. | Not run | - |
| S-09 | AC-14 | /settings/membership-types | Open create/edit dialog, then switch selected organisation. | Dialog closes; edits discarded; default toast indicates editing cancelled due to org change. | Not run | - |
| S-10 | AC-17 | /settings/membership-types (table toolbar + filters) | Use search input and Active column filter. | Search narrows rows; Active filter shows only selected status. | Not run | - |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: No
