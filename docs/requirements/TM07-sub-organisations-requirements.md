# TEAM-07 — Sub-organisations

## §1 Slice metadata

```
Slice ID:        TEAM-07
Name:            Sub-organisations
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems)
Backend impact:  Schema changes (upstream platform: RBAC-checked INSERT/UPDATE RLS policies on core_organisations; AFTER INSERT trigger seeding core_organisation_app_access)
Frontend impact: UI
Routes owned:    /settings/organisations
QA pack:         docs/test-packs/TEAM-07-qa-pack.md
```

---

## §2 Overview

TEAM-07 delivers the sub-organisations management surface at `/settings/organisations` for the TEAM app. Authenticated org-admin staff see a flat table of direct child organisations of their current organisation, can create a new child via a toolbar dialog, and can edit a child's `display_name`, `description`, and `is_active` flag via a row-level dialog. The slice depends on TEAM-01 for the app shell and the toast context, and on upstream platform work for two pieces of backend wiring (RBAC-checked RLS policies and an `AFTER INSERT` trigger that seeds app-access rows for new children). No detail sub-route exists; all editing is in modals.

---

## §3 What this slice delivers

### Purpose

TEAM-07 lets staff in an organisation list, create, and adjust the direct child organisations of the organisation they are currently in. The outcome is that org admins can shape their tenancy's child structure (open new sub-orgs, rename them for display, deactivate them when no longer needed) without leaving the settings area.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Sub-organisations list page | `/settings/organisations` | Flat DataTable of direct children of the current organisation, with toolbar Create button |
| Create sub-organisation dialog | *(modal overlay on the list page)* | `Dialog` containing a `Form` for `name`, `display_name`, `description` |
| Edit sub-organisation dialog | *(modal overlay on the list page)* | `Dialog` containing a `Form` for `display_name`, `description`, `is_active`; `name` shown read-only |

### Boundaries

TEAM-07 does **not** own:
- Any detail sub-route under `/settings/organisations/:id` — none exists in the v6 architecture; edit is delivered via modal.
- Hard delete of an organisation — not exposed in v1; deactivate-only.
- Editing `parent_id` — `parent_id` is locked from this surface in v1; reparenting is not delivered.
- Member-list filtering by sub-organisation (no `?subOrgId=` contract on the members directory in v1).
- Branding fields on `core_organisations` — `organisation_colours`, `logo_id`, `subscription_tier`, `settings` are not authored on this surface.
- The "no organisation selected" empty state — that is handled at the shell level by TEAM-01 and is not duplicated here.
- Authoring the RLS policies and the app-access auto-seed trigger — both are upstream platform work and gate Done (see §15).

### Architectural posture

**Mutation contract.** All mutations on `core_organisations` go through `useSecureSupabase().from('core_organisations').insert/update`. Authority is enforced server-side by RBAC-checked INSERT and UPDATE RLS policies for `pageName` `organisations`, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` and using `check_rbac_permission_with_context('<op>:page.organisations', 'organisations', parent_id, NULL, get_app_id('TEAM'))`. (`parent_id` here refers to the parent organisation under which the child is being created or updated — not the new or existing row's own `id`. Authorisation is scoped to the user's permissions on the parent org.) Hard delete remains gated by the super-admin-only DELETE policy and is not exercised by this slice.

**App-access seeding.** When a new child organisation is inserted, an `AFTER INSERT` trigger on `core_organisations` seeds rows in `core_organisation_app_access` for the new child by copying the active app-access rows from the parent organisation. The TEAM-07 client never writes to `core_organisation_app_access`.

**Page guard.** The page is wrapped in `<PagePermissionGuard pageName="organisations" operation="read">`. Scope is resolved internally by the guard from `OrganisationServiceProvider` context — no `scope` prop is passed.

**RBAC visibility gating.** The toolbar Create button and the row Edit action are conditioned on `useResourcePermissions('organisations').canCreate` and `.canUpdate` respectively. When a permission is `false`, the corresponding affordance is hidden — the slice never renders an affordance that would always fail authorisation.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget success and network-failure notifications. `ToastProvider` is mounted by TEAM-01 in `AuthenticatedShell`; this slice does not mount it.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

### Page-level guards and evaluation ordering

The route `/settings/organisations` sits inside `AuthenticatedShell` (TEAM-01) and is wrapped by `<PagePermissionGuard pageName="organisations" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires before any guard. An unauthenticated user is redirected to `/login` and never reaches the org check or the guard.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; no feature content or guard is shown.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state. `PagePermissionGuard` is not reached; no RBAC query fires.
4. **Page permission guard** — Once org context is resolved, `PagePermissionGuard` evaluates with `pageName: 'organisations'`, `operation: 'read'`. Scope is resolved internally; no `scope` prop is passed. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside the PaceMain content area is acceptable). On `can === false`, `<AccessDenied />` is rendered. On `can === true`, the page body renders.

If `selectedOrganisation` becomes null after the guard would otherwise evaluate (race condition), the RBAC engine evaluates with `organisationId: undefined`; the check returns pending and the guard returns `null`. In practice, the no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **Route:** `/settings/organisations`. Reachable from the Settings nav menu (Settings → Organisations) defined by TEAM-01.
- **Initial fetch:** the page issues a single SELECT against `core_organisations` filtered by `parent_id = selectedOrganisation.id`, ordered by `display_name` ascending. Both active and inactive children are returned.
- **Page title:** "Sub-organisations" (sentence case). Print title set to "Sub-organisations" via `usePaceMain({ printTitle: 'Sub-organisations' })`.
- **No breadcrumb.** The page renders inside the standard authenticated shell chrome (header, PaceMain, footer).

### Loading states

- **List loading** — while the SELECT is in flight, the DataTable shows its built-in loading state: a Card → Table → TableCaption (with title) → a single full-width row containing `<LoadingSpinner label="Loading table" />`. The toolbar Create button remains visible if `canCreate === true`.
- **Permission check in flight** — `PagePermissionGuard` returns `null`; a brief blank inside PaceMain is acceptable.
- **Mutation in flight** — the editor's primary submit button shows a loading spinner and is disabled. The Cancel button remains enabled.

### Empty states

