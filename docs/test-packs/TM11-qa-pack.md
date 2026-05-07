# TM11 QA Pack

## Slice metadata

- slice_id: TM11
- app: TEAM
- requirement_path: docs/requirements/TM11-report-builder-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/reports` | Sign in with `read:page.reports`; open `/reports`. | Reports page, builder panel, templates panel, and results empty state render. | Not run |  |
| S-02 | AC-04 | `/reports` | Leave selected fields empty. | Run report is disabled and "Select at least one field" alert renders. | Not run |  |
| S-03 | AC-03 | `/reports` | Select fields and click Run report. | Results table renders rows and columns in selected field order. | Not run |  |
| S-04 | AC-06 | `/reports` | Run a report returning 10,000 rows. | Truncation alert appears with required "Result truncated" copy. | Not run |  |
| S-05 | AC-07 | `/reports` | Configure report and click Save as new template. | "Template saved." success toast appears; template appears in templates list and load select. | Not run |  |
| S-06 | AC-09 | `/reports` | Load a saved template from load select. | Builder state restores fields/filters/sorts/name/visibility/description from saved template. | Not run |  |
| S-07 | AC-10 | `/reports` | Click Delete on creator-owned template. | Confirmation dialog shows required title/description and Delete/Cancel actions. | Not run |  |
| S-08 | AC-12 | `/reports` | As non-creator org user, load shared template. | Template controls are locked, creator-only message renders, Save/Delete hidden. | Not run |  |
| S-09 | AC-16 | `/reports` | Run report and click Export. | `export.csv` downloads with visible rows in visible-column order. | Not run |  |
| S-10 | AC-22 | `/reports` | Sign in without `read:page.reports`; open `/reports`. | AccessDenied renders and report panels do not render. | Not run |  |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: Yes
