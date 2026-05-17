# TM09 QA Pack

## Slice metadata

- slice_id: TM09
- app: TEAM
- requirement_path: docs/requirements/TM09-org-form-authoring-requirements.md
- queue_row: TEAM-09
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/forms` | Sign in with org and `read:page.forms`; open `/forms`. | Title "Forms"; DataTable lists all org `core_forms` rows regardless of active/status. | [Pass/Fail] | Post-build: `rbac_app_pages` row for `forms` under TEAM. |
| S-02 | AC-02 | `/forms` | Load list with distinct `updated_at` values; observe default order. | Rows sort by Updated descending (newest first). | [Pass/Fail] |  |
| S-03 | AC-03 | `/forms` | Open `/forms` for org with zero forms and `canCreate`. | Empty state "No forms yet." with org-specific description; Create form visible in toolbar. | [Pass/Fail] |  |
| S-04 | AC-04 | `/forms` | Type substring in search; clear search. | Only name/workflow/status label matches show; clear restores full list. | [Pass/Fail] |  |
| S-05 | AC-05 | `/forms` | Use 60-row fixture; exercise pages and page-size 10/25/50. | Pagination matches initialPageSize 25 and options [10, 25, 50]. | [Pass/Fail] |  |
| S-06 | AC-06 | `/forms/new` → `/forms/:formId` | Create form per AC-06 fixture (name, slug, org_signup, one field, Save). | INSERT succeeds; navigates to new id; success toast "Form created.". | [Pass/Fail] | Blocked on platform gates per requirement §15 until noted otherwise. |
| S-07 | AC-07 | `/forms/:formId` | Edit existing form: change name; Save. | UPDATE succeeds; toast "Form saved."; fields unchanged if only name edited. | [Pass/Fail] |  |
| S-08 | AC-08 | `/forms/:formId` | Inspect slug field on edit page. | Slug input disabled; shows persisted value; cannot type. | [Pass/Fail] |  |
| S-09 | AC-09 | `/forms/new` | Leave name empty; observe ValidationSummary and Save. | Errors Alert includes "Name is required."; Save disabled. | [Pass/Fail] |  |
| S-10 | AC-10 | `/forms/new` | Set slug to invalid shape (e.g. `Bad Slug!`). | Errors Alert includes slug shape message; Save disabled. | [Pass/Fail] |  |
| S-11 | AC-11 | `/forms/new` | Remove all fields so `state.fields=[]`. | Errors Alert "At least one active field is required."; Save disabled. | [Pass/Fail] |  |
| S-12 | AC-12 | `/forms/new` | Two active fields with same `fieldKey`. | Errors Alert duplicate field key message; Save disabled. | [Pass/Fail] |  |
| S-13 | AC-13 | `/forms/new` | Set workflow to `generic`; Primary entrypoint checked. | Errors Alert primary entrypoint message; Save disabled. | [Pass/Fail] |  |
| S-14 | AC-14 | `/forms/new` | Leave a validation error present; check Active. | Errors include activation-blocked message; Save disabled. | [Pass/Fail] |  |
| S-15 | AC-15 | `/forms/new` | One active field with `fieldType='date'`. | Warnings Alert for unknown field type; Save enabled. | [Pass/Fail] |  |
| S-16 | AC-16 | `/forms/new` | Inspect order of cards in authoring shell. | Between Form metadata and Fields: "Schedule & limits" with Opens, Closes, Max submissions, Confirmation message, Required switch in order. | [Pass/Fail] |  |
| S-17 | AC-17 | `/forms/new` | Open Workflow type Select. | Options exactly: org_signup, information_collection, consent_capture, generic. | [Pass/Fail] |  |
| S-18 | AC-18 | `/forms` | With `VITE_FORM_PORTAL_URL` set; Copy share URL on row with known slug. | Clipboard has `{origin}/forms/{slug}`; success toast "Share URL copied to clipboard.". | [Pass/Fail] |  |
| S-19 | AC-19 | `/forms` | With portal URL set; Open in new tab on row. | New tab at `{origin}/forms/{slug}`; no toast. | [Pass/Fail] |  |
| S-20 | AC-20 | `/forms` | Unset or empty `VITE_FORM_PORTAL_URL`; Copy share URL. | Destructive toast "Portal origin not configured. Contact your administrator."; clipboard unchanged. | [Pass/Fail] |  |
| S-21 | AC-21 | `/forms` | Delete on form with responses count > 0. | Non-destructive Dialog with count body and OK only; no delete on OK. | [Pass/Fail] |  |
| S-22 | AC-22 | `/forms` | Delete on form with zero responses; confirm destructive dialog. | DELETE runs; list refreshes; success toast with form name deleted. | [Pass/Fail] |  |
| S-23 | AC-23 | `/forms` | Open delete ConfirmationDialog; Cancel or Escape. | Dialog closes; no mutation. | [Pass/Fail] |  |
| S-24 | AC-24 | `/forms` | Navigate without `read:page.forms`. | `AccessDenied` with required copy in shell. | [Pass/Fail] |  |
| S-25 | AC-25 | `/forms` | Read but `canCreate` false. | Create form button not in toolbar. | [Pass/Fail] |  |
| S-26 | AC-26 | `/forms/:formId` | Read but `canUpdate` false. | Shell renders disabled; Save and editors non-interactive. | [Pass/Fail] |  |
| S-27 | AC-27 | `/forms` | Read but `canDelete` false. | No Delete row action. | [Pass/Fail] |  |
| S-28 | AC-28 | `/forms` | List loaded for org A; switch to org B. | List refetches; org B rows or empty state. | [Pass/Fail] |  |
| S-29 | AC-29 | `/forms/:formId` | Form in org A; switch to org B where form absent. | Navigates `/forms`; default toast "Switched organisations. Showing forms for {newOrgName}.". | [Pass/Fail] |  |
| S-30 | AC-30 | `/forms/:formId` | Navigate to id not in current org. | Redirect `/forms`; toast "Form not found in this organisation.". | [Pass/Fail] |  |
| S-31 | AC-31 | `/forms/new` or `/forms/:formId` | Save with valid client state; force duplicate-slug 23505 (or equivalent). | Shell stays with edits; destructive toast with normalised message. | [Pass/Fail] |  |
| S-32 | AC-32 | `/forms` | Force list query failure. | Destructive Alert "Could not load forms" with Retry; Retry refetches. | [Pass/Fail] |  |
| S-33 | AC-33 | cross-surface | Org A selected; attempt to surface org B form via list, detail, responses reads. | No org B form data appears in UI. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
