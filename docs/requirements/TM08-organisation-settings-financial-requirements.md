# TEAM-08 — Organisation settings (Financial)

## §1 Slice metadata

```
Slice ID:        TEAM-08
Name:            Organisation settings (Financial)
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems)
Backend impact:  Schema changes (upstream platform: RBAC-checked INSERT/UPDATE RLS policies on core_org_settings)
Frontend impact: UI
Routes owned:    /settings/org
QA pack:         docs/test-packs/TEAM-08-qa-pack.md
```

---

## §2 Overview

TEAM-08 v1 delivers the Organisation settings page at `/settings/org` for the TEAM app. Authenticated org-admin staff edit the Financial fields on `core_org_settings` for the currently selected organisation: joining fee, recurring fee and recurrence cadence, tax rate, base currency, and bank-account details. The page is a single Financial card with one Save button at the bottom; saving issues a single upsert against `core_org_settings`. The slice is gated behind a page-level RBAC guard, mutations are authorised at the database layer by RBAC-checked RLS policies, and toasts surface success and failure outcomes. The Operational section (`member_validation_config` external validation API + inheritance UX) is out of v1 scope and is captured for a follow-up slice.

---

## §3 What this slice delivers

### Purpose

Org-admin staff need to set the financial defaults that govern membership pricing, tax handling, and bank-account display for their organisation. TEAM-08 v1 provides the only place in TEAM where these fields are authored. Without this surface no other slice can offer a per-organisation joining fee, recurring fee, tax rate, base currency, or bank-account detail block.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Organisation settings page | `/settings/org` | Single page; one Financial section rendered as a `Card` with one Save button at the bottom |

### Boundaries

TEAM-08 v1 does **not** own:
- The Operational section (`member_validation_config` external validation API editor, local-vs-inherited indicator, override clear/restore). This is captured for a follow-up slice.
- Membership types (TEAM-06).
- Sub-organisations (TEAM-07).
- The TEAM-05 consumer side that reads validation status onto member requests.
- Branding fields (`organisation_colours`, `logo_id`, `subscription_tier`, `settings`) — those live on `core_organisations`, not `core_org_settings`.
- Hard delete of the `core_org_settings` row — DELETE remains gated by the super-admin-only policy and is not exercised by this slice.
- Authoring the upstream RLS migration that replaces the prior `check_user_is_org_admin(organisation_id)` policies on `core_org_settings` with RBAC-checked equivalents — that is upstream platform work and gates Done (see §15).

### Architectural posture

**Mutation contract — Option A (RBAC-checked RLS).** All reads and writes go via `useSecureSupabase().from('core_org_settings')`. Save is a single `.upsert(payload, { onConflict: 'organisation_id' })` call. Authorisation is enforced at the database layer by RBAC-checked INSERT and UPDATE RLS policies on `core_org_settings` matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md`, using `check_rbac_permission_with_context('<op>:page.org-settings', 'org-settings', organisation_id, NULL, get_app_id('TEAM'))` (where `<op>` is `create` or `update`). The slice does **not** author the RLS migration. The migration is upstream platform work and gates implementation (see §15). Super-admins also pass authorisation via the standards-template super-admin OR-clause (`is_super_admin(safe_get_user_id_for_rls())`).

**Page guard.** The page is wrapped in `<PagePermissionGuard pageName="org-settings" operation="read">`. Scope is resolved internally by the guard from `OrganisationServiceProvider` context — no `scope` prop is passed.

**RBAC visibility gating.** The Save button is conditioned on `useResourcePermissions('org-settings')`: `canCreate` when no `core_org_settings` row exists yet for the current org (the save will be an INSERT), `canUpdate` when a row exists (the save will be an UPDATE). When the relevant permission is `false`, the Save button is hidden — the slice never renders an affordance that would always fail authorisation.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget success and network-failure notifications. `ToastProvider` (which renders `<Toaster />` internally) is mounted by TEAM-01 in `AuthenticatedShell`; this slice does not mount it. Variants used by this slice are `'default' | 'destructive' | 'success'`. Default duration 5000 ms.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

### Page-level guards and evaluation ordering

The route `/settings/org` sits inside `AuthenticatedShell` (TEAM-01) and is wrapped by `<PagePermissionGuard pageName="org-settings" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires before any other gate. An unauthenticated user is redirected to `/login` and never reaches the org check or the page guard.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; the page body and the page guard are not reached.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state from TEAM-01. `PagePermissionGuard` is not reached; no RBAC query fires.
4. **Page permission guard** — Once org context is resolved, `PagePermissionGuard` evaluates with `pageName: 'org-settings'`, `operation: 'read'`. Scope is resolved internally; no `scope` prop is passed. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside the PaceMain content area is acceptable). On `can === false`, `<AccessDenied />` is rendered. On `can === true`, the page body renders.

