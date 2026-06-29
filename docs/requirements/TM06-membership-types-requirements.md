# TEAM-06 — Membership types

## §1 Slice metadata

```
Slice ID:        TEAM-06
Name:            Membership types
Status:          Draft
Depends on:      TEAM-01
Backend impact:  Read contract only (RLS INSERT/UPDATE policies on core_membership_type are upstream platform work — see §15 implementation gate)
Frontend impact: UI
Routes owned:    /settings/membership-types
QA pack:         docs/test-packs/TM06-qa-pack.md
```

---

## §2 Overview

TEAM-06 delivers the admin surface for managing membership types within the currently selected organisation. Org-admin staff land at `/settings/membership-types`, see a sortable, filterable table of every membership type defined for their organisation, and can create new types, edit fields on a saved type, or deactivate a type (with reactivate available for previously-deactivated rows). Mutations flow through the secure Supabase client and are authorised at the database layer by RBAC-checked RLS policies. The slice does not own member assignment, fee or billing semantics, or org hierarchy — those are TEAM-02/03, TEAM-08, and TEAM-07 respectively.

**Prototype reference:** `pace-prototype/apps/pace-team/pages/FormsReportsSettingsPages.jsx` — `SettingsMembershipTypes` (route `/settings/membership-types` via `SettingsPage` dispatcher).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need to define the catalogue of membership types (e.g. "Junior", "Senior", "Honorary") that members in their organisation can be assigned to. TEAM-06 provides the only place in TEAM where these rows are created, renamed, age-banded, and retired. Without this surface, no other slice can offer membership type as a structured field.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| List page | `/settings/membership-types` | Table of membership types for the currently selected organisation |
| Create / edit inline form | (replaces list on same route) | `Card` inline editor swaps table — Compliance Register pattern; not `Dialog` |
| Deactivate confirmation | (overlay on list page) | `ConfirmationDialog` with destructive variant |
| Reactivate row action | (inline on list page) | Direct action — no confirmation |

### Boundaries

TEAM-06 does **not** own:
- Membership status on a member record or assignment of members to a type (TEAM-02, TEAM-03).
- Fee, billing, or financial settings (TEAM-08).
- Org hierarchy or sub-organisation structure (TEAM-07).
- Hard delete of `core_membership_type` rows — soft delete only (deactivate via `is_active = false`).
- The RLS migration that grants INSERT and UPDATE on `core_membership_type` — that is upstream platform work, gated as per §15.

### Architectural posture

**Mutation contract — Option A (RBAC-checked RLS policies).** All reads and writes go via `useSecureSupabase().from('core_membership_type')` using `select`, `insert`, and `update`. Authorisation is enforced at the database layer by RBAC-checked INSERT and UPDATE RLS policies on `core_membership_type` matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md`, using helper `data_check_rbac_permission_with_context('<op>:page.membership-types', 'membership-types', organisation_id, NULL, data_get_app_id('TEAM'))`. The slice does **not** author the RLS migration. The migration is upstream platform work and gates implementation (see §15).

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**Action gating.** Create / Edit / Deactivate / Reactivate visibility is gated by `useResourcePermissions('membership-types')`: the Create button is hidden when `canCreate === false`; Edit / Deactivate / Reactivate row actions are hidden when `canUpdate === false`. Hard delete is not exposed; `canDelete` is not consumed.

**Org-scoped reads and writes.** Every list query, every aggregate query, and every mutation is filtered or stamped with `organisation_id = selectedOrganisation.id`. Switching the org context refetches the list against the new org and silently closes any open editor.

**Editor pattern.** A slice-controlled `Dialog` editor is used for final create / edit submission. Create entry is initiated via the `DataTable` built-in create modal (`onCreateRow`), which hands off to the slice editor; edit entry is invoked from row actions. `features.deletion: false` is set; `onDeleteRow` is not passed.

### Page-level guards and evaluation ordering

The `/settings/membership-types` route sits behind `ProtectedRoute` (from TEAM-01's shell), the `AuthenticatedShell` no-org check (from TEAM-01), and `PagePermissionGuard pageName="membership-types" operation="read"`. Evaluation order when context is absent:

1. **Authentication** — `ProtectedRoute` (TEAM-01) fires first. Unauthenticated users are redirected to `/login`; the guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, the `AuthenticatedShell` renders `<LoadingSpinner />` (full-viewport). The page guard does not evaluate yet.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, the `AuthenticatedShell` renders the no-org empty state from TEAM-01. The page guard is not reached.
4. **Page permission guard** — `PagePermissionGuard` fires with org scope fully resolved from `OrganisationServiceProvider`. While the RBAC check is in flight (`isLoading === true`), the guard returns `null` (no `loading` prop supplied); this brief blank is acceptable.
5. **Permission denied** — On deny, `<AccessDenied message="You do not have permission to view this page." />` renders inside the `AuthenticatedShell` chrome.

If `selectedOrganisation` somehow resolves to `null` after step 3 (e.g. a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/settings/membership-types` renders for an authenticated user whose currently selected organisation has resolved.
- **F-02** On entry, the page fetches all `core_membership_type` rows for `selectedOrganisation.id`, regardless of `is_active`.
- **F-03** On entry, the page also fetches a per-type member count by counting `core_member` rows joined to each `core_membership_type.id` for the current org.
- **F-04** The page title is "Membership types" (sentence case). No breadcrumb is rendered.
- **F-05** Switching the currently selected organisation refetches the list against the new org and silently closes any open editor or confirmation dialog (BR-07).

### Loading states

- **F-06** While the list query is in flight, the table renders the `DataTable` loading state: a Card → Table → TableCaption (title + toolbar) → a single full-width row containing `<LoadingSpinner label="Loading table" />`.

### Empty states

- **F-07** When the org has zero membership types, the page renders a `DataTable` empty state with heading "No membership types yet." and description "Create your first to start assigning members.", with the toolbar's primary `Create membership type` button visible.

### Error states

