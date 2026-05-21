# TM04 QA Pack

## Slice metadata

- slice_id: TM04
- app: TEAM
- requirement_path: docs/requirements/TM04-standing-roles-requirements.md
- queue_row: TEAM-04
- depends_on: TEAM-01, TEAM-03

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/members/:memberId/roles` | Open standing roles route with read permission and seeded rows. | Header + table render with expected columns and rows. | [Pass/Fail] |  |
| S-02 (AC-02) | role-history table | Use one active and one ended role fixture. | Default sort and badge/date rendering match requirement. | [Pass/Fail] |  |
| S-03 (AC-03) | role-history table | Load row with missing role-type join. | Role column shows em dash fallback. | [Pass/Fail] |  |
| S-04 (AC-04) | Add role dialog | Open Add role, select valid type, submit. | Insert succeeds; modal closes; row appears; success toast renders. | [Pass/Fail] |  |
| S-05 (AC-05) | Add role dialog | Select role type already active for member. | Duplicate helper appears and Submit is disabled. | [Pass/Fail] |  |
| S-06 (AC-06) | Add role dialog | Simulate race causing `core_member_role_active_unique` violation on submit. | Modal stays open and destructive duplicate-race toast appears. | [Pass/Fail] |  |
| S-07 (AC-07) | Add role dialog | Force non-uniqueness insert error on submit. | Modal stays open and destructive normalized error toast appears. | [Pass/Fail] |  |
| S-08 (AC-08) | page header | Use org with zero role types and `canUpdate=true`. | Add role button is disabled with required helper text. | [Pass/Fail] |  |
| S-09 (AC-09) | End role dialog | Open End role on active row and confirm with valid date. | Update succeeds; row ends; success toast renders. | [Pass/Fail] |  |
| S-10 (AC-10) | End role dialog | Choose end date before start date. | Validation helper appears and Confirm is disabled. | [Pass/Fail] |  |
| S-11 (AC-11) | End role dialog | Force update failure on End role confirm. | Dialog closes and destructive normalized error toast appears. | [Pass/Fail] |  |
| S-12 (AC-12) | `/members/:memberId/roles` | Navigate to unknown/deleted/other-org member id. | Member-not-found page renders with back-to-members action. | [Pass/Fail] |  |
| S-13 (AC-13) | `/members/:memberId/roles` | Open valid member in org A, switch to org B where absent. | Org-mismatch destructive alert renders with back action. | [Pass/Fail] |  |
| S-14 (AC-14) | `/members/:memberId/roles` | Open route without `read:page.member-roles`. | `AccessDenied` renders in shell. | [Pass/Fail] |  |
| S-15 (AC-15) | `/members/:memberId/roles` | Open route with read allowed and `canUpdate=false`. | Table is read-only; Add role and End role actions are hidden. | [Pass/Fail] |  |
| S-16 (AC-16) | role-history table | Load member with zero role rows. | Empty-state copy renders. | [Pass/Fail] |  |
| S-17 (AC-17) | role-history section | Force role-history query failure and click Retry. | Destructive alert + Retry render while page header remains. | [Pass/Fail] |  |
| S-18 (AC-18) | `/members/:memberId/roles` | Observe initial load then role-history load. | Full-page loading for member query; table loading after member resolves. | [Pass/Fail] |  |
| S-19 (AC-19) | `/members/:memberId/roles` | With org A selected, open org B member id route. | Member-not-found UX renders; no cross-org data leakage. | [Pass/Fail] |  |
| S-20 (AC-20) | page header back action | Click Back to Member 360. | Navigates to `/members/:memberId`. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
