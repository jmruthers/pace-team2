# TM11 QA Pack

## Slice metadata

- slice_id: TM11
- app: TEAM
- requirement_path: docs/requirements/TM11-report-builder-requirements.md
- queue_row: TEAM-11
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/reports` | Sign in with org and `read:page.reports`; open `/reports`. | Title "Reports"; builder card with explore default; Templates panel; results empty state. | [Pass/Fail] | Post-build: `rbac_app_pages` row for `reports` under TEAM. |
| S-02 (AC-02) | `/reports` | Catalogue with participant report fields. | Fields list shows available rows in table_name, field_name order. | [Pass/Fail] |  |
| S-03 (AC-03) | `/reports` | Select fields; Run with org data present. | Results panel shows columns per selection and row data. | [Pass/Fail] |  |
| S-04 (AC-04) | `/reports` | No fields selected. | Run disabled; default Alert copy about selecting fields. | [Pass/Fail] |  |
| S-05 (AC-05) | `/reports` | Run when execution rejects. | Destructive Alert above results; Run re-enables. | [Pass/Fail] |  |
| S-06 (AC-06) | `/reports` | Run hits 10,000 row cap. | Default Alert "Result truncated" with required description. | [Pass/Fail] |  |
| S-07 (AC-07) | `/reports` | Select fields, name template, Save as creator. | Success toast "Template saved."; new row in Templates and Load select. | [Pass/Fail] |  |
| S-08 (AC-08) | `/reports` | After save, inspect persisted row (SQL or admin). | `app_id`, `domain_id`, `organisation_id`, `created_by` per requirement. | [Pass/Fail] |  |
| S-09 (AC-09) | `/reports` | Load template with fields, filters, sorts, metadata. | Builder state matches saved template. | [Pass/Fail] |  |
| S-10 (AC-10) | `/reports` | Delete on template "My report". | Dialog title, description, Delete/Cancel labels per requirement. | [Pass/Fail] |  |
| S-11 (AC-11) | `/reports` | Confirm delete for creator-owned template. | Success toast "Template deleted."; row removed; results empty; active template cleared. | [Pass/Fail] |  |
| S-12 (AC-12) | `/reports` | Non-creator opens org-shared template. | Name/visibility/description disabled; lock caption; Save and Delete hidden. | [Pass/Fail] |  |
| S-13 (AC-13) | `/reports` | Force non-creator save race / denial. | Destructive toast literal "Only the template creator can edit this template.". | [Pass/Fail] |  |
| S-14 (AC-14) | `/reports` | Templates with `is_private` true and false. | Badges "Private" vs "Org-shared" in list. | [Pass/Fail] |  |
| S-15 (AC-15) | `/reports` | Toggle visibility checkbox. | Label "Private template" vs "Event-shared template" per state. | [Pass/Fail] |  |
| S-16 (AC-16) | `/reports` | Run report with `canExport`; Export. | Downloads `export.csv` with visible columns order. | [Pass/Fail] |  |
| S-17 (AC-17) | `/reports` | User with `canExport` false. | Export not in results toolbar. | [Pass/Fail] |  |
| S-18 (AC-18) | `/reports` | `canCreate` and `canUpdate` both false. | Save not in builder footer. | [Pass/Fail] |  |
| S-19 (AC-19) | `/reports` | `canDelete` false. | Delete hidden in builder and Templates kebab. | [Pass/Fail] |  |
| S-20 (AC-20) | `/reports` | Zero catalogue rows for explore. | Fields section shows administrator message; Run disabled. | [Pass/Fail] |  |
| S-21 (AC-21) | `/reports` | Org with zero templates. | Templates body "No saved templates yet."; Load shows placeholder only. | [Pass/Fail] |  |
| S-22 (AC-22) | `/reports` | Without `read:page.reports`. | `AccessDenied` with required copy; no panels. | [Pass/Fail] |  |
| S-23 (AC-23) | `/reports` | Builder with results for org A; switch to org B. | Metadata and templates refetch; active template cleared; results empty. | [Pass/Fail] |  |
| S-24 (AC-24) | `/reports` | Orphan template row with `app_id` NULL in DB for org. | Row skipped in Templates list UI. | [Pass/Fail] |  |
| S-25 (AC-25) | `/reports` | Templates for org B only; org A selected. | No org B templates in panel regardless of search. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
