# TM12 QA Pack

## Slice metadata

- slice_id: TM12
- app: TEAM
- requirement_path: docs/requirements/TM12-photo-moderation-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/moderation/photos` | Sign in with `read:page.moderation-photos`; open route. | Photo moderation page renders with Profile photos table sorted by Member ascending. | Not run |  |
| S-02 | AC-02 | `/moderation/photos` | Use org with no profile-photo rows; open route. | Empty state shows required title and description copy. | Not run |  |
| S-03 | AC-06 | `/moderation/photos` preview dialog | Click a thumbnail cell. | Preview dialog opens with larger image and required metadata fields. | Not run |  |
| S-04 | AC-05 | `/moderation/photos` | Sign in with read but no delete permission. | Remove action is hidden in row actions and preview dialog footer. | Not run |  |
| S-05 | AC-03 | `/moderation/photos` remove flow | Click Remove on a row and confirm. | Photo is removed, row leaves table, and success toast "Photo removed." appears. | Not run |  |
| S-06 | AC-04 | `/moderation/photos` remove flow | Force storage-delete failure path and confirm Remove. | Destructive toast appears, confirm dialog stays open, row remains in table. | Not run |  |
| S-07 | AC-08 | `/moderation/photos` | Force list RPC error, then click Retry. | Inline destructive alert renders with retry; retry re-runs list load. | Not run |  |
| S-08 | AC-11 | `/moderation/photos` | Open preview or confirm-remove dialog, then switch organisation. | Open dialog closes, stale-org toast appears, list refreshes for new org. | Not run |  |
| S-09 | AC-10 | `/moderation/photos` | Use Public column filter (Public then Private). | Rows filter correctly by `is_public` true/false state. | Not run |  |
| S-10 | AC-07 | `/moderation/photos` | Sign in without `read:page.moderation-photos`; open route. | AccessDenied renders inside shell and table does not render. | Not run |  |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: Yes