If `selectedOrganisation` becomes `null` after the guard would otherwise evaluate (race condition during org switch), the RBAC engine evaluates with `organisationId: undefined`; the check returns pending and the guard returns `null`. In practice, the no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/settings/org` renders for an authenticated user whose currently selected organisation has resolved.
- **F-02** On entry, the page issues a single SELECT against `core_org_settings` filtered by `organisation_id = selectedOrganisation.id` and `.maybeSingle()`. The query returns at most one row (UNIQUE on `organisation_id`).
- **F-03** When the SELECT returns a row, the form is pre-populated from that row's columns: `joining_fee`, `recurring_fee`, `fee_recurrence_days`, `tax_rate`, `base_currency`, `bank_account_name`, `bank_bsb`, `bank_account_number`.
- **F-04** When the SELECT returns no row, the form initialises with `base_currency: 'AUD'` and every other field empty (the save will be an INSERT).
- **F-05** The page heading is "Organisation settings" (Australian English, sentence case). Print title is set to "Organisation settings" via `usePaceMain({ printTitle: 'Organisation settings' })`.
- **F-06** Switching the currently selected organisation refetches against the new organisation and silently discards any in-flight unsaved edits, with a default-variant toast "Editing cancelled — organisation changed." (BR-10).

### Loading states

- **F-07** While the SELECT is in flight, the Financial card body renders a centred `<LoadingSpinner />` in place of the form. The card header (with section title) is visible. The Save button is not rendered while loading is in flight.
- **F-08** While the page-level RBAC check is in flight, `PagePermissionGuard` returns `null`; a brief blank inside PaceMain is acceptable.
- **F-09** While the upsert is in flight, the Save button shows a spinner and is disabled; the Cancel button remains enabled.

### Empty states

- **F-10** First-time create — when the SELECT returns zero rows, the page does not show a separate "no row" placeholder. The form renders with the defaults from F-04, ready for a first-time INSERT on save.

### Error states

- **F-11** Field-level validation errors are surfaced as inline messages under each `FormField` and as an `Alert` (variant `destructive`) at the top of the Financial card body when the form has any error. The Alert title is "Please fix the errors below." The Save button is disabled while any field is invalid.
- **F-12** A 23514 CHECK violation on `base_currency` (server-side regex enforcement) is caught by the save handler and surfaced inline at the top of the Financial card body as an `Alert` (variant `destructive`) with copy "Currency must be a 3-letter ISO code, e.g. AUD." The Save button re-enables so the user can correct the value.
- **F-13** A 42501 RLS denial (or PostgREST equivalent) on save is caught by the save handler and surfaced as a destructive toast `toast({ variant: 'destructive', title: 'Could not save organisation settings', description: <message> })`. The form remains in its edited state so the user can retry.
- **F-14** Any other server / network failure on save is normalised through `NormalizeSupabaseError` and surfaced as a destructive toast with the same title and the normalised error message.
- **F-15** A user without `read:page.org-settings` sees `<AccessDenied />` ("You do not have permission to view this page.") inside the `AuthenticatedShell` chrome. Header and footer remain visible.

### Primary content

- **F-16** A single Financial card is rendered. The `CardHeader` contains the section title "Financial" and a one-line description "Joining and recurring fees, tax rate, base currency, and bank-account details." The `CardContent` contains the form fields below. The `CardFooter` contains the Save / Cancel button pair.
- **F-17** The Financial form contains the following fields, in this order:
  1. **Base currency** (`base_currency`) — required.
  2. **Joining fee** (`joining_fee`) — optional.
  3. **Recurring fee** (`recurring_fee`) — optional.
  4. **Recurrence (days)** (`fee_recurrence_days`) — optional.
  5. **Tax rate (%)** (`tax_rate`) — optional.
  6. **Bank account name** (`bank_account_name`) — optional.
  7. **BSB** (`bank_bsb`) — optional.
  8. **Bank account number** (`bank_account_number`) — optional.
- **F-18** All values are displayed and edited as their stored types: numerics with up to two decimal places for currency / tax (`joining_fee`, `recurring_fee`, `tax_rate`); `fee_recurrence_days` as an integer; the rest as text.

### Primary actions

**Save button (bottom of the Financial card)**
- Visible only when either `useResourcePermissions('org-settings').canCreate === true` (no row exists yet → INSERT) or `useResourcePermissions('org-settings').canUpdate === true` (row exists → UPDATE), as appropriate (BR-08).
- Click submits the form. On submit, the slice issues a single `useSecureSupabase().from('core_org_settings').upsert(payload, { onConflict: 'organisation_id' })` call (BR-03).
- Payload shape: every field from F-17 plus `organisation_id: selectedOrganisation.id`. Empty optional values become SQL NULL (per BR-06). `base_currency` is always present.
- On success: a success toast `toast({ variant: 'success', title: 'Organisation settings saved.' })` fires. The form remains on the page and is re-populated from the upserted row (so `created_by` / `updated_by` / `updated_at` reflect the new server-side values for any next save).
- On 23514 (`base_currency`): inline `Alert` per F-12; Save re-enables.
- On 42501 (RLS denial) or other server / network failure: destructive toast per F-13 / F-14; the form's edited values stay on screen.

**Cancel button (bottom of the Financial card, left of Save)**
- Always rendered when the form is rendered.
- Click reverts every field to its last-loaded value (the row from the most recent SELECT, or the F-04 first-time defaults when no row exists yet). Validation state is cleared.
- The button is enabled regardless of permission state — it does not mutate server state.

### Secondary actions

- N/A — there are no filters, sorts, search affordances, paging controls, drawers, or modals in v1. The page is a single form.

### Permission-conditional rendering

| Capability | Permission | When `false` |
|------------|-----------|--------------|
| Page entry | `read:page.org-settings` | `<AccessDenied />` is rendered inside PaceMain |
| Save (no row exists yet → INSERT) | `create:page.org-settings` | Save button is hidden |
| Save (row exists → UPDATE) | `update:page.org-settings` | Save button is hidden |
| Cancel | (no permission required) | Always rendered when the form is rendered |

When Save is hidden, the form fields remain visible and editable on screen (so the user can read the current values), but no Save affordance is rendered. Server-side RLS is the authority — the visibility gate is for UX cleanliness, not for security.

### Navigation

- The page is reachable from the Settings nav menu defined in TEAM-01 (`Settings → Organisation settings`, `href: /settings/org`).
- The slice does not navigate anywhere on success — saving does not change the URL.
- An unmatched route under `/settings/org/<anything>` falls through to the TEAM-01 `*` NotFound page.

### Edge cases and constraints

- **Whitespace** — all string inputs (`bank_account_name`, `bank_bsb`, `bank_account_number`, `base_currency` "Other" free-text) are trimmed before submit. An all-whitespace value in a non-required field is treated as empty and persisted as SQL NULL (BR-06).
- **Empty optional fields** — every optional field that is empty after trim is persisted as SQL NULL, not as an empty string or zero.
- **Org-context switch while editing** — switching the current organisation via the header org selector silently refetches against the new organisation and discards in-flight unsaved edits, with a default-variant toast "Editing cancelled — organisation changed." (BR-10).
- **`base_currency` "Other" path** — when the user picks "Other" from the Select, an inline Input appears below the Select to capture a free-text three-letter code. Submit converts that value to upper-case and validates against `^[A-Z]{3}$` client-side; the server CHECK is the final authority (F-12 covers the server rejection path).
- **Audit columns** — `created_at`, `updated_at`, `created_by`, `updated_by` are populated server-side via column defaults / `BEFORE UPDATE` trigger `tr_core_org_settings_updated_at`. The UI never sends them, and they are not displayed.
- **`id` and `organisation_id`** — the slice never displays or edits `id`. `organisation_id` is set from `selectedOrganisation.id` at submit and is never edited from the UI.
- **`member_validation_config` (Operational column)** — out of v1 scope. The slice never reads, writes, or displays this column.

---

## §5 Visual specification

### Layout

The page renders inside the standard authenticated shell chrome (header, PaceMain content area, footer) provided by TEAM-01. Within PaceMain:

- **Page title row** — "Organisation settings" rendered as the page heading at the top of the PaceMain content area. No subtitle, no breadcrumb.
- **Financial card** — a single `Card` filling the available width within PaceMain's `max-w-(--app-width)`. The card has three regions:
  - **`CardHeader`** — `CardTitle` "Financial" on the left; a `CardDescription` underneath reading "Joining and recurring fees, tax rate, base currency, and bank-account details."
  - **`CardContent`** — the form rows (eight financial fields in the order from §4 F-17).
  - **`CardFooter`** — `SaveActions` (right-aligned Cancel + Save).

Breakpoints:
- Desktop (≥ 1024px): full Card width within PaceMain's `max-w-(--app-width)`. Two-column field layout where it fits naturally (currency / fee / tax fields in a left column; bank-account fields in a right column) is permitted but not required; a single-column stack is acceptable. The implementer chooses the layout that uses screen real estate without crowding labels.
- Tablet (768–1023px): single-column stack within the card body.
- Mobile (< 768px): single-column stack; field labels stack above their controls.

Sticky elements: the shell header and footer are sticky per TEAM-01's `PaceAppLayout` defaults. The card itself does not have sticky elements; the Save / Cancel buttons live in `CardFooter` at the bottom of the card.

### Components

**Page heading**
- Plain text heading rendered above the Financial card in PaceMain. Copy: "Organisation settings". Size and weight per pace-core2 visual standards (page heading scale).

**Financial card (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)**
- `Card` from `@solvera/pace-core/components`, rendering an `<article>` with rounded border + shadow per pace-core2 visual standards.
- `CardHeader` contains a `CardTitle` "Financial" and a `CardDescription` "Joining and recurring fees, tax rate, base currency, and bank-account details."
- `CardContent` contains a `<Form>` whose body lists the eight financial fields described below as `FormField` rows.
- `CardFooter` contains a `<SaveActions />` block aligned to the right of the footer.

**Form (`Form`, `FormField`)**
- `Form` from `@solvera/pace-core/components` with an inline Zod schema covering all eight financial fields. `defaultValues` populated from the loaded row, or from `{ base_currency: 'AUD' }` plus empties when no row exists yet.
- Each `FormField` row renders the standard pace-core2 layout: a `Label` above (or beside, per pace-core2 visual standards) the control, helper text below the control where specified, and an inline error message below the helper text when validation fails.

**Field 1 — Base currency (`base_currency`)** — `Select` (composed from `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`, `SelectItem`)
- Required. Marked with the standard pace-core2 required marker per `FormField` `showRequiredMarker`.
- Options, in this order: AUD, NZD, USD, GBP, EUR, SGD, HKD, JPY, CAD, CHF, **Other…**
- When "Other…" is selected, an `Input` of `type="text"` appears immediately below the `Select` with placeholder "Three-letter ISO code (e.g. AUD)" and helper text "Three uppercase letters. Example: AUD, USD, GBP." The Input value is upper-cased on blur and validated against `^[A-Z]{3}$` client-side; on a non-Other selection, the Input is hidden and any prior free-text value is discarded.
- Helper text under the Select (when the Select alone is shown, i.e. not "Other"): "All currency amounts on this page are saved in this currency."
- Error copy on empty: "Base currency is required." Error copy on invalid free-text: "Currency must be a 3-letter ISO code, e.g. AUD."

**Field 2 — Joining fee (`joining_fee`)** — `Input` of `type="number" step="0.01"`
- Optional. Placeholder: `0.00`. Helper text: "AUD (or selected base currency)."
- Validation (client-side): if not empty, must be ≥ 0 with up to two decimal places. Error copy: "Joining fee must be 0 or more, with at most two decimal places."

**Field 3 — Recurring fee (`recurring_fee`)** — `Input` of `type="number" step="0.01"`
- Optional. Placeholder: `0.00`. Helper text: "AUD (or selected base currency)."
- Validation (client-side): if not empty, must be ≥ 0 with up to two decimal places. Error copy: "Recurring fee must be 0 or more, with at most two decimal places."

**Field 4 — Recurrence (days) (`fee_recurrence_days`)** — `Input` of `type="number" step="1"`
- Optional. Placeholder: `0`. Helper text: "Days between recurring charges."
- Validation (client-side): if not empty, must be an integer ≥ 0. Error copy: "Recurrence must be a whole number of 0 or more days."

**Field 5 — Tax rate (%) (`tax_rate`)** — `Input` of `type="number" step="0.01"`
- Optional. Placeholder: `0.00`. Helper text: "Percentage from 0 to 100."
- Validation (client-side): if not empty, must be between 0 and 100 inclusive with up to two decimal places. Error copy: "Tax rate must be between 0 and 100, with at most two decimal places."

**Field 6 — Bank account name (`bank_account_name`)** — `Input` of `type="text"`
- Optional. Placeholder: `e.g. Scouts Victoria — Operating Account`. No helper text.
- Validation (client-side): if not empty after trim, length 1–80. Error copy: "Bank account name must be 1 to 80 characters."

**Field 7 — BSB (`bank_bsb`)** — `Input` of `type="text"`
- Optional. Placeholder: `123-456`. Helper text: "Six digits, with or without a hyphen between the third and fourth digit."
- Validation (client-side): if not empty after trim, must match `^\d{3}-?\d{3}$`. Error copy: "BSB must be six digits, optionally with a hyphen (e.g. 123-456)."

**Field 8 — Bank account number (`bank_account_number`)** — `Input` of `type="text"`
- Optional. Placeholder: `12345678`. Helper text: "Digits only, 4 to 20 characters."
- Validation (client-side): if not empty after trim, must be digits only with length 4–20. Error copy: "Account number must be 4 to 20 digits."

**SaveActions block**
- `SaveActions` from `@solvera/pace-core/components`. Default `cancelLabel: 'Cancel'`. Default save label "Save" (the component fixes this copy). `saveType='submit'` (default).
- Right-aligned at the bottom of `CardFooter`.
- Save button is hidden when the relevant `useResourcePermissions('org-settings')` boolean (`canCreate` or `canUpdate` per the row-exists state) is `false`. When Save is hidden, Cancel remains rendered.
- During the upsert, Save shows the pace-core2 standard pending state (spinner + disabled). Cancel remains enabled.
- `onCancel` reverts the form to its last-loaded values.

**Top-of-card error Alert**
- `Alert` (variant `destructive`) with `AlertTitle` and `AlertDescription`. Rendered inside `CardContent` above the form rows when:
  - The form has any field-level validation error — title "Please fix the errors below.", no description.
  - The save handler caught a 23514 on `base_currency` — title "Currency must be a 3-letter ISO code, e.g. AUD.", no description.
- Not used for 42501 / network errors — those use the toast path instead.

**Toast notifications**
- Surfaced via `toast()` from `@solvera/pace-core/components`. The provider (`ToastProvider`) is mounted by TEAM-01 in `AuthenticatedShell` and renders `<Toaster />` internally.
- Notifications appear as an `aside[role="region"][aria-label="Notifications"]` overlay anchored to the bottom-right of the viewport.
- Default duration 5000 ms.
- TEAM-08 emits:
  - `toast({ variant: 'success', title: 'Organisation settings saved.' })` after a successful upsert.
  - `toast({ variant: 'destructive', title: 'Could not save organisation settings', description: <error message> })` on RLS denial, network failure, or other non-23514 server error.
  - `toast({ variant: 'default', title: 'Editing cancelled — organisation changed.' })` when the org context changes mid-edit.

### States

- **Loading (initial fetch)** — Card header is visible with title "Financial". Card body shows a centred `<LoadingSpinner />` in place of the form. Card footer is empty (no Save / Cancel rendered yet).
- **Loading (RBAC check)** — `PagePermissionGuard` returns `null`; PaceMain content area is briefly blank.
- **Empty / first-time create** — Card body renders the form with `base_currency: 'AUD'` and every other field empty. No "no row" placeholder is shown.
- **Permission denied (page)** — `<AccessDenied />` block (`<section role="alert" aria-live="polite"><p>You do not have permission to view this page.</p></section>`) inside PaceMain. Header and footer remain visible.
- **Permission denied (Save)** — Save button is hidden; Cancel is rendered; form fields are visible and editable on screen.
- **Mutation in flight** — Save shows a spinner and is disabled; Cancel remains enabled; form fields remain visible.
- **Validation error (client-side)** — Top-of-card destructive `Alert` with title "Please fix the errors below." plus inline error text under each offending `FormField`. Save is disabled.
- **23514 on `base_currency`** — Top-of-card destructive `Alert` with title "Currency must be a 3-letter ISO code, e.g. AUD." Save re-enables.
- **42501 / network / other server failure** — Destructive toast (copy from §4 F-13 / F-14) plus the form's edited values stay on screen; Save re-enables.
- **Success (save)** — Success toast "Organisation settings saved." plus form re-populates from the upserted row (server-managed columns reflect the new values).

### Interactions

- **Base currency `Select`** — default state: shows current selection (or "AUD" on first-time create). Click: opens listbox popover with the ten ISO codes plus "Other…". Keyboard nav per pace-core2 Select. Picking "Other…" reveals the free-text Input below; picking any of the ten codes hides the Input and discards any prior free-text value.
- **Other-currency `Input`** — default state: empty when first revealed. Focus: standard focus ring. Blur: value upper-cased. Typing: standard text-input behaviour.
- **Numeric `Input`s (`joining_fee`, `recurring_fee`, `fee_recurrence_days`, `tax_rate`)** — default state: empty or pre-populated from the loaded row (rendered with up to two decimal places for currency / tax fields, no decimals for `fee_recurrence_days`). Browser native number stepping is allowed but not required for QA. Paste of non-numeric input is rejected by the native control's `type="number"` semantics.
- **Text `Input`s (`bank_account_name`, `bank_bsb`, `bank_account_number`)** — default state: empty or pre-populated. Focus: standard focus ring. Typing: standard text-input behaviour. Trimmed on submit.
- **Save button** — default state: enabled when the form has been touched and is valid; disabled when invalid or in flight. Click: submits the form. Hidden when the relevant `useResourcePermissions('org-settings')` boolean is `false`.
- **Cancel button** — default state: always enabled when the form is rendered. Click: reverts every field to its last-loaded value; clears any validation state; does not navigate or close the page.
- **Top-of-card Alert** — appears when there is at least one client-side validation error or after a 23514 on `base_currency`. Disappears when the form becomes valid (validation case) or when the user submits a corrected value (23514 case).

### Permission-conditional rendering

| Condition | Page body | Save button | Cancel button | Form fields |
|-----------|-----------|-------------|---------------|-------------|
| Authenticated, has org, lacks `read:page.org-settings` | `<AccessDenied />` | n/a | n/a | n/a |
| Authenticated, has org, has `read` only | rendered | hidden | rendered | visible and editable |
| Authenticated, has org, has `read` + `create` (no row exists yet) | rendered | shown | rendered | visible and editable |
| Authenticated, has org, has `read` + `update` (row exists) | rendered | shown | rendered | visible and editable |
| Authenticated, has org, has `read` + `create` + `update` | rendered | shown (per row-exists state) | rendered | visible and editable |

---

## §6 Business rules

**BR-01 — Org-scoped reads**
- Input: `selectedOrganisation.id` from `useOrganisations()`.
- Output: SELECT against `core_org_settings` filtered by `organisation_id = selectedOrganisation.id`, `.maybeSingle()`. Returns either a single row or none (UNIQUE constraint guarantees this).

**BR-02 — Org-scoped writes**
- Input: form submission.
- Output: upsert payload always includes `organisation_id = selectedOrganisation.id`. Server-side RLS WITH CHECK enforces that cross-org writes are blocked.

**BR-03 — Save semantics: single upsert**
- Input: a click on the Save button with a valid form.
- Output: a single `useSecureSupabase().from('core_org_settings').upsert(payload, { onConflict: 'organisation_id' })` call. The unique constraint on `organisation_id` permits at most one row per org; upsert resolves to INSERT when no row exists and UPDATE when one does.
- Edge: there is no separate "create" vs "update" mutation path in this slice; the Save button issues the same call shape regardless.

**BR-04 — `base_currency` regex**
- Input: `base_currency` value on submit.
- Output: must match `^[A-Z]{3}$` (three uppercase letters — ISO 4217). Server CHECK `core_org_settings_base_currency_check` is the final authority. Invalid values raise Postgres 23514, surfaced inline per §4 F-12.

**BR-05 — `base_currency` is required**
- Input: form submission.
- Output: `base_currency` is always present in the payload. The column is NOT NULL with DEFAULT `'AUD'`; client default for first-time create is `'AUD'` (BR-06 also covers this for completeness).

**BR-06 — Financial validation rules (client-side, mirrored on the server where CHECKs exist)**
- All financial fields except `base_currency` are optional.
- `joining_fee`, `recurring_fee`, `tax_rate` — when present, numeric ≥ 0 with up to two decimal places. `tax_rate` additionally constrained to ≤ 100.
- `fee_recurrence_days` — when present, integer ≥ 0.
- `bank_bsb` — when present, matches `^\d{3}-?\d{3}$`.
- `bank_account_number` — when present, digits only with length 4–20.
- `bank_account_name` — when present (after trim), length 1–80 characters.
- `base_currency` — required; matches `^[A-Z]{3}$` (BR-04).
- Empty optional values (after trim for strings) are persisted as SQL NULL, not as empty strings or zero.

**BR-07 — Audit columns server-managed**
- `created_at`, `updated_at`, `created_by`, `updated_by` are populated server-side via column defaults / `BEFORE UPDATE` trigger `tr_core_org_settings_updated_at`. The UI never sends them, and they are not shown on the page.

**BR-08 — RBAC visibility gating**
- Input: `useResourcePermissions('org-settings')` return values plus the row-exists state from the initial SELECT.
- Output:
  - When no row exists yet for the current org and `canCreate === false`, the Save button is hidden.
  - When a row exists for the current org and `canUpdate === false`, the Save button is hidden.
  - Cancel is always rendered when the form is rendered, regardless of permission state.
  - When `canRead === false`, `<AccessDenied />` is rendered (handled by `PagePermissionGuard`).
  - `canDelete` is not consumed by this slice (no delete UI exists in v1).

**BR-09 — Page permission scope**
- `pageName: 'org-settings'` per the architecture canonical map. Operations `read`, `create`, `update`, `delete` map to `{op}:page.org-settings`. `scope_type = 'organisation'`. Post-build seeding adds the `rbac_app_pages` row.

**BR-10 — Org-context change discards local edits**
- Input: `selectedOrganisation.id` changes (header org selector) while edits are in flight on the form.
- Output: the page silently refetches against the new org and discards any unsaved edits. A default-variant toast fires with title "Editing cancelled — organisation changed." The form re-populates from the new org's row (or the F-04 first-time defaults if none exists).

**BR-11 — RLS authority via Option A**
- Input: an INSERT or UPDATE on `core_org_settings` from the slice (issued via the upsert call).
- Output: server-side RLS authorises the operation when either `is_super_admin(safe_get_user_id_for_rls())` is true OR `check_rbac_permission_with_context('<op>:page.org-settings', 'org-settings', organisation_id, NULL, get_app_id('TEAM'))` returns true (where `<op>` is `create` or `update`). Super-admins also pass authorisation via the standards-template super-admin OR-clause (`is_super_admin(safe_get_user_id_for_rls())`). The DELETE policy remains super-admin-only and is not exercised by this slice.

---

## §7 API / Contract

### Public exports

This slice does not publish any types, hooks, or services for other slices to import.

### Read contract

- **Organisation settings row**
  - Query: `useSecureSupabase().from('core_org_settings').select('id, organisation_id, joining_fee, recurring_fee, fee_recurrence_days, tax_rate, base_currency, bank_account_name, bank_bsb, bank_account_number').eq('organisation_id', selectedOrganisation.id).maybeSingle()`.
  - Returns: a single row, or `null` when no row exists for the current organisation.
  - The slice does not select `member_validation_config`, `created_at`, `updated_at`, `created_by`, or `updated_by`.

### Write contract

- **Save (single upsert)**
  - Call: `useSecureSupabase().from('core_org_settings').upsert({ organisation_id: selectedOrganisation.id, base_currency, joining_fee, recurring_fee, fee_recurrence_days, tax_rate, bank_account_name, bank_bsb, bank_account_number }, { onConflict: 'organisation_id' }).select().single()`.
  - On success: `{ data, error: null }` with the upserted row (used to re-populate the form so audit columns reflect the new server-side values).
  - On 23514 against `core_org_settings_base_currency_check`: surface inline per §4 F-12.
  - On 42501 (Postgres `insufficient_privilege`) or PostgREST equivalent: surface as a destructive toast per §4 F-13.
  - On other server / network failure: surface as a destructive toast per §4 F-14.
  - Payload never includes `id`, `created_at`, `updated_at`, `created_by`, `updated_by`, or `member_validation_config`.

### RLS / permission contract

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Super-admin | allow | allow | allow | allow (slice does not exercise) |
| Org admin with `create:page.org-settings` and/or `update:page.org-settings` on the current org | allow (the SELECT policy widens to org members and TRAC planners) | allow if `create:page.org-settings` | allow if `update:page.org-settings` | denied (no UI) |
| Org member without `org-settings` permissions | allow (SELECT) | denied | denied | denied |
| Anonymous | denied | denied | denied | denied |

Authorisation is enforced server-side by RBAC-checked INSERT and UPDATE RLS policies on `core_org_settings` for `pageName` `org-settings` (matching the standards-file template). The SELECT policy is not changed by this slice and continues to allow super-admins, organisation members (via `check_user_organisation_access(organisation_id)`), and TRAC planners (via `check_rbac_permission_with_context('read:page.planning', 'planning', organisation_id, NULL, get_app_id('TRAC'))`) to read the row.

### Cross-slice handoffs

- TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />`) as the outermost wrapper of `AuthenticatedShell`. TEAM-08 calls `toast(...)` and depends on TEAM-01 having mounted the provider.
- TEAM-01 owns the route mounting the navItem at `Settings → Organisation settings` with `href: /settings/org`. TEAM-08 owns the page component.
- The architecture's canonical `pageName` for this slice is `org-settings`. Post-build RBAC seeding (planned in TEAM-01 §8) will add the `rbac_app_pages` row.

