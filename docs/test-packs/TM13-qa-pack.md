# TM13 QA Pack

## Slice metadata

- slice_id: TM13
- app: TEAM
- requirement_path: docs/requirements/TM13-communications-pump-requirements.md
- queue_row: TEAM-13
- depends_on: TEAM-01, TEAM-02

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/communications` | Sign in with org and `read:page.comms-log`; open route. | Heading "Communications"; recipient-mode card default All org members; composer email; pool preview visible. | [Pass/Fail] | Verify `PagePermissionGuard` resolves per requirement §15 if TEAM-only RBAC. |
| S-02 (AC-02) | `/communications` | Load org with known sender identity RPC values. | Sender name, email (and phone when switched) match RPC. | [Pass/Fail] |  |
| S-03 (AC-03) | `/communications` | Default All members; switch to Specific members with empty list. | "Choose members…" shown; pool preview shows estimated_count 0 after resolve. | [Pass/Fail] |  |
| S-04 (AC-04) | `/communications` | Specific members; click Choose members… | `sessionStorage` payload set; navigates `/members` with comms picker intent. | [Pass/Fail] |  |
| S-05 (AC-05) | `/communications` | Return from picker with same-org payload and member ids. | Specific members mode; count; manual pool; storage key cleared. | [Pass/Fail] |  |
| S-06 (AC-06) | `/communications` | Mount with storage payload for different org than selected. | All org members mode; default pool; key cleared. | [Pass/Fail] |  |
| S-07 (AC-07) | `/communications` | All org members; select one membership-type chip. | Pool descriptor includes string `member_type_ids`; preview re-runs. | [Pass/Fail] |  |
| S-08 (AC-08) | `/communications` | Toggle include-inactive. | Pool filters include `include_inactive: true`; preview re-runs. | [Pass/Fail] |  |
| S-09 (AC-09) | `/communications` | Email draft with subject/html; switch channel to SMS. | Text preserved; email-only fields dropped; SMS sender phone visible; preview uses `sms`. | [Pass/Fail] |  |
| S-10 (AC-10) | `/communications` | Email channel; select active template. | Draft fields populate from template. | [Pass/Fail] |  |
| S-11 (AC-11) | `/communications` | Strict template with unresolved token; Send now. | No adapter call; destructive toast strict-template message; draft unchanged. | [Pass/Fail] |  |
| S-12 (AC-12) | `/communications` | Block-on-unresolved on; no template; unknown token in body; Send now. | Blocking UI; no adapter call; destructive toast resolve-tokens message. | [Pass/Fail] |  |
| S-13 (AC-13) | `/communications` | Valid email send; success response with counts. | Success toast with recipient and suppression counts; draft reset; stay on page. | [Pass/Fail] |  |
| S-14 (AC-14) | `/communications` | Valid draft; schedule datetime; Confirm schedule success. | Success toast with scheduled time; schedule collapses; draft reset. | [Pass/Fail] |  |
| S-15 (AC-15) | `/communications` | Send returns gateway failure payload. | Destructive toast with error message; draft unchanged. | [Pass/Fail] |  |
| S-16 (AC-16) | `/communications` | Send test success. | Success toast "Test message sent."; draft unchanged. | [Pass/Fail] |  |
| S-17 (AC-17) | `/communications` | Send test failure. | Destructive toast with failure message; draft unchanged. | [Pass/Fail] |  |
| S-18 (AC-18) | `/communications` | Filters yield zero recipients; try Send now. | Inline "No recipients match these filters."; Send/Schedule disabled; bypass shows toast. | [Pass/Fail] |  |
| S-19 (AC-19) | `/communications` | Specific members selected; switch org. | Resets to All members; clears manual, chips, include-inactive; sender RPC re-runs; default toast. | [Pass/Fail] |  |
| S-20 (AC-20) | `/communications` | Without `read:page.comms-log`. | `AccessDenied`; no recipient or composer UI. | [Pass/Fail] |  |
| S-21 (AC-21) | `/communications` | Read+create but not update. | Read-only banner; inputs disabled; footer replaced by view-only alert. | [Pass/Fail] |  |
| S-22 (AC-22) | `/communications` | In-progress draft; Cancel. | Navigates `/`; draft discarded. | [Pass/Fail] |  |
| S-23 (AC-23) | `/communications` | Sender identity RPC fails on mount. | Sender fields empty; destructive toast per requirement copy. | [Pass/Fail] |  |
| S-24 (AC-24) | `/communications` | Successful send; inspect network request to `pump-send`. | Payload has no operator-set `bypass_suppression`; behaves as false. | [Pass/Fail] |  |
| S-25 (AC-25) | `/communications` | Successful send or schedule; inspect `pump-send` / `pump-schedule` request. | `source_app` is `team`; context type/id undefined as specified. | [Pass/Fail] |  |

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