- **No children yet** — when the SELECT returns zero rows: the DataTable body shows an empty placeholder with title "No sub-organisations yet. Create one below." and no description. The toolbar "+ New sub-organisation" button remains visible (subject to `canCreate`) so the user can create the first child without scrolling.

### Error states

- **Validation errors inside the editor** — surfaced as inline messages under each `FormField` and as an `Alert` (variant `destructive`) at the top of the dialog body when the form has any error. The Alert title is "Please fix the errors below." The submit button is disabled while any field is invalid.
- **Duplicate `name` (Postgres 23505 on `organisations_name_key`)** — caught by the editor's submit handler, surfaced as an inline `Alert` (variant `destructive`) at the top of the dialog body with copy: "An organisation with this name already exists. Names must be unique across the platform." The dialog stays open so the user can edit the name and resubmit.
- **Network or other server failure** — caught by the editor's submit handler, surfaced as a destructive `toast({ variant: 'destructive', title: 'Could not save sub-organisation', description: <message> })`. The dialog stays open. Validation errors and 23505 do NOT use the toast path; they use the inline `Alert` instead.
- **Permission denied on page entry** — `PagePermissionGuard` renders `<AccessDenied />` ("You do not have permission to view this page.") inside PaceMain. Header and footer remain visible.

### Primary content

The list is rendered as a DataTable wrapped in a `Card`. Columns, in this order:

1. **Internal name** — `name`. Sortable. Used as the unique business identifier; not editable after create.
2. **Display name** — `display_name`. Sortable, default sort ascending.
3. **Status** — derived from `is_active`. Renders the literal text "Active" when `is_active === true`, "Inactive" when `false`. Sortable and filterable (boolean filter mapping `Active → true`, `Inactive → false`).
4. **Actions** — row-action column rendered by the DataTable on the right of each row, containing the Edit action (subject to `canUpdate`).

