# TM10 QA Pack

## Slice metadata

- slice_id: TM10
- app: TEAM
- requirement_path: docs/requirements/TM10-events-attendees-requirements.md
- queue_row: TEAM-10
- depends_on: TEAM-01, TEAM-03

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/events` | Sign in with org and `read:page.events`; open `/events`. | Heading "Events"; DataTable with Event name, Event date, Event venue, Members registered from RPC. | [Pass/Fail] | Post-build: `rbac_app_pages` row for `events` under TEAM. |
| S-02 (AC-02) | `/events` | Fixture with three rows: dated and null `event_date`; default sort desc. | Order: latest date first, then older, nulls last for desc. | [Pass/Fail] |  |
| S-03 (AC-03) | `/events` | Row with `event_date` and `event_days > 1`. | Event date cell shows inclusive date range per requirement. | [Pass/Fail] |  |
| S-04 (AC-04) | `/events` | Row with single day or `event_days` null/1. | Event date cell shows single formatted date. | [Pass/Fail] |  |
| S-05 (AC-05) | `/events` | Row with null `event_date`. | Cell shows em dash; sorts to bottom under default desc. | [Pass/Fail] |  |
| S-06 (AC-06) | `/events` | Row with null `event_venue`. | Venue cell shows em dash. | [Pass/Fail] |  |
| S-07 (AC-07) | `/events` | Row with known `members_registered_count`. | Members registered cell shows integer. | [Pass/Fail] |  |
| S-08 (AC-08) | `/events` | Org with zero qualifying events. | Empty state title and description; no CTA. | [Pass/Fail] |  |
| S-09 (AC-09) | `/events` | Type in list search; clear. | Filters event names case-insensitive; clear restores. | [Pass/Fail] |  |
| S-10 (AC-10) | `/events` | Click a data row. | Navigates to `/events/:eventId` for that row's id. | [Pass/Fail] |  |
| S-11 (AC-11) | `/events/:eventId` | Open detail for event org has presence; attendees returned. | Back button; header card with name, date span, venue; attendee table Name and Application status. | [Pass/Fail] |  |
| S-12 (AC-12) | `/events/:eventId` | Open event id with no org presence. | "Event not found" heading, description, Back to events → `/events`. | [Pass/Fail] |  |
| S-13 (AC-13) | `/events/:eventId` | Rows with preferred vs first/last only. | Name cell uses preferred + last or first + last per rules. | [Pass/Fail] |  |
| S-14 (AC-14) | `/events/:eventId` | Fixture with submitted, under_review, approved, rejected, withdrawn. | Badges with required labels and tones. | [Pass/Fail] |  |
| S-15 (AC-15) | `/events/:eventId` | Member has draft application for event. | Draft excluded from list and counts. | [Pass/Fail] |  |
| S-16 (AC-16) | `/events/:eventId` | Same person applications from two orgs; view as org A. | Only org A application row visible. | [Pass/Fail] |  |
| S-17 (AC-17) | `/events/:eventId` | Applicant without current-org `core_member` row. | Row excluded from attendee list. | [Pass/Fail] |  |
| S-18 (AC-18) | `/events/:eventId` | Click attendee row. | Navigates to `/members/:memberId`. | [Pass/Fail] |  |
| S-19 (AC-19) | `/events/:eventId` | Click Back to events. | Navigates to `/events`. | [Pass/Fail] |  |
| S-20 (AC-20) | `/events`, `/events/:eventId` | Open without `read:page.events`. | `AccessDenied` in shell; no list or detail content. | [Pass/Fail] |  |
| S-21 (AC-21) | `/events` | Force `app_org_event_summaries` failure. | Destructive Alert "Could not load events" with Retry; Retry re-runs RPC. | [Pass/Fail] |  |
| S-22 (AC-22) | `/events` | List for org A; switch to org B. | RPC refetches; org B data or empty state. | [Pass/Fail] |  |
| S-23 (AC-23) | `/events/:eventId` | Detail for org A presence; switch to org B without presence. | Destructive org-mismatch Alert with Back to events. | [Pass/Fail] |  |
| S-24 (AC-24) | `/events` | Event exists only for org B; org A selected. | List RPC returns no row for that event regardless of search. | [Pass/Fail] |  |

## Vitest coverage (pre-manual sign-off)

Automated tests cover list/detail wiring, display rules, NULLS LAST sort (`event_date_sort_key`), org-mismatch, navigation, and RPC hook contracts. See [`docs/delivery/TM10-verification-evidence.md`](../delivery/TM10-verification-evidence.md).

Scenarios **requiring in-app dev QA:** S-09 (search), S-15–S-17 (RPC row filters), S-22 (org switch UI), S-24 (BR-I cross-org).

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
