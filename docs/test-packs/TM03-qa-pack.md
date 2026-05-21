# TM03 QA Pack

## Slice metadata

- slice_id: TM03
- app: TEAM
- requirement_path: docs/requirements/TM03-member-360-requirements.md
- queue_row: TEAM-03
- depends_on: TEAM-01, TEAM-02

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/members/:memberId` | Open Member 360 for current-org member with read permission. | Sections and identity content render in required order. | [Pass/Fail] |  |
| S-02 (AC-02) | Identity card | Open member with `canUpdate` false and true variants. | Identity is read-only; Unlock appears only when `canUpdate` is true. | [Pass/Fail] |  |
| S-03 (AC-03) | Identity edit | Unlock, edit first/last name, click Save. | Person/member updates succeed; edit mode closes; success toast appears. | [Pass/Fail] |  |
| S-04 (AC-04) | Identity edit | Unlock and click Cancel without edits. | Edit mode exits without confirmation dialog. | [Pass/Fail] |  |
| S-05 (AC-05) | Identity edit | Unlock, modify a field, click Cancel; exercise Discard and Continue editing. | Discard resets and exits; Continue editing keeps form open. | [Pass/Fail] |  |
| S-06 (AC-06) | Identity edit | Clear required first name and save. | Save blocked with required error message. | [Pass/Fail] |  |
| S-07 (AC-07) | Identity edit | Set date of birth to a future date and save. | Save blocked with DOB-in-future validation error. | [Pass/Fail] |  |
| S-08 (AC-08) | Identity edit | Set Valid from after Valid to and save. | Save blocked with valid-range error. | [Pass/Fail] |  |
| S-09 (AC-09) | Identity edit | Submit save when person update fails (simulated or forced failure). | Destructive toast; form stays open with edits; member row not updated. | [Pass/Fail] |  |
| S-10 (AC-10) | `/members/:memberId` | Navigate to unknown, deleted, or other-org member id. | Member-not-found experience renders with back-to-members action. | [Pass/Fail] |  |
| S-11 (AC-11) | `/members/:memberId` | Open member in org A; switch org selector to org B where member is absent. | Org-mismatch alert renders with back action. | [Pass/Fail] |  |
| S-12 (AC-12) | `/members/:memberId` | Open route without `read:page.members`. | `AccessDenied` renders inside shell. | [Pass/Fail] | Post-build: `rbac_app_pages` row for `members` under TEAM. |
| S-13 (AC-13) | Additional contacts | Load member with contacts; open View details on a row. | Contacts table renders; read-only details dialog shows required fields. | [Pass/Fail] |  |
| S-14 (AC-14) | Additional contacts | Load member with zero contacts. | Additional contacts empty state renders. | [Pass/Fail] |  |
| S-15 (AC-15) | Member cards | On active card, click Deactivate and confirm. | Confirmation dialog; card deactivates; success toast. | [Pass/Fail] |  |
| S-16 (AC-16) | Member cards | On inactive card, click Reactivate. | Reactivates without confirmation; success toast. | [Pass/Fail] |  |
| S-17 (AC-17) | Applications | Load member with draft and non-draft applications. | Draft excluded; non-draft rows and badge tones match requirement. | [Pass/Fail] |  |
| S-18 (AC-18) | Applications | Member with no non-draft apps or without BASE permission. | Applications empty state renders. | [Pass/Fail] |  |
| S-19 (AC-19) | Standing roles section | Click View roles. | Navigates to `/members/:memberId/roles`. | [Pass/Fail] |  |
| S-20 (AC-20) | Portal CTA | As non-target user with Portal update permission, click Edit in Portal. | New tab opens to portal edit URL with required shape. | [Pass/Fail] |  |
| S-21 (AC-21) | Portal CTA | As non-target user with Portal read-only, click View in Portal. | New tab opens to portal view URL with required shape. | [Pass/Fail] |  |
| S-22 (AC-22) | Portal CTA | Open page when acting user is the target member. | Portal CTA hidden. | [Pass/Fail] |  |
| S-23 (AC-23) | `/members/:memberId` | Click Back to members. | Navigates to `/members`. | [Pass/Fail] |  |
| S-24 (AC-24) | `/members/:memberId` | Cold load page; observe loading states. | Full-page loading then section-level loading for contacts/cards/apps. | [Pass/Fail] |  |
| S-25 (AC-25) | `/members/:memberId` | With org A selected, open id for org B member. | Member-not-found UX; no cross-org data shown. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
