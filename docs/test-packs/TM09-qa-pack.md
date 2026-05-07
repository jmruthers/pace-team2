# TM09 QA Pack

## Slice metadata

- slice_id: TM09
- app: TEAM
- requirement_path: docs/requirements/TM09-org-form-authoring-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | /forms | Open route as authenticated user with org context and read permission. | Forms list renders for selected organisation. | Not run | - |
| S-02 | AC-03 | /forms | Open list where current org has zero forms. | Empty state renders with org-specific message and Create button when permitted. | Not run | - |
| S-03 | AC-06 | /forms/new -> /forms/:formId | Create valid form in authoring shell and click Save. | Form is created, success toast appears, and navigation goes to new `/forms/:formId`. | Not run | - |
| S-04 | AC-07 | /forms/:formId | Edit existing form name and save. | Save succeeds and success toast "Form saved." appears with updated data. | Not run | - |
| S-05 | AC-08 | /forms/:formId | Open edit route and inspect Slug input. | Slug field is disabled/read-only on edit route. | Not run | - |
| S-06 | AC-11 | /forms/new | Set authoring state to no active fields. | Validation error indicates at least one active field required and Save is disabled. | Not run | - |
| S-07 | AC-16 | /forms/new | Inspect shell sections between metadata and fields cards. | Schedule & limits card renders with opens/closes/max/confirmation/required controls. | Not run | - |
| S-08 | AC-18 | /forms (row action) | Click Copy share URL with configured portal origin. | Correct `${VITE_FORM_PORTAL_URL}/forms/{slug}` is copied and success toast appears. | Not run | - |
| S-09 | AC-21 | /forms (row delete action) | Click Delete on form with response count > 0. | "Cannot delete this form" dialog appears with count and no delete mutation is run. | Not run | - |
| S-10 | AC-22 | /forms (row delete action) | Click Delete on form with response count = 0 and confirm. | Destructive confirmation deletes form; success toast appears; row is removed from list. | Not run | - |
| S-11 | AC-26 | /forms/:formId | Open edit route as user without update permission. | Shell renders in disabled/non-interactive state. | Not run | - |
| S-12 | AC-30 | /forms/:formId | Navigate directly to unknown or wrong-org form id. | Redirects to `/forms` and shows "Form not found in this organisation." toast. | Not run | - |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: No