- **F-08** A 23505 (unique violation) on save displays the inline form error "A membership type with this name already exists in this organisation." in the editor dialog. The dialog stays open; the form remains editable.
- **F-09** Any other Supabase error on save is normalised through `HandleSupabaseError` (with the slice context string `'core_membership_type'`) and surfaced as a `destructive` toast.
- **F-10** A user without `read:page.membership-types` sees the `<AccessDenied />` fallback inside the `AuthenticatedShell` chrome with message "You do not have permission to view this page."

### Primary content

- **F-11** The table renders one row per `core_membership_type` row in the current org, in the columns and order: **Name**, **Min age**, **Max age**, **Active**, **Members**, **Actions**.
- **F-12** The **Name** column shows `name` as plain text. Default sort is `Name` ascending.
- **F-13** The **Min age** column shows `min_age` as a number, or an em-dash ("—") when `null`.
- **F-14** The **Max age** column shows `max_age` as a number, or an em-dash ("—") when `null`.
- **F-15** The **Active** column shows a badge: "Active" when `is_active === true`, "Inactive" when `is_active === false`.
- **F-16** The **Members** column shows the integer count of `core_member` rows joined to this type within the current org. When the count is zero, the cell shows `0`.
- **F-17** The **Actions** column shows row-level action triggers per BR-09 (Edit, Deactivate, Reactivate), gated by `canUpdate`.
- **F-18** Audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) are not displayed in any column (BR-06).

### Primary actions

- **F-19** **Create membership type.** A toolbar button labelled "Create" opens the `DataTable` create modal. Submitting that modal opens the slice editor dialog with a blank form. On successful save: the dialog closes; the list refreshes; a `success` toast renders with copy "Membership type created." The button is hidden when `canCreate === false`.
- **F-20** **Edit row.** An "Edit" row action opens the editor dialog pre-populated with the row's current field values. On successful save: the dialog closes; the list refreshes; a `success` toast renders with copy "Membership type updated." The action is hidden when `canUpdate === false`.
- **F-21** **Deactivate row.** A "Deactivate" row action (only shown when `is_active === true` and `canUpdate === true`) opens a `ConfirmationDialog` with the destructive variant per BR-10. On confirm: the row's `is_active` is updated to `false`; the dialog closes; the list refreshes; a `success` toast renders with copy `"{name} deactivated."` (with the type's name interpolated).
- **F-22** **Reactivate row.** A "Reactivate" row action (only shown when `is_active === false` and `canUpdate === true`) directly updates `is_active` to `true` without a confirmation step. On success: the list refreshes; a `success` toast renders with copy `"{name} reactivated."` The action is hidden when `canUpdate === false`.

### Secondary actions

- **F-23** **Search.** A toolbar text-search input filters table rows globally (DataTable default behaviour). All visible columns participate in the search match.
- **F-24** **Per-column filters.** The DataTable's column filter row is available, including a filter on the **Active** column (Active / Inactive / All).
- **F-25** **Sort.** Each column header is sortable. Default sort is **Name** ascending.
- **F-26** **Pagination.** `initialPageSize` is `25`; page size options are `[10, 25, 50]`.
- **F-27** **No import / export / hierarchical / grouping affordances** are surfaced. The toolbar's pace-core2 default features for Import, Export, hierarchical toggles, and grouping are disabled by setting `features.import: false`, `features.export: false`, `features.hierarchical: false`, `features.grouping: false`, `features.deletion: false`, `features.deleteSelected: false`, `features.selection: false`.

### Permission-conditional rendering

- **F-28** When `canRead === false`, the route's `PagePermissionGuard` denies and `<AccessDenied />` renders.
- **F-29** When `canCreate === false`, the toolbar's **Create** button is not rendered.
- **F-30** When `canUpdate === false`, the row actions **Edit**, **Deactivate**, and **Reactivate** are not rendered for any row.
- **F-31** Hard delete is not surfaced under any permission combination.

### Navigation

- **F-32** The page is reachable from the TEAM-01 navigation menu under **Settings → Membership Types** (`/settings/membership-types`).
- **F-33** No surface in this slice navigates away from `/settings/membership-types`. All actions (create / edit / deactivate / reactivate) resolve in modal overlays on the same route.

### Edge cases and constraints

- **F-34** **Org switch while editor open.** When `selectedOrganisation` changes while the editor or confirmation dialog is open, the dialog closes silently, any in-flight unsaved edits are discarded, and a `default`-variant toast renders with copy "Editing cancelled — organisation changed." (BR-07).
- **F-35** **Duplicate name within current org.** The unique constraint `(name, organisation_id)` is enforced at the database. If a user submits a duplicate name (case-insensitive duplicate detected at submit-time), the form displays the field error "A membership type with this name already exists in this organisation." (BR-03, BR-08).
- **F-36** **Min/max age relationship.** When both `min_age` and `max_age` are populated, the form requires `min_age ≤ max_age` (BR-05). When only one or neither is supplied, no relational validation fires.
- **F-37** **Server-side audit columns.** The form does not display or send `created_at`, `updated_at`, `created_by`, or `updated_by`. These are populated server-side via column defaults and a database trigger that refreshes `updated_at` / `updated_by` on UPDATE (BR-06).

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `OrgContextBar`, `PaceMain`, footer). Within `PaceMain`:

- **Page header** — `PageHeader`:
  - `title`: "Membership types".
  - `sub`: "Membership types determine fees, age eligibility, and which members appear on event and comms picker lists."
  - `right`: primary `Button` "New type" when list view is active and `canCreate === true`; hidden while inline editor is open.
- **Content region — list OR inline editor (mutually exclusive)** — Prototype **Compliance Register** pattern: inline form **replaces** the table in place; no modal `Dialog` for create/edit.
  - **List view** — `DataTable` inside a `Card` (or table-only layout) listing types with row icon actions (edit, deactivate/delete per permissions).
  - **Editor view** — When `editing` is `"new"` or a row id, render `MembershipTypeForm` as a `Card` with `CardHeader`/`CardTitle` ("New membership type" / "Edit membership type"), `CardContent` form fields, `CardFooter` with `SaveActions` (Save + Cancel). Cancel returns to list view without route change. Use `key={editing}` so switching rows remounts defaults.

