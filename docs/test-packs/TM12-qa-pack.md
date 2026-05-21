# TM12 QA Pack

## Slice metadata

- slice_id: TM12
- app: TEAM
- requirement_path: docs/requirements/TM12-photo-moderation-requirements.md
- queue_row: TEAM-12
- depends_on: TEAM-01

## Manual frontend scenarios

**Execution status (2026-05-19):** Pending signed-in browser pass on app `.env` target. Vitest covers AC-01–AC-05, AC-07–AC-08, AC-11 (see [`TM12-verification-evidence.md`](../delivery/TM12-verification-evidence.md)). MCP verification target has **8** private profile photos, **0** public — seed a `is_public = true` row before S-13 ([`sql/seed-tm12-profile-photos-dev.sql`](../delivery/sql/seed-tm12-profile-photos-dev.sql)).

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/moderation/photos` | Sign in with `read:page.moderation-photos`; open route. | Title "Photo moderation"; Profile photos DataTable sorted by Member ascending. | Pending | Vitest: page title + table |
| S-02 (AC-02) | `/moderation/photos` | Org with zero profile photos for members. | Empty state title and description per requirement. | Pending | Vitest: empty copy |
| S-03 (AC-03) | `/moderation/photos` | With delete permission: Remove on row; confirm. | Storage clear + metadata delete; dialog closes; row removed; toast "Photo removed.". | Pending | Vitest: toast + removePhoto |
| S-04 (AC-04) | `/moderation/photos` | Confirm Remove when `deleteAttachment` fails with storage delete error. | Dialog stays open; destructive toast "Could not remove photo" with message; row remains. | Pending | Vitest: failure toast |
| S-05 (AC-05) | `/moderation/photos` | Read but not delete. | No Remove in row menu; preview has no Remove. | Pending | Vitest: hidden Remove |
| S-06 (AC-06) | `/moderation/photos` | Click thumbnail cell. | Preview: title = member name; larger image; metadata fields per AC-06; no raw `file_path` shown. | Pending |  |
| S-07 (AC-07) | `/moderation/photos` | Without `read:page.moderation-photos`. | `AccessDenied` in PaceMain with required copy; shell chrome visible. | Pending | Vitest: access denied |
| S-08 (AC-08) | `/moderation/photos` | Force list RPC error; Retry. | Destructive Alert "Could not load profile photos." with message; Retry refetches. | Pending | Vitest: Retry |
| S-09 (AC-09) | `/moderation/photos` | More than 25 rows: search, sort, pagination, page sizes. | Search on Member, Uploaded by, File type; sorts work; default 25; options 10/25/50. | Pending |  |
| S-10 (AC-10) | `/moderation/photos` | Filter Public column Public vs Private. | Only matching `is_public` rows per filter. | Pending |  |
| S-11 (AC-11) | `/moderation/photos` | Open preview or confirm-remove; switch org in header. | Dialog closes; default toast "Editing cancelled — organisation changed."; table refetches. | Pending | Vitest: org-change toast |
| S-12 (AC-12) | `/moderation/photos` | Private photo row (`is_public` false). | Thumbnail loads via signed URL; `file_path` never shown in UI. | Pending | MCP: 8 private rows on verification DB |
| S-13 (AC-13) | `/moderation/photos` | Public photo row (`is_public` true). | Thumbnail loads via public-files URL. | Pending | **Blocked until public row seeded** |
| S-14 (AC-14) | `/moderation/photos` | Click member name when Member 360 available / unavailable. | Navigates `/members/:id` when enabled; plain text when not. | Pending | TEAM-03 Built: expect link |
| S-15 (AC-15) | `/moderation/photos` | Simulate second Remove after first succeeded on same row. | Error toast; list stable (no duplicate/crash). | Pending |  |

## Post-build RBAC seeding

Before release, ensure `rbac_app_pages` includes a row for `pageName = 'moderation-photos'` (`scope_type = 'organisation'`, TEAM `app_id`).

## Test run summary

- overall result: **Pending** (manual browser pass not executed in build remediation; Vitest 16/16 TM12 tests pass)
- failed scenarios: —
- defect links: N/A
- retest needed: **Yes** — after seeding ≥1 `is_public = true` profile photo and completing S-01–S-15 in browser
