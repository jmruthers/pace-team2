# TM13 QA Pack

## Slice metadata

- slice_id: TM13
- app: TEAM
- requirement_path: docs/requirements/TM13-communications-pump-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/communications` | Sign in with `read:page.CommsLog`; open route. | Communications heading, recipient-mode card, composer card, and recipient preview render. | Not run |  |
| S-02 | AC-02 | `/communications` sender fields | Open page with valid sender identity for org. | Sender fields pre-fill from effective sender identity RPC values. | Not run |  |
| S-03 | AC-04 | `/communications` to `/members` hand-off | In Specific members mode click "Choose members…". | Session payload is written and navigation to `/members` occurs with comms picker intent. | Not run |  |
| S-04 | AC-05 | `/communications` return from picker | Return with same-org payload containing member ids. | Mode is Specific members, selected count renders, manual pool hydrates, key is cleared. | Not run |  |
| S-05 | AC-07 | `/communications` recipient filters | In org-members mode select one membership-type chip. | Pool descriptor includes selected `member_type_ids` as strings and preview re-resolves. | Not run |  |
| S-06 | AC-10 | `/communications` template section | Select an active channel template. | Draft fields populate from selected template values. | Not run |  |
| S-07 | AC-12 | `/communications` unresolved-token gate | With unresolved token present, click Send now. | Send is blocked and destructive toast shows unresolved-token message. | Not run |  |
| S-08 | AC-13 | `/communications` send flow | Submit a valid send and receive success response with suppression count. | Success toast shows recipient count and suppression-skipped suffix; draft resets for channel. | Not run |  |
| S-09 | AC-14 | `/communications` schedule flow | Enter datetime, click Confirm schedule, receive success response. | Success toast shows scheduled datetime; schedule input collapses; draft resets for channel. | Not run |  |
| S-10 | AC-19 | `/communications` org switch | Start with manual recipients in org A, then switch to org B. | Manual recipients and filters clear, mode resets to org members, stale-org toast appears. | Not run |  |
| S-11 | AC-20 | `/communications` | Sign in without `read:page.CommsLog`; open route. | AccessDenied renders and recipient/composer UI does not render. | Not run |  |
| S-12 | AC-21 | `/communications` | Sign in with read/create but without update permission. | Composer shows read-only state and action footer is replaced by read-only alert. | Not run |  |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: Yes
