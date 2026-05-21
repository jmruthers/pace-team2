# TM08 QA Pack

## Slice metadata

- slice_id: TM08
- app: TEAM
- requirement_path: docs/requirements/TM08-organisation-settings-financial-requirements.md
- queue_row: TEAM-08
- depends_on: TEAM-01

## Manual frontend scenarios

| scenario_ref | route_or_screen | steps | expected_result | result | notes |
|---|---|---|---|---|---|
| S-01 (AC-01) | `/settings/org` | Sign in with `read:page.org-settings`; open route. | Heading "Organisation settings"; Financial card with eight fields. | [Pass/Fail] |  |
| S-02 (AC-02) | `/settings/org` | Open when no `core_org_settings` row exists. | Base currency shows AUD; other fields empty; Save only if `create` permission. | [Pass/Fail] |  |
| S-03 (AC-03) | `/settings/org` | Open when saved row has populated financial fields. | Each field matches stored values; decimals and integer display per requirement. | [Pass/Fail] |  |
| S-04 (AC-04) | `/settings/org` | Change recurring fee; Save with update permission. | Success toast "Organisation settings saved."; form shows new value. | [Pass/Fail] |  |
| S-05 (AC-05) | `/settings/org` | First-time row: set base currency only; Save with create permission. | Upsert succeeds; toast; reload shows inserted row with optional fields empty. | [Pass/Fail] |  |
| S-06 (AC-06) | `/settings/org` | Enter tax rate > 100; attempt Save. | Submit blocked; top destructive Alert; tax field error; Save disabled. | [Pass/Fail] |  |
| S-07 (AC-07) | `/settings/org` | Enter invalid BSB pattern; attempt Save. | Submit blocked; BSB field shows pattern error. | [Pass/Fail] |  |
| S-08 (AC-08) | `/settings/org` | Trigger server 23514 on invalid base currency (or equivalent path). | Inline destructive Alert for currency; edited state retained; Save re-enables. | [Pass/Fail] |  |
| S-09 (AC-09) | `/settings/org` | Change fields; click Cancel. | Fields revert to last load; validation cleared; Save state default. | [Pass/Fail] |  |
| S-10 (AC-10) | `/settings/org` | Open without `read:page.org-settings`. | `AccessDenied` in PaceMain with required copy; shell chrome visible. | [Pass/Fail] |  |
| S-11 (AC-11) | `/settings/org` | No row; read but no create. | Save not rendered; Cancel and fields visible. | [Pass/Fail] |  |
| S-12 (AC-12) | `/settings/org` | Row exists; read but no update. | Save not rendered; Cancel and fields visible. | [Pass/Fail] |  |
| S-13 (AC-13) | `/settings/org` | Edit fields; switch org in header before Save. | Form resets to new org data; default toast "Editing cancelled — organisation changed."; no Save fired. | [Pass/Fail] |  |
| S-14 (AC-14) | `/settings/org` | Save when server returns non-23514 failure. | Values stay; Save re-enables; destructive toast "Could not save organisation settings" with message. | [Pass/Fail] |  |
| S-15 (AC-15) | `/settings/org` | Save when server returns 42501 RLS denial. | Same as AC-14 destructive toast behaviour; edits retained. | [Pass/Fail] |  |
| S-16 (AC-16) | `/settings/org` | Load page while initial SELECT in flight. | Financial card title visible; body shows centred loading spinner; no Save/Cancel. | [Pass/Fail] |  |
| S-17 (AC-17) | `/settings/org` | Clear all bank fields on saved row; Save. | Payload uses nulls; reload shows SQL NULL for those columns. | [Pass/Fail] |  |

## Post-build RBAC seeding

Before release, ensure `rbac_app_pages` includes a row for `pageName = 'org-settings'` (`scope_type = 'organisation'`, TEAM `app_id`).

## Test run summary

- overall result: [Pass | Fail]
- failed scenarios: -
- defect links: N/A
- retest needed: [Yes/No]