### ID contracts

- `core_org_settings.id` is a `uuid` (Postgres `gen_random_uuid()`); the slice does not display or construct it.
- `organisation_id` is the typed `OrganisationId` from `@solvera/pace-core/types` if available; otherwise a `uuid` string at runtime boundaries.

---

## §8 Data and schema references

### Tables consumed

| Table | Access | Columns used |
|-------|--------|--------------|
| `public.core_org_settings` | Read + write | `id`, `organisation_id`, `joining_fee`, `recurring_fee`, `fee_recurrence_days`, `tax_rate`, `base_currency`, `bank_account_name`, `bank_bsb`, `bank_account_number` |

The slice does not read or write `member_validation_config`, audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`), or any column on `core_organisations`.

### Dev-db verification (project: `rkytnffgmwnnmewevqgp`)

Verified 2026-05-04 via Supabase MCP:

- `public.core_org_settings` columns include the financial set listed in §8 Tables consumed plus `member_validation_config jsonb NOT NULL DEFAULT '{}'::jsonb` (Operational, out of v1 scope), `base_currency text NOT NULL DEFAULT 'AUD'::text`, and the audit columns.
- Constraints: PK on `id`; UNIQUE on `organisation_id`; FK on `organisation_id` → `core_organisations(id)`; FKs on `created_by` / `updated_by` → `auth.users(id)`; CHECK `core_org_settings_base_currency_check` (`base_currency ~ '^[A-Z]{3}$'`); CHECK `core_org_settings_member_validation_config_check` (Operational column; not exercised by this slice).
- Triggers: `tr_core_org_settings_updated_at` (`BEFORE UPDATE`).
- Row count on dev: 0 (every test exercises first-time INSERT).

### Implementation gate (upstream platform work — required for Done)

The TEAM-08 v1 slice does NOT author migrations. Before TEAM-08 implementation begins (and certainly before it can be marked Done):

1. **RBAC-checked INSERT and UPDATE policies** on `public.core_org_settings` for `pageName` `org-settings` must replace the prior `check_user_is_org_admin(organisation_id)` policies, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` and using `check_rbac_permission_with_context('<op>:page.org-settings', 'org-settings', organisation_id, NULL, get_app_id('TEAM'))` for `<op>` in `{create, update}`. The new policies include the super-admin OR-clause from the standards template; the SELECT policy is unchanged; DELETE remains super-admin-only.

