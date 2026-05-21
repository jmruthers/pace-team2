# TM05 QA Pack

## Slice metadata

- slice_id: TM05
- app: TEAM
- requirement_path: docs/requirements/TM05-member-requests-review-requirements.md
- queue_row: TEAM-05
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/approvals` | Open `/approvals` with read permission. | Title renders; Open tab is default; queue shows current-org open requests. | [Pass/Fail] |  |
| S-02 (AC-02) | Open tab | Load open rows with distinct submit times. | Default sort is submitted ascending (FIFO). | [Pass/Fail] |  |
| S-03 (AC-03) | Open tab | Use org with zero open join/transfer rows. | Open empty state and `/forms` guidance link render. | [Pass/Fail] |  |
| S-04 (AC-04) | Closed tab | Switch to Closed with fixture rows. | Default sort is resolved descending. | [Pass/Fail] |  |
| S-05 (AC-05) | Closed tab | Use org with no closed rows. | Closed empty state renders. | [Pass/Fail] |  |
| S-06 (AC-06) | Open tab | Type search text and clear it. | In-memory search filters by applicant/member number; clear restores list. | [Pass/Fail] |  |
| S-07 (AC-07) | Open tab toolbar | Set request-type filter to Transfer then All. | Server-filtered list matches selected type then resets. | [Pass/Fail] |  |
| S-08 (AC-08) | Open tab pagination | Use 60-row fixture and page controls. | Pagination and page-size behavior matches requirement. | [Pass/Fail] |  |
| S-09 (AC-09) | `/approvals` -> `/approvals/:requestId` | Click queue row at `md+`. | URL updates to detail route and review panel opens. | [Pass/Fail] |  |
| S-10 (AC-10) | review panel left column | Open detail for transfer request with populated fields. | Applicant and Request groups show required request metadata. | [Pass/Fail] |  |
| S-11 (AC-11) | review panel right column | Open detail with linked form responses. | Label/value response rows render correctly. | [Pass/Fail] |  |
| S-12 (AC-12) | review panel right column | Open detail with no form responses/config. | Right-column empty state with `/forms` guidance renders. | [Pass/Fail] |  |
| S-13 (AC-13) | Approve (with applicant number) | Open pending request with applicant member number and confirm Approve. | RPC approve flow succeeds; invalidations run; navigate `/approvals`; success toast appears. | [Pass/Fail] |  |
| S-14 (AC-14) | Approve (manual number input) | Open pending request without applicant member number; enter number and approve. | Input dialog validates and approve succeeds with success toast/navigation. | [Pass/Fail] |  |
| S-15 (AC-15) | Reject dialog | Open pending request, enter note >=10 chars, confirm Reject. | Reject succeeds; navigate `/approvals`; success toast appears. | [Pass/Fail] |  |
| S-16 (AC-16) | Put on hold dialog | Open pending request, confirm Put on hold with optional note empty. | On-hold succeeds; open/open-count invalidated; success toast appears. | [Pass/Fail] |  |
| S-17 (AC-17) | Reject dialog | Enter short reject note (<10 trimmed chars). | Reject confirm remains disabled. | [Pass/Fail] |  |
| S-18 (AC-18) | stale resolve flow | Resolve same pending request in two sessions. | Second resolve gets stale toast, invalidates queues/count, navigates `/approvals`. | [Pass/Fail] |  |
| S-19 (AC-19) | `/approvals` | Open route without `read:page.approvals`. | `AccessDenied` renders and queue/panel are hidden. | [Pass/Fail] |  |
| S-20 (AC-20) | `/approvals/:requestId` | Open pending request with read allowed but update denied. | Detail renders read-only with action rail hidden. | [Pass/Fail] |  |
| S-21 (AC-21) | closed detail panel | Open closed request detail. | Read-only header strip shows outcome/resolver/date and note; no action rail. | [Pass/Fail] |  |
| S-22 (AC-22) | withdrawn detail panel | Open withdrawn request where `subject_member_id` is null. | Detail renders; View member 360 link is suppressed. | [Pass/Fail] |  |
| S-23 (AC-23) | review panel link | Open detail where subject member exists and click View member 360. | Link is visible and navigates to `/members/:memberId`. | [Pass/Fail] |  |
| S-24 (AC-24) | Open tab | Force open-list query failure and click Retry. | Destructive alert + Retry render and Retry re-runs query. | [Pass/Fail] |  |
| S-25 (AC-25) | detail with org switch | Open `/approvals/:requestId` in org A, switch to org B where request absent. | Navigates `/approvals` and shows org-switch toast. | [Pass/Fail] |  |
| S-26 (AC-26) | unknown request route | Navigate directly to wrong-org/unknown `/approvals/:requestId`. | Redirects to `/approvals` with request-not-found toast. | [Pass/Fail] |  |
| S-27 (AC-27) | mobile layout (`<md`) | At mobile width, open `/approvals` then select row. | Queue-only list on parent route; detail-only panel on child route. | [Pass/Fail] |  |
| S-28 (AC-28) | desktop layout (`md+`) | At `md+` width, open `/approvals` with no selected row. | Two-column hybrid layout shows queue + empty right-pane prompt. | [Pass/Fail] |  |
| S-29 (AC-29) | cross-org data isolation | With org A selected, verify org B request is not returned in list/detail/response reads. | No cross-org data leakage appears. | [Pass/Fail] |  |
| S-30 (AC-30) | approvals nav badge | Resolve one pending request and observe open-count key consumer. | Open-count invalidates/refetches and badge value updates accordingly. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
