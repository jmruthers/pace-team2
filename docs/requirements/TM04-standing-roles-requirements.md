# TEAM-04 — Standing roles

## §1 Slice metadata

```
Slice ID:        TEAM-04
Name:            Standing roles
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems), TEAM-03 (Member 360 entry — supplies stable core_member.id navigation and "View roles ›" link)
Backend impact:  Read contract only at v1 (mutations on core_member_role use the live check_user_is_org_admin(organisation_id) RLS gate already in place on dev — no migration required for slice mutations). Implementation gate on a planned per-org UNIQUE migration on core_role_type — see §15 / §17.
Frontend impact: UI
Routes owned:    /member-roles
QA pack:         docs/test-packs/TM04-qa-pack.md
```

---

## §2 Overview

TEAM-04 delivers the org-wide **Member roles** surface at **`/member-roles`** — active and recent role appointments across all units in the currently selected organisation (not a member-scoped nested route). Layout authority: **`PageHeader`** (title "Member roles", org-wide subtitle, **New appointment** primary in header-right) → optional **inline appointment form** in a **`Card`** region above the table when creating/editing (not a modal **`Dialog`**) → org-wide appointments **`DataTable`**. Ending a role may still use a confirmation dialog. Route read is enforced by shell `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts).

- **Prototype reference:** `pace-prototype/apps/pace-team/pages/MemberPages.jsx` — `MemberRolesPage` at route **`/member-roles`** (org-wide appointments table + inline **`Card`** appointment form).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a member-scoped surface where they can review every standing role a member has held in the currently selected organisation, add a new active role for that member, and end an active role on a chosen date. TEAM-04 produces that surface. It does not own role-type creation, the directory list, the Member 360 detail surface, member-request review, or any settings-cluster page.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Member roles — org-wide appointments page | `/member-roles` | **`PageHeader`** + optional inline appointment **`Card`** form + org-wide **`DataTable`** (Member, Role/title, Unit, Start, End, row edit). |
| Inline appointment form | (in-page on `/member-roles`) | **`Card`** / form region with grid fields (Member, Role, Role title, Unit, Start, End) and **Create appointment** / **Save** footer — not a modal **`Dialog`**. |
| End-role confirmation dialog | (overlay on `/member-roles`) | Retained for destructive end-date confirmation when row actions require it. |

### Boundaries

TEAM-04 does **not** own:
- The member directory list at `/members` — that is TEAM-02.
- The Member 360 detail surface at `/members/:memberId` — that is TEAM-03. TEAM-04's Back button navigates to `/members/:memberId`.
- Member-request review, join, transfer, or status transitions — that is TEAM-05.
- Membership type lookups, sub-organisations, organisation settings — those are TEAM-06 / TEAM-07 / TEAM-08.
- Role-type creation, edit, or delete (any mutation of `core_role_type`). The slice consumes role types Select-only; mutation is deferred to a follow-up slice — see §16 and §17.
- Hard delete of role history rows. Ended roles remain visible for audit history; "remove" is achieved only via the End-role action (`end_date`).
- Self-service editing by the target member. There is no Portal CTA on TEAM-04 and no acting-user-is-target check — the standard `useResourcePermissions('member-roles').canUpdate` gating is sufficient.

### Architectural posture

**Mutation contract — live `check_user_is_org_admin(organisation_id)` RLS gate.** All reads and writes go via `useSecureSupabase().from(...)`. Authorisation on `core_member_role` is enforced at the database layer by RLS policies that gate INSERT, UPDATE, and DELETE on `check_user_is_org_admin(organisation_id)` (with `is_super_admin` as the override). These policies already exist on dev and work for org admins today; this slice authors against them. No upstream RLS migration is required to ship TEAM-04 v1. Future cross-app convergence to RBAC-checked RLS for `core_member_role` is informational only and captured in §17.

**Implementation gate on planned `core_role_type` per-org uniqueness migration.** The Add-role form filters `core_role_type` rows by `organisation_id = selectedOrganisation.id`. The slice authors against the **planned** per-org UNIQUE constraint `(name, organisation_id)` on `core_role_type`. Live dev currently enforces a global UNIQUE on `core_role_type.name` (constraint `team_formation_roles_name_key` — an artefact of an earlier table rename) which is internally inconsistent with the per-org `organisation_id NOT NULL` design. The planned migration drops the global UNIQUE and adds UNIQUE `(name, organisation_id)`. The migration is non-breaking on dev (4 rows, 1 org — no conflicts). The v6 slice does not author the migration; it cites the planned constraint — see §15 and §17. Day-1 read behaviour is unaffected since `organisation_id` is already populated.

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**Action gating.** Visibility of the "Add role" header button and the End-role row action is gated by `useResourcePermissions('member-roles')`: hidden when `canUpdate === false`. The resource key matches the page name (`'member-roles'`) and gives finer-grained access than the broader `'members'` key used by TEAM-02 / TEAM-03.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications. `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it. Variant vocabulary: `'success'` (Add success, End success) and `'destructive'` (Add failure, End failure). Default duration 5000 ms.

**Page metadata.** `usePaceMain({ printTitle })` is called on member load. While the member fetch is in flight and before resolution, `printTitle` is `'Standing roles'`. Once the member resolves, `printTitle` is `"{full name} — Standing roles"` per BR-2.

**Org-scoped reads and writes.** Every read filters by `organisation_id = selectedOrganisation.id` (defensive belt-and-braces over RLS). Every INSERT stamps `organisation_id = selectedOrganisation.id` explicitly. Every UPDATE filters defensively on `organisation_id = selectedOrganisation.id` in the WHERE clause; no payload mutates `organisation_id`.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

**Single-page layout.** No tabs, no sub-navigation, no nested routes. The Standing roles page renders one role-history table inside the `AuthenticatedShell` chrome.

### Page-level guards and evaluation ordering

The route `/members/:memberId/roles` sits inside `AuthenticatedShell` (TEAM-01) registers read access in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts); shell `routeAccessDenied` enforces entry. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the page guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state from TEAM-01; the page guard does not evaluate.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the no-org empty state from TEAM-01. The page guard is not reached.
4. **Route read access** — Once org context is resolved, shell `routeAccessDenied` (via [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts)) evaluates the route's registered `pageName` / `read` permission. Scope resolves internally from `OrganisationServiceProvider`; no page-level read guard wraps the component tree. While the shell RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable. On deny, `<AccessDenied />` renders in the shell main region. On allow, the page body renders.
5. **Member fetch** — Inside the page body, the slice fetches `core_member` joined to `core_person` for `core_member.id = :memberId AND organisation_id = selectedOrganisation.id AND deleted_at IS NULL`. While the query is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area. On a zero-row result (unknown id, deleted member, cross-org member), the "Member not found" page renders. On a non-zero result, the page header (Back button + member name + Add-role button) and the role-history table render with the table's built-in loading state for the role-history query.

