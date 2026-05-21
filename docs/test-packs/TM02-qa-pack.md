# TM02 QA Pack

## Slice metadata

- slice_id: TM02
- app: TEAM
- requirement_path: docs/requirements/TM02-member-directory-requirements.md
- queue_row: TEAM-02
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/members` | Open `/members` with read permission. | Title is Members, Members tab is default, Pending tab is visible. | [Pass/Fail] |  |
| S-02 (AC-02) | `/members` Members tab | Load fixture with mixed last names. | Rows default-sort by name (last then first ascending). | [Pass/Fail] |  |
| S-03 (AC-03) | `/members` Members tab | Use org with zero active/suspended members. | Members empty state copy renders. | [Pass/Fail] |  |
| S-04 (AC-04) | `/members` Pending tab | Open Pending tab with qualifying provisional requests. | Pending rows render with required columns. | [Pass/Fail] |  |
| S-05 (AC-05) | `/members` Pending tab | Use org with no qualifying pending rows. | Pending empty state copy renders. | [Pass/Fail] |  |
| S-06 (AC-06) | `/members` Pending tab | Include provisional member lacking open request. | That member is excluded from Pending list. | [Pass/Fail] |  |
| S-07 (AC-07) | `/members` Members tab | Type search term and then clear it. | In-memory filter applies; clear restores full list. | [Pass/Fail] |  |
| S-08 (AC-08) | `/members` Members tab | Select membership-type filter, then reset to All; inspect Pending tab toolbar. | Members list filters by selected type; Pending has no membership-type filter. | [Pass/Fail] |  |
| S-09 (AC-09) | `/members` Members tab | Use 60-row dataset and page controls/page-size options. | Pagination and page-size behavior matches requirement. | [Pass/Fail] |  |
| S-10 (AC-10) | `/members` | Click a row in normal mode. | Navigates to `/members/:memberId`. | [Pass/Fail] |  |
| S-11 (AC-11) | `/members` | Open `/members` without `read:page.members`. | `AccessDenied` renders; table/tabs hidden. | [Pass/Fail] |  |
| S-12 (AC-12) | `/members` Members tab | Force members query failure and click Retry. | Destructive alert + Retry renders; Retry re-runs query. | [Pass/Fail] |  |
| S-13 (AC-13) | `/members` | With page loaded for org A, switch to org B. | Lists refetch to org B data/empty state. | [Pass/Fail] |  |
| S-14 (AC-14) | `/members` picker mode | Enter with `location.state.intent='commsManualPick'`. | Picker banner and sticky action bar render; Members-only view. | [Pass/Fail] |  |
| S-15 (AC-15) | `/members` picker mode | Seed matching-org payload in `sessionStorage`; enter picker mode. | Matching payload hydrates preselected rows/counter. | [Pass/Fail] |  |
| S-16 (AC-16) | `/members` picker mode | Seed mismatched-org payload in `sessionStorage`; enter picker mode. | Selection starts empty. | [Pass/Fail] |  |
| S-17 (AC-17) | `/members` picker mode | Select members and click Done. | Writes payload to `sessionStorage` and navigates to `/communications`. | [Pass/Fail] |  |
| S-18 (AC-18) | `/members` picker mode | With prior payload present, click Cancel. | Navigates to `/communications` without overwriting payload. | [Pass/Fail] |  |
| S-19 (AC-19) | `/members` picker mode | Ensure no rows selected. | Done is disabled and helper copy is shown. | [Pass/Fail] |  |
| S-20 (AC-20) | `/members` picker mode | Select 700 rows. | Soft-cap warning appears and Done stays enabled. | [Pass/Fail] |  |
| S-21 (AC-21) | `/members` picker mode | Select 2001 rows. | Hard-cap destructive warning appears and Done is disabled. | [Pass/Fail] |  |
| S-22 (AC-22) | `/members?pick=comms` | Navigate with query param only (no state intent). | Picker mode does not activate; normal tabs render. | [Pass/Fail] |  |
| S-23 (AC-23) | `/members` picker mode | With selected rows, switch org. | Selection clears and org-switch toast renders. | [Pass/Fail] |  |
| S-24 (AC-24) | `/members` | With org A selected, inspect results for known org B member. | Cross-org rows are not returned. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
