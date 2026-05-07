# TM03 QA Pack

## Slice metadata

- slice_id: TM03
- app: TEAM
- requirement_path: docs/requirements/TM03-member-360-requirements.md
- queue_row: TEAM-03
- depends_on: TEAM-01, TEAM-02

## Manual frontend scenarios

| scenario_id | requirement_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|---|
| S-01 | AC-01 | `/members/:memberId` | Open Member 360 for current-org member with read permission. | Sections and identity content render in required order. | [Pass/Fail] |  |
| S-02 | AC-02 | Identity card | Open member with `canUpdate` false and true variants. | Identity is read-only; Unlock appears only when `canUpdate` is true. | [Pass/Fail] |  |
| S-03 | AC-03 | Identity edit | Unlock, edit first/last name, click Save. | Person/member updates succeed, edit mode closes, success toast appears. | [Pass/Fail] |  |
| S-04 | AC-04 | Identity edit | Unlock and click Cancel without edits. | Edit mode exits without confirmation dialog. | [Pass/Fail] |  |
| S-05 | AC-05 | Identity edit | Unlock, modify field, click Cancel and test both dialog actions. | Discard resets/exits; Continue editing keeps form open. | [Pass/Fail] |  |
| S-06 | AC-06 | Identity edit | Clear required first name and save. | Save blocked with required error message. | [Pass/Fail] |  |
| S-07 | AC-07 | Identity edit | Set date of birth to future date and save. | Save blocked with DOB-future validation error. | [Pass/Fail] |  |
| S-08 | AC-08 | Identity edit | Set Valid from after Valid to and save. | Save blocked with valid-range error. | [Pass/Fail] |  |
| S-09 | AC-09 | Identity edit | Force `core_person` update failure on save. | Destructive toast renders; form remains open/dirty; member update not attempted. | [Pass/Fail] |  |
| S-10 | AC-10 | `/members/:memberId` | Navigate to unknown/deleted/other-org member id. | Member-not-found page renders with back-to-members action. | [Pass/Fail] |  |
| S-11 | AC-11 | `/members/:memberId` | Open member in org A, then switch to org B where member absent. | Org-mismatch destructive alert renders with back action. | [Pass/Fail] |  |
| S-12 | AC-12 | `/members/:memberId` | Open route without `read:page.members`. | `AccessDenied` renders in shell. | [Pass/Fail] |  |
| S-13 | AC-13 | Additional contacts | Load member with contacts and open View details. | Contacts table renders; read-only details dialog shows required fields. | [Pass/Fail] |  |
| S-14 | AC-14 | Additional contacts | Load member with zero contacts. | Additional contacts empty state renders. | [Pass/Fail] |  |
| S-15 | AC-15 | Member cards | On active card, click Deactivate and confirm. | Confirmation dialog appears; card deactivates; success toast renders. | [Pass/Fail] |  |
| S-16 | AC-16 | Member cards | On inactive card, click Reactivate. | Reactivation occurs directly; success toast renders. | [Pass/Fail] |  |
| S-17 | AC-17 | Applications | Load member with draft and non-draft applications. | Draft excluded; non-draft rows and badge tones render correctly. | [Pass/Fail] |  |
| S-18 | AC-18 | Applications | Use member with no non-draft apps or no BASE permission. | Applications empty state renders. | [Pass/Fail] |  |
| S-19 | AC-19 | Standing roles section | Click View roles button. | Navigates to `/members/:memberId/roles`. | [Pass/Fail] |  |
| S-20 | AC-20 | Portal CTA | As non-target user with `member-profile` update, click Edit in Portal. | Opens portal edit URL in new tab with required URL shape. | [Pass/Fail] |  |
| S-21 | AC-21 | Portal CTA | As non-target user with read-only `member-profile`, click View in Portal. | Opens portal view URL in new tab with required URL shape. | [Pass/Fail] |  |
| S-22 | AC-22 | Portal CTA | Open page as acting user matching target member. | Portal CTA is hidden regardless of permissions. | [Pass/Fail] |  |
| S-23 | AC-23 | `/members/:memberId` | Click Back to members button. | Navigates to `/members`. | [Pass/Fail] |  |
| S-24 | AC-24 | `/members/:memberId` | Load page from cold state and observe loading transitions. | Full-page loading first, then section-level loading for contacts/cards/apps. | [Pass/Fail] |  |
| S-25 | AC-25 | `/members/:memberId` | With org A selected, open org B member id. | Returns member-not-found UX; no cross-org leakage. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: [list or -]
- defect links: [links or N/A]
- retest needed: [Yes/No]