### Helpers referenced (must be present on dev)

- `check_rbac_permission_with_context(p_permission TEXT, p_page_name TEXT, p_organisation_id UUID, p_event_id TEXT, p_app_id UUID) RETURNS boolean` — STABLE SECURITY DEFINER wrapper. Verified via dev MCP 2026-05-04.
- `is_super_admin(p_user_id UUID) RETURNS boolean` — verified.
- `safe_get_user_id_for_rls() RETURNS UUID` — verified.
- `get_app_id(p_app_name TEXT) RETURNS UUID` — verified; called as `get_app_id('TEAM')`.

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `check_rbac_permission_with_context` reference.
- DB-419 (Operational `member_validation_config` column) — informational only for v1; not exercised by this slice.
- DB-420 (`base_currency` column + CHECK) — defines the regex enforced server-side and surfaced in BR-04 / §4 F-12.

### Post-build RBAC seeding reminder

A canonical `rbac_app_pages` row for `pageName = 'org-settings'` (with `scope_type = 'organisation'`, mapped to TEAM's `app_id`) must be seeded post-build per the TEAM-01 audit's seeding plan. Without it, RBAC checks for create / update on this surface return false and the Save button is hidden.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|--------|-------------|--------------|
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Wraps the page on `read:page.org-settings` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Default fallback when the page guard denies access |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Gates the Save button (`canCreate` or `canUpdate` per row-exists state) |
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for SELECT and upsert on `core_org_settings` |
| `useOrganisations` | `@solvera/pace-core/hooks` | Reads `selectedOrganisation` for the SELECT filter and for the upsert `organisation_id` |
| `usePaceMain` | `@solvera/pace-core/hooks` | Sets `printTitle: 'Organisation settings'` |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `@solvera/pace-core/components` | Page content wrapper for the Financial section |
| `Form`, `FormField` | `@solvera/pace-core/components` | Editor form with Zod schema |
| `Input` | `@solvera/pace-core/components` | Numeric and text controls for the seven non-currency fields plus the "Other" currency fallback |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`, `SelectItem` | `@solvera/pace-core/components` | `base_currency` Select with the ten ISO codes + "Other…" |
| `SaveActions` | `@solvera/pace-core/components` | Right-aligned Cancel + Save block in `CardFooter` |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | Top-of-card destructive Alert for client-side validation and 23514 |
| `LoadingSpinner` | `@solvera/pace-core/components` | Initial-fetch in-card spinner |
| `toast` | `@solvera/pace-core/components` | Success / RLS-denial / network-failure / org-switch notifications. `ToastProvider` is mounted by TEAM-01 |
| `NormalizeSupabaseError` | `@solvera/pace-core/utils` | Maps Postgres error codes (23514, 42501) to user-friendly messages |
| `z` | `zod` | Inline schema for the financial fields |

### §9.2 Slice-specific caveats

**`ToastProvider` mount.** This slice does NOT mount `<ToastProvider>` or `<Toaster />`. Both are mounted by TEAM-01 in `AuthenticatedShell`. Calling `toast(...)` from inside any TEAM-08 component will work because every authenticated route descends from `AuthenticatedShell`'s provider. Do not add a second mount in this slice. Default toast duration is 5000 ms; do not pass `duration` unless overriding for a specific UX reason.

**`useResourcePermissions` boolean gating + row-exists state.** Read `canCreate` and `canUpdate` from `useResourcePermissions('org-settings')`. The Save button's visibility depends on the row-exists state from the SELECT: when the SELECT returned `null` (no row yet), Save is gated on `canCreate`; when the SELECT returned a row, Save is gated on `canUpdate`. Treat `isLoading: true` from the hook as "do not show the Save button yet" — the brief absence avoids flicker and prevents a request that would 401 / 403 on the server.

**`useSecureSupabase` selection.** Call with no arguments. Do not import `createClient` from `@supabase/supabase-js` for any reason. The client is wrapped server-side with the resolved `organisationId`; the slice does not need to thread `organisationId` through the upsert payload manually beyond the explicit `organisation_id` field needed for the `WITH CHECK` clause and the `onConflict` resolution.

**Mutation contract gate.** TEAM-08's INSERT / UPDATE paths (issued via the single upsert call) depend on the upstream platform replacing the prior `check_user_is_org_admin(organisation_id)` INSERT / UPDATE policies on `core_org_settings` with RBAC-checked policies (per §8 Implementation gate). Until those land on dev, the v1 build can render the page but mutations may succeed for the wrong reason (the `check_user_is_org_admin` predicate currently in place on dev is broader than the page permission). The v6 slice does not author the migration.

**`Select` "Other…" handling.** The `base_currency` Select carries an "Other…" option that is not an ISO code. Do not send the literal string "Other" or "Other…" to the server. When "Other…" is selected, render the fallback `Input` and read the currency value from that Input on submit; upper-case it on blur and validate `^[A-Z]{3}$` client-side. Do not store the sentinel "Other" in `react-hook-form` state for the `base_currency` field — store the actual code (or empty pending the free-text entry).

**Empty optional values become SQL NULL.** All seven optional fields are stored as SQL NULL when their input is empty (after trim, for strings). Do not send empty strings or `0` for an unset numeric field — send `null`. The Zod schema and the upsert payload builder must coerce empties to `null` consistently.

**Org-context change handling.** Subscribe to `selectedOrganisation.id` via `useOrganisations()`. When it changes, refetch the SELECT (the query already depends on the value) and reset the form to the new org's loaded row (or the first-time defaults). Fire the `default`-variant toast described in §4 F-06 / BR-10. Do not carry edits across the org switch.

**`NormalizeSupabaseError` use.** Wrap the upsert `catch` with `NormalizeSupabaseError`. Branch on `code === '23514'` for the inline `Alert` path (only when the violated check is `core_org_settings_base_currency_check`); branch on `code === '42501'` (or PostgREST equivalent) for the destructive toast; everything else is the destructive toast with the normalised message.

---

## §10 Permission and access rules

### Page-level guard

| Route | `pageName` | `operation` | Fallback |
|-------|-----------|------------|----------|
| `/settings/org` | `org-settings` | `read` | `<AccessDenied />` |

### Action-level access

| Action | Permission required | Mechanism |
|--------|---------------------|-----------|
| View page body | `read:page.org-settings` | `PagePermissionGuard` |
| Show Save button (no row exists yet → INSERT) | `create:page.org-settings` | `useResourcePermissions('org-settings').canCreate` |
| Submit Save (INSERT path) | `create:page.org-settings` | RBAC-checked INSERT policy (server-side) |
| Show Save button (row exists → UPDATE) | `update:page.org-settings` | `useResourcePermissions('org-settings').canUpdate` |
| Submit Save (UPDATE path) | `update:page.org-settings` | RBAC-checked UPDATE policy (server-side) |
| Cancel (revert local edits) | (no permission required) | Always rendered when the form is rendered |
| Delete the `core_org_settings` row | (n/a — UI not provided in v1) | Server-side super-admin-only DELETE policy unchanged |

### Row-level access

- The SELECT policy is not changed by this slice. A user sees their organisation's row when they are a super-admin OR have `check_user_organisation_access(organisation_id)` OR (TRAC-side) `check_rbac_permission_with_context('read:page.planning', 'planning', organisation_id, NULL, get_app_id('TRAC'))`. TEAM-08's UI only renders for users who passed `read:page.org-settings` at the page guard, so the SELECT widening is invisible to TEAM users.

### Proxy / impersonation

- None. The slice does not consult or expose proxy / impersonation state.

---

## §11 Acceptance criteria

**AC-01 — Page entry, authenticated org admin with `read`**
Given a user is authenticated and has `read:page.org-settings` on their current organisation, when they navigate to `/settings/org`, then the page renders with the heading "Organisation settings" and a Financial card containing the eight financial fields.

**AC-02 — First-time create defaults**
Given the current organisation has no `core_org_settings` row, when the page loads, then the Base currency field shows "AUD", every other field is empty, and the Save button is shown only if the user has `create:page.org-settings`.

**AC-03 — Saved row pre-populated**
Given the current organisation has a `core_org_settings` row with `joining_fee = 25.00`, `recurring_fee = 10.00`, `fee_recurrence_days = 30`, `tax_rate = 10.00`, `base_currency = 'AUD'`, and bank-account fields populated, when the page loads, then every field reflects the stored value (currency / tax fields rendered with up to two decimal places; `fee_recurrence_days` rendered as an integer).

**AC-04 — Save — happy path (UPDATE)**
Given a user with `update:page.org-settings` on a row that already exists, when they change `recurring_fee` to `12.50` and click Save, then the upsert succeeds, a success toast "Organisation settings saved." appears, and the form re-populates with `recurring_fee = 12.50`.

**AC-05 — Save — happy path (INSERT)**
Given a user with `create:page.org-settings` on an organisation that has no row yet, when they fill `base_currency = 'NZD'`, leave all other fields empty, and click Save, then the upsert succeeds, a success toast "Organisation settings saved." appears, and the form re-populates with the inserted row (Base currency "NZD"; all optional fields empty / NULL).

**AC-06 — Validation — `tax_rate` out of range**
Given a user enters `tax_rate = 150`, when they attempt to Save, then submit is blocked, an inline destructive `Alert` with title "Please fix the errors below." appears at the top of the Financial card, the `Tax rate (%)` field shows "Tax rate must be between 0 and 100, with at most two decimal places.", and the Save button is disabled.

**AC-07 — Validation — `bank_bsb` pattern**
Given a user enters `bank_bsb = 12-34567`, when they attempt to Save, then submit is blocked and the BSB field shows "BSB must be six digits, optionally with a hyphen (e.g. 123-456)."

**AC-08 — Server-side `base_currency` rejection (23514)**
Given the client somehow sends an invalid `base_currency` value (e.g. via the "Other" path before client validation tightens), when the server returns Postgres 23514, then the dialog stays in its edited state, an inline destructive `Alert` with title "Currency must be a 3-letter ISO code, e.g. AUD." appears at the top of the Financial card, and the Save button re-enables.

**AC-09 — Cancel reverts local edits**
Given a user has changed `joining_fee` and `bank_account_name` from their loaded values, when they click Cancel, then both fields revert to the values from the most recent SELECT (or to the F-04 defaults if no row exists yet), validation state is cleared, and the Save button returns to its default state.

**AC-10 — Permission denied — page**
Given a user is authenticated but lacks `read:page.org-settings`, when they navigate to `/settings/org`, then `<AccessDenied />` is rendered inside PaceMain with copy "You do not have permission to view this page.", and the shell header and footer remain visible.

**AC-11 — Permission denied — Save hidden (no row exists)**
Given a user has `read` but lacks `create:page.org-settings` and the current organisation has no `core_org_settings` row, when the page loads, then the Save button is not rendered; the Cancel button and the form fields remain rendered.

**AC-12 — Permission denied — Save hidden (row exists)**
Given a user has `read` but lacks `update:page.org-settings` and the current organisation already has a saved `core_org_settings` row, when the page loads, then the Save button is not rendered; the Cancel button and the form fields remain rendered.

**AC-13 — Org-context switch discards edits**
Given the user has touched form fields and a Save has not yet been issued, when the user switches the current organisation via the header org selector, then the form is silently reset to the new organisation's loaded row (or first-time defaults), a default-variant toast "Editing cancelled — organisation changed." appears, and no Save call is issued for either organisation.

**AC-14 — Network failure on Save**
Given a user submits Save and the server returns a non-23514 server error (network or 5xx), when the error fires, then the form's edited values stay on screen, the Save button re-enables, and a destructive toast "Could not save organisation settings" with the normalised error message appears.

**AC-15 — RLS denial on Save (42501)**
Given a user submits Save and the server returns Postgres 42501 / PostgREST RLS denial (e.g. an `rbac_app_pages` row for `org-settings` not yet seeded), when the error fires, then the form's edited values stay on screen, the Save button re-enables, and a destructive toast "Could not save organisation settings" with the normalised error message appears.

**AC-16 — Loading state**
Given the initial SELECT is in flight, when the page first renders, then the Financial card header shows the title "Financial" and the card body shows a centred `<LoadingSpinner />` with no Save / Cancel buttons rendered.

**AC-17 — Empty optional fields persist as NULL**
Given the user clears `bank_account_name`, `bank_bsb`, and `bank_account_number` on a row that previously had values for all three, when they Save, then the upsert payload sends `null` for each (not empty strings), and a subsequent SELECT confirms each column is SQL NULL.

---

## §12 Verification

- Confirm `<PagePermissionGuard pageName="org-settings" operation="read">` wraps the page body and that no `scope` prop is passed.
- Confirm `useSecureSupabase()` is used for both the SELECT and the upsert; confirm there is no direct `createClient` import from `@supabase/supabase-js`.
- Confirm the SELECT uses `.eq('organisation_id', selectedOrganisation.id).maybeSingle()` and selects only the columns listed in §7 Read contract.
- Confirm the upsert payload contains exactly `{ organisation_id, base_currency, joining_fee, recurring_fee, fee_recurrence_days, tax_rate, bank_account_name, bank_bsb, bank_account_number }` — no `id`, no `member_validation_config`, no audit columns.
- Confirm the upsert call uses `{ onConflict: 'organisation_id' }`.
- Confirm the Save button is conditioned on `useResourcePermissions('org-settings').canCreate` when the SELECT returned `null`, and on `.canUpdate` when the SELECT returned a row.
- Confirm Cancel reverts every field to the most-recently-loaded values.
- Confirm the org-context switch handler fires the default-variant toast and resets the form.
- Against dev-db (`rkytnffgmwnnmewevqgp`):
  - Confirm RBAC-checked INSERT and UPDATE policies on `public.core_org_settings` for `pageName` `org-settings` are present and use `check_rbac_permission_with_context(... , get_app_id('TEAM'))`.
  - Confirm `rbac_app_pages` has a row for `pageName = 'org-settings'` with `scope_type = 'organisation'` and the TEAM `app_id` (post-build seeding may handle this; if absent, the slice's Save affordance will be hidden because `useResourcePermissions` returns false — note as a known seeding gap, not a code defect).
- Manually verify that an INSERT with an invalid `base_currency` value (e.g. lower-case `'usd'`) returns Postgres 23514 and that the slice surfaces the inline `Alert` from §4 F-12.
- Manually verify that an UPDATE attempt by an authenticated user without the update permission returns an RLS denial (Postgres `42501` or PostgREST equivalent) and that the slice surfaces the destructive toast from §4 F-13.
- Manually verify that clearing all bank-account fields on a previously-saved row and saving persists each as SQL NULL (per AC-17).

---

## §13 Testing requirements

n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- Save is a single `useSecureSupabase().from('core_org_settings').upsert(payload, { onConflict: 'organisation_id' })` call. Do not split into separate insert / update branches in the client.
- All mutations go through `useSecureSupabase()`; do not call `createClient` from `@supabase/supabase-js` directly.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- The slice does not author RLS policies. Replacing the prior `check_user_is_org_admin(organisation_id)` policies on `core_org_settings` with RBAC-checked equivalents is upstream platform work and gates Done.
- Do not author or read `member_validation_config`; do not render any Operational UI in v1.

---

## §15 Done criteria

- All 17 acceptance criteria (AC-01 through AC-17) verified.
- Implementation gate satisfied on dev: RBAC-checked INSERT and UPDATE RLS policies on `public.core_org_settings` for `pageName` `org-settings` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` "RBAC Permission-Based Policy") landed on dev. **Implementation blocked until RBAC-checked INSERT/UPDATE policies on `core_org_settings` for pageName `org-settings` (matching pace-core2 standards/3-security-rbac-standards.md template) land on dev. The v6 slice does not author the migration.**
- Post-build RBAC seeding reminder logged in the QA pack: `rbac_app_pages` row for `pageName = 'org-settings'` (`scope_type = 'organisation'`, TEAM `app_id`) added before release.
- `npm run validate` passes (lint + type-check + tests).
- Manual verification of save (INSERT and UPDATE paths) against dev completed; an RLS-denied save surfaces the destructive toast; a 23514 on `base_currency` surfaces the inline Alert.