The toolbar contains:
- A search input (DataTable default), filtering across `name` and `display_name` text columns.
- A Filters toggle (DataTable default), exposing the per-column filter row.
- A Columns settings affordance (DataTable default).
- A "+ New sub-organisation" button (slice-controlled; rendered above or beside the DataTable's title within the same `Card`'s header, NOT via the DataTable's built-in `onCreateRow`).

The DataTable's built-in Create / Edit modals, Import, Export, and Delete affordances are not used (`features.creation: false`, `features.deletion: false`, `features.import: false`, `features.export: false`). No `onEditRow` is passed; row-level Edit is provided via the `actions` array.

### Primary actions

**"+ New sub-organisation" button (toolbar)**
- Visible only when `useResourcePermissions('organisations').canCreate === true`.
- Click opens the Create dialog.
- Form fields:
  - `Internal name` (`name`): `Input`, required, free-text, trimmed, non-empty after trim. Helper text: "Globally unique across the platform. Cannot be changed later."
  - `Display name` (`display_name`): `Input`, required, free-text, trimmed, non-empty after trim.
  - `Description`: `Textarea`, optional, multi-line. Empty values are persisted as SQL NULL.
- Submit button: "Create sub-organisation". Cancel button: "Cancel".
- On submit success: dialog closes, `toast({ variant: 'success', title: 'Sub-organisation created.' })` fires, and the list refreshes (the new row appears in alphabetical position by `display_name`).
- On 23505 (duplicate name): dialog stays open with the inline error from §4 Error states.
- On network / other server error: dialog stays open with the destructive toast from §4 Error states.

**Row "Edit" action**
- Visible only when `useResourcePermissions('organisations').canUpdate === true`.
- Click opens the Edit dialog pre-filled with the row's values.
- Form fields:
  - `Internal name` (`name`): `Input`, **read-only / disabled**. Helper text: "Internal names cannot be changed after create."
  - `Display name` (`display_name`): `Input`, required, trimmed, non-empty after trim.
  - `Description`: `Textarea`, optional, multi-line. Empty values are persisted as SQL NULL.
  - `Active`: `Switch` labelled "Active". When toggled off, the child organisation becomes inactive.
- A read-only `Parent organisation` row at the top of the dialog body, before the form fields, displays the parent organisation's `display_name` (resolved from the current org context). This row is informational only; no control to change `parent_id` is rendered.
- Submit button: "Save changes". Cancel button: "Cancel".
- On submit success: dialog closes, `toast({ variant: 'success', title: 'Sub-organisation updated.' })` fires, and the list refreshes (status badge and display name reflect the new values).
- On 23505 (would only occur if a future change re-enables `name` editing — covered defensively): dialog stays open with the inline error from §4 Error states.
- On network / other server error: dialog stays open with the destructive toast from §4 Error states.

### Secondary actions

- **Search** — DataTable global search input filters rows by substring match against `name` and `display_name` (case-insensitive).
- **Per-column filters** — Filters toggle reveals per-column filter row. The Status column exposes a boolean filter (Active / Inactive).
- **Sort** — Internal name, Display name, and Status columns are sortable. Default sort: Display name ascending.
- **Pagination** — DataTable footer renders Chevron pagination + a page-size Select. `initialPageSize: 25`; page-size options `[10, 25, 50]`.
- **Columns settings** — DataTable's Columns affordance allows the user to hide/show columns and reorder them. State is local to the page.

### Permission-conditional rendering

| Capability | Permission | When `false` |
|------------|-----------|--------------|
| Page entry | `read:page.organisations` | `<AccessDenied />` is rendered inside PaceMain |
| "+ New sub-organisation" toolbar button | `create:page.organisations` | Button is hidden |
| Row "Edit" action | `update:page.organisations` | Action is hidden from the row's action menu |
| Row "Delete" action | (n/a in v1) | No delete action is rendered for any role |

### Navigation

- The page is reachable from the Settings nav menu defined in TEAM-01 (`Settings → Organisations`, `href: /settings/organisations`).
- The slice does not navigate anywhere on success — neither create nor update changes the URL.
- The slice does not call `switchOrganisation()`; creating a child does not move the user into the child's context.
- An unmatched route under `/settings/organisations/<anything>` falls through to the TEAM-01 `*` NotFound page.

### Edge cases and constraints

- **Duplicate `name`** — on create, the server raises Postgres 23505 against `organisations_name_key`. The editor maps this to the specific copy in §4 Error states. The error path applies whether the conflict is with a sibling, an ancestor, or an unrelated organisation in another tenancy (the unique constraint is global).
- **Whitespace** — all string inputs are trimmed before submit. An all-whitespace value is treated as empty and triggers the required-field validation.
- **Empty description** — empty after trim is persisted as SQL NULL, not as an empty string.
- **Org-context switch while a dialog is open** — switching the current organisation (via the header org selector) refreshes the list against the new parent and silently closes any open editor. A `toast({ variant: 'default', title: 'Editing cancelled — organisation changed.' })` is fired.
- **Deactivation does not cascade** — flipping `is_active` to `false` does not affect members of the child organisation, their roles, or `core_organisation_app_access` rows. Reactivation is an inverse update of the same field.
- **`parent_id`** — the slice never sends `parent_id` on update payloads. On create, `parent_id` is set to `selectedOrganisation.id` and is not editable.
- **Audit fields** — `created_at`, `updated_at`, `created_by`, `updated_by` are populated server-side via column defaults / `auth.uid()`. The UI never sends them, and they are not shown in the table.
- **App-access auto-seed** — on successful create, the server-side `AFTER INSERT` trigger seeds `core_organisation_app_access` rows for the new child from the parent's active app-access rows. The client never writes to that table; failure to seed surfaces as a server error and follows the network-failure error path.

---

## §5 Visual specification

### Layout

The page renders inside the standard authenticated shell chrome (header, PaceMain content area, footer) provided by TEAM-01. Within PaceMain:

- **Page title row** — "Sub-organisations" rendered as the page heading at the top of the PaceMain content area. No subtitle, no breadcrumb.
- **Content card** — a single `Card` containing the DataTable. The Card header (`CardHeader`) includes the DataTable's title row and the slice-controlled "+ New sub-organisation" button on the right.
- **DataTable** — fills the Card body. Footer pagination renders below the table.
- **Editor dialogs** — overlay `Dialog`s portalled to `document.body`. Modal centred. Dim background behind. Focus trapped inside the dialog; native escape closes it.

Breakpoints:
- Desktop (≥ 1024px): full Card width within PaceMain's `max-w-(--app-width)`.
- Tablet (768–1023px): same Card; DataTable's horizontal scroll handles narrow columns.
- Mobile (< 768px): same Card; the toolbar's "+ New sub-organisation" button collapses to icon + label per DataTable defaults; the DataTable's body scrolls horizontally inside the Card.

Sticky elements: the shell header and footer are sticky per TEAM-01's `PaceAppLayout` defaults. The DataTable's header row is not separately sticky beyond DataTable defaults.

### Components

**Card (page content wrapper)**
- `Card` from `@solvera/pace-core/components`, rendering `<article>` with rounded border + shadow per pace-core2 visual standards.
- `CardHeader` contains the DataTable title row and the "+ New sub-organisation" button on the right.
- `CardContent` contains the DataTable body.

**DataTable**
- Source: `@solvera/pace-core/components`.
- `rbac={{ pageName: 'organisations' }}`.
- `title="Sub-organisations"`. `description` not set.
- `data` — array of child organisation rows from the SELECT.
- `columns`:
  | id | header | accessorKey | sortable | filterable | filterType | width hint | cell |
  |----|--------|-------------|----------|------------|------------|-----------|------|
  | `name` | `"Internal name"` | `name` | yes | text | text | flexible (mid) | plain text |
  | `display_name` | `"Display name"` | `display_name` | yes (default sort asc) | text | text | flexible (wide) | plain text |
  | `is_active` | `"Status"` | `is_active` | yes | yes | boolean | narrow | renders the literal text "Active" when true, "Inactive" when false |
  | (actions column — DataTable injected) | (n/a — DataTable label) | n/a | n/a | n/a | n/a | narrow, right-aligned | row-action menu containing the Edit action when `canUpdate === true` |
- `features={{ creation: false, deletion: false, import: false, export: false }}`. `editing` is left at its default (`true`) so that the row-action menu is shown; `onEditRow` is NOT supplied (the slice uses the `actions` array instead).
- `actions` — single entry: Edit. Each row's Edit click opens the slice's Edit dialog with the row's data.
- `initialPageSize: 25`; page-size options `[10, 25, 50]` (DataTable default).
- `initialSorting: [{ id: 'display_name', desc: false }]`.
- `emptyState: { title: 'No sub-organisations yet. Create one below.' }`.
- `isLoading` — bound to the SELECT's loading state.
- `getRowId: row => row.id`.

**"+ New sub-organisation" button**
- `Button` from `@solvera/pace-core/components`, primary variant.
- Rendered inside `CardHeader` on the right (or in the DataTable's title row toolbar area, visually to the right of the title) — NOT via DataTable `onCreateRow`.
- Visible only when `canCreate === true`.
- Click opens the Create dialog.

**Create dialog**
- `Dialog` + `DialogPortal` + `DialogContent` + `DialogHeader` + `DialogTitle` ("Create sub-organisation") + `DialogBody` + (form below).
- `Form` with inline Zod schema; `defaultValues: { name: '', display_name: '', description: '' }`.
- `FormField` rows:
  - **Internal name** — `name`. `Input`. Required. Placeholder: "e.g. scouts-victoria-north". Helper text: "Globally unique across the platform. Cannot be changed later." Error copy on empty: "Internal name is required." Trim whitespace before submit.
  - **Display name** — `display_name`. `Input`. Required. Placeholder: "e.g. Scouts Victoria — Northern Region". Error copy on empty: "Display name is required."
  - **Description** — `description`. `Textarea`. Optional. Placeholder: "Optional — short description of this sub-organisation." Empty values become SQL NULL.
- An `Alert` (variant `destructive`) at the top of the dialog body, rendered only when there is a non-field error (23505 duplicate, network failure caught locally) or any field-level validation error. Title: "Please fix the errors below." (validation) or copy from §4 Error states (23505).
- Footer: a right-aligned button group: Cancel (outline variant) on the left, "Create sub-organisation" (primary variant, type=submit) on the right. Submit shows a spinner and is disabled while the mutation is in flight.
- Close behaviour: native escape closes the dialog (DialogContent behaviour). Cancel button closes the dialog. Submit success closes the dialog. Submit failure leaves the dialog open.
- Focus management: DialogContent auto-focuses the first focusable element (the `name` input).

**Edit dialog**
- `Dialog` + `DialogPortal` + `DialogContent` + `DialogHeader` + `DialogTitle` ("Edit sub-organisation") + `DialogBody` + (form below).
- A read-only **Parent organisation** row at the top of the body, before the form fields. Renders a `Label` "Parent organisation" with the parent's `display_name` rendered as plain text below. No editable control.
- `Form` with inline Zod schema; `defaultValues` populated from the row.
- `FormField` rows:
  - **Internal name** — `name`. `Input` with `disabled` set to `true` (read-only). Helper text: "Internal names cannot be changed after create."
  - **Display name** — `display_name`. `Input`. Required. Same validation as Create.
  - **Description** — `description`. `Textarea`. Optional. Same handling as Create.
  - **Active** — `is_active`. `Switch` labelled "Active". On / off toggle controlling the boolean.
- An `Alert` (variant `destructive`) at the top of the dialog body, rendered as in Create.
- Footer: Cancel (outline) + "Save changes" (primary, type=submit). Submit shows a spinner and is disabled while the mutation is in flight.
- Close behaviour and focus management are the same as the Create dialog.

**Toast notifications**
- Surfaced via `toast()` from `@solvera/pace-core/components`. The provider (`ToastProvider`) is mounted by TEAM-01 in `AuthenticatedShell` and renders `<Toaster />` internally.
- Notifications appear as an `aside[role="region"][aria-label="Notifications"]` overlay anchored to the bottom-right of the viewport.
- TEAM-07 emits:
  - `toast({ variant: 'success', title: 'Sub-organisation created.' })` after a successful create.
  - `toast({ variant: 'success', title: 'Sub-organisation updated.' })` after a successful update.
  - `toast({ variant: 'destructive', title: 'Could not save sub-organisation', description: <error message> })` on network or non-23505 server failure.
  - `toast({ variant: 'default', title: 'Editing cancelled — organisation changed.' })` when the org context changes while a dialog is open.

### States

- **Loading (list)** — DataTable renders Card + Table + TableCaption + single full-width row with `<LoadingSpinner label="Loading table" />`. Toolbar Create button stays visible if `canCreate === true`.
- **Loading (RBAC check)** — `PagePermissionGuard` returns `null`; PaceMain content area is briefly blank.
- **Empty (no children)** — DataTable renders the empty placeholder with title "No sub-organisations yet. Create one below." Toolbar Create button stays visible.
- **Permission denied (page)** — `<AccessDenied />` block (`<section role="alert" aria-live="polite"><p>You do not have permission to view this page.</p></section>`) inside PaceMain. Header and footer remain visible.
- **Permission denied (action)** — affordance hidden (no copy shown in its place).
- **Mutation in flight** — submit button shows spinner, is disabled; Cancel remains enabled.
- **Validation error** — top-of-dialog destructive `Alert` with title "Please fix the errors below." plus inline error text under the offending `FormField`.
- **Duplicate `name`** — top-of-dialog destructive `Alert` with copy "An organisation with this name already exists. Names must be unique across the platform." Field-level error on the `name` `FormField` echoing the same copy.
- **Network / server error** — destructive toast (copy from §4 Error states) plus the dialog stays open.
- **Success (create)** — success toast "Sub-organisation created." plus dialog closes plus list refreshes (new row appears in alphabetical position by `display_name`).
- **Success (update)** — success toast "Sub-organisation updated." plus dialog closes plus the row's columns reflect the new values; the Status column re-renders if `is_active` changed.

### Interactions

- **Toolbar "+ New sub-organisation" button** — default state: primary variant button. Hover: standard primary hover treatment. Active: pressed state. Disabled: hidden (not greyed). Click: opens the Create dialog.
- **Row Edit action** — default state: action menu icon (DataTable default). Hover: standard hover treatment. Click: opens the Edit dialog pre-filled with the row's data. Hidden when `canUpdate === false`.
- **Status column cell** — default state: plain text "Active" or "Inactive". No interaction.
- **Search input** — default state: empty input with magnifier icon. Focus: standard focus ring. Typing: debounced filter applied to the table.
- **Per-column filter (Status)** — Boolean filter; default state: unfiltered. User picks Active or Inactive; table filters live.
- **Sort** — column header click toggles asc → desc → unsorted (DataTable default).
- **Pagination** — chevrons advance the page; page-size Select changes rows-per-page.
- **Dialogs** — open: dim background, modal centred, focus trapped, first focusable autofocuses. Close: escape, Cancel button, or successful submit.
- **Switch** — default state: unchecked or checked depending on `is_active`. Click: toggles value. While the mutation is in flight after submit, the Switch and other fields are disabled along with the submit button.

### Permission-conditional rendering

| Condition | Page body | "+ New sub-organisation" button | Row Edit action |
|-----------|-----------|---------------------------------|-----------------|
| Authenticated, has org, lacks `read:page.organisations` | `<AccessDenied />` | n/a | n/a |
| Authenticated, has org, has `read` only | DataTable | hidden | hidden |
| Authenticated, has org, has `read` + `create` | DataTable | shown | hidden |
| Authenticated, has org, has `read` + `update` | DataTable | hidden | shown |
| Authenticated, has org, has `read` + `create` + `update` | DataTable | shown | shown |

---

## §6 Business rules

**BR-01 — List scope**
- Input: `selectedOrganisation.id` from `useOrganisations()`.
- Output: SELECT against `core_organisations` filtered by `parent_id = selectedOrganisation.id`, ordered by `display_name` ascending. Both active and inactive children are returned.
- Edge: only direct children — grandchildren are not loaded.

**BR-02 — Required fields on create**
- Input: form submission with `name`, `display_name`, `description`.
- Output: both `name` and `display_name` must be non-empty after trim. `description` may be empty (becomes SQL NULL).
- Edge: an all-whitespace value is treated as empty and triggers required-field validation.

**BR-03 — Whitespace normalisation**
- Input: any string field on create or update.
- Output: leading and trailing whitespace are stripped before submit.

**BR-04 — Empty description coerced to NULL**
- Input: `description` value.
- Output: empty (after trim) is persisted as SQL NULL, not as an empty string.

**BR-05 — `name` is the globally unique internal identifier**
- Input: `name` on create.
- Output: `core_organisations.organisations_name_key` enforces uniqueness across the entire `core_organisations` table. A duplicate insert raises Postgres error 23505. The UI surfaces the specific copy in BR-09.

**BR-06 — `parent_id` lock**
- Input: any update payload.
- Output: `parent_id` is never present in update payloads emitted by this slice. No control to change `parent_id` is rendered.
- Edge: cycle creation is unreachable from this surface.

**BR-07 — `parent_id` of a created child = current org's id**
- Input: `selectedOrganisation.id` at the moment of submit on the Create dialog.
- Output: insert payload sets `parent_id: selectedOrganisation.id`.

**BR-08 — `is_active` defaults to true on create**
- Input: insert payload.
- Output: `is_active` is omitted from the insert payload; the column default `true` applies. New child orgs start active.

**BR-09 — Duplicate-name error copy**
- Input: a 23505 error (`code === '23505'`) on insert or update against `core_organisations`.
- Output: the editor surfaces an inline `Alert` (destructive) with copy "An organisation with this name already exists. Names must be unique across the platform." plus a field-level error on the `name` field with the same copy. The dialog stays open.

**BR-10 — Org-ancestors maintenance**
- Input: insert into or `parent_id` update of `core_organisations`.
- Output: the database trigger `trg_core_organisations_org_ancestors` maintains `public.org_ancestors` automatically. The slice never writes to `org_ancestors`.

**BR-11 — Mutation authority via RBAC-checked RLS**
- Input: an INSERT or UPDATE on `core_organisations` from the slice.
- Output: server-side RLS authorises the operation when either `is_super_admin(safe_get_user_id_for_rls())` is true OR `check_rbac_permission_with_context('<op>:page.organisations', 'organisations', parent_id, NULL, get_app_id('TEAM'))` returns true (where `<op>` is `create` or `update`). `parent_id` here refers to the parent organisation under which the child is being created or updated — not the new or existing row's own `id`. Authorisation is scoped to the user's permissions on the parent org. DELETE remains gated by the super-admin-only policy.

**BR-12 — App-access auto-seed**
- Input: a successful INSERT into `core_organisations`.
- Output: the server-side `AFTER INSERT` trigger seeds `core_organisation_app_access` rows for the new child organisation by copying the active app-access rows from the parent organisation. The client never writes to `core_organisation_app_access`.

**BR-13 — Page permission scope**
- Input: any RBAC check for this surface.
- Output: `pageName: 'organisations'`; ops `read`, `create`, `update`, `delete` map to `{op}:page.organisations`; `scope_type = 'organisation'`.

**BR-14 — `name` read-only after create**
- Input: the Edit dialog form.
- Output: the `name` field is rendered as a disabled `Input`; update payloads do not include `name`.

**BR-15 — Deactivation does not cascade**
- Input: an update setting `is_active = false`.
- Output: only the row's `is_active` flag changes. Members of the child organisation are untouched and stay assigned. `core_organisation_app_access` rows are not modified.

**BR-16 — RBAC visibility gating**
- Input: `useResourcePermissions('organisations')` return values.
- Output:
  - When `canCreate === false`, the toolbar "+ New sub-organisation" button is hidden.
  - When `canUpdate === false`, the row Edit action is hidden from each row's action menu.
  - When `canRead === false`, `<AccessDenied />` is rendered (handled by `PagePermissionGuard`).
  - `canDelete` is not consumed by this slice (no delete UI exists in v1).

**BR-17 — No org-context auto-switch on create**
- Input: a successful create.
- Output: the slice does not call `switchOrganisation()`. The user remains in the current parent's org context.

**BR-18 — Org-context change closes any open editor**
- Input: `selectedOrganisation.id` changes (header org selector) while a dialog is open.
- Output: the dialog closes silently, unsaved edits are discarded, and a default-variant toast fires with title "Editing cancelled — organisation changed." The list refetches against the new parent.

**BR-19 — Validation rules (editor)**
- `name` — required, trimmed, non-empty after trim. Free-text; no slug pattern enforced.
- `display_name` — required, trimmed, non-empty after trim.
- `description` — optional, multi-line; trimmed; empty becomes SQL NULL.
- `is_active` (Edit dialog only) — boolean; defaults to the row's value at open.

---

## §7 API / Contract

### Public exports

This slice does not publish any types, hooks, or services for other slices to import.

### Read contracts

- **Sub-organisations list**
  - Query: `useSecureSupabase().from('core_organisations').select('id, name, display_name, description, is_active, parent_id').eq('parent_id', selectedOrganisation.id).order('display_name', { ascending: true })`.
  - Returns: array of child organisation rows.
  - Includes both active and inactive rows.

### Write contracts

- **Create child organisation**
  - Call: `useSecureSupabase().from('core_organisations').insert({ name, display_name, description, parent_id: selectedOrganisation.id }).select().single()`.
  - On success: `{ data, error: null }` with the new row.
  - On duplicate `name`: `error.code === '23505'` against `organisations_name_key`. Surface BR-09 copy.
  - On RLS denial: `error.code === '42501'` (Postgres insufficient_privilege) or PostgREST equivalent. Surface as a destructive toast with the normalised message.
  - On other server / network failure: surface as a destructive toast with the normalised message.

- **Update child organisation (display_name / description / is_active)**
  - Call: `useSecureSupabase().from('core_organisations').update({ display_name, description, is_active }).eq('id', row.id).select().single()`.
  - Payload never includes `name`, `parent_id`, audit columns, or branding fields.
  - Error handling identical to create.

### RLS / permission contract

| Role | SELECT | INSERT | UPDATE (`display_name` / `description` / `is_active`) | UPDATE (`name` / `parent_id`) | DELETE |
|------|--------|--------|------------------------------------------------------|-------------------------------|--------|
| Super-admin | allow (member-or-admin OR super-admin) | allow | allow | allow (slice does not exercise) | allow (slice does not exercise) |
| Org admin with `update:page.organisations` on the current org | allow (member-or-admin) | allow if also has `create:page.organisations` | allow | denied (slice never sends) | denied (no delete UI) |
| Org member without org-permission | allow (member-or-admin) for SELECT | denied | denied | n/a | denied |
| Anonymous | denied | denied | denied | n/a | denied |

### Cross-slice handoffs

- TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />`) as the outermost wrapper of `AuthenticatedShell`. TEAM-07 calls `toast(...)` and depends on TEAM-01 having mounted the provider.
- TEAM-01 owns the route mounting the navItem at `Settings → Organisations` with `href: /settings/organisations`. TEAM-07 owns the page component.
- The architecture's canonical `pageName` for this slice is `organisations`. Post-build RBAC seeding (planned in TEAM-01 §8) will add the `rbac_app_pages` row.

### ID contracts

- Sub-organisation row `id` is a `uuid` (Postgres `gen_random_uuid()`). Use the typed `OrganisationId` from `@solvera/pace-core/types` if available; otherwise treat as string at runtime boundaries.

---

## §8 Data and schema references

### Tables consumed

| Table | Access | Columns used |
|-------|--------|--------------|
| `public.core_organisations` | Read + write | `id`, `name`, `display_name`, `description`, `is_active`, `parent_id` |
| `public.core_organisation_app_access` | n/a (server-side trigger only) | seeded by `AFTER INSERT` trigger; not read or written by this slice |
| `public.org_ancestors` | n/a (server-side trigger only) | maintained by `trg_core_organisations_org_ancestors`; never read or written by this slice |

### Dev-db verification (project: `rkytnffgmwnnmewevqgp`)

Verified 2026-05-04 via Supabase MCP:

- `public.core_organisations` columns: `id uuid NOT NULL DEFAULT gen_random_uuid()`, `name varchar NOT NULL`, `display_name varchar NOT NULL`, `description text NULL`, `parent_id uuid NULL`, `is_active boolean NULL DEFAULT true`, plus audit columns and branding columns not authored by this slice.
- Constraints: PK on `id`; `organisations_name_key` UNIQUE (`name`); FK `organisations_parent_id_fkey` on `parent_id` → `core_organisations(id)`; audit FKs on `created_by` / `updated_by` → `auth.users(id)`.
- Indexes: PK; UNIQUE on `name`; partial btree on `parent_id WHERE parent_id IS NOT NULL`.
- Triggers: `trg_core_organisations_org_ancestors` (AFTER INSERT, AFTER UPDATE) — maintains `public.org_ancestors`.

### Implementation gate (upstream platform work — required for Done)

The TEAM-07 v6 slice does NOT author migrations. Before TEAM-07 can be marked Done:

1. **RBAC-checked INSERT and UPDATE policies** on `public.core_organisations` for `pageName` `organisations` must replace the current super-admin-only policies, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` and using `check_rbac_permission_with_context('<op>:page.organisations', 'organisations', parent_id, NULL, get_app_id('TEAM'))`. (`parent_id` here refers to the parent organisation under which the child is being created or updated — not the new or existing row's own `id`. Authorisation is scoped to the user's permissions on the parent org.)
2. **`AFTER INSERT` trigger on `public.core_organisations`** that seeds `public.core_organisation_app_access` for the new child organisation by copying the active app-access rows from `NEW.parent_id`. Trigger function follows pace-core2 trigger standards (`SET search_path TO public`, schema-qualified references, `SECURITY DEFINER` if it queries RLS-protected tables, `COMMENT ON FUNCTION` documenting rationale).

### Helpers referenced (must be present on dev)

- `check_rbac_permission_with_context(p_permission TEXT, p_page_name TEXT, p_organisation_id UUID, p_event_id TEXT, p_app_id UUID) RETURNS boolean` — STABLE SECURITY DEFINER wrapper. Verified via dev MCP 2026-05-04.
- `is_super_admin(p_user_id UUID) RETURNS boolean` — verified.
- `safe_get_user_id_for_rls() RETURNS UUID` — verified.
- `get_app_id(p_app_name TEXT) RETURNS UUID` — verified; called as `get_app_id('TEAM')`.

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `check_rbac_permission_with_context` reference.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — shell chrome contract.

### Post-build RBAC seeding reminder

A canonical `rbac_app_pages` row for `pageName = 'organisations'` (with `scope_type = 'organisation'`, mapped to TEAM's `app_id`) must be seeded post-build per the TEAM-01 audit's seeding plan. Without it, RBAC checks for create/update on this surface return false and the affordances are hidden.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|--------|-------------|--------------|
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Wraps the page on `read:page.organisations` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Default fallback when the page guard denies access |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Gates the toolbar Create button (`canCreate`) and row Edit action (`canUpdate`) |
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for SELECT and INSERT/UPDATE on `core_organisations` |
| `useOrganisations` | `@solvera/pace-core/hooks` | Reads `selectedOrganisation` for the parent_id filter and for the parent-display label in the editor |
| `usePaceMain` | `@solvera/pace-core/hooks` | Sets `printTitle: 'Sub-organisations'` |
| `DataTable` | `@solvera/pace-core/components` | List rendering with sort/search/filter/pagination |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@solvera/pace-core/components` | Page content wrapper around the DataTable |
| `Dialog`, `DialogPortal`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogBody` | `@solvera/pace-core/components` | Create / Edit dialog primitives |
| `Form`, `FormField` | `@solvera/pace-core/components` | Editor form with Zod schema |
| `Input` | `@solvera/pace-core/components` | `name` and `display_name` controls |
| `Textarea` | `@solvera/pace-core/components` | `description` control |
| `Switch` | `@solvera/pace-core/components` | `is_active` control on the Edit dialog |
| `Label` | `@solvera/pace-core/components` | "Parent organisation" label in the Edit dialog |
| `Button` | `@solvera/pace-core/components` | Toolbar Create button; dialog Cancel / Save buttons |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | Validation / 23505 inline error block at the top of editor dialogs |
| `LoadingSpinner` | `@solvera/pace-core/components` | DataTable loading row spinner reference (rendered by DataTable internally) |
| `toast` | `@solvera/pace-core/components` | Success / network-failure / org-switch notifications. `ToastProvider` is mounted by TEAM-01 |
| `z` | `zod` | Inline schema for the editor form |

### §9.2 Slice-specific caveats

**`ToastProvider` mount.** This slice does NOT mount `<ToastProvider>` or `<Toaster />`. Both are mounted by TEAM-01 in `AuthenticatedShell`. Calling `toast(...)` from inside any TEAM-07 component will work because every authenticated route descends from `AuthenticatedShell`'s provider. Do not add a second mount in this slice.

**`DataTable` editor pattern.** The DataTable's built-in Create / Edit modals are not used. Set `features.creation: false`, `features.deletion: false`, `features.import: false`, `features.export: false`. Do NOT pass `onEditRow` (which would mount the built-in edit modal). Use the `actions` array for the row Edit action and a slice-controlled `Dialog` for both create and edit.

**`useResourcePermissions` boolean gating.** Read `canCreate` and `canUpdate` from `useResourcePermissions('organisations')`. Hide affordances when `false`; do not render disabled-but-visible buttons. Treat `isLoading: true` from the hook as "do not show the affordance yet" — the brief absence avoids flicker and prevents a request that would 403 on the server.

**`useSecureSupabase` selection.** Call with no arguments. Do not import `createClient` from `@supabase/supabase-js` for any reason. The client is wrapped server-side with the resolved `organisationId`; the slice does not need to thread `organisationId` through manually.

**Mutation contract gate.** TEAM-07's INSERT / UPDATE paths depend on the upstream platform adding RBAC-checked RLS policies and the `AFTER INSERT` trigger described in §8 Implementation gate. Until those land on dev, every mutation request returns 401 / 403 for non-super-admin users; the v6 slice does not author the migration.

**`Switch` controlled value on Edit dialog.** Bind to the form's `is_active` field via `FormField` `render` prop. Submit only when the dialog is submitted; do not commit `is_active` on each toggle.

**Org-context change handling.** Subscribe to `selectedOrganisation.id` via `useOrganisations()` and close any open editor when it changes. The list refetch happens automatically because the SELECT depends on the same value.

---

## §10 Permission and access rules

### Page-level guard

| Route | `pageName` | `operation` | Fallback |
|-------|-----------|------------|----------|
| `/settings/organisations` | `organisations` | `read` | `<AccessDenied />` |

### Action-level access

| Action | Permission required | Mechanism |
|--------|---------------------|-----------|
| View page body | `read:page.organisations` | `PagePermissionGuard` |
| Show toolbar Create button | `create:page.organisations` | `useResourcePermissions('organisations').canCreate` |
| Submit Create dialog | `create:page.organisations` | RBAC-checked INSERT policy (server-side) |
| Show row Edit action | `update:page.organisations` | `useResourcePermissions('organisations').canUpdate` |
| Submit Edit dialog (any field) | `update:page.organisations` | RBAC-checked UPDATE policy (server-side) |
| Delete a child organisation | (n/a — UI not provided in v1) | Server-side super-admin-only DELETE policy unchanged |

### Row-level access

- A user can SELECT a child organisation row when they are a super-admin OR they have access to the organisation via `check_user_organisation_access(id)` (existing SELECT policy). For TEAM-07's list, this is implicitly satisfied because the query is filtered to children of the user's current organisation, which they must have access to.

### Proxy / impersonation

- None. The slice does not consult or expose proxy / impersonation state.

---

## §11 Acceptance criteria

**AC-01 — Page entry, authenticated org admin with `read`**
Given a user is authenticated and has `read:page.organisations` on their current organisation, when they navigate to `/settings/organisations`, then the page renders with title "Sub-organisations" and a DataTable showing the direct children of the current organisation sorted by display name ascending.

**AC-02 — Empty list**
Given the current organisation has zero direct children, when the page loads, then the DataTable shows the empty placeholder "No sub-organisations yet. Create one below." and the "+ New sub-organisation" button is visible (provided the user has create permission).

**AC-03 — Create — happy path**
Given a user has `create:page.organisations` and the editor is open with valid `Internal name`, `Display name`, and an empty `Description`, when they submit "Create sub-organisation", then the dialog closes, a success toast "Sub-organisation created." is shown, and a new row appears in the table at the correct alphabetical position by display name.

**AC-04 — Create — duplicate name**
Given a user submits Create with a `name` that already exists somewhere in `core_organisations`, when the server returns Postgres 23505, then the dialog stays open with an inline destructive `Alert` reading "An organisation with this name already exists. Names must be unique across the platform.", and the `name` field shows a matching field-level error.

**AC-05 — Create — required field validation**
Given a user submits Create with empty `Internal name`, when the form validates, then submit is blocked, an inline destructive `Alert` "Please fix the errors below." appears at the top of the dialog body, and the `Internal name` field shows "Internal name is required."

**AC-06 — Edit — happy path**
Given a user has `update:page.organisations` and opens Edit on a row, when they change `Display name` and submit "Save changes", then the dialog closes, a success toast "Sub-organisation updated." is shown, and the row's Display name column reflects the new value.

**AC-07 — Edit — name read-only**
Given a user opens Edit on a row, when the dialog renders, then the `Internal name` field is disabled and the helper text reads "Internal names cannot be changed after create."

**AC-08 — Edit — deactivate (no cascade)**
Given a user toggles `Active` to off on the Edit dialog and submits, when the update completes, then the row's Status column shows "Inactive", and (verified separately) the child organisation's members and `core_organisation_app_access` rows are unchanged.

**AC-09 — Permission denied — page**
Given a user is authenticated but lacks `read:page.organisations`, when they navigate to `/settings/organisations`, then `<AccessDenied />` is shown inside PaceMain with copy "You do not have permission to view this page.", and the shell header and footer remain visible.

**AC-10 — Permission denied — create button hidden**
Given a user lacks `create:page.organisations` but has `read`, when the page loads, then the "+ New sub-organisation" button is not rendered anywhere on the page.

**AC-11 — Permission denied — edit action hidden**
Given a user lacks `update:page.organisations` but has `read`, when the page loads, then no row's action menu shows an Edit action.

**AC-12 — Org-context switch closes open editor**
Given the Edit dialog is open and a user switches the current organisation via the header org selector, when the org changes, then the dialog closes silently, a default-variant toast "Editing cancelled — organisation changed." appears, and the table refetches against the new parent organisation.

**AC-13 — Sort, search, pagination**
Given the table contains more than 25 child organisations, when the user uses the search input, sort headers, and pagination controls, then the search filters by `name` and `display_name` substring, sorts apply per column, and pagination defaults to 25 rows per page with options [10, 25, 50].

**AC-14 — Status filter**
Given the table contains both active and inactive children, when the user reveals the column filter row and filters Status to Active, then only rows with `is_active === true` are shown; switching to Inactive shows only `is_active === false` rows.

**AC-15 — Network failure on save**
Given a user submits Create or Edit and the server returns a non-23505 error (network or 5xx), when the error fires, then the dialog stays open and a destructive toast "Could not save sub-organisation" with the normalised error message is shown.

**AC-16 — Parent organisation indicator**
Given a user opens the Edit dialog on a row, when the dialog renders, then a read-only "Parent organisation" row at the top of the body shows the parent organisation's display name (the current organisation's `display_name`), and no control to change `parent_id` is rendered.

---

## §12 Verification

- Confirm `<PagePermissionGuard pageName="organisations" operation="read">` wraps the page body and that no `scope` prop is passed.
- Confirm `useSecureSupabase()` is used for all reads and writes; confirm there is no direct `createClient` import from `@supabase/supabase-js`.
- Confirm the SELECT query uses `.eq('parent_id', selectedOrganisation.id)` and `.order('display_name', { ascending: true })`.
- Confirm the INSERT payload includes `name`, `display_name`, `description` (or `null`), and `parent_id` only — no `is_active`, no audit columns, no branding columns.
- Confirm UPDATE payloads include only `display_name`, `description` (or `null`), `is_active` — no `name`, no `parent_id`.
- Confirm the toolbar "+ New sub-organisation" button is conditioned on `useResourcePermissions('organisations').canCreate`; confirm the row Edit action is conditioned on `.canUpdate`.
- Against dev-db (`rkytnffgmwnnmewevqgp`):
  - Confirm RBAC-checked INSERT and UPDATE policies on `public.core_organisations` for `pageName` `organisations` are present and use `check_rbac_permission_with_context(... , get_app_id('TEAM'))`.
  - Confirm the `AFTER INSERT` trigger on `public.core_organisations` seeds `public.core_organisation_app_access` for the new child from the parent.
  - Confirm `rbac_app_pages` has a row for `pageName = 'organisations'` with `scope_type = 'organisation'` and the TEAM `app_id` (post-build seeding may handle this; if absent, the slice's affordances will be hidden because `useResourcePermissions` returns false — note as a known seeding gap, not a code defect).
- Manually verify in dev-db that an INSERT by an org admin with `create:page.organisations` succeeds and seeds `core_organisation_app_access` rows for the new child matching the parent's active app-access set.
- Manually verify that an INSERT attempt by an authenticated user without the create permission returns an RLS denial (Postgres `42501` or PostgREST equivalent).

---

## §13 Testing requirements

n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- The Create dialog is a slice-controlled `Dialog` opened by a slice-controlled toolbar button. Do not wire Create through `DataTable.onCreateRow` — the built-in modal is not used.
- The Edit dialog is a slice-controlled `Dialog` opened from the DataTable `actions` array entry. Do not pass `onEditRow` — the built-in edit modal is not used.
- All mutations go through `useSecureSupabase()`; do not call `createClient` from `@supabase/supabase-js` directly.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- The slice does not author RLS policies or trigger functions. Both are upstream platform work and gate Done.

---

## §15 Done criteria

- All 16 acceptance criteria (AC-01 through AC-16) verified.
- Implementation gate satisfied on dev:
  - RBAC-checked INSERT and UPDATE RLS policies on `public.core_organisations` for `pageName` `organisations` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` "RBAC Permission-Based Policy") landed on dev.
  - `AFTER INSERT` trigger on `public.core_organisations` seeding `public.core_organisation_app_access` from the parent's active app-access rows landed on dev.
- Post-build RBAC seeding reminder logged in the QA pack: `rbac_app_pages` row for `pageName = 'organisations'` (`scope_type = 'organisation'`, TEAM `app_id`) added before release.
- `npm run validate` passes (lint + type-check + tests).
- Manual verification of the create + auto-seed path completed against dev (a new child organisation receives `core_organisation_app_access` rows matching the parent's active app-access set).

---

## §16 Do not

- Do not expose hard delete in v1. There is no delete affordance on this surface.
- Do not allow editing `parent_id` from this surface in v1. The Edit dialog never sends `parent_id`, and no control to change it is rendered.
- Do not surface `created_at`, `updated_at`, `created_by`, or `updated_by` as columns or fields. Audit columns are populated server-side and are not displayed.
- Do not surface `organisation_colours`, `logo_id`, `subscription_tier`, or `settings`. They are out of scope for this surface.
- Do not seed `core_organisation_app_access` from the client. Seeding is server-side via the `AFTER INSERT` trigger.
- Do not duplicate the "no organisation selected" empty state — it is handled at the shell level by TEAM-01.
- Do not navigate the user into the newly created child organisation. The org-context selector does not auto-switch on create.
- Do not cascade `is_active = false` to members or app-access. Deactivation only changes the row's flag.
- Do not mount `<ToastProvider>` or `<Toaster />` — TEAM-01 owns that mount.
- Do not author RLS policies or the trigger function in this slice. Those are upstream platform work and gate Done.
- Do not hand-roll a permission-string check; route everything through `useResourcePermissions` and `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate and scope boundaries.
- `/rebuild/architecture.md` — route ownership of `/settings/organisations`; canonical `pageName` `organisations`; nav entry under Settings.
- `/docs/requirements/team/TM01-app-shell-auth-layout-requirements.md` — app shell, `AuthenticatedShell` mounting `<ToastProvider>` (which renders `<Toaster />`), nav menu, `ProtectedRoute`, no-org empty state, post-build RBAC seeding plan.
- `/docs/requirements/team/TM06-membership-types-requirements.md` — sibling settings slice using the same RBAC-checked-RLS mutation pattern; convention reference for editor / DataTable bespoke pattern.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `check_rbac_permission_with_context`; `get_app_id`.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API; no `scope` prop at page level.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout`; nav menu dropdown contract.

### Implementation gate (upstream platform work — repeated for traceability)

Before TEAM-07 is marked Done:

1. RBAC-checked INSERT and UPDATE RLS policies on `core_organisations` for `pageName` `organisations` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` "RBAC Permission-Based Policy") must land on dev.
2. An `AFTER INSERT` trigger on `core_organisations` that seeds `core_organisation_app_access` from the parent organisation's active app-access rows must land on dev.

The v6 slice does not author either migration.