If `selectedOrganisation` resolves to `null` mid-render (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined` and the page guard returns `null` (pending). The no-org check at step 3 prevents this path under normal conditions. If the loaded member's `organisation_id` no longer matches `selectedOrganisation.id` after an org switch, the page replaces its content with the org-mismatch alert (BR-14).

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/members/:memberId/roles` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.member-roles` permission, where `:memberId` is interpreted as `core_member.id` (uuid).
- **F-02** On entry, the page fetches the member: `core_member` joined to `core_person`, filtered by `core_member.id = :memberId AND organisation_id = selectedOrganisation.id AND deleted_at IS NULL`.
- **F-03** On member resolve, the page sets `printTitle` to `"{full name} — Standing roles"` (full name composed per BR-2) via `usePaceMain`. Until resolve, `printTitle` is `'Standing roles'`.
- **F-04** On member resolve, the page also fetches the role history: `core_member_role` joined to `core_role_type`, filtered by `core_member_role.member_id = :memberId AND organisation_id = selectedOrganisation.id`, ordered by `start_date desc`.
- **F-05** The page header renders, in this order from left to right: a `<Button variant="outline">← Back to Member 360</Button>` at top-left, a heading composed as the member's full name (BR-2) followed by " — Standing roles", and an `<Button>Add role</Button>` at top-right.
- **F-06** Below the header, the role-history `DataTable` renders with columns Role, Start date, End date, Status, Actions.
- **F-07** Switching the currently selected organisation refetches the member against the new org. If the member's `organisation_id` matches the new selected org, the page silently rebinds (BR-14). If it does not match, the page replaces its content with the org-mismatch alert.

### Loading states

- **F-08** While the initial member query is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; no header and no table render.
- **F-09** Once the member resolves, the page header renders immediately. The role-history `DataTable` renders with its built-in `isLoading` state bound to the role-history query (the table's own loading affordance) until the role-history query completes.
- **F-10** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).

### Empty states

- **F-11** **Member not found.** When the member query returns zero rows (unknown id, deleted member, cross-org member), the page replaces its content with a "Member not found" page: heading "Member not found", description "We couldn't find this member in your current organisation.", and a `<Button variant="outline">← Back to members</Button>` linking to `/members`.
- **F-12** **No roles recorded.** When the role-history query returns zero rows for the member, the role-history `DataTable` renders its empty state with heading "No roles recorded for this member yet." and sub-line "Use Add role to record this member's first standing role." No CTA inside the empty state itself; the "Add role" button in the page header is the entry point.
- **F-13** **No role types configured for this organisation.** When the `core_role_type` lookup query returns zero rows for the current org, the "Add role" header button renders disabled with helper text below the button reading "No role types configured for this organisation. Contact your administrator." The role-history table still renders normally; End-role actions on existing rows still work.

### Error states

- **F-14** **Member fetch error.** When the initial member query fails, the page replaces its content with `<Alert variant="destructive">` titled "Could not load member", description from the normalised `HandleSupabaseError(error, { context: 'core_member' })` message, and a `<Button>Retry</Button>` that re-runs the query.
- **F-15** **Role-history fetch error.** When the role-history query fails, the role-history table area is replaced inline by `<Alert variant="destructive">` with title "Could not load roles", description from the normalised `HandleSupabaseError(error, { context: 'core_member_role' })` message, and a `<Button>Retry</Button>` that re-runs the role-history query. The page header (Back, member name, Add role button) continues to render.
- **F-16** **Add-role failure.** Add-role mutation failures are normalised through `HandleSupabaseError(error, { context: 'core_member_role' })` and surfaced as a `destructive` toast with the normalised message. The Add-role modal stays open with its current values intact; no row is committed.
- **F-17** **Add-role race on active uniqueness.** When the Add-role mutation fails with the partial-unique-index violation (`core_member_role_active_unique` on `(member_id, role_id, organisation_id) WHERE end_date IS NULL`), the destructive toast surfaces the copy "This member already has an active role of this type. Refresh the list and try again." The modal stays open; no row is committed.
- **F-18** **End-role failure.** End-role mutation failures are normalised through `HandleSupabaseError(error, { context: 'core_member_role' })` and surfaced as a `destructive` toast. The End-role dialog closes; no row is mutated.
- **F-19** **Permission denied (read).** A user without `read:page.member-roles` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).
- **F-20** **Org-mismatch.** When `selectedOrganisation` changes mid-render and the loaded member's `organisation_id` no longer matches, the page replaces its content with `<Alert variant="destructive">` titled "This member is not in the current organisation", description "Switch back, or return to the members directory.", and a `<Button variant="outline">Back to members</Button>` that navigates to `/members`.

### Primary content — role history table

- **F-21** The role-history `DataTable` renders rows from `core_member_role` joined to `core_role_type` for the target member in the columns and order: **Role**, **Start date**, **End date**, **Status**, **Actions**.
- **F-22** The **Role** column shows `core_role_type.name` resolved via the embedded select on `role_id`. When the join returns null, the cell renders an em-dash "—".
- **F-23** The **Start date** column shows `start_date` formatted as a localised short date (e.g. "5 May 2026"). Sortable; default sort key, descending (most recent at top).
- **F-24** The **End date** column shows `end_date` formatted as a localised short date when set, em-dash "—" when null. Sortable.
- **F-25** The **Status** column shows a badge: "Active" (success tone) when `end_date IS NULL`; "Ended" (muted tone) otherwise. Sortable; sorting groups Active rows together and Ended rows together.
- **F-26** The **Actions** column shows a single "End role" row trigger when `end_date IS NULL` AND `useResourcePermissions('member-roles').canUpdate === true`. Hidden on rows where `end_date` is non-null. Hidden entirely when `canUpdate === false`.
- **F-27** Audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) are not displayed on the role-history table.

### Primary actions — Add role

- **F-28** **Add role — open modal.** A `<Button>Add role</Button>` renders top-right of the page header when the page has loaded. Visible when `useResourcePermissions('member-roles').canUpdate === true` AND the `core_role_type` lookup for the current org returned at least one row. Disabled (with the F-13 helper text) when the lookup returned zero rows. Hidden when `canUpdate === false`. Click opens the Add-role modal.
- **F-29** **Add-role modal — fields.** The modal renders a form with two fields:
  - **Role type** (`role_id`): required `Select`. Options sourced from `core_role_type` for `selectedOrganisation.id` (integer id, text name), ordered by `name` ascending. Placeholder option labelled "Select role type" with empty value.
  - **Start date** (`start_date`): required date input. Default value: today (the user's local date). Persisted to the column as a date (no time, no tz).
- **F-30** **Add-role active-uniqueness pre-validation.** The form runs an active-uniqueness check on every change to the Role type select. The check compares the in-flight role history (already fetched for the table) and tests whether any row exists with `member_id = :memberId AND role_id = (selected) AND organisation_id = selectedOrganisation.id AND end_date IS NULL`. If a match exists, the Submit button is disabled and helper text under the role-type select reads "This member already has an active role of this type." The helper text clears and Submit re-enables when the user picks a different role type or no longer has a duplicate.
- **F-31** **Add-role submit.** Click Submit when the form is valid (both fields set, no duplicate detected) runs `INSERT INTO core_member_role (member_id, role_id, organisation_id, start_date)` with the four populated values; `id`, `end_date`, audit columns are server-defaulted (`gen_random_uuid()`, NULL, `auth.uid()`, `now()`). On success: closes the modal, refreshes the role-history table, renders a `success` toast "Role added." On failure: leaves the modal open with values intact, renders a `destructive` toast with the normalised `HandleSupabaseError` message (per F-16 / F-17).
- **F-32** **Add-role cancel.** Click Cancel or the modal close affordance closes the modal without inserting any row. The table is unchanged. Form values are discarded.
- **F-32a (Option A / DB-422)** **Appointment title column.** The role-history table includes an **Appointment title** column sourced from `core_member_role.title` (blank when null).
- **F-32b (Option A / DB-422)** **Add-role appointment title.** The Add-role modal includes an optional **Appointment title** text field (`core_member_role.title`). Placeholder e.g. "Patrol Leader — Wombats". Persisted on insert when non-empty.
- **F-32c (Option A / DB-422)** **Role-type membership filter.** The Add-role and Edit-role role-type `Select` lists only `core_role_type` rows where `membership_type_id = member.membership_type_id OR membership_type_id IS NULL`. When the member has no `membership_type_id`, all role types for the org are shown.
- **F-32d (Option A / DB-422)** **Edit role.** Active rows (`end_date IS NULL`) expose an **Edit role** row action opening a modal to update `role_id` and `title` via `UPDATE core_member_role`. Success toast: "Role updated."
- **F-32e (Option A)** **Post-approval placement.** MVP does not create placement rows on approve when `p_placement_role_id` is null; admins use Add role to create the sub-org placement that makes the member visible in TEAM-02.

### Primary actions — End role

- **F-33** **End role — open dialog.** Click the End-role row trigger on an active row opens a destructive end-role dialog composed from the `Dialog` family (`Dialog` + `DialogContent` + `DialogHeader` + body + `DialogFooter`). The dialog body contains a `DatePickerWithTimezone` for the chosen `end_date` (default value: today, the user's local date) and the row's role name and start date for context.
- **F-34** **End-role pre-validation.** The dialog runs a date-validity check on every change to the date picker: `chosen_end_date >= row.start_date`. When the check fails, the Confirm button is disabled and helper text under the date picker reads "End date must be on or after start date." When the check passes, the Confirm button enables.
- **F-35** **End-role submit.** Click Confirm when valid runs `UPDATE core_member_role SET end_date = (chosen) WHERE id = row.id AND organisation_id = selectedOrganisation.id AND end_date IS NULL`. On success: closes the dialog, refreshes the role-history table, renders a `success` toast "Role ended." On failure: closes the dialog, renders a `destructive` toast with the normalised `HandleSupabaseError(error, { context: 'core_member_role' })` message (per F-18); the row is not mutated.
- **F-36** **End-role cancel.** Click Cancel or the dialog close affordance closes the dialog without mutating the row. The table is unchanged.

### Permission-conditional rendering

- **F-37** When `read:page.member-roles` is denied at the page level, `<AccessDenied />` renders and no header / table content renders.
- **F-38** When `useResourcePermissions('member-roles').canUpdate === false`, the "Add role" header button is hidden and the End-role row trigger is hidden on every row. The role-history table still renders with its read-only columns.
- **F-39** When the `core_role_type` lookup for the current org returns zero rows, the "Add role" header button renders disabled with the F-13 helper text. End-role row triggers on existing rows are unaffected.

### Navigation

- **F-40** The page is reachable from TEAM-03 via the "View roles ›" button on Member 360 (TEAM-03 owns that navigation; TEAM-04 receives the entry).
- **F-41** The "← Back to Member 360" header button navigates to `/members/:memberId` (TEAM-03 Member 360).
- **F-42** The "← Back to members" button on the Member-not-found page and on the Org-mismatch alert both navigate to `/members` (TEAM-02 directory).

### Secondary actions

- **F-43** **Search.** The role-history `DataTable` toolbar offers a text-search input (placeholder "Search roles") that filters the in-memory rows by case-insensitive substring against `core_role_type.name`. Clearing restores the unfiltered list.
- **F-44** **Sort.** Each `DataTable` column is sortable. Default sort: **Start date** descending.
- **F-45** **Pagination.** The `DataTable` uses `initialPageSize = 25` with page size options `[10, 25, 50]`.
- **F-46** **Column visibility / reordering.** The `DataTable` toolbar exposes column visibility and column reordering controls (pace-core2 default behaviour for those features when enabled).

### Edge cases and constraints

- **F-47** **Concurrency.** Mutations use last-write-wins. No optimistic locking; no `updated_at` watermark check. If a second admin ends a role between the page's initial fetch and this user's End-role submit, the second admin's `end_date` is overwritten by this submit if the row is still flagged active locally — the next refetch reflects the second-completing mutation.
- **F-48** **Cross-org leakage prevention.** Every list query carries a defensive belt-and-braces filter: member fetch on `organisation_id = selectedOrganisation.id`; role-history query on `core_member_role.organisation_id = selectedOrganisation.id`; role-type lookup on `core_role_type.organisation_id = selectedOrganisation.id`. RLS would still enforce per-org isolation if these filters were absent.
- **F-49** **Stale member id.** A user navigating directly to `/members/:memberId/roles` for a `core_member.id` they cannot read (RLS denies) sees the "Member not found" page (F-11).
- **F-50** **Deleted member.** A user navigating to a `core_member.id` whose row has `deleted_at` set sees the "Member not found" page (the member fetch filter excludes `deleted_at IS NOT NULL`).
- **F-51** **Audit attribution.** Every INSERT and UPDATE relies on column defaults (`auth.uid()` for `created_by` / `updated_by`, `now()` for `created_at` / `updated_at` plus server triggers) on `core_member_role`; the slice does not patch these columns from the client.
- **F-52** **Active-uniqueness race.** When the client-side pre-validation passes but a concurrent admin commits a duplicate active row before this submit, the partial unique index `core_member_role_active_unique` rejects the second INSERT with a unique-violation error. The slice surfaces the F-17 destructive toast copy.

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`:

- **`PageHeader`** — **Title:** "Member roles". **Subtitle:** org-wide copy (prototype: "Active and recent role appointments across all units in this branch."). **Header-right:** primary **`New appointment`** button (`Plus` icon) opens the inline form when `canUpdate === true` and role types exist. Hidden when `canUpdate === false`; disabled with helper text when no role types configured (BR-19).
- **Inline appointment form (create/edit)** — When `editing !== null`, a **`Card`** form region renders **above** the table (prototype `appt-form` / `role="region" aria-label="Appointment form"`):
  - Section heading **"New appointment"** or **"Edit appointment"** with short description and close icon.
  - Grid fields: **Member** (select), **Role** (select), **Role title** (required text with datalist presets), **Unit** (select), **Start date**, **End date** (optional — blank means current).
  - Footer actions: **Cancel** (secondary) and **Create appointment** / **Save** (primary) — not modal **`Dialog`** chrome.
- **Appointments table** — **`DataTable`** below the form (when closed, table is first content below header): columns **Member**, **Role** (title + role type subline), **Unit**, **Start**, **End**, row **Edit** action. Row activate navigates to **`/members/:memberId`** (Member 360). Search enabled.

Breakpoints: standard pace-core2 responsive behaviour applies. The appointments `DataTable` shows horizontal scroll on narrow viewports. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Components

**Back button** (`Button` from `@solvera/pace-core/components`)
- Variant: `outline`.
- Label: `← Back to Member 360` (the arrow glyph is rendered by the `ChevronLeft` icon from `@solvera/pace-core/icons`, preceding the text label).
- Click: navigates to `/members/:memberId` (TEAM-03).

**Page heading**
- Rendered as a heading at the same typographic level as a top-level page title (e.g. `h1` semantics).
- Composition: the member's full name (BR-2) followed by " — Standing roles", e.g. `"Jane Doe — Standing roles"`. Until the member resolves, no heading renders (the page is in the full-page loading state per F-08).

**Add-role button** (`Button` from `@solvera/pace-core/components`)
- Variant: default (primary visual).
- Label: `Add role`.
- Visible when `useResourcePermissions('member-roles').canUpdate === true`. Hidden when `canUpdate === false`.
- Disabled visual when the role-type lookup for the current org returned zero rows (BR-19); when disabled, the helper text "No role types configured for this organisation. Contact your administrator." renders below the button in a small muted typographic style.
- Click: opens the Add-role modal (when enabled).

**Role history card** (`Card` + `CardContent` + `DataTable`)
- Header: no `CardHeader` rendered. The page header above the card carries the page title; the table's own description / toolbar carries the count.
- Content: a `DataTable` rendered inside `CardContent`.
- `DataTable` props summary:
  - `data`: array of joined rows (`core_member_role` + `core_role_type`) returned by the role-history query, after the in-memory search filter is applied.
  - `rbac.pageName`: `'member-roles'`.
  - `title`: omitted (the page heading is above the card).
  - `description`: `"{count} roles"` where `{count}` is the unfiltered server-result count for this member.
  - `isLoading`: bound to the role-history query's loading state.
  - `emptyState`: `{ title: "No roles recorded for this member yet.", description: "Use Add role to record this member's first standing role." }`.
  - `getRowId`: `(row) => row.id`.
  - `initialPageSize`: `25`.
  - `initialSorting`: `[{ id: 'start_date', desc: true }]`.
  - `actions`: a single `End role` row-action descriptor visible when `row.end_date === null && canUpdate === true`.
  - `onCreateRow`, `onEditRow`, `onDeleteRow`: not used.
  - `features`: `{ search: true, sorting: true, pagination: true, filtering: true, columnVisibility: true, columnReordering: true, creation: false, editing: false, deletion: false, deleteSelected: false, selection: false, grouping: false, hierarchical: false, import: false, export: false }`.

Role history columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Role | `core_role_type.name` resolved via `role_id` embedded select | flexible | Plain text. Sortable. Em-dash "—" when the join returns null. |
| Start date | `start_date` | narrow | Localised short date (e.g. "5 May 2026"). Sortable. Default sort key, descending. |
| End date | `end_date` | narrow | Localised short date when set; em-dash "—" when null. Sortable. |
| Status | derived from `end_date` | narrow | Badge: "Active" (success tone) when `end_date IS NULL`; "Ended" (muted tone) otherwise. Sortable. |
| Actions | n/a | narrow | A single `End role` trigger per row, visible when `end_date IS NULL && canUpdate === true`. Hidden otherwise. |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search roles". Filters by case-insensitive substring against `core_role_type.name`.
- Column visibility and column reordering controls render per pace-core2 default for those features.
- The toolbar does not show Create / Import / Export / Edit / Delete — those features are off.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Status badge** (`Badge` from `@solvera/pace-core/components`)
- "Active" — success tone, label "Active".
- "Ended" — muted tone, label "Ended".

**Add-role modal** (`Dialog` family from `@solvera/pace-core/components`)
- Trigger: the "Add role" button in the page header.
- Container: `<Dialog open onOpenChange><DialogPortal><DialogContent><DialogHeader><DialogTitle>Add role</DialogTitle><DialogDescription>Record a new standing role for this member.</DialogDescription></DialogHeader><DialogBody>{form}</DialogBody><DialogFooter>{Cancel + Add role buttons}</DialogFooter></DialogContent></DialogPortal></Dialog>`.
- Header title: "Add role". Description (sub-line): "Record a new standing role for this member."
- Body: a `<Form>` rendering two fields in vertical order:
  - **Role type** field — labelled "Role type". Rendered via `FormField` with `Select` / `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem`. Required. Options sourced from `core_role_type` for `selectedOrganisation.id` (integer id, text name), ordered by `name` ascending. Placeholder option labelled "Select role type" with empty value. Helper text: when the active-uniqueness pre-validation flags the chosen role as a duplicate, the helper text reads "This member already has an active role of this type." (small muted typographic style under the select). Error copy: required → "Role type is required."
  - **Start date** field — labelled "Start date". Rendered via `FormField` with `DatePickerWithTimezone`. Required. Default value: today (the user's local date). Persisted to the column as a date (no time, no tz). Error copy: required → "Start date is required."
- Footer: composed manually inside `DialogFooter` from two `Button`s (the slice does not use any wrapper that hardcodes a save-button label). Render two buttons:
  - **Cancel** (first / left): `<Button variant="outline" type="button">Cancel</Button>`. On click, closes the modal and discards the form state (no INSERT issued).
  - **Add role** (second / right): `<Button type="submit">Add role</Button>` rendered inside the `<Form>` so Enter submission and click submission both fire the form's submit handler. The button is `disabled` when (a) the form is invalid (any required field empty or invalid), (b) the active-uniqueness pre-validation has flagged a duplicate per Q-D7, or (c) the submit is in flight (`isPending`). When `isPending` is true the button also renders a small `<LoadingSpinner size="sm" />` (already imported in §9.1) inline beside the label.
- Close behaviour: native escape key, Cancel button, click outside, or successful submit close the dialog. On failure, the dialog stays open with values intact (per F-16, F-17).
- Focus management: focus moves to the Role type select on open. Focus returns to the "Add role" header button on close.

**End-role dialog** (composed from the `Dialog` family in `@solvera/pace-core/components`)
- Composition: this dialog needs a date picker in its body, so TEAM-04 composes the End-role dialog directly from the `Dialog` family (the slice does not use any wrapper that lacks a body slot).
- Container: `<Dialog open onOpenChange><DialogPortal><DialogContent><DialogHeader><DialogTitle>End role?</DialogTitle><DialogDescription>{role name} will be marked ended on {chosen end_date}.</DialogDescription></DialogHeader>{body}<DialogFooter>{Cancel + End role buttons}</DialogFooter></DialogContent></DialogPortal></Dialog>`. If `pace-core2` ships a `DialogBody` wrapper (the build agent confirms this against `pace-core2/packages/core/src/components/Dialog.tsx`), the `{body}` is wrapped in `<DialogBody>...</DialogBody>`; otherwise the body content is placed inside `DialogContent` directly between `DialogHeader` and `DialogFooter` with no wrapper.
- Trigger: the End-role row action on the role-history table.
- Header title: "End role?".
- Header description (`DialogDescription`): "{role name} will be marked ended on {chosen end_date}." The `{role name}` is the row's `core_role_type.name` (or em-dash if the join returns null); the `{chosen end_date}` is the date currently in the date picker, formatted as a localised short date (e.g. "5 May 2026"). The description updates as the user changes the date picker. The description ends before the date picker — the irreversibility line lives below as helper text, not inside `DialogDescription`.
- Body: a `DatePickerWithTimezone` labelled "End date". Default value: today (the user's local date). Persisted to the column as a date (no time, no tz). Two pieces of helper text render with the date picker (rendered below the picker, both small muted typographic style):
  - A non-blocking irreversibility note: "You can't reverse this from this page."
  - A conditional date-validity error: when the date-validity pre-validation flags a date earlier than `row.start_date`, the helper text reads "End date must be on or after start date."
- Footer (`DialogFooter`):
  - **Cancel** (first / left): `<Button variant="outline" type="button">Cancel</Button>`. On click, closes the dialog without mutating the row.
  - **End role** (second / right): `<Button variant="destructive" type="button">End role</Button>`. On click, invokes the End-role mutation (`UPDATE core_member_role SET end_date = chosen`) with the chosen `end_date`; closes the dialog on resolution. `disabled` when the date-validity check fails or the mutation is in flight; renders a small `<LoadingSpinner size="sm" />` (already imported in §9.1) inline beside the label when `isPending`.
- Close behaviour: native escape, Cancel button, or click outside closes the dialog without mutating the row. Successful confirm closes the dialog and renders the toast.
- Focus management: focus moves to the date picker on open (so the user can change the date if needed). On close, focus returns to the row's End-role trigger.

**Member-not-found page**
- Replaces the entire `PaceMain` content area when the member fetch returns zero rows.
- Layout: a centred vertical stack containing:
  - A heading "Member not found" rendered at top-level page heading typographic level.
  - A description paragraph "We couldn't find this member in your current organisation."
  - A `<Button variant="outline">← Back to members</Button>` linking to `/members`.

**Org-mismatch alert**
- Replaces the entire `PaceMain` content area when the loaded member's `organisation_id` differs from the new `selectedOrganisation.id` after an org switch.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>This member is not in the current organisation</AlertTitle>` and `<AlertDescription>Switch back, or return to the members directory.</AlertDescription>`. Below the alert, a `<Button variant="outline">Back to members</Button>` that navigates to `/members`.

**Member fetch error state**
- Replaces the entire `PaceMain` content area when the initial member query fails.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>Could not load member</AlertTitle>` and `<AlertDescription>` populated from the normalised `HandleSupabaseError(error, { context: 'core_member' })` message. Below the alert, a `<Button>Retry</Button>` that re-runs the member query.

**Section error state (role history)**
- Replaces the role-history `DataTable` area inside the role-history card when the role-history query fails.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>Could not load roles</AlertTitle>` and `<AlertDescription>` populated from the normalised `HandleSupabaseError(error, { context: 'core_member_role' })` message. Below the alert, a `<Button>Retry</Button>` that re-runs the role-history query.
- The page header (Back button, member name, Add-role button) continues to render above the section error.

**Toasts** — surfaced via the module-level `toast({ title, description?, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'success'` (Add success "Role added.", End success "Role ended.") and `'destructive'` (Add failure with normalised `HandleSupabaseError` message, End failure with normalised message, active-uniqueness race per BR-9). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### Layout acceptance criteria (prototype alignment)

- [ ] Route is **`/member-roles`** (org-wide), not **`/members/:memberId/roles`**.
- [ ] **`PageHeader`** uses org-wide title/subtitle and **New appointment** in header-right.
- [ ] Create/edit appointment uses an **inline `Card` form** above the table, not an **Add-role modal `Dialog`**.
- [ ] Table lists appointments **across all members/units** in the org; row activate opens Member 360.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- Route and architecture spec still target **`/members/:memberId/roles`** (member-scoped nested route) with **Back to Member 360** header and member-name page title.
- **Add role** opens a modal **`Dialog`**, not prototype inline **`Card`** appointment form.
- Table is member-scoped role history, not org-wide appointments with **Member** column.
- **`team-architecture-requirements.md`** route registry must be updated when pass 2 adopts **`/member-roles`**.

### States

- **Loading — initial page** — Full-page `<LoadingSpinner />` centred inside the `PaceMain` content area; no header, no card, no table render. Back button does not render yet.
- **Loading — role history (after member resolves)** — Once the member resolves, the page header renders immediately (Back button, member-name heading, Add-role button). The role-history `DataTable` renders with its built-in `isLoading` indication until the role-history query completes.
- **Empty — no roles** — Page header renders; the role-history `DataTable` renders its empty state inside the card with heading "No roles recorded for this member yet." and sub-line "Use Add role to record this member's first standing role." Toolbar (search) renders above the empty area.
- **Empty — no role types** — Page header renders; the "Add role" button renders disabled with the helper text "No role types configured for this organisation. Contact your administrator." rendered below it. The role-history `DataTable` still renders in its current state (loaded data, empty state, or loading) — not affected by the role-type lookup outcome.
- **Member-not-found** — Replaces the page; layout per the Member-not-found page component above.
- **Org-mismatch** — Replaces the page; layout per the Org-mismatch alert component above.
- **Member fetch error** — Replaces the page; layout per the Member fetch error state component above.
- **Section error** — Replaces only the role-history card content; page header continues to render above.
- **Permission denied** — `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page."
- **Add-role modal — open / clean** — Modal overlay; focus on the Role type select; both fields empty (or Start date defaulted to today); Submit disabled until both fields are valid.
- **Add-role modal — duplicate detected** — Modal overlay; the chosen Role type triggers the active-uniqueness helper text under the select; Submit disabled with helper text visible.
- **Add-role modal — submitting** — Submit button enters disabled / pending state; form fields remain visible; the rest of the page is unaffected.
- **Add-role modal — success** — Modal closes; `success` toast "Role added." renders; role-history table refreshes with the new active row at the top of the default sort.
- **Add-role modal — failure** — Modal stays open with values intact; `destructive` toast surfaces the normalised error message (or the BR-9 race copy when the active-uniqueness index rejects the INSERT).
- **End-role dialog — open** — Modal overlay; date picker defaulted to today; description shows the row's role name and the chosen end date.
- **End-role dialog — invalid date** — Date earlier than the row's `start_date` triggers the helper text "End date must be on or after start date." Confirm button disabled.
- **End-role dialog — confirming** — Confirm button enters disabled / pending state.
- **End-role — success** — Dialog closes; `success` toast "Role ended." renders; role-history table refreshes with the row showing the `end_date` and Status flipped to "Ended".
- **End-role — failure** — Dialog closes; `destructive` toast surfaces the normalised error; the row is unchanged.

### Interactions

- **Back button** — Hover: pace-core2 default outline-button hover. Click: navigates to `/members/:memberId` (TEAM-03 Member 360). Default / focused / disabled visuals follow pace-core2 `Button` defaults.
- **Add-role button** — Visible when `canUpdate === true`. Disabled visual when the role-type lookup is empty (BR-19). Click (when enabled): opens the Add-role modal and moves focus to the Role type select.
- **Role type select (Add-role modal)** — Standard pace-core2 `Select` interaction (click trigger to open the popover, click an item to choose). On change, triggers the active-uniqueness pre-validation; updates the helper text and Submit-disabled state synchronously.
- **Start date date picker (Add-role modal)** — Standard `DatePickerWithTimezone` interaction. Default value: today.
- **Add-role Cancel** — Click: closes the modal without inserting. Form values are discarded.
- **Add-role Submit** — Click (when enabled): runs the INSERT mutation; pending state shows during the in-flight mutation. On success: modal closes, toast renders. On failure: modal stays open, toast renders.
- **End-role row trigger** — Visible when `row.end_date === null && canUpdate === true`. Click: opens the End-role dialog with focus on the date picker.
- **End-role date picker (dialog)** — Standard `DatePickerWithTimezone` interaction. Default value: today. On change, triggers the date-validity pre-validation; updates helper text and Confirm-disabled state synchronously.
- **End-role Cancel** — Click, native escape, or click outside: closes the dialog without mutating the row.
- **End-role Confirm** — Click (when enabled): runs the UPDATE mutation; pending state shows during the in-flight mutation. On success: dialog closes, toast renders. On failure: dialog closes, toast renders.
- **Search input (role history)** — Typing filters in-memory rows in real time with no submit step. Clearing the input restores the unfiltered list.
- **Sort headers** — Click toggles asc / desc / none on that column.
- **Pagination controls** — Page size dropdown changes rows per page; prev / next change page index; current page indicator updates immediately.
- **Toast** — On Add success / failure, End success / failure: toast renders bottom-right and auto-dismisses after 5000 ms.

### Permission-conditional rendering

| Condition | Page entry | Add-role button | End-role row trigger |
|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a |
| Authenticated, org, `read:page.member-roles` denied | `<AccessDenied />` | Hidden | Hidden |
| Authenticated, org, `read:page.member-roles` allowed, `useResourcePermissions('member-roles').canUpdate === false` | Page visible | Hidden | Hidden |
| Authenticated, org, `read:page.member-roles` allowed, `canUpdate === true`, role-type lookup non-empty | Page visible | Visible (enabled) | Visible on rows where `end_date IS NULL` |
| Authenticated, org, `read:page.member-roles` allowed, `canUpdate === true`, role-type lookup empty | Page visible | Visible (disabled, with helper text) | Visible on rows where `end_date IS NULL` |

---

## §6 Business rules

**BR-1 — Identifier in path.**
- Input: a navigation to `/members/:memberId/roles`.
- Output: `:memberId` is interpreted as `core_member.id` (uuid). Never `core_person.id`. The member fetch query filters `core_member.id = :memberId AND organisation_id = selectedOrganisation.id AND deleted_at IS NULL`.
- Edge: a member-not-found UX renders when the query returns zero rows for any reason (unknown id, deleted member, cross-org member).

**BR-2 — Member name composition.**
- Input: `core_person.first_name`, `last_name`, `preferred_name`.
- Output: when `preferred_name` is non-empty (after trim), full name is `"{preferred_name} {last_name}"`. Otherwise full name is `"{first_name} {last_name}"`. Used for the page heading ("`{full name} — Standing roles`") and for `usePaceMain({ printTitle })`. Mirrors TEAM-03 BR-AA verbatim.
- Edge: until the member fetch resolves, `printTitle` is `'Standing roles'` and no heading renders (full-page loading).

**BR-3 — Role list query.**
- Input: the role-history query.
- Output: rows from `core_member_role` joined to `core_role_type` via `role_id`, filtered by `core_member_role.member_id = :memberId AND core_member_role.organisation_id = selectedOrganisation.id`, ordered by `start_date` descending. The slice does NOT filter by `deleted_at` — that column does not exist on `core_member_role`.

**BR-4 — Role name fallback.**
- Input: a role-history row whose `core_role_type` join returns null (role-type row deleted, missing, or unreadable).
- Output: the Role column for that row renders as em-dash "—". The row is otherwise unaffected; sort, search, and Status column behave as if the role name were empty (search match on em-dash returns no match; sort places null-named rows together per pace-core2 default null sorting).

**BR-5 — Status derivation and badge tones.**
- Input: a role-history row's `end_date`.
- Output: `end_date IS NULL` → status "Active" with success-tone badge. Otherwise → status "Ended" with muted-tone badge. The label is the literal status word ("Active" or "Ended").

**BR-6 — Date display format.**
- Input: a `start_date` or `end_date` value from a role-history row.
- Output: rendered as a localised short date (e.g. "5 May 2026"). When `end_date` is null, the End date column renders an em-dash "—".

**BR-7 — Add-role payload.**
- Input: a successful submit of the Add-role modal.
- Output: INSERT `core_member_role` with payload `{ member_id: :memberId, role_id: <Role type select value>, organisation_id: selectedOrganisation.id, start_date: <Start date picker value> }`. Do NOT pass `id` (server default `gen_random_uuid()`), `end_date` (server default null), or audit columns (`created_at`, `updated_at`, `created_by`, `updated_by` — server defaults / triggers populate). Do NOT pass `unit_id` (column does not exist on live dev — see §16).
- Edge: on success, the slice closes the modal, refreshes the role-history query, and renders a `success` toast "Role added." (BR-10).

**BR-8 — Active-uniqueness pre-validation (Add role).**
- Input: every change to the Role type select in the Add-role modal.
- Output: the form runs an in-memory check against the already-loaded role-history rows. If any row exists with `member_id = :memberId AND role_id = (selected) AND organisation_id = selectedOrganisation.id AND end_date IS NULL`, the Submit button is disabled and the helper text under the role-type select reads "This member already has an active role of this type." When no duplicate exists, the helper text is empty and Submit is enabled (subject to other validation).
- Edge: if the user changes the selection back to a non-duplicate role type, the helper text clears and Submit re-enables synchronously.

**BR-9 — Active-uniqueness DB error race.**
- Input: an Add-role INSERT that fails with the partial unique index violation `core_member_role_active_unique` on `(member_id, role_id, organisation_id) WHERE end_date IS NULL`.
- Output: the modal stays open with values intact (no row committed); a `destructive` toast renders with the copy "This member already has an active role of this type. Refresh the list and try again."
- Edge: the underlying `HandleSupabaseError` normalised message is suppressed in favour of the BR-9 copy because the BR-9 wording is more actionable for the user. Other DB errors fall through to BR-10's normalised handling.

**BR-10 — Add-role outcomes.**
- Input: an Add-role INSERT result.
- Output:
  - On success: close the modal, refresh the role-history query, render `success` toast "Role added."
  - On failure (general): leave the modal open with values intact, render `destructive` toast with the normalised `HandleSupabaseError(error, { context: 'core_member_role' })` message.
  - On failure (active-uniqueness violation): per BR-9.

**BR-11 — End-role payload and outcomes.**
- Input: a successful confirm of the End-role dialog with chosen `end_date`.
- Output: UPDATE `core_member_role` SET `end_date = (chosen)` WHERE `id = row.id AND organisation_id = selectedOrganisation.id AND end_date IS NULL`. On success: close the dialog, refresh the role-history query, render `success` toast "Role ended." On failure: close the dialog, render `destructive` toast with normalised `HandleSupabaseError(error, { context: 'core_member_role' })` message; the row is not mutated.
- Edge: the End-role row action is only rendered on rows where `end_date IS NULL && canUpdate === true`. The defensive `end_date IS NULL` predicate in the WHERE clause guards against a race where the row has already been ended by another admin between the page render and this confirm — in that case the UPDATE affects zero rows and the slice still surfaces the success toast (the next refetch will reflect whichever `end_date` won). If the build agent prefers stricter feedback, the UPDATE can use `.select().single()` and surface a destructive toast on zero-row response; this is implementation-judgement and does not change the user-facing contract documented here.

**BR-12 — End-role date validity.**
- Input: every change to the End-role dialog's date picker.
- Output: the dialog runs a check `chosen_end_date >= row.start_date`. When the check fails, the Confirm button is disabled and the helper text under the date picker reads "End date must be on or after start date." When the check passes, the Confirm button enables.
- Edge: the underlying CHECK constraint `valid_date_range` (`end_date IS NULL OR end_date >= start_date`) on `core_member_role` enforces the same rule server-side. If a race produces a server-side rejection on a date that passed client validation (extremely unlikely given the row's `start_date` is already loaded), the slice falls through to BR-11's destructive-toast handling.

**BR-13 — Org-scoped reads and writes.**
- Input: any list query or mutation in this slice.
- Output: every query and mutation filters by `organisation_id = selectedOrganisation.id` defensively. Member fetch on `core_member.organisation_id`; role-history query on `core_member_role.organisation_id`; role-type lookup on `core_role_type.organisation_id`. INSERT on `core_member_role` stamps `organisation_id = selectedOrganisation.id` explicitly. UPDATE on `core_member_role` includes `organisation_id = selectedOrganisation.id` in the WHERE clause. RLS enforces the same isolation server-side; the defensive filters are belt-and-braces.

**BR-14 — Org switch.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output: the slice refetches the member against the new org. If the member's `organisation_id === selectedOrganisation.id` after the refetch, the page silently rebinds (the role-history query is also refetched against the new org; any open Add-role modal or End-role dialog closes with values discarded). If the member's `organisation_id !== selectedOrganisation.id`, the page replaces its content with the org-mismatch alert (§5 component above) plus a "Back to members" button.
- Edge: mirrors TEAM-03 BR-W (silent rebind if member exists in new org; org-mismatch destructive `Alert` + "Back to members" if not).

**BR-15 — Action permission gating.**
- Input: `useResourcePermissions('member-roles')` results.
- Output:
  - "Add role" header button: hidden when `canUpdate === false`.
  - End-role row trigger: hidden on every row when `canUpdate === false`.
  - When `canUpdate === true` AND the role-type lookup is empty, the "Add role" button renders disabled with the BR-19 helper text. End-role triggers on existing rows are unaffected.
- Edge: page entry remains gated by `<PagePermissionGuard pageName="member-roles" operation="read">` regardless of `canUpdate`.

**BR-16 — Mutation contract.**
- Input: any INSERT or UPDATE on `core_member_role` originated by this slice.
- Output: The mutation goes via `useSecureSupabase().from('core_member_role')`. Server-side authorisation is enforced by RLS policies (`rbac_insert_core_member_role`, `rbac_update_core_member_role`) that gate on `is_super_admin OR check_user_is_org_admin(organisation_id)`. The slice does not author these RLS policies; they exist today and work for org-admin staff. Future cross-app convergence to RBAC-checked RLS for `core_member_role` is informational only — see §17 References.
- Edge: a non-org-admin staff member with `read:page.member-roles` (page guard satisfied) but no `org_admin` role still cannot mutate the row — RLS denies. The destructive toast surfaces the normalised RLS deny message.

**BR-17 — Audit attribution.**
- Input: any INSERT or UPDATE originated by this slice.
- Output: payload omits `created_at`, `updated_at`, `created_by`, `updated_by`. These columns are populated server-side via column defaults (`now()`, `auth.uid()`) and database triggers that refresh `updated_at` / `updated_by` on UPDATE. The slice never patches these columns from the client.

**BR-18 — Concurrency.**
- Input: any INSERT or UPDATE originated by this slice.
- Output: last-write-wins. No optimistic locking; no `updated_at` watermark check; no `If-Match` header or version column. Concurrent edits resolve to the second-completing mutation on the next refetch. Mirrors TEAM-03 BR-X.
- Edge: if a second admin ends the same role between this user's read and confirm, the second admin's `end_date` is overwritten by this confirm only if the WHERE clause's `end_date IS NULL` predicate still holds at the time of UPDATE; otherwise the UPDATE affects zero rows. The slice does not warn the user about either outcome.

**BR-19 — Role-type lookup.**
- Input: the Add-role modal's Role type select source.
- Output: SELECT `id, name` FROM `core_role_type` WHERE `organisation_id = selectedOrganisation.id`, ordered by `name` ascending. The query runs once on page load (or on org switch). When the result set is empty, the "Add role" header button renders disabled with the helper text "No role types configured for this organisation. Contact your administrator."
- Edge: v6 authors against the **planned** per-org UNIQUE `(name, organisation_id)` constraint on `core_role_type` (see §15 / §17). Day-1 read behaviour is unaffected because `organisation_id` is already populated on every row. The slice does not author the migration. Role-type creation is out of scope for v1 (deferred — see §16, §17).

**BR-20 — Role history table behaviour (read-only).**
- Input: the role-history `DataTable` configuration.
- Output: features for the role-history `DataTable`: `search: true`, `sorting: true`, `pagination: true`, `filtering: true`, `columnVisibility: true`, `columnReordering: true`. All Create / Edit / Delete features OFF: `creation: false`, `editing: false`, `deletion: false`, `deleteSelected: false`, `selection: false`, `grouping: false`, `hierarchical: false`, `import: false`, `export: false`. End-role is exposed only via the `actions` row trigger (BR-15). Add-role is rendered outside the table as a separate header button (BR-15) — the toolbar does NOT show a Create affordance.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. Standing roles lives behind `/members/:memberId/roles`.

### Read contracts

- **Member fetch.** `useSecureSupabase().from('core_member').select('id, person_id, organisation_id, deleted_at, core_person!inner(id, first_name, last_name, preferred_name)').eq('id', :memberId).eq('organisation_id', selectedOrganisation.id).is('deleted_at', null).maybeSingle()`. Returns one row or `null`. The page heading and `printTitle` are composed from `first_name`, `last_name`, `preferred_name` per BR-2.
- **Role-history fetch.** `useSecureSupabase().from('core_member_role').select('id, member_id, role_id, organisation_id, start_date, end_date, core_role_type!inner(id, name)').eq('member_id', :memberId).eq('organisation_id', selectedOrganisation.id).order('start_date', { ascending: false })`. The slice does NOT include any `deleted_at` predicate — that column does not exist on `core_member_role`.
- **Role-type lookup.** `useSecureSupabase().from('core_role_type').select('id, name').eq('organisation_id', selectedOrganisation.id).order('name', { ascending: true })`. Returns the role types available for the Add-role select. When the result is empty, BR-19's helper text renders.

### Query-key contract

- Member fetch: `['member', :memberId, selectedOrganisation.id]`.
- Role-history fetch: `['member', :memberId, 'roles', selectedOrganisation.id]`.
- Role-type lookup: `['lookup', 'role-types', selectedOrganisation.id]`.
- Add-role success invalidates the role-history query (and re-uses the loaded role-type lookup). End-role success invalidates the role-history query. Org switch invalidates all of the above against the new org.

### Write contracts

All writes go via `useSecureSupabase().from('core_member_role')` against the live `check_user_is_org_admin(organisation_id)` RLS gate.

- **Add role — INSERT.** `.from('core_member_role').insert({ member_id: :memberId, role_id, organisation_id: selectedOrganisation.id, start_date }).select().single()`. Success: refetch role history, close modal, success toast "Role added." Failure: normalised `HandleSupabaseError(error, { context: 'core_member_role' })` and `destructive` toast; modal stays open. Active-uniqueness violation: substitute the BR-9 copy "This member already has an active role of this type. Refresh the list and try again." for the toast description.
- **End role — UPDATE.** `.from('core_member_role').update({ end_date }).eq('id', row.id).eq('organisation_id', selectedOrganisation.id).is('end_date', null).select().single()`. Success: refetch role history, close dialog, success toast "Role ended." Failure: normalised `HandleSupabaseError(error, { context: 'core_member_role' })` and `destructive` toast; dialog closes without mutating the row.

### RLS / permission contracts

- **SELECT** on `core_member_role` is permitted on dev by `rbac_select_core_member_role` (super-admin OR `check_user_organisation_access(organisation_id)`).
- **INSERT** on `core_member_role` is permitted by `rbac_insert_core_member_role` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **UPDATE** on `core_member_role` is permitted by `rbac_update_core_member_role` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **DELETE** on `core_member_role` is permitted server-side by `rbac_delete_core_member_role`, but this slice never issues a DELETE (see §16).
- **SELECT** on `core_role_type` is permitted by `read_team_formation_roles` (`USING is_authenticated_user()`). Read-only from client; mutations only via service role.
- **SELECT** on `core_member` and `core_person` is permitted by their existing RLS chains (TEAM-03 §7 documents the same chains; this slice consumes them in the same way).

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-04 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu, and the `PaceAppLayout` chrome. TEAM-04 renders inside that chrome.
- **TEAM-02** owns the directory list at `/members`. TEAM-04's "← Back to members" buttons (on the Member-not-found page and on the Org-mismatch alert) navigate there.
- **TEAM-03** owns the Member 360 detail surface at `/members/:memberId`. TEAM-03's "View roles ›" button navigates here using `core_member.id`. TEAM-04's "← Back to Member 360" button navigates to `/members/:memberId` (same id).

### ID contracts

- `core_member.id` (uuid) — primary identifier in the route path. Consumed from TEAM-03's "View roles ›" navigation; used as `member_id` in every `core_member_role` read and INSERT.
- `core_member_role.id` (uuid) — primary identifier of a role-history row. Used as the WHERE-anchor for End-role UPDATEs.
- `core_role_type.id` (integer) — FK target for `core_member_role.role_id`. Used as the value of the Role type select in the Add-role modal.
- `core_member.organisation_id` (uuid) — used internally for org-scoped read filters.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_member` | SELECT (joined to `core_person`) | `useSecureSupabase()` |
| `core_person` | SELECT (joined) | `useSecureSupabase()` |
| `core_member_role` | SELECT, INSERT, UPDATE | `useSecureSupabase()` |
| `core_role_type` | SELECT (lookup; joined for display) | `useSecureSupabase()` |

### `core_member_role` — relevant columns (live dev-db)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `member_id` | uuid | NO | — | FK → `core_member(id)` |
| `role_id` | integer | NO | — | FK → `core_role_type(id)` |
| `organisation_id` | uuid | NO | — | FK → `core_organisations(id)` |
| `start_date` | date | NO | — | — |
| `end_date` | date | YES | — | — |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | server triggers update on UPDATE |
| `created_by` | uuid | YES | `auth.uid()` | — |
| `updated_by` | uuid | YES | `auth.uid()` | — |

Constraints:
- PK `core_member_role_pkey (id)`.
- FK `core_member_role_role_id_fkey (role_id) REFERENCES core_role_type(id)`.
- FK `pace_member_roles_member_id_fkey (member_id) REFERENCES core_member(id)` (constraint name is an artefact of an earlier table rename).
- FK `pace_member_role_organisation_id_fkey (organisation_id) REFERENCES core_organisations(id)`.
- CHECK `valid_date_range`: `(end_date IS NULL) OR (end_date >= start_date)`.
- Partial UNIQUE `core_member_role_active_unique` on `(member_id, role_id, organisation_id) WHERE (end_date IS NULL)` — enforces active uniqueness.

There is **no `unit_id` column** on `core_member_role`. There is **no `deleted_at` column** on `core_member_role`. Do not attempt to write to or filter by either.

### `core_role_type` — relevant columns (live dev-db)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | integer | NO | `nextval('team_formation_roles_id_seq')` | PK; sequence name is an artefact of an earlier table rename |
| `name` | text | NO | — | UNIQUE on dev today (`team_formation_roles_name_key`) — see §15 implementation gate for the planned per-org UNIQUE migration |
| `organisation_id` | uuid | NO | — | FK → `core_organisations(id)` |
| `created_at` | timestamptz | YES | `now()` | — |
| `updated_at` | timestamptz | YES | `now()` | — |
| `created_by` | uuid | YES | `auth.uid()` | — |
| `updated_by` | uuid | YES | `auth.uid()` | — |

`core_role_type` is read-only from the client (RLS permits SELECT for any authenticated user; no INSERT / UPDATE / DELETE policies exist on dev — mutations only via service role). v1 consumes role types Select-only.

### `core_member` — relevant columns (joined for member fetch)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | route `:memberId` |
| `person_id` | uuid | NO | FK → `core_person.id`; used to compose member name via the embedded join |
| `organisation_id` | uuid | NO | FK → `core_organisations.id`; used for org-scoped filter |
| `deleted_at` | timestamptz | YES | filter excludes `deleted_at IS NOT NULL` |

### `core_person` — relevant columns (joined for member fetch)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | — |
| `first_name` | text | NO | name composition (BR-2) |
| `last_name` | text | NO | name composition (BR-2) |
| `preferred_name` | text | YES | name composition (BR-2) |

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

Every verification step here targets dev-db only.

- Confirm `core_member_role` columns and constraints match the table above. Specifically, confirm `core_member_role_active_unique` is `UNIQUE INDEX ON (member_id, role_id, organisation_id) WHERE (end_date IS NULL)` and `valid_date_range` CHECK is `end_date IS NULL OR end_date >= start_date`.
- Confirm `core_member_role` has no `unit_id` column and no `deleted_at` column.
- Confirm `core_member_role` UPDATE / INSERT / DELETE RLS policies use `is_super_admin OR check_user_is_org_admin(organisation_id)` — the live gate this slice authors against.
- Confirm `core_role_type` columns include `organisation_id NOT NULL`. Confirm the constraint `team_formation_roles_name_key` is the global UNIQUE on `name` referenced by the implementation gate in §15.
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Confirm `rbac_app_pages` row for `page_name = 'member-roles'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` is in place (post-build seeding pass — see §15).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `data_check_rbac_permission_with_context` helper; `data_get_app_id`. Future cross-app convergence to RBAC-checked RLS for `core_member_role` is informational only — see §17 References.
- `pace-core2/packages/core/docs/database/domains/team.md` — `core_member_role`, `core_role_type` shapes.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for every read, INSERT, and UPDATE |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="member-roles"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Action-level gating for the "Add role" button and the End-role row trigger via `'member-roles'` resource key |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for org filters and org-switch detection |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set dynamic `printTitle` to `"{full name} — Standing roles"` on member resolve |
| `Card`, `CardContent` | `@solvera/pace-core/components` | Section panel container around the role-history `DataTable` |
| `Button` | `@solvera/pace-core/components` | Back, Add role, Retry, Back to members; also Cancel + Add role buttons inside the Add-role modal `DialogFooter`, and Cancel + End role buttons inside the End-role dialog `DialogFooter` |
| `Form`, `FormField` | `@solvera/pace-core/components` | Add-role form root and labelled fields |
| `Input` | `@solvera/pace-core/components` | Underlying primitive used by `FormField` |
| `Label` | `@solvera/pace-core/components` | Label primitive used by `FormField` |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | `@solvera/pace-core/components` | Role type select in the Add-role modal |
| `DatePickerWithTimezone` | `@solvera/pace-core/components` | Start date input in the Add-role modal; End date input in the End-role dialog body |
| `Dialog`, `DialogPortal`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose` | `@solvera/pace-core/components` | Add-role modal container; also used to compose the End-role destructive dialog (the End-role surface needs a date picker in its body) |
| `DataTable` | `@solvera/pace-core/components` | Role-history table |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | Member fetch error, role-history fetch error, org-mismatch alert |
| `Badge` | `@solvera/pace-core/components` | Status column ("Active" / "Ended") |
| `LoadingSpinner` | `@solvera/pace-core/components` | Full-page initial loading while the member fetch is in flight |
| `toast` | `@solvera/pace-core/components` | Module-level toast for Add / End success and failure |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalise Supabase errors for inline `Alert` description and toast copy |
| `ChevronLeft` | `@solvera/pace-core/icons` | Back-button glyph |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in query handlers must abort the SELECT / INSERT / UPDATE when `selectedOrganisation` is null mid-render (for example during an org switch). Do not issue cross-org reads or writes.
- **`useResourcePermissions` resource key is `'member-roles'`** (singular `member-roles`, not the broader `'members'` key used by TEAM-02 / TEAM-03). It matches the canonical `rbac_app_pages.page_name` and gives finer-grained access for the standing-roles surface.
- **`DataTable` features for the role-history table.** `features.search: true`, `features.sorting: true`, `features.pagination: true`, `features.filtering: true`, `features.columnVisibility: true`, `features.columnReordering: true`. All CRUD features off: `features.creation: false`, `features.editing: false`, `features.deletion: false`, `features.deleteSelected: false`, `features.selection: false`, `features.grouping: false`, `features.hierarchical: false`, `features.import: false`, `features.export: false`. Do not pass `onCreateRow`, `onEditRow`, or `onDeleteRow`. The End-role row trigger is exposed via the `actions` prop only.
- **Role-history table description: count is unfiltered.** `description` is `"{count} roles"` where `{count}` is the unfiltered server-result count for the member, not the post-search count.
- **`DatePickerWithTimezone` for date-only fields.** Both Start date (Add-role) and End date (End-role) are pure date columns (`date`, no time, no tz). Pass the date in the input format the picker accepts and persist back to the column as a date.
- **End-role dialog composition.** The End-role surface needs a date picker in its body, so it is composed directly from the `Dialog` family rather than from any single-call destructive-confirm wrapper: `Dialog` → `DialogContent` → `DialogHeader` (title "End role?", description) → body (date picker + irreversibility helper text + conditional date-validity helper text) → `DialogFooter` (`Cancel` outline + `End role` destructive). The build agent verifies against `pace-core2/packages/core/src/components/Dialog.tsx` whether a `DialogBody` wrapper is exported; if it is, the body is wrapped in `<DialogBody>...</DialogBody>`; if not, the body content sits directly inside `DialogContent` between `DialogHeader` and `DialogFooter`.
- **`DatePickerWithTimezone` value prop pattern.** Both Add-role (Start date) and End-role (End date) require a `defaultValue` of today and a controlled `value` / `onChange` for live helper-text updates. The build agent confirms the exact prop shape (whether `defaultValue` plus `onChange` is supported or only fully-controlled `value` plus `onChange`) by reading `pace-core2/packages/core/src/components/DatePickerWithTimezone.tsx`. If the picker is fully-controlled only, the slice initialises local state to today on dialog open and feeds it via `value` / `onChange`.
- **`HandleSupabaseError` context strings.** Pass `{ context: 'core_member' }` for the member fetch failure. Pass `{ context: 'core_member_role' }` for the role-history fetch failure, the Add-role INSERT failure, and the End-role UPDATE failure.
- **Active-uniqueness DB error copy override.** When the Add-role INSERT fails with the partial-unique-index violation (`core_member_role_active_unique`), the toast description is overridden to BR-9's copy ("This member already has an active role of this type. Refresh the list and try again.") rather than the generic `HandleSupabaseError` message — that wording is more actionable.
- **No `Toaster` mount.** TEAM-01's `<ToastProvider>` mount is the ancestor; calling `toast(...)` without the provider mounted will throw.
- **Implementation gate — `core_role_type` per-org UNIQUE migration.** v6 authors against the planned UNIQUE `(name, organisation_id)` constraint. Migration is upstream platform work; the slice does not author it. Day-1 read behaviour is unaffected. See §15 / §17.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/members/:memberId/roles` | `member-roles` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read Standing roles | `read:page.member-roles` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Add role | `update:page.member-roles` | `useResourcePermissions('member-roles').canUpdate` | "Add role" header button hidden |
| End role (row action) | `update:page.member-roles` | `useResourcePermissions('member-roles').canUpdate` | End-role row trigger hidden on every row |

There is no Portal CTA on TEAM-04 and no acting-user-is-target check; standard `useResourcePermissions('member-roles').canUpdate` gating is sufficient.

### Server-side enforcement

- **`core_member_role` SELECT** is permitted by `rbac_select_core_member_role` (super-admin OR `check_user_organisation_access(organisation_id)`).
- **`core_member_role` INSERT** is permitted by `rbac_insert_core_member_role` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **`core_member_role` UPDATE** is permitted by `rbac_update_core_member_role` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **`core_member_role` DELETE** is permitted by `rbac_delete_core_member_role`, but this slice never issues a DELETE.
- **`core_role_type` SELECT** is permitted by `read_team_formation_roles` (`USING is_authenticated_user()`).
- **`core_member` and `core_person` SELECT** permitted by their existing RLS chains; identical to TEAM-03's read patterns.

---

## §11 Acceptance criteria

- [ ] **AC-01 — Page entry, authenticated, has org, has read permission, member resolves, role history loads.**

Given a user is authenticated, has an org, has `read:page.member-roles`, and navigates to `/members/:memberId/roles` for a member of the current org with two existing roles (one active, one ended), when the page loads, then the page header renders with a "← Back to Member 360" button, a heading composed as the member's full name (BR-2) followed by " — Standing roles", an "Add role" button on the right, and below the header a single-card role-history `DataTable` with rows for the two roles in the columns Role, Start date, End date, Status, Actions. (Traces F-01, F-02, F-04, F-05, F-21–F-26.)

- [ ] **AC-02 — Default sort, status badges, and date format.**

Given the member has two roles (Role A active since 2026-01-15; Role B ended 2025-12-31), when the role-history table renders, then the row for Role A appears first (default sort `start_date desc`); Role A's End date column shows em-dash "—" and its Status column shows a success-toned "Active" badge; Role B's End date column shows "31 Dec 2025" and its Status column shows a muted-toned "Ended" badge. (Traces F-23, F-24, F-25, BR-5, BR-6.)

- [ ] **AC-03 — Role name fallback.**

Given a role-history row's `core_role_type` join returns null (role-type row deleted server-side), when the row renders, then its Role column shows an em-dash "—". (Traces F-22, BR-4.)

- [ ] **AC-04 — Add role happy path.**

Given the user has `useResourcePermissions('member-roles').canUpdate === true` and the org has at least one `core_role_type` row, when the user clicks "Add role" in the page header, the Add-role modal opens with focus on the Role type select, the Start date defaulted to today, and Submit disabled; when they choose a role type that is not currently held active by the member and click Submit, the slice runs `INSERT INTO core_member_role (member_id, role_id, organisation_id, start_date)` with the four populated values, the modal closes, the role-history table refreshes with the new active row at the top, and a `success` toast renders with copy "Role added." (Traces F-28, F-29, F-31, BR-7, BR-10.)

- [ ] **AC-05 — Add role active-uniqueness pre-validation.**

Given the member already has an active role of type "Leader", when the user opens the Add-role modal and selects "Leader" in the Role type select, then the helper text under the role-type select shows "This member already has an active role of this type." and the Submit button is disabled. (Traces F-30, BR-8.)

- [x] **AC-06 — Add role active-uniqueness DB race.**

Given the user opens the Add-role modal and selects a role type that is not currently held active (per the in-memory check) but a concurrent admin commits a duplicate active row before this Submit, when the user clicks Submit, the INSERT fails with the `core_member_role_active_unique` violation, the modal stays open with values intact, and a `destructive` toast renders with copy "This member already has an active role of this type. Refresh the list and try again." (Traces F-17, BR-9.)

- [ ] **AC-07 — Add role failure (general).**

Given the user clicks Submit in the Add-role modal, when the INSERT fails for a reason other than active-uniqueness (for example RLS deny), then the modal stays open with values intact and a `destructive` toast renders with the normalised `HandleSupabaseError` message. (Traces F-16, BR-10.)

- [x] **AC-08 — Add role disabled when no role types configured.**

Given the org has zero `core_role_type` rows, when the page loads with `canUpdate === true`, then the "Add role" header button renders disabled with helper text "No role types configured for this organisation. Contact your administrator." rendered below the button. (Traces F-13, F-39, BR-19.)

- [ ] **AC-09 — End role happy path.**

Given the user has `canUpdate === true` and the member has a role with `end_date IS NULL` and `start_date = "2026-01-15"`, when the user clicks the End-role row action, the End-role dialog (composed from the `Dialog` family) opens with title "End role?", a date picker defaulted to today, and a description that updates as the date changes; when they accept the default end date (today, e.g. "5 May 2026") and click "End role", the slice runs `UPDATE core_member_role SET end_date = '2026-05-05' WHERE id = row.id AND organisation_id = ... AND end_date IS NULL`, the dialog closes, the table refreshes (the row's End date column now shows "5 May 2026" and the Status column flips to "Ended"), and a `success` toast renders with copy "Role ended." (Traces F-33, F-35, BR-11.)

- [ ] **AC-10 — End role date validity.**

Given the user opens the End-role dialog for a row with `start_date = "2026-01-15"`, when they pick an end date of "2025-12-31" (earlier than the start date), then the helper text under the date picker shows "End date must be on or after start date." and the Confirm button is disabled. (Traces F-34, BR-12.)

- [x] **AC-11 — End role failure.**

Given the user confirms the End-role dialog, when the UPDATE fails (for example RLS deny), then the dialog closes and a `destructive` toast renders with the normalised `HandleSupabaseError` message; the row is not mutated. (Traces F-18, BR-11.)

- [x] **AC-12 — Member-not-found UX.**

Given a user navigates to `/members/:memberId/roles` for an id that does not exist, is deleted, or belongs to another organisation, when the page renders, then the page replaces its content with the heading "Member not found", description "We couldn't find this member in your current organisation.", and a "← Back to members" button that navigates to `/members`. (Traces F-11, BR-1.)

- [x] **AC-13 — Org-mismatch on org switch.**

Given the user is on `/members/:memberId/roles` for a member of org A, when they switch the org context to org B (and the member does not exist in org B), then the page replaces its content with a destructive `Alert` titled "This member is not in the current organisation", description "Switch back, or return to the members directory.", and a "Back to members" button navigating to `/members`. (Traces F-20, BR-14.)

- [ ] **AC-14 — Permission denied (read).**

Given a user is authenticated and has org context but lacks `read:page.member-roles`, when they navigate to `/members/:memberId/roles`, then `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (Traces F-19, F-37.)

- [x] **AC-15 — Permission denied (update).**

Given the user has `read:page.member-roles` but `useResourcePermissions('member-roles').canUpdate === false`, when the page renders, then the role-history table renders with all read-only columns but no End-role row triggers, and the "Add role" header button is hidden. (Traces F-26, F-28, F-38, BR-15.)

- [ ] **AC-16 — Empty role-history.**

Given the member has zero `core_member_role` rows, when the page loads, then the role-history table renders its empty state with heading "No roles recorded for this member yet." and sub-line "Use Add role to record this member's first standing role." (Traces F-12.)

- [ ] **AC-17 — Role-history fetch error.**

Given the role-history query fails, when the page is rendered, then the role-history card area is replaced inline by a destructive `Alert` titled "Could not load roles" with the normalised error message and a Retry button; the page header (Back, member name, Add role) continues to render above. (Traces F-15.)

- [ ] **AC-18 — Initial loading is full-page; role-history loading is per-table.**

Given the user navigates to `/members/:memberId/roles`, when the initial member query is in flight, then a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; once the member resolves, the page header renders immediately and the role-history `DataTable` uses its built-in `isLoading` indication until the role-history query completes. (Traces F-08, F-09.)

- [ ] **AC-19 — Cross-org leakage prevention.**

Given a member exists in org B but not in org A, when the user is signed in with org A selected and navigates to `/members/<orgB-member-id>/roles`, then the member fetch returns zero rows (RLS deny + defensive filter) and the page renders the "Member not found" UX. (Traces F-48, F-49, BR-13.)

- [ ] **AC-20 — Back to Member 360 button.**

Given the page has loaded, when the user clicks the "← Back to Member 360" button at top-left of the page header, then the app navigates to `/members/:memberId`. (Traces F-05, F-41.)

---

## §12 Verification

- **MCP test — RLS authority on `core_member_role` mutations.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), as a user with `org_admin` on org A, run `INSERT INTO core_member_role (member_id, role_id, organisation_id, start_date) VALUES (<orgA-member-id>, <orgA-role-type-id>, <orgA-org-id>, '2026-05-05')` and confirm success; repeat as a user without `org_admin` and confirm RLS deny. Same drill for `UPDATE core_member_role SET end_date = '2026-05-05' WHERE id = <row-id>`.
- **MCP test — `core_member_role_active_unique` enforcement.** Against dev-db, attempt to insert two rows with the same `(member_id, role_id, organisation_id)` and `end_date IS NULL`. Confirm the second INSERT fails with the unique-violation error.
- **MCP test — `valid_date_range` CHECK enforcement.** Against dev-db, attempt to UPDATE a role-history row with `end_date < start_date`. Confirm the CHECK rejects the row.
- **MCP test — `core_member_role` schema sanity.** Confirm via `information_schema.columns` that `core_member_role` has no `unit_id` column and no `deleted_at` column.
- **MCP test — `core_role_type` planned per-org UNIQUE migration readiness.** Confirm via `pg_indexes` that the global UNIQUE `team_formation_roles_name_key` is the live constraint on `core_role_type.name`. The slice authors against the planned UNIQUE `(name, organisation_id)`; the migration is documented in §15.
- **MCP test — `rbac_app_pages` row for `member-roles`.** Confirm post-build seeding adds the row for `page_name = 'member-roles'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` before release.
- **In-app demo — Add role happy path.** Navigate to `/members/<known-member-id>/roles` as an org admin. Click "Add role". Choose a role type the member does not currently hold active. Click Submit. Verify the modal closes, the role-history table refreshes with the new active row at the top, and a success toast renders.
- **In-app demo — Add role active-uniqueness pre-validation.** In the same modal, choose a role type the member already holds active. Verify the helper text "This member already has an active role of this type." appears under the role-type select and Submit is disabled.
- **In-app demo — End role.** From the role-history table, click the End-role row action on an active row. Verify the confirmation dialog title, description, and date-picker default match BR-11 / F-33. Click "End role". Verify the table refreshes (Status flips to "Ended") and a success toast renders.
- **In-app demo — End role date validity.** Open the End-role dialog and pick a date earlier than the row's start date. Verify the helper text and Confirm-disabled state per BR-12.
- **In-app demo — Cross-org navigation.** Navigate directly to `/members/<some-other-org-member-id>/roles`. Verify the "Member not found" page renders.
- **In-app demo — Org switch.** With the page open for a member in org A, switch the org context to a different org B in which that member does not exist. Verify the org-mismatch alert renders.

---

## §13 Testing requirements

- **Concurrency test (Add role active-uniqueness race).** Two concurrent Add-role submits for the same `(member_id, role_id, organisation_id)` with `end_date IS NULL`: simulate User A and User B both submitting the same role type for the same member at the same time. Verify the second-completing INSERT fails with the partial-unique-index violation and the BR-9 toast copy renders for that user.
- **Concurrency test (End role race).** Two concurrent End-role confirms on the same active row: verify the second-completing UPDATE either overwrites the first `end_date` (last-write-wins) or affects zero rows (because the WHERE-clause `end_date IS NULL` predicate now fails). Either outcome is acceptable; the slice does not warn the user.
- **Negative test — `canUpdate === false`.** With a user who has `read:page.member-roles` but lacks `update:page.member-roles`, verify the "Add role" button is hidden and no End-role row trigger renders on any row.
- **Negative test — empty role-type lookup.** With an org that has zero `core_role_type` rows seeded, verify the "Add role" button renders disabled with the BR-19 helper text and the End-role row triggers on existing rows are unaffected.

Otherwise, n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads, INSERTs, and UPDATEs go via `useSecureSupabase().from(...)`. Do not call `createClient` directly. Do not reach for any client that bypasses RBAC scope resolution.
- The slice does not author any RLS migration on `core_member_role`. The live policies already work for org admins on dev.
- The slice does not author the planned `core_role_type` per-org UNIQUE migration. The migration is upstream platform work; the slice cites the planned constraint per §15 / §17.
- Do not implement role-type CRUD. The slice consumes `core_role_type` Select-only.
- Do not implement hard delete on `core_member_role`. End-role (`end_date`) is the only "remove" path.
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- Do not introduce a `unit_id` payload on Add-role INSERTs. The column does not exist on live dev.
- Do not add a `deleted_at` predicate to any `core_member_role` read. The column does not exist on live dev.

---

## §15 Done criteria

- All 20 acceptance criteria (AC-01 through AC-20) verified via the slice's QA pack.
- **Implementation gate — `core_role_type` per-org UNIQUE migration.** The Add-role flow authors against the **planned** UNIQUE `(name, organisation_id)` constraint on `core_role_type`. The current dev shape carries a global UNIQUE `team_formation_roles_name_key` on `name` alone, which is internally inconsistent with the per-org `organisation_id NOT NULL` design. The planned migration drops `team_formation_roles_name_key` and adds UNIQUE `(name, organisation_id)`. The migration is non-breaking on dev (4 rows, 1 org — no conflicts). Day-1 read behaviour is unaffected; this gate is documented for traceability and to inform the future role-type CRUD slice (which will create new rows). The v6 slice does **not** author the migration.
- **Verification step — `core_member_role` schema sanity.** Re-run the MCP query in §12 against dev-db. Confirm `core_member_role` has no `unit_id` column and no `deleted_at` column. If either column exists on dev, stop and surface as a blocker — the slice's payloads and read filters assume the live shape documented in §8.
- Post-build RBAC seeding reminder: `rbac_app_pages` must include the row for `page_name = 'member-roles'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` (post-build seeding pass per architecture).

---

## §16 Do not

- **Do not implement role-type CRUD** (create / edit / delete `core_role_type` rows). v1 reads role types Select-only. Creation, edit, and delete are deferred to a follow-up slice — likely an org-level role-type management page under `/settings/roles` or part of an extended TEAM-06-style settings cluster. See §17 References.
- **Do not hard-delete role history rows.** The UI never offers a DELETE affordance, even though the live `rbac_delete_core_member_role` policy permits it for org admins. Ended roles remain visible for audit history; "remove" is achieved only via the End-role action (`end_date`).
- **Do not introduce a `team_unit` legacy construct** anywhere in this slice. TEAM-04 owns no unit / team / squad concept. The live `core_member_role` schema has no `unit_id` column; do not attempt to write or filter by it.
- **Do not pass `unit_id` in the Add-role INSERT payload.** The column does not exist on live dev. Any attempt to write it will fail with a column-not-found error.
- **Do not include a `deleted_at` predicate in any `core_member_role` read.** The column does not exist on live dev. Filtering on it returns no rows in some PostgREST configurations and unhelpful behaviour in others; the slice's read contracts omit it entirely.
- **Do not implement custom RBAC checks.** Use only `<PagePermissionGuard pageName="member-roles" operation="read">` and `useResourcePermissions('member-roles')` per §10.
- **Do not introduce an acting-user-is-target gating** on TEAM-04. The slice has no Portal CTA; standard `useResourcePermissions('member-roles').canUpdate` is sufficient for action gating.
- **Do not pass a `scope` prop to `PagePermissionGuard`.** Scope is resolved internally from `OrganisationServiceProvider`.
- **Do not patch audit columns** (`created_at`, `updated_at`, `created_by`, `updated_by`) from the client. Server defaults / triggers populate these.
- **Do not import from internal `packages/core/src/*` paths.** Use published sub-paths only.
- **Do not run any verification or smoke test against production.** Non-prod only: MCP catalogue queries use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); browser/runtime uses `SUPABASE_PROJECT_REF`.
- **Do not introduce optimistic locking or `updated_at` watermark checks.** Concurrency is last-write-wins for v1.
- **Do not surface an inline role-type create form** inside the Add-role modal in v1. The Role type select is select-only; creation lives in the future role-type CRUD slice.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; org-scoped admin surfaces; no Portal handoff for this slice.
- `/rebuild/architecture.md` — slice ownership, route registry, canonical `pageName` map (`member-roles` for `/members/:memberId/roles`), Standing roles bounded context.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu, and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`**, so any descendant route (including this slice) can call `toast(...)`. TEAM-04 depends on this mount; without it, `toast(...)` throws.
- **TEAM-02** — owns the directory list at `/members`. TEAM-04's "← Back to members" buttons (Member-not-found page; Org-mismatch alert) navigate there.
- **TEAM-03** — owns the Member 360 detail surface at `/members/:memberId`. TEAM-03's "View roles ›" button navigates here using `core_member.id`. TEAM-04's "← Back to Member 360" button navigates back to `/members/:memberId`.
- **Future slice — org-level role-type CRUD.** Role-type management (create / edit / delete `core_role_type` rows) is deferred to a follow-up slice, likely under `/settings/roles` or as part of an extended TEAM-06-style settings cluster. Until that slice ships, the seed for `core_role_type` per organisation is managed via direct DB seed or service-role tooling. TEAM-04 consumes role types Select-only.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `PagePermissionGuard` page-level gate; `data_check_rbac_permission_with_context` helper. **Future cross-app convergence note (informational, not blocking v1):** `core_member_role` INSERT / UPDATE / DELETE RLS policies currently use `is_super_admin OR check_user_is_org_admin(organisation_id)`. Future migration candidate: extend `core_member_role` to RBAC-checked RLS template per this standards file, mirroring the TEAM-06 / TEAM-07 pattern. Not required for v1.
- **Implementation gate — `core_role_type` per-org UNIQUE migration (informational).** The dev shape on `core_role_type` carries `organisation_id NOT NULL` per row but a global UNIQUE on `name` (`team_formation_roles_name_key`). Future migration: drop the global UNIQUE and add UNIQUE `(name, organisation_id)`. Migration is non-breaking on dev (4 rows, 1 org — no conflicts). The v6 slice authors against the planned constraint; it does not author the migration. Day-1 read behaviour is unaffected. The future role-type CRUD slice (above) will depend on the planned constraint for safe per-org create flows.
- `pace-core2/packages/core/docs/database/domains/team.md` — `core_member_role`, `core_role_type` shapes.
- DB-decision: `core_member_role` partial-unique active index (`core_member_role_active_unique`) — the canonical mechanism enforcing one active role per `(member_id, role_id, organisation_id)`.