---

## §16 Do not

- Do not implement the Operational section (`member_validation_config` editor, local-vs-inherited indicator, override clear / restore) in v1. **Operational section (`member_validation_config` external validation API + inheritance UX) is out of v1 scope. Deferred until: (a) the national-DB validation API exists; (b) pace-core2 ships `app_get_effective_member_validation_config(...)` for inheritance resolution. Captured for follow-up.**
- Do not read, write, or display `member_validation_config` on this surface in v1.
- Do not split Save into separate insert / update mutation paths. Use a single upsert call with `onConflict: 'organisation_id'`.
- Do not surface `created_at`, `updated_at`, `created_by`, or `updated_by` as fields. Audit columns are populated server-side and are not displayed.
- Do not surface `subscription_tier`, `settings`, `organisation_colours`, or `logo_id` — those columns live on `core_organisations`, not `core_org_settings`, and are out of scope here.
- Do not expose hard delete in v1. There is no delete affordance on this surface.
- Do not mount `<ToastProvider>` or `<Toaster />` — TEAM-01 owns that mount.
- Do not hand-roll a permission-string check; route everything through `useResourcePermissions` and `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths.
- Do not author RLS policies in this slice. Replacing the prior `check_user_is_org_admin(organisation_id)` policies on `core_org_settings` with RBAC-checked equivalents is upstream platform work.
- Do not use the production database during development or testing — dev-db (`rkytnffgmwnnmewevqgp`) only.
- Do not render this surface for non-admin members of the organisation. TEAM is admin-only by design.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate and scope boundaries.
- `/rebuild/architecture.md` — route ownership of `/settings/org`; canonical `pageName` `org-settings`; nav entry under Settings; TEAM-08 Financial vs Operational planning resolution (Operational deferred entirely in v1).
- `/docs/requirements/team/TM01-app-shell-auth-layout-requirements.md` — app shell, `AuthenticatedShell` mounting `<ToastProvider>` (which renders `<Toaster />`), nav menu, `ProtectedRoute`, no-org empty state, post-build RBAC seeding plan.
- `/docs/requirements/team/TM06-membership-types-requirements.md` — sibling settings slice using the same RBAC-checked-RLS mutation pattern; convention reference for editor / DataTable bespoke pattern.
- `/docs/requirements/team/TM07-sub-organisations-requirements.md` — sibling settings slice (sub-organisations) using the same RBAC-checked-RLS mutation pattern; convention reference for `<PagePermissionGuard>` usage and toast variants.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `check_rbac_permission_with_context`; `get_app_id`.

### Implementation gate (upstream platform work — repeated for traceability)

Before TEAM-08 is marked Done:

1. RBAC-checked INSERT and UPDATE RLS policies on `core_org_settings` for `pageName` `org-settings` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` "RBAC Permission-Based Policy"), using `check_rbac_permission_with_context('<op>:page.org-settings', 'org-settings', organisation_id, NULL, get_app_id('TEAM'))`, must replace the current `check_user_is_org_admin(organisation_id)` policies on dev.

The v6 slice does not author the migration. Super-admins also pass authorisation via the standards-template super-admin OR-clause (`is_super_admin(safe_get_user_id_for_rls())`).

### Deferred follow-up

A follow-up TEAM slice will deliver the Operational section: `member_validation_config` typed editor (no plaintext API keys; Vault-secret-name reference only), local-vs-inherited indicator, and clear-override path. Prerequisites for that follow-up:

(a) The national-DB validation API exists.
(b) pace-core2 ships `app_get_effective_member_validation_config(p_organisation_id uuid)` (or equivalent) for inheritance resolution per DB-419's intent.

The follow-up will share the route `/settings/org` with this slice; tabbed or stacked presentation will be decided when the follow-up is authored.
