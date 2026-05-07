# TM08 QA Pack

## Slice metadata

- slice_id: TM08
- app: TEAM
- requirement_path: docs/requirements/TM08-organisation-settings-financial-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | /settings/org | Open route as authenticated user with read permission and selected org. | "Organisation settings" page renders with Financial card and form fields. | Not run | - |
| S-02 | AC-02 | /settings/org | Open route where no `core_org_settings` row exists. | Base currency defaults to AUD and other fields are empty. | Not run | - |
| S-03 | AC-04 | /settings/org | Modify recurring fee on existing row and click Save. | Save succeeds; success toast "Organisation settings saved." appears; value persists. | Not run | - |
| S-04 | AC-05 | /settings/org | On first-time row, set base currency and save with optional fields empty. | Upsert succeeds; success toast appears; saved row is reflected on reload. | Not run | - |
| S-05 | AC-06 | /settings/org | Enter tax rate above allowed range and attempt Save. | Validation alert/error appears and Save remains blocked. | Not run | - |
| S-06 | AC-07 | /settings/org | Enter invalid BSB format and attempt Save. | BSB validation error appears with save blocked. | Not run | - |
| S-07 | AC-09 | /settings/org | Change multiple fields, click Cancel. | Form resets to last-loaded values and validation state clears. | Not run | - |
| S-08 | AC-11 | /settings/org | View page with read access but without create permission and no existing row. | Save button is hidden while form remains visible. | Not run | - |
| S-09 | AC-12 | /settings/org | View page with read access but without update permission and existing row. | Save button is hidden while form remains visible. | Not run | - |
| S-10 | AC-13 | /settings/org | Edit fields, switch selected organisation before saving. | Unsaved edits are discarded and default org-switch toast appears. | Not run | - |
| S-11 | AC-14 | /settings/org | Trigger non-23514 server/network failure on Save. | Form stays on screen with edits intact and destructive save-failure toast appears. | Not run | - |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: No