Breakpoints: standard pace-core2 responsive behaviour. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Layout acceptance criteria (prototype alignment)

- [ ] `PageHeader` with title, subtitle, and "New type" CTA in header (list mode only).
- [ ] `OrgContextBar` breadcrumb above content.
- [ ] Create/edit uses **inline `Card` form that swaps the table** — not `Dialog` overlays.
- [ ] Route is `/settings/membership-types` (standalone settings page, no settings hub).

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout:

- `MembershipTypesPage.tsx` uses plain `<h1>` and `Dialog`/`DialogPortal` editors for create/edit.
- DataTable toolbar Create handoff opens dialog instead of inline swap pattern.
- Deactivate still uses `ConfirmationDialog` (acceptable for destructive confirm; prototype uses inline icon delete stub).

### Components

**`DataTable`** (`@solvera/pace-core/components`)
- Purpose: table of `core_membership_type` rows for the current org with sort, search, per-column filter, and pagination.
- `data`: array of rows from the list query.
- `rbac.pageName`: `'membership-types'`.
- `title`: omitted (the page title sits above the table).
- `isLoading`: bound to the list query's loading state.
- `emptyState`: `{ title: "No membership types yet.", description: "Create your first to start assigning members." }`.
- `getRowId`: `(row) => row.id`.
- `initialPageSize`: `25`.
- `actions`: array of row-action descriptors for **Edit**, **Deactivate** (only when `is_active === true`), **Reactivate** (only when `is_active === false`), each opening the slice's own `Dialog` or `ConfirmationDialog`.
- `onCreateRow`: wired to a slice-controlled handler that receives the DataTable create-modal submit and opens the editor `Dialog` with a blank form.
- `onEditRow`, `onDeleteRow`: not used.
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, deletion: false, deleteSelected: false, selection: false, search: true, pagination: true, sorting: true, filtering: true, creation: true, editing: false, columnVisibility: true, columnReordering: true }`.
- `initialSorting`: `[{ id: 'name', desc: false }]`.

Columns:

| Header copy | Field | Width hint | Notes |
|---|---|---|---|
| Name | `name` | flexible | Default sort asc; plain text |
| Min age | `min_age` | narrow | Number; em-dash when null |
| Max age | `max_age` | narrow | Number; em-dash when null |
| Active | `is_active` | narrow | Badge: "Active" (default tone) or "Inactive" (muted tone); column filter offers Active / Inactive / All |
| Members | (derived) | narrow | Integer count from members-aggregate query; joined client-side onto each row and sorted via DataTable's standard column sort over the resulting numeric column (no server-side sort on this column) |
| Actions | (n/a) | narrow | Edit / Deactivate / Reactivate triggers per row gated by `canUpdate` |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search…".
- Column-filter toggle (default DataTable affordance).
- Column-visibility popover (default DataTable affordance).
- **Create** primary button (right-aligned), visible when `canCreate === true`.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Editor `Dialog`** (`@solvera/pace-core/components`)
- Trigger: DataTable **Create** toolbar button submit (blank form handoff) or **Edit** row action (pre-populated form).
- Container: `<Dialog open onOpenChange><DialogPortal><DialogContent><DialogHeader><DialogTitle>{Create | Edit} membership type</DialogTitle></DialogHeader><DialogBody>{form}</DialogBody></DialogContent></DialogPortal></Dialog>`.
- Title copy: "Create membership type" or "Edit membership type" depending on mode.
- Description: omitted.
- Closes on: native escape key (DialogContent uses `dialog.showModal()`), the SaveActions Cancel button, successful submit, or org switch.

**Editor form** (`Form` + `FormField` from `@solvera/pace-core/components`)
- Validation: Zod schema authored inline within the slice; passed to `<Form schema={...}>` so `zodResolver` is applied implicitly.
- Field 1 — **Name**:
  - Type: text input via default `FormField` rendering.
  - Required: yes.
  - Validation: trimmed; 1–80 characters; no leading or trailing whitespace; case-insensitive uniqueness check on submit (server-enforced via 23505, surfaced as form error). See BR-08.
  - Placeholder: "e.g. Junior".
  - Helper text: omitted.
  - Error copy: required → "Name is required."; length out of range → "Name must be 1 to 80 characters."; whitespace edges → "Name must not start or end with whitespace."; duplicate (23505) → "A membership type with this name already exists in this organisation."
- Field 2 — **Minimum age**:
  - Type: number input (`type="number"`).
  - Required: no.
  - Validation: integer; 0–120 inclusive when supplied. See BR-05.
  - Placeholder: omitted.
  - Helper text: "Optional. Leave blank for no lower bound."
  - Error copy: out of range → "Minimum age must be between 0 and 120."; not integer → "Minimum age must be a whole number."
- Field 3 — **Maximum age**:
  - Type: number input (`type="number"`).
  - Required: no.
  - Validation: integer; 0–120 inclusive when supplied; if both `min_age` and `max_age` are supplied, `min_age ≤ max_age`. See BR-05.
  - Placeholder: omitted.
  - Helper text: "Optional. Leave blank for no upper bound."
  - Error copy: out of range → "Maximum age must be between 0 and 120."; not integer → "Maximum age must be a whole number."; below min → "Maximum age must be greater than or equal to minimum age."
- Field 4 — **Active**:
  - Type: `Switch` from `@solvera/pace-core/components` with a `Label` reading "Active".
  - Required: yes (boolean).
  - Default on create: `true`.
  - Helper text: "Inactive types cannot be assigned to new members."
  - Error copy: n/a.
- Submit footer: `SaveActions` with default "Cancel" and "Save" labels. `saveType` is `'submit'`. `saveDisabled` is bound to the form's `formState.isSubmitting`.

**Deactivate `ConfirmationDialog`** (`@solvera/pace-core/components`)
- Trigger: **Deactivate** row action.
- `title`: "Deactivate membership type?".
- `description`: "Members already assigned to '{name}' will stay assigned, but this type cannot be selected for new assignments. You can reactivate later." (with the type's name interpolated).
- `confirmLabel`: "Deactivate".
- `cancelLabel`: "Cancel".
- `variant`: `'destructive'`.
- `onConfirm`: awaits the `is_active = false` update; closes on resolution. `isPending` reflects the in-flight mutation.

**Reactivate row action** — direct, no confirmation; uses the row's action trigger directly to perform the `is_active = true` update.

**Toasts** — surfaced via the module-level `toast({ title, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'default'`, `'destructive'`, `'success'`. The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms).

### States

- **Loading** — `DataTable` renders Card + Table + TableCaption (title + toolbar) + a single full-width row with `<LoadingSpinner label="Loading table" />`. The toolbar's Create button remains visible during loading.
- **Empty** — `DataTable` renders the empty state heading "No membership types yet." and description "Create your first to start assigning members." inside the table area. The toolbar (with the Create button when `canCreate === true`) remains visible above the empty area.
- **Error (save)** — Within the editor `Dialog`, an inline form error appears for the offending field. For 23505 the **Name** field shows "A membership type with this name already exists in this organisation." For non-23505 errors, the dialog stays open and a `destructive` toast surfaces the normalised message from `HandleSupabaseError`.
- **Permission denied** — `<AccessDenied />` in `PaceMain` with TEAM-01 chrome (header, footer) visible.
- **Success (create)** — Editor closes; `success` toast: "Membership type created."; list refreshes.
- **Success (update)** — Editor closes; `success` toast: "Membership type updated."; list refreshes.
- **Success (deactivate)** — `ConfirmationDialog` closes; `success` toast: `"{name} deactivated."`; list refreshes.
- **Success (reactivate)** — `success` toast: `"{name} reactivated."`; list refreshes.
- **Org switch with editor open** — Dialog closes silently; unsaved edits are discarded; `default`-variant toast: "Editing cancelled — organisation changed."

### Interactions

- **Create** button: visible when `canCreate === true`. Default: standard primary tone. Hover: pace-core2 default hover treatment. Disabled: pace-core2 default disabled treatment. Click: opens the DataTable create modal; submitting it opens the slice editor `Dialog` with focus in the first form input (DialogContent auto-focus).
- **Edit row action**: visible when `canUpdate === true`. Click: opens editor `Dialog` pre-populated with that row's current values; focus moves into the first form input.
- **Deactivate row action**: visible when `canUpdate === true` and the row is active. Click: opens `ConfirmationDialog` with destructive variant; focus on the destructive **Deactivate** button. Confirm: awaits the update, button shows pending state via `isPending`; on resolve the dialog closes. Cancel or escape: closes without mutation.
- **Reactivate row action**: visible when `canUpdate === true` and the row is inactive. Click: directly performs the `is_active = true` update with no intermediate dialog. The row action button shows a brief pending state for the duration of the mutation.
- **Editor `Dialog`**: native escape key closes (via `dialog.showModal()`); SaveActions Cancel button closes. Submit button enters disabled / pending state during the mutation. Successful submit closes the dialog and refreshes the list. Org switch closes the dialog silently with a `default` toast.
- **Search input**: typing filters the table rows globally with no submit step. Clearing returns all rows.
- **Active column filter**: dropdown with options Active / Inactive / All. Selection filters rows immediately.
- **Sort headers**: click toggles asc/desc/none on that column.
- **Pagination controls**: page size dropdown changes rows per page; prev/next change page index; current page indicator updates immediately.

### Permission-conditional rendering

| Condition | Page entry | Create button | Edit row action | Deactivate row action | Reactivate row action |
|---|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a | n/a |
| Authenticated, org, `canRead === false` | `<AccessDenied />` | n/a | n/a | n/a | n/a |
| Authenticated, org, `canRead === true`, `canCreate === false`, `canUpdate === false` | List visible | Hidden | Hidden | Hidden | Hidden |
| Authenticated, org, `canRead === true`, `canCreate === true`, `canUpdate === false` | List visible | Visible | Hidden | Hidden | Hidden |
| Authenticated, org, `canRead === true`, `canCreate === false`, `canUpdate === true` | List visible | Hidden | Visible | Visible (when row active) | Visible (when row inactive) |
| Authenticated, org, `canRead === true`, `canCreate === true`, `canUpdate === true` | List visible | Visible | Visible | Visible (when row active) | Visible (when row inactive) |

---

## §6 Business rules

**BR-01 — Org-scoped reads.**
- Input: a list query for `core_membership_type`.
- Output: every row returned has `organisation_id === selectedOrganisation.id`. The query filter `.eq('organisation_id', selectedOrganisation.id)` is applied at every read site.
- Edge: an org with zero rows returns an empty array; never includes another org's rows.

**BR-02 — Org-scoped writes.**
- Input: an insert or update payload for `core_membership_type`.
- Output: the payload includes `organisation_id = selectedOrganisation.id`. The RBAC-checked RLS WITH CHECK policy (per pace-core2 standard 3 — RBAC Permission-Based Policy template) rejects mismatched org via `data_check_rbac_permission_with_context(...)`.

**BR-03 — Per-org name uniqueness.**
- Input: a submitted `name` plus the user's `organisation_id`.
- Output: enforced by the database constraint `core_membership_type_name_organisation_id_key` (UNIQUE on `(name, organisation_id)`). Violation returns Postgres error code 23505. The slice overrides the default normalised copy for 23505 with: "A membership type with this name already exists in this organisation."
- Edge: uniqueness is per-org. Two organisations may each have a row called "Junior".

**BR-04 — `is_active` defaults and semantics.**
- Input: an insert with no `is_active` field.
- Output: the database default `true` is applied. New rows are active. Deactivation is an UPDATE setting `is_active = false`; rows are never DELETEd through this slice.

**BR-05 — Age range validation.**
- Input: form fields `min_age` and `max_age`, each independently nullable.
- Output:
  - Each field, when supplied, must be an integer in `[0, 120]`.
  - When both `min_age` and `max_age` are supplied, `min_age <= max_age` is required.
  - When only one or neither is supplied, no relational validation fires.
- Edge: client-side Zod validation runs before submit; the server enforces no further age constraint.

**BR-06 — Server-side audit columns.**
- Input: an insert or update payload.
- Output: the payload does **not** include `created_at`, `updated_at`, `created_by`, or `updated_by`. These are populated by column defaults (`now()`, `auth.uid()`) and a database trigger that refreshes `updated_at` / `updated_by` on UPDATE.
- Edge: the UI never patches these columns.

**BR-07 — Org switch closes editor.**
- Input: `selectedOrganisation` changes while the editor `Dialog` or `ConfirmationDialog` is open.
- Output: the dialog closes silently; in-flight unsaved edits are discarded; a `default`-variant toast renders: "Editing cancelled — organisation changed.". The list query refetches against the new org.

**BR-08 — Name validation.**
- Input: a submitted `name`.
- Output:
  - Required: empty string after trim → error "Name is required."
  - Length: trimmed length must be 1 to 80 characters → error "Name must be 1 to 80 characters."
  - Whitespace edges: original (untrimmed) value must not start or end with whitespace → error "Name must not start or end with whitespace."
  - Duplicate (case-insensitive) within current org: surfaced via 23505 → error "A membership type with this name already exists in this organisation." (BR-03).
- Edge: case-insensitive matching is enforced on save by the database via 23505 surface; the form does not pre-emptively query for collision.

**BR-09 — Permission resolution.**
- Page entry requires `read:page.membership-types` (resolved via `<PagePermissionGuard pageName="membership-types" operation="read">`).
- Create requires `create:page.membership-types`; resolved via `useResourcePermissions('membership-types').canCreate`.
- Update / Deactivate / Reactivate require `update:page.membership-types`; resolved via `useResourcePermissions('membership-types').canUpdate`.
- Hard delete is not exposed; `canDelete` is not consumed.
- Permission strings are constructed by pace-core2's `toPagePermission(resource, op)` as `{op}:page.{resource}`.

**BR-10 — Confirmation copy and variant.**
- Deactivate: `ConfirmationDialog` with `variant="destructive"`, `title="Deactivate membership type?"`, `description="Members already assigned to '{name}' will stay assigned, but this type cannot be selected for new assignments. You can reactivate later."`, `confirmLabel="Deactivate"`, `cancelLabel="Cancel"`.
- Reactivate: no confirmation. The row action performs the update directly.

**BR-11 — Toast vocabulary.**
- Success — `variant: 'success'`:
  - Create: "Membership type created."
  - Update: "Membership type updated."
  - Deactivate: `"{name} deactivated."`
  - Reactivate: `"{name} reactivated."`
- Default — `variant: 'default'`:
  - Org switch with editor open: "Editing cancelled — organisation changed."
- Destructive — `variant: 'destructive'`:
  - Save failure (non-23505): the normalised message returned by `HandleSupabaseError`. The 23505 case is handled inline in the form, not via toast.

**BR-12 — Concurrency model.**
- Concurrent edits use last-write-wins. If two admins edit the same membership type at the same time, the second save overwrites the first; no optimistic locking, no version column.
- The database `updated_at` column reflects the most recent write.
- Edge: the slice does not warn the user about a stale read. If a stale write succeeds, the next list refetch will reflect the second-write values.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. All membership-type CRUD UX lives behind `/settings/membership-types`.

### Read contracts

- **List query.** `useSecureSupabase().from('core_membership_type').select('id, name, min_age, max_age, is_active, organisation_id').eq('organisation_id', selectedOrganisation.id)` — returns the rows used by the table. Sort is applied client-side by `DataTable`.
- **Members-count query.** Aggregated count of `core_member` rows joined to each `core_membership_type.id` for the current org via a single grouped query: `SELECT membership_type_id, count(*) FROM core_member WHERE organisation_id = :orgId GROUP BY membership_type_id`. The result is joined client-side onto the type rows. The query must be filtered by `organisation_id = selectedOrganisation.id`.

### Query-key contract

- Read query key: `['membership-types', selectedOrganisation.id]`. Mutations invalidate this key on success.
- The members-count aggregate uses key `['membership-types', selectedOrganisation.id, 'members-count']` and is invalidated on the same success path.

### Write contracts

All writes go via `useSecureSupabase().from('core_membership_type')`. Authorisation is enforced at the database by RBAC-checked RLS policies (Option A — see §3 architectural posture).

- **Create.** `.insert({ name, min_age, max_age, is_active, organisation_id: selectedOrganisation.id }).select().single()`. Success: refetch list + success toast. Failure 23505 → form error on `name`. Failure other → `HandleSupabaseError` with destructive toast.
- **Update.** `.update({ name, min_age, max_age, is_active }).eq('id', row.id).select().single()`. Same success / failure pattern as Create. The payload omits `organisation_id` (immutable on update; would otherwise risk WITH CHECK violation if changed).
- **Deactivate.** `.update({ is_active: false }).eq('id', row.id).select().single()`. Success: refetch list + success toast `"{name} deactivated."`. Failure: `HandleSupabaseError` with destructive toast.
- **Reactivate.** `.update({ is_active: true }).eq('id', row.id).select().single()`. Success: refetch list + success toast `"{name} reactivated."`. Failure: `HandleSupabaseError` with destructive toast.

### RLS / permission contracts

- **SELECT** on `core_membership_type` is permitted on dev by the policy `read_team_membership_types` (`USING is_authenticated_user()`).
- **INSERT** and **UPDATE** require RBAC-checked RLS policies on `core_membership_type` for `pageName` `membership-types`, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md`. These policies use `data_check_rbac_permission_with_context('<op>:page.membership-types', 'membership-types', organisation_id, NULL, data_get_app_id('TEAM'))` and are upstream platform work — see §15 implementation gate.
- **DELETE** is not used; no DELETE policy is required.

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-06 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Membership Types" under Settings), and the `PaceAppLayout` chrome. TEAM-06 renders inside that chrome.
- **TEAM-02 / TEAM-03** consume `core_membership_type.id` and `name` to populate filters and detail views. TEAM-06's contract to those slices is implicit — the row shape used here is the same row shape they read.

### ID contracts

- `core_membership_type.id` — integer primary key. Used internally as `getRowId` and as the target of update / deactivate / reactivate mutations. Not exposed across slice boundaries beyond the implicit shape consumed by TEAM-02 / TEAM-03 read paths.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_membership_type` | SELECT, INSERT, UPDATE | `useSecureSupabase()` (RBAC-checked RLS policies for INSERT/UPDATE — see §15 gate) |
| `core_member` | SELECT (count only) | `useSecureSupabase()` for the per-type members count |

### `core_membership_type` columns (live dev-db)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | integer | NO | `nextval('team_membership_types_id_seq')` | Primary key. Sequence retains a legacy `team_*` name (cosmetic only). |
| `name` | text | NO | — | Unique per org via `core_membership_type_name_organisation_id_key`. |
| `min_age` | integer | YES | — | Optional; integer 0–120. |
| `max_age` | integer | YES | — | Optional; integer 0–120; `min_age ≤ max_age` when both populated. |
| `is_active` | boolean | NO | `true` | NOT NULL since DB-317. |
| `organisation_id` | uuid | NO | — | FK → `core_organisations(id)`. |
| `created_at` | timestamptz | YES | `now()` | Server-populated. |
| `updated_at` | timestamptz | YES | `now()` | Server-populated; refreshed by a database trigger on UPDATE. |
| `created_by` | uuid | YES | `auth.uid()` | Server-populated. |
| `updated_by` | uuid | YES | `auth.uid()` | Server-populated; refreshed by a database trigger on UPDATE. |

### Constraints (live dev-db)

- `core_membership_type_pkey` — PRIMARY KEY on `id`.
- `core_membership_type_name_organisation_id_key` — UNIQUE on `(name, organisation_id)` — per-org uniqueness.
- `pace_membership_type_organisation_id_fkey` — FOREIGN KEY on `organisation_id` → `core_organisations(id)`.

### Indexes

- Primary key + the per-org uniqueness UNIQUE index above + `idx_pace_membership_type_organisation_id` (partial).

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm the column shape and constraints above via Supabase MCP `execute_sql` against the canonical dev project ID.
- Confirm `is_active` is `NOT NULL DEFAULT true` (DB-317).
- Confirm `core_membership_type_name_organisation_id_key` UNIQUE on `(name, organisation_id)`.
- Confirm the helper `data_check_rbac_permission_with_context` exists. Confirm `data_get_app_id('TEAM')` resolves to the TEAM app UUID.
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Note: the RLS INSERT / UPDATE policies on `core_membership_type` for `pageName` `membership-types` do not yet exist on dev. This is the implementation gate (§15).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — "RBAC Permission-Based Policy" template; `data_check_rbac_permission_with_context`; `data_get_app_id`; helper attributes (STABLE, SECURITY DEFINER, SET search_path TO public).

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for list, members-count, and all mutations |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Resolves `canRead` / `canCreate` / `canUpdate` for action gating on `'membership-types'` |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="membership-types"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` to scope queries and writes |
| `useUnifiedAuth` | `@solvera/pace-core/hooks` | Auth state if needed alongside org context (e.g. the no-org check delegated to TEAM-01's shell) |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle="Membership types"` on page mount |
| `DataTable` | `@solvera/pace-core/components` | Table, toolbar, search, sort, filter, pagination, row actions |
| `Dialog` | `@solvera/pace-core/components` | Editor dialog root |
| `DialogContent` | `@solvera/pace-core/components` | Editor dialog content panel |
| `DialogPortal` | `@solvera/pace-core/components` | Editor dialog portal |
| `DialogHeader` | `@solvera/pace-core/components` | Editor dialog header |
| `DialogTitle` | `@solvera/pace-core/components` | Editor dialog title ("Create membership type" / "Edit membership type") |
| `DialogBody` | `@solvera/pace-core/components` | Editor dialog body wrapper |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Deactivate confirmation, destructive variant |
| `Form` | `@solvera/pace-core/components` | Editor form wrapper with Zod schema |
| `FormField` | `@solvera/pace-core/components` | Editor form fields (name, min age, max age) |
| `Input` | `@solvera/pace-core/components` | Underlying input element rendered by `FormField` |
| `Label` | `@solvera/pace-core/components` | Label for the `Switch` "Active" control |
| `Switch` | `@solvera/pace-core/components` | `is_active` toggle in the editor form |
| `Button` | `@solvera/pace-core/components` | Toolbar Create button and row-action triggers where needed |
| `Card` | `@solvera/pace-core/components` | Page chrome card wrapper around `DataTable` |
| `LoadingSpinner` | `@solvera/pace-core/components` | Loading state inside `DataTable` |
| `SaveActions` | `@solvera/pace-core/components` | Editor form footer (Cancel + Save) |
| `toast` | `@solvera/pace-core/components` | Module-level toast function for success / default / destructive notifications |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalises Supabase errors and fires destructive toast for non-23505 mutation failures |
| `NormalizeSupabaseError` | `@solvera/pace-core/utils` | Used inside the slice's mutation `catch` to detect and override 23505 with the per-org duplicate copy |
| `z` | `zod` | Inline schema for the editor form (peer dependency, not pace-core2) |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no org is resolved.** Callers must check `selectedOrganisation` separately before reading or writing — TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive guards in mutation handlers are still required for the org-switch race (BR-07).
- **`DataTable` create handoff pattern.** Create entry uses the DataTable built-in create modal (`onCreateRow`) and then hands off to a slice-controlled `Dialog`; row Edit / Deactivate / Reactivate actions open slice-controlled `Dialog` / `ConfirmationDialog` overlays. `features.deletion: false` and `onDeleteRow` is not passed (no hard delete UX). `features.import`, `features.export`, `features.hierarchical`, `features.grouping`, `features.deleteSelected`, `features.selection` are also `false`.
- **`HandleSupabaseError` 23505 override.** The default normalised copy for 23505 is "This record already exists." The slice intercepts 23505 in the mutation `catch` block, renders an inline form error on the **Name** field with the per-org override copy "A membership type with this name already exists in this organisation.", and does not raise a destructive toast for that case.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **Mutation contract gate.** All mutations rely on RBAC-checked INSERT and UPDATE RLS policies that are upstream platform work. Implementation cannot proceed until those policies land on dev — see §15.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/settings/membership-types` | `membership-types` | `read` | `<AccessDenied message="You do not have permission to view this page." />` |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read list and counts | `read:page.membership-types` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Create | `create:page.membership-types` | `useResourcePermissions('membership-types').canCreate` | Create button hidden |
| Edit | `update:page.membership-types` | `useResourcePermissions('membership-types').canUpdate` | Edit row action hidden |
| Deactivate | `update:page.membership-types` | `useResourcePermissions('membership-types').canUpdate` | Deactivate row action hidden |
| Reactivate | `update:page.membership-types` | `useResourcePermissions('membership-types').canUpdate` | Reactivate row action hidden |
| Delete | n/a — not exposed | n/a | n/a |

### Server-side enforcement

- INSERT and UPDATE on `core_membership_type` are authorised by RBAC-checked RLS policies using `data_check_rbac_permission_with_context('<op>:page.membership-types', 'membership-types', organisation_id, NULL, data_get_app_id('TEAM'))`. Any client that bypasses the UI and submits a mutation without the requisite permission receives a Postgres permission error. See §12 verification.

---

## §11 Acceptance criteria

- [ ] **AC-01 — Page entry, authenticated, has org, has read permission.**

Given a user is authenticated, has an org, and has `read:page.membership-types`, when they navigate to `/settings/membership-types`, then the page renders the title "Membership types" and the table of all membership types for the current org, regardless of `is_active`. (Traces F-01, F-02, F-04.)

- [ ] **AC-02 — Empty state.**

Given a user enters `/settings/membership-types` for an org that has zero membership types, when the page loads, then the table renders the empty state heading "No membership types yet." and description "Create your first to start assigning members." with the **Create** button visible in the toolbar (assuming `canCreate === true`). (Traces F-07.)

- [x] **AC-03 — Create membership type — happy path.**

Given a user has `canCreate === true`, when they click **Create**, submit the DataTable create modal, then fill `name = "Junior"`, `min_age = 5`, `max_age = 12`, leave Active on, and submit in the slice editor dialog, then the editor closes, the new row appears in the list, and a success toast renders with copy "Membership type created." (Traces F-19, BR-04, BR-11.)

- [x] **AC-04 — Edit membership type — happy path.**

Given a user has `canUpdate === true` and a saved row, when they open the Edit dialog, change `name`, and submit, then the dialog closes, the row's name updates in the list, and a success toast renders with copy "Membership type updated." (Traces F-20, BR-11.)

- [x] **AC-05 — Duplicate name within current org.**

Given a row named "Junior" already exists in the user's org, when the user tries to create another row with `name = "Junior"` (or "junior" — case-insensitive) and submits, then the dialog stays open, the **Name** field shows the inline error "A membership type with this name already exists in this organisation.", and no row is created. (Traces F-08, F-35, BR-03, BR-08.)

- [x] **AC-06 — Min/max age validation.**

Given a user fills `min_age = 18` and `max_age = 12`, when they submit the form, then the submit is blocked with the field-level error "Maximum age must be greater than or equal to minimum age." and no row is created or updated. (Traces F-36, BR-05.)

- [x] **AC-07 — Age out of range.**

Given a user fills `min_age = 200`, when they submit the form, then the submit is blocked with the field-level error "Minimum age must be between 0 and 120." (Traces BR-05.)

- [x] **AC-08 — Deactivate row.**

Given a user has `canUpdate === true` and an active row, when they click Deactivate and confirm in the destructive confirmation dialog, then the row's `is_active` updates to `false`, the dialog closes, the row's badge changes to "Inactive", and a success toast renders with copy `"{name} deactivated."`. (Traces F-21, BR-10, BR-11.)

- [ ] **AC-09 — Deactivate cancelled.**

Given the deactivate confirmation dialog is open, when the user clicks Cancel or presses Escape, then the dialog closes with no mutation and the row remains active. (Traces BR-10.)

- [x] **AC-10 — Reactivate row.**

Given a user has `canUpdate === true` and an inactive row, when they click Reactivate, then the row's `is_active` updates to `true` directly with no confirmation dialog, the row's badge changes to "Active", and a success toast renders with copy `"{name} reactivated."`. (Traces F-22, BR-10, BR-11.)

- [x] **AC-11 — Permission denied — read.**

Given a user is authenticated and has org context but lacks `read:page.membership-types`, when they navigate to `/settings/membership-types`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside the `AuthenticatedShell` chrome. (Traces F-10, F-28.)

- [x] **AC-12 — Permission denied — create / update.**

Given a user has `canRead === true` but `canCreate === false` and `canUpdate === false`, when they view `/settings/membership-types`, then the **Create** button is not rendered and no row shows Edit / Deactivate / Reactivate actions. (Traces F-29, F-30, F-31.)

- [ ] **AC-13 — Switching organisation refreshes the list.**

Given a user has the page open with rows visible for org A, when they switch the org context to org B in the header selector, then the list refetches and shows org B's rows (or the empty state). (Traces F-05, BR-01.)

- [x] **AC-14 — Switching organisation while editor is open.**

Given a user has the create or edit dialog open for org A, when they switch org context to org B, then the dialog closes silently, unsaved edits are discarded, and a `default`-variant toast renders with copy "Editing cancelled — organisation changed." (Traces F-34, BR-07, BR-11.)

- [ ] **AC-15 — Members count displayed.**

Given an org has a membership type "Junior" with three `core_member` rows assigned to it for the current org, when the page loads, then the **Members** column for the "Junior" row shows the value `3`. (Traces F-16.)

- [ ] **AC-16 — Audit fields are not displayed and not sent.**

Given a user opens the editor dialog, when they inspect the form, then `created_at`, `updated_at`, `created_by`, and `updated_by` are not displayed; and when they submit a create or update, then the network payload does not include these columns. (Traces F-18, F-37, BR-06.)

- [ ] **AC-17 — Search and filter.**

Given the table has multiple rows, when the user types into the search input, then only matching rows remain visible; when the user opens the **Active** column filter and selects "Inactive", then only inactive rows remain visible. (Traces F-23, F-24.)

- [ ] **AC-18 — Default sort.**

Given the table has rows "Bravo", "Alpha", "Charlie", when the page loads, then the rows render in the order Alpha, Bravo, Charlie under the **Name** column. (Traces F-12, F-25.)

- [x] **AC-19 — Server error on save.**

Given a user submits a create with valid data but the server returns a 5xx error, when the mutation rejects, then the editor dialog stays open and a `destructive` toast renders the normalised message from `HandleSupabaseError`. (Traces F-09, BR-11.)

---

## §12 Verification

- **MCP test — RLS bypass surface.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), once the upstream RBAC-checked INSERT / UPDATE RLS policies (§15 gate) have landed, attempt an INSERT into `core_membership_type` as an authenticated user **without** `create:page.membership-types`. The query must fail with a Postgres permission error (RLS WITH CHECK violation). Repeat for UPDATE without `update:page.membership-types`.
- **MCP test — Helper exists.** Confirm `data_check_rbac_permission_with_context(...)` exists and that `data_get_app_id('TEAM')` returns a non-null UUID via `select data_check_rbac_permission_with_context(...)` and `select data_get_app_id('TEAM')`. The slice's RLS posture depends on these helpers per pace-core2 standard 3.
- **MCP test — Per-org uniqueness.** Insert a row `(name='Junior', organisation_id=<org A>)` and confirm a second insert with the same name in org A fails with 23505. Confirm the same name succeeds in org B (different `organisation_id`). This proves per-org (not global) uniqueness.
- **MCP test — Schema invariants.** Confirm `core_membership_type.is_active` is `NOT NULL DEFAULT true` (DB-317).
- **In-app demo flow — happy path.** Sign in as a TEAM org-admin, navigate to `/settings/membership-types`, create a new type, edit its name, deactivate it, reactivate it. Confirm the success toast for each step (per BR-11 copy) and that the list reflects each change.
- **In-app demo flow — duplicate.** With a row named "Junior" present, attempt to create another "junior" — confirm the inline form error matches BR-08 / BR-03 copy and the dialog stays open.
- **In-app demo flow — org switch with editor open.** Open the create dialog. Switch the org context. Confirm the dialog closes silently with the BR-07 toast copy.
- **Members-count column verification.** Pick a type with known assignments via SQL and confirm the **Members** column matches. Pick a type with no assignments and confirm `0` renders.

---

## §13 Testing requirements

- Unit / integration tests for the editor form's Zod schema covering each error copy in BR-08 and BR-05.
- Component test that asserts the 23505 path renders the form error "A membership type with this name already exists in this organisation." rather than firing a destructive toast.
- Component test that asserts changing `selectedOrganisation` while the editor `Dialog` is open closes the dialog and renders the BR-07 toast.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All mutations must go via `useSecureSupabase().from('core_membership_type')`. Do not call `createClient` directly. Do not reach for any client that bypasses RBAC scope resolution.
- Do not implement a hard-delete path. The DataTable's `features.deletion` is `false`, `onDeleteRow` is not passed, and no UI surface offers row deletion.
- Do not use `onEditRow` / `onDeleteRow` built-in DataTable modals. Create may use DataTable `onCreateRow` as a handoff into the slice editor `Dialog`.
- Do not author the RBAC-checked INSERT / UPDATE RLS policies on `core_membership_type` from inside this slice. That migration is upstream platform work; this slice depends on it (§15).
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.

---

## §15 Done criteria

- All 19 acceptance criteria (AC-01 through AC-19) verified via the slice's QA pack.
- **Implementation blocked until RBAC-checked INSERT/UPDATE RLS policies on `core_membership_type` for `pageName` `membership-types` land on dev. The v6 slice does not author the migration.** Specifically: an INSERT policy with `WITH CHECK` and an UPDATE policy with `USING` + `WITH CHECK` must both call `data_check_rbac_permission_with_context('<op>:page.membership-types', 'membership-types', organisation_id, NULL, data_get_app_id('TEAM'))`, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md`. Until those policies exist on dev, this slice cannot be marked Done.
- Post-build RBAC seeding reminder noted in TEAM-01: `rbac_app_pages` must include the row for `page_name = 'membership-types'` with `scope_type = 'organisation'` for the TEAM app before release.

---

## §16 Do not

- Do not surface a hard-delete UX. Soft delete (deactivate) only.
- Do not implement member assignment to a type from this surface — that is TEAM-02 / TEAM-03.
- Do not surface fee or billing fields here — that is TEAM-08.
- Do not author an org-hierarchy parent picker — that is TEAM-07.
- Do not introduce a shared "Settings sub-layout" component. Each settings slice (TEAM-06, TEAM-07, TEAM-08) renders its own page chrome (page title + content card).
- Do not display, send, or patch `created_at`, `updated_at`, `created_by`, or `updated_by` from the client.
- Do not pre-emptively query for case-insensitive name collision; rely on the database's 23505 surface and override its copy.
- Do not run any verification or smoke test against production. Dev-db only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; org-scoped admin surfaces.
- `/rebuild/architecture.md` — slice ownership, route registry, settings cluster ordering, canonical `pageName` map (`membership-types`).
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Settings → Membership Types), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`** so any descendant route (including this slice) can call `toast(...)`. TEAM-06 depends on this mount; without it, `toast(...)` throws.
- **TEAM-02 / TEAM-03** — read `core_membership_type.id` and `name` for filters and detail views; the row shape they consume is the row shape this slice writes.
- **TEAM-08** — owns financial / fee semantics; this slice does not surface fees.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — "RBAC Permission-Based Policy" template; helper-function attributes; `data_check_rbac_permission_with_context`; `data_get_app_id('TEAM')`. **Implementation gate:** the v6 slice does not author the RBAC-checked INSERT/UPDATE RLS policies on `core_membership_type` for `pageName` `membership-types`. The migration is upstream platform work and gates implementation per §15.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage; `pageName` + `operation`; no `scope` prop at page level.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and shell chrome (provided by TEAM-01).
- DB-317 — `is_active NOT NULL DEFAULT true` on `core_membership_type` (live on dev).
