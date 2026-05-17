# TM12 QA Pack

## Slice metadata

- slice_id: TM12
- app: TEAM
- requirement_path: docs/requirements/TM12-photo-moderation-requirements.md
- queue_row: TEAM-12
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/moderation/photos` | Sign in with `read:page.moderation-photos`; open route. | Title "Photo moderation"; Profile photos DataTable sorted by Member ascending. | [Pass/Fail] |  |
| S-02 | AC-02 | `/moderation/photos` | Org with zero profile photos for members. | Empty state title and description per requirement. | [Pass/Fail] |  |
| S-03 | AC-03 | `/moderation/photos` | With delete permission: Remove on row; confirm. | Storage clear + metadata delete; dialog closes; row removed; toast "Photo removed.". | [Pass/Fail] |  |
| S-04 | AC-04 | `/moderation/photos` | Confirm Remove when `deleteAttachment` fails with storage delete error. | Dialog stays open; destructive toast "Could not remove photo" with message; row remains. | [Pass/Fail] |  |
| S-05 | AC-05 | `/moderation/photos` | Read but not delete. | No Remove in row menu; preview has no Remove. | [Pass/Fail] |  |
| S-06 | AC-06 | `/moderation/photos` | Click thumbnail cell. | Preview: title = member name; larger image; metadata fields per AC-06; no raw `file_path` shown. | [Pass/Fail] |  |
| S-07 | AC-07 | `/moderation/photos` | Without `read:page.moderation-photos`. | `AccessDenied` in PaceMain with required copy; shell chrome visible. | [Pass/Fail] |  |
| S-08 | AC-08 | `/moderation/photos` | Force list RPC error; Retry. | Destructive Alert "Could not load profile photos." with message; Retry refetches. | [Pass/Fail] |  |
| S-09 | AC-09 | `/moderation/photos` | More than 25 rows: search, sort, pagination, page sizes. | Search on Member, Uploaded by, File type; sorts work; default 25; options 10/25/50. | [Pass/Fail] |  |
| S-10 | AC-10 | `/moderation/photos` | Filter Public column Public vs Private. | Only matching `is_public` rows per filter. | [Pass/Fail] |  |
| S-11 | AC-11 | `/moderation/photos` | Open preview or confirm-remove; switch org in header. | Dialog closes; default toast "Editing cancelled — organisation changed."; table refetches. | [Pass/Fail] |  |
| S-12 | AC-12 | `/moderation/photos` | Private photo row (`is_public` false). | Thumbnail loads via signed URL; `file_path` never shown in UI. | [Pass/Fail] |  |
| S-13 | AC-13 | `/moderation/photos` | Public photo row (`is_public` true). | Thumbnail loads via public-files URL. | [Pass/Fail] |  |
| S-14 | AC-14 | `/moderation/photos` | Click member name when Member 360 available / unavailable. | Navigates `/members/:id` when enabled; plain text when not. | [Pass/Fail] |  |
| S-15 | AC-15 | `/moderation/photos` | Simulate second Remove after first succeeded on same row. | Error toast; list stable (no duplicate/crash). | [Pass/Fail] |  |

## Post-build RBAC seeding

Before release, ensure `rbac_app_pages` includes a row for `pageName = 'moderation-photos'` (`scope_type = 'organisation'`, TEAM `app_id`).

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
