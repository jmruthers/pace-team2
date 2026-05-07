# TM10 QA Pack

## Slice metadata

- slice_id: TM10
- app: TEAM
- requirement_path: docs/requirements/TM10-events-attendees-requirements.md

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/events` | Sign in as a user with `read:page.events`; open `/events`. | Events page heading and events table render with Event name/date/venue/members columns. | Not run |  |
| S-02 | AC-08 | `/events` | Use an org with no qualifying events; open `/events`. | Empty table state shows "No registered-member events" with requirement-defined description. | Not run |  |
| S-03 | AC-09 | `/events` | Type a partial event name in Search; clear the input. | Rows filter by case-insensitive event name match; clearing restores all rows. | Not run |  |
| S-04 | AC-10 | `/events` | Click an event row. | Navigates to `/events/:eventId` using clicked row event id. | Not run |  |
| S-05 | AC-11 | `/events/:eventId` | Open an event detail with org presence. | Back button, event header card (name/date/venue), and attendee table render. | Not run |  |
| S-06 | AC-12 | `/events/:eventId` | Open an event id with no presence for current org. | Event-not-found content renders with Back to events button. | Not run |  |
| S-07 | AC-14 | `/events/:eventId` | Use attendee rows with statuses submitted/under_review/approved/rejected/withdrawn. | Status badges render title-case labels and required tone mapping. | Not run |  |
| S-08 | AC-18 | `/events/:eventId` | Click an attendee row. | Navigates to `/members/:memberId` using row member id. | Not run |  |
| S-09 | AC-20 | `/events` and `/events/:eventId` | Sign in as user without `read:page.events`; open both routes. | AccessDenied renders and list/detail content does not render. | Not run |  |
| S-10 | AC-23 | `/events/:eventId` | Open detail in org A; switch to org B without event presence. | Org-mismatch destructive alert renders with Back to events action. | Not run |  |

## Test run summary

- overall result: Not run
- failed scenarios: -
- defect links: N/A
- retest needed: Yes
