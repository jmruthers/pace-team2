# TEAM-02 — Member directory

## §1 Slice metadata

```
Slice ID:        TEAM-02
Name:            Member directory
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems)
Backend impact:  Schema changes (upstream platform: extend team_member_request_type enum with 'join'/'transfer'; extend team_member_request_status enum with 'on_hold'; update app_submit_member_request, app_resolve_member_request, app_withdraw_member_request RPCs accordingly — see §15 implementation gate)
Frontend impact: UI
Routes owned:    /members
QA pack:         docs/test-packs/TM02-qa-pack.md
```

---

## §2 Overview

TEAM-02 delivers the member directory for org-admin staff at `/members`. The page renders two tabs — Members (active and suspended members of the currently selected organisation) and Pending join & transfer (provisional members whose join or transfer request is awaiting resolution) — with text search, membership-type filtering on the Members tab, sortable columns, pagination, and row navigation to Member 360 at `/members/:memberId`. The same route doubles as a multi-select picker for the communications composer: when entered with `location.state.intent === 'commsManualPick'`, the page swaps to picker mode, surfaces a selection checkbox column on the Members tab, and on Done writes the chosen member ids to `sessionStorage` for TEAM-13 to read on `/communications`. The slice is read-only — no creates, updates, or deletes happen on this surface — route read is enforced by shell `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts).

**Prototype reference:** `pace-prototype/apps/pace-team/pages/MemberPages.jsx` — `MembersPage` (directory at `/members`), `MemberInvitePage` (invite flow at `/members/invite`).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single, fast surface to find any member of their currently selected organisation, to navigate into a member's full profile, and to assemble an ad-hoc audience for a comms send. TEAM-02 produces that surface. The directory does not handle membership creation, status transitions, role assignments, or comms composition — those live in adjacent slices — so this surface is intentionally narrow: search, filter, sort, paginate, click through.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Member directory — Members tab (default) | `/members` | Active and Suspended `core_member` rows for the current organisation |
| Member directory — Pending tab | `/members` | Provisional `core_member` rows for the current organisation that have an open join or transfer `team_member_request` |
| Comms picker mode | `/members` (entered with `location.state.intent === 'commsManualPick'`) | Members tab only; selection checkbox column; sticky banner; sticky bottom action bar with Done and Cancel |

### Boundaries

TEAM-02 does **not** own:
- The Member 360 detail surface at `/members/:memberId` — that is TEAM-03.
- Role assignment or role display logic — that is TEAM-04.
- Member-request review and resolution (the queue at `/approvals`) — that is TEAM-05.
- Comms composer state, recipient deduplication, or send orchestration on `/communications` — that is TEAM-13. TEAM-02 only writes the picker payload to `sessionStorage`; TEAM-13 reads-and-clears it.
- Any mutation on `core_member`, `core_person`, or `team_member_request`. The directory is read-only.
- Any view of `Resigned`, `Lapsed`, or `Revoked` members — these statuses are not surfaced in v1.
- The schema migration that extends `team_member_request_type` and `team_member_request_status` enums and updates the related RPCs — that is upstream platform work (see §15).

### Architectural posture

**Read-only surface.** Every data path in this slice is a SELECT via `useSecureSupabase()`. There are no `insert`, `update`, or `delete` calls. There are no `useResourcePermissions('members')` checks — shell route read is the sole route gate, since no row-level affordance on this page mutates data.

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**Filter execution model (Option A — membership at issuing org).** Members tab: include `core_member` rows where `deleted_at IS NULL`, `membership_status IN ('Active','Suspended')`, and the member is visible at the selected org via an active `core_member_role` placement (`organisation_id = selectedOrganisation.id`, `end_date IS NULL`) **or** flat-org membership (`core_member.organisation_id = selectedOrganisation.id` when no separate placement row exists). Pending tab: request-first — open `team_member_request` rows at `organisation_id = selectedOrganisation.id` joined to `core_member` via `subject_member_id` (membership row lives at the issuing/root org, not necessarily the selected sub-org). Pending includes second-placement requests where the issuing-org `core_member` may already be `Active`. Members tab also filters `membership_type_id` when the membership-type filter is active. Client-side: free-text search across last name, first name, preferred name, email, and membership number.

**Picker mode.** Activated only when `location.state.intent === 'commsManualPick'` is set on the navigation that brought the user to `/members`. A `?pick=comms` query string alone is **not** sufficient. On entry the slice reads `sessionStorage['pace:team:comms:manual-pick']`; if the payload exists and `payload.organisationId === selectedOrganisation.id`, `selectedIds` is hydrated from `payload.memberIds`, otherwise selection starts empty. The Pending tab is hidden in picker mode. On Done, the slice writes `{ organisationId: selectedOrganisation.id, memberIds: selectedIds, updatedAt: Date.now() }` to `sessionStorage['pace:team:comms:manual-pick']` and navigates to `/communications`. On Cancel, the slice navigates to `/communications` without writing the payload (and without clearing any prior payload). TEAM-13 reads-and-clears the key on `/communications` mount.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (org-switch in picker mode). `ToastProvider` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it.

**Page metadata.** `usePaceMain({ printTitle: 'Members' })` is called on page mount.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

### Page-level guards and evaluation ordering

The route `/members` sits inside `AuthenticatedShell` (TEAM-01) registers read access in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts); shell `routeAccessDenied` enforces entry. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; no feature content or guard is shown.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state from TEAM-01. shell route read is not evaluated; no RBAC query fires.
4. **Route read access** — Once org context is resolved, shell `routeAccessDenied` (via [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts)) evaluates the route's registered `pageName` / `read` permission. Scope resolves internally from `OrganisationServiceProvider`; no page-level read guard wraps the component tree. While the shell RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable. On deny, `<AccessDenied />` renders in the shell main region. On allow, the page body renders.

If `selectedOrganisation` somehow resolves to `null` after step 3 (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/members` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.members` permission.
- **F-02** On entry, the page sets `printTitle` to "Members" via `usePaceMain`.
- **F-03** The page title is "Members" (sentence case). No breadcrumb is rendered.
- **F-04** The page renders two tabs in this order — **Members** (default, active) and **Pending** — except in picker mode, where only the Members tab is rendered.
- **F-05** On entry, the Members tab issues SELECT(s) against `core_member` joined to `core_person` (and optionally `core_membership_type`), scoped to the selected org via active `core_member_role` placement and/or flat-org `core_member.organisation_id = selectedOrganisation.id`, with `deleted_at IS NULL` and `membership_status IN ('Active','Suspended')`, ordered by `core_person.last_name` asc, `core_person.first_name` asc.
- **F-06** When the Pending tab is opened, the page issues a SELECT against open `team_member_request` rows for `organisation_id = selectedOrganisation.id` with `status IN ('pending','on_hold')` and `request_type IN ('join','transfer')`, joined to `core_member` on `subject_member_id` (and `core_person`). Rows render when the open request exists; `core_member.organisation_id` may be the issuing/root org. Second-placement requests with an already-`Active` issuing-org member are included.
- **F-07** Picker mode is active when `location.state.intent === 'commsManualPick'` is set on the navigation that brought the user to `/members`. The `?pick=comms` query string alone does not activate picker mode.
- **F-08** When picker mode is active and `selectedOrganisation` is set, the slice reads `sessionStorage['pace:team:comms:manual-pick']`. If a payload exists and `payload.organisationId === selectedOrganisation.id`, `selectedIds` is hydrated from `payload.memberIds`. Otherwise `selectedIds` starts empty.

### Loading states

- **F-09** While the Members or Pending list query is in flight, the corresponding tab's `DataTable` renders its built-in loading state: a Card → Table → TableCaption (title + description + toolbar) → a single full-width row containing `<LoadingSpinner label="Loading table" />`. Switching tabs does not cancel the other tab's data when prefetched.
- **F-10** While the page-level RBAC check is in flight, a brief blank inside the PaceMain content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).

### Empty states

- **F-11** Members tab with zero rows for the current org renders an empty state inside the `DataTable`: heading "No active or suspended members yet." and description "New members appear here once approved via /approvals." No CTA. The toolbar (search, filters) remains visible above the empty area.
- **F-12** Pending tab with zero rows for the current org renders an empty state inside the `DataTable`: heading "No pending members." and description "New join requests appear here once submitted via your org signup form." No CTA.

### Error states

- **F-13** When a list query fails, the corresponding tab's `DataTable` is not rendered; instead the tab's content area renders an inline `<Alert variant="destructive">` with title "Could not load members" (Members tab) or "Could not load pending members" (Pending tab), description set from the normalised error returned by `HandleSupabaseError`, and a Retry button alongside that re-runs the query. The page also calls `HandleSupabaseError(error, { context: 'core_member' })` (or `'team_member_request'` for the Pending tab) for normalised logging.
- **F-14** A user without `read:page.members` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).

### Primary content — Members tab

- **F-15** The Members tab `DataTable` renders one row per `core_member` row for the current org with `membership_status IN ('Active','Suspended')` and `deleted_at IS NULL`, in the columns and order: **Name**, **Membership #**, **Membership status**, **Membership type**.
- **F-16** The **Name** column shows `core_person.preferred_name` followed by `core_person.last_name` when `preferred_name` is non-empty; otherwise `core_person.first_name` followed by `core_person.last_name`. Default sort key is `core_person.last_name` asc, then `core_person.first_name` asc (BR-04).
- **F-17** The **Membership #** column shows `core_member.membership_number` as plain text, or an em-dash ("—") when `null`.
- **F-18** The **Membership status** column shows a badge: "Active" (default tone) when `membership_status === 'Active'`, "Suspended" (muted tone) when `membership_status === 'Suspended'`. The column is sortable; sorting groups Active rows together and Suspended rows together.
- **F-19** The **Membership type** column shows `core_membership_type.name` as plain text, or an em-dash ("—") when `core_member.membership_type_id` is null.
- **F-20** The `DataTable.description` for the Members tab reads `"{count} members"` where `{count}` is the unfiltered server-result count for the current org. When the Members tab has zero rows, the description reads `"0 members"`.

### Primary content — Pending tab

- **F-21** The Pending tab `DataTable` renders one row per Provisional `core_member` row for the current org with an open `team_member_request` (`status IN ('pending','on_hold')`, `request_type IN ('join','transfer')`), in the columns and order: **Name**, **Membership #**, **Membership type**, **Requested**, **Request type**.
- **F-22** The **Name**, **Membership #**, and **Membership type** columns follow the same rendering rules as the Members tab (F-16, F-17, F-19).
- **F-23** The **Requested** column shows the matching `team_member_request.created_at` formatted as a localised short date (e.g. "5 May 2026"). When multiple open requests exist for the same member, the most recent `created_at` is shown.
- **F-24** The **Request type** column shows a badge whose label is the `team_member_request.request_type` value rendered in title case ("Join" or "Transfer").
- **F-25** The `DataTable.description` for the Pending tab reads `"{count} pending members"` where `{count}` is the unfiltered server-result count for the current org's Pending view.

### Primary actions

- **F-26** **Row click — normal mode (Members tab).** Clicking anywhere on a row in the Members tab when picker mode is not active navigates to `/members/:memberId` using `core_member.id` (BR-06). No secondary row actions render in v1.
- **F-27** **Row click — normal mode (Pending tab).** Clicking anywhere on a row in the Pending tab navigates to `/members/:memberId` using `core_member.id`.
- **F-28** **Row click — picker mode.** Clicking anywhere on a row in picker mode toggles that row's selection state. The row does not navigate. The selection checkbox in the leftmost column reflects the current state and is also clickable.
- **F-29** **Done — picker mode.** When `selectedIds.length` is between 1 and 2000 inclusive, the Done button is enabled. Clicking Done writes `{ organisationId: selectedOrganisation.id, memberIds: selectedIds, updatedAt: Date.now() }` to `sessionStorage['pace:team:comms:manual-pick']`, then navigates to `/communications`. Done does not put member ids in the URL (BR-10).
- **F-30** **Cancel — picker mode.** Clicking Cancel navigates to `/communications` without writing the picker payload. The slice does not clear any prior payload from `sessionStorage` on Cancel; TEAM-13 reads-and-clears the key on `/communications` mount.

### Secondary actions

- **F-31** **Search.** A toolbar text-search input (rendered by `DataTable`) filters the in-memory rows of the active tab by case-insensitive substring across last name, first name, preferred name, email, and membership number. Clearing the input restores the unfiltered list.
- **F-32** **Membership-type filter — Members tab only.** The Members tab's toolbar offers a Membership-type filter sourced from `core_membership_type` rows for the current org with `is_active = true`. When a type is selected, the server query adds `membership_type_id = :id`; "All" clears the filter. The Pending tab does not surface the membership-type filter.
- **F-33** **Sort.** Each column header on each tab is sortable. The default sort is **Name** ascending using the (last name, first name) sort key from BR-04; subsequent clicks toggle asc/desc/none on that column.
- **F-34** **Pagination.** `initialPageSize` is `25`; page size options are `[10, 25, 50]`. The current page indicator and prev/next controls are rendered by `DataTable` below the table.
- **F-35** **No import / export / hierarchical / grouping affordances** are surfaced. The toolbar's pace-core2 default features for Import, Export, hierarchical toggles, and grouping are disabled by setting `features.import: false`, `features.export: false`, `features.hierarchical: false`, `features.grouping: false`, `features.creation: false`, `features.editing: false`, `features.deletion: false`, `features.deleteSelected: false`. The `selection` feature is `false` in normal mode and `true` only on the Members tab in picker mode.

### Permission-conditional rendering

- **F-36** When `read:page.members` is denied, the `PagePermissionGuard` renders `<AccessDenied />` and no tab, table, or toolbar renders.
- **F-37** When `read:page.members` is allowed, both tabs render in normal mode and the Members tab alone renders in picker mode. No row-level permission check fires from this slice — row click navigates to `/members/:memberId` and any further authorisation is the responsibility of TEAM-03.

### Navigation

- **F-38** The page is reachable from the TEAM-01 navigation menu via the **Members** entry (`/members`).
- **F-39** Row click in normal mode navigates to `/members/:memberId` (TEAM-03).
- **F-40** Done in picker mode navigates to `/communications` (TEAM-13) after writing the sessionStorage payload.
- **F-41** Cancel in picker mode navigates to `/communications` without writing the payload.

### Edge cases and constraints

- **F-42** **Org switch — normal mode.** When `selectedOrganisation` changes, both tabs refetch against the new org. Any in-flight query for the previous org is discarded.
- **F-43** **Org switch — picker mode.** When `selectedOrganisation` changes while picker mode is active, `selectedIds` is cleared to an empty array, the lists refetch against the new org, and a `default`-variant toast renders with copy "Selection cleared — organisation changed." (BR-11).
- **F-44** **Picker — empty selection.** When `selectedIds.length === 0`, the Done button is disabled and the action bar shows the helper copy "Select at least one member." (BR-09).
- **F-45** **Picker — soft cap.** When `selectedIds.length > 500 && selectedIds.length <= 2000`, the Done button remains enabled and the picker mode banner shows a non-blocking warning copy "Large audience — confirm you intend to message {count} members." (BR-09).
- **F-46** **Picker — hard cap.** When `selectedIds.length > 2000`, the Done button is disabled and the picker mode banner shows the error copy "Reduce selection to at most 2000 members." (BR-09).
- **F-47** **URL-only picker entry.** A user who navigates directly to `/members?pick=comms` without `location.state.intent === 'commsManualPick'` set on the navigation does not enter picker mode. The page renders normal-mode tabs (Members + Pending) (BR-07).
- **F-48** **Stale picker payload.** A user who enters picker mode while `sessionStorage['pace:team:comms:manual-pick']` exists for a different `organisationId` does not hydrate from that payload — `selectedIds` starts empty (BR-07).
- **F-49** **Provisional members without an open request.** A `core_member` row with `membership_status = 'Provisional'` but no matching open `team_member_request` is excluded from the Pending tab (BR-03). It does not render in any tab in v1.
- **F-50** **Cross-org leakage prevention.** Every list query carries a `core_member.organisation_id = selectedOrganisation.id` filter as a defensive belt-and-braces check against RLS regression (BR-12). Even if the filter were absent, RLS would still enforce per-org isolation.

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `OrgContextBar`, `PaceMain`, footer). `OrgContextBar` (TEAM-01) sits between the shell header and page content on `/members` and `/members/invite`.

Within `PaceMain`:

- **Page header** — `PageHeader` from `@solvera/pace-core/components` (or team-local wrapper matching prototype):
  - `title`: "Member directory" (sentence case).
  - `sub`: "Search, filter and review the people in your branch. Click a row to open Member 360."
  - `right`: primary `Button` "Invite member" navigating to `/members/invite` (hidden in comms picker mode).
- **Tabs row** — Below the page header, a `Tabs` root with `TabsList` containing two `TabsTrigger` controls in this order: **Members** (default, with optional count badge) and **Pending join & transfer** (with optional count badge). In picker mode only the Members trigger renders. The selected tab's `TabsContent` panel hosts the `DataTable` for that view. The `Tabs` value is held in slice-controlled state (`activeView`).
- **Tab panel content** — A single `DataTable` per tab, occupying the panel area. The `DataTable` provides its own internal toolbar, header row, body, and pagination controls inside its built-in `Card` wrapper.
- **Picker mode banner** — When picker mode is active, a banner renders **above** the Tabs row. The banner uses `<Alert variant="default">` with title "Selecting members for a comms send" and description `"{count} selected"`. When the soft cap (`> 500 && <= 2000`) is breached, the banner switches to title "Large audience" and description `"Confirm you intend to message {count} members."` — still `variant="default"`. When the hard cap (`> 2000`) is breached, the banner switches to `variant="destructive"` with title "Selection too large" and description "Reduce selection to at most 2000 members."
- **Members tab row selection (normal mode)** — When rows are selected on the Members tab outside picker mode, a bottom **bulk action bar** renders (prototype `tk-bulkbar` pattern): left shows `"{count} selected"`; right clusters secondary actions (e.g. Message, Add to event, Change status) gated by permissions. This bar is distinct from comms picker mode.
- **Picker mode action bar** — When picker mode is active, a sticky action bar renders at the bottom of the viewport, anchored beneath `PaceMain`'s normal scroll. The bar contains, left-aligned: a counter reading `"{count} selected"`. Right-aligned: two buttons — `Cancel` (secondary variant) and `Done` (primary variant). The `Done` button is disabled when `selectedIds.length === 0` or `selectedIds.length > 2000`. When `selectedIds.length === 0` the bar also shows the helper text "Select at least one member." next to the disabled Done button.

The picker banner is sticky to the top of the `PaceMain` content area (it scrolls with content above it but pins to the top once it would scroll out of view). The picker action bar is sticky to the bottom of the viewport.

**Invite member page (`/members/invite`)** — Standalone route (prototype promoted invite from modal to full page). Layout:
- `PageHeader` with `title` "Invite a new member", `sub` "We'll email them a self-service join link prefilled with this branch.", `right` ghost `Button` "Back to members" → `/members`.
- Single `Card` (or `section` grid) with invite form fields (first name, last name, email, unit/sub-org, membership type). Primary submit in `CardFooter` or `PageSaveBar` labelled per intent (e.g. "Send invitation"). No `Dialog` for create on the directory page itself.

### Layout acceptance criteria (prototype alignment)

- [ ] `/members` renders `PageHeader` with title "Member directory", descriptive subtitle, and header CTA "Invite member" → `/members/invite` (when not in comms picker mode).
- [ ] `OrgContextBar` breadcrumb renders above page content per TEAM-01.
- [ ] Tab labels are **Members** and **Pending join & transfer** (with optional count badges).
- [ ] Members tab uses `DataTable` with search; row activate navigates to `/members/:memberId`.
- [ ] Multi-select on Members tab shows prototype-style bottom bulk bar (not comms-picker banner/footer) when not in `commsManualPick` mode.
- [ ] `/members/invite` is a standalone page with `PageHeader` and back navigation — not an in-page modal on `/members`.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- `MemberDirectoryPage.tsx` uses plain `<h1>Members</h1>` instead of `PageHeader` ("Member directory" + subtitle + Invite CTA).
- Tab trigger copy is "Pending" not "Pending join & transfer".
- No `/members/invite` route or `MemberInvitePage` equivalent.
- Comms picker mode uses sticky `Alert` + sticky footer (Done/Cancel); prototype normal mode uses row-selection bulk bar — production conflates selection UX with picker-only flow.
- No header "Invite member" action; no `OrgContextBar` integration called out in slice implementation (shell may still render it once TEAM-01 pass 2 lands).

Breakpoints: standard pace-core2 responsive behaviour applies. The `DataTable` shows a horizontal scroll on narrow viewports rather than collapsing to a card list. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Components

**`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`** (`@solvera/pace-core/components`)
- Purpose: switch between Members and Pending views.
- `Tabs` props: `value={activeView}`, `onValueChange={setActiveView}`. Initial `activeView` is `'members'`.
- `TabsList` renders a `<nav>` containing the trigger controls left-aligned.
- `TabsTrigger` controls — Members trigger has `value="members"` and label "Members"; Pending trigger has `value="pending"` and label "Pending". In picker mode only the Members trigger renders.
- `TabsContent` panels — `value="members"` panel hosts the Members `DataTable`; `value="pending"` panel hosts the Pending `DataTable`. Only the active panel is visible at a time.

**Members tab `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list active and suspended members of the current organisation with search, sort, and pagination.
- `data`: array of joined rows (`core_member` + `core_person` + `core_membership_type`) returned by the server query, after the client-side search filter is applied.
- `rbac.pageName`: `'members'`.
- `title`: omitted (the page title sits above the tabs).
- `description`: `"{count} members"` (where `{count}` is the unfiltered server-result count for the current org).
- `isLoading`: bound to the Members list query's loading state.
- `emptyState`: `{ title: "No active or suspended members yet.", description: "New members appear here once approved via /approvals." }`.
- `getRowId`: `(row) => row.id`.
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'last_name', desc: false }, { id: 'first_name', desc: false }]`.
- `actions`: empty — row click handles navigation via the slice's row-click handler (no per-row buttons).
- `onCreateRow`, `onEditRow`, `onDeleteRow`: not used.
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, creation: false, editing: false, deletion: false, deleteSelected: false, search: true, pagination: true, sorting: true, filtering: true, columnVisibility: true, columnReordering: true, selection: <pickerActive> }`. `selection` is `true` only when picker mode is active.
- `selection`: controlled `Record<string, boolean>` derived from `selectedIds` when picker mode is active; `undefined` otherwise.
- `onRowSelectionChange`: updates `selectedIds` from the next selection state when picker mode is active; not wired otherwise.

Members tab columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Name | `core_person.preferred_name`/`first_name` + `last_name` (composed per F-16) | flexible | Sortable; default sort uses (last name asc, first name asc) per BR-04. Plain text rendering; no avatar. |
| Membership # | `core_member.membership_number` | narrow | Plain text; em-dash ("—") when `null`. Sortable. |
| Membership status | `core_member.membership_status` | narrow | Badge: "Active" (default tone) or "Suspended" (muted tone). Sortable; sort groups Active rows together and Suspended rows together. |
| Membership type | `core_membership_type.name` | narrow-medium | Plain text; em-dash ("—") when `core_member.membership_type_id` is `null`. Per-column filter (toolbar membership-type filter populates options from `core_membership_type` rows for the current org with `is_active = true`). |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search members". Filters across last name, first name, preferred name, email, membership number (BR-05).
- Membership-type filter — dropdown with options "All" plus one option per active type for the current org. Selection drives the server query refetch (`membership_type_id = :id`).
- Column-visibility popover (default `DataTable` affordance).
- The toolbar does not show Create / Import / Export / Delete buttons — features are off.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

In picker mode, a checkbox column is rendered as the leftmost column by `DataTable` (controlled by `features.selection: true`); the cell shows a checkbox bound to that row's selection state.

**Pending tab `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list provisional members of the current organisation whose join or transfer request is open.
- `data`: array of joined rows (`core_member` + `core_person` + `core_membership_type` + `team_member_request`) returned by the server query, after the client-side search filter is applied.
- `rbac.pageName`: `'members'`.
- `description`: `"{count} pending members"`.
- `isLoading`: bound to the Pending list query's loading state.
- `emptyState`: `{ title: "No pending members.", description: "New join requests appear here once submitted via your org signup form." }`.
- `getRowId`: `(row) => row.id` (where `row.id` is `core_member.id`).
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'last_name', desc: false }, { id: 'first_name', desc: false }]`.
- `actions`: empty.
- `features`: same as Members tab but `selection: false` always (Pending tab is hidden in picker mode).

Pending tab columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Name | `core_person.preferred_name`/`first_name` + `last_name` | flexible | Sortable; default sort (last name asc, first name asc). |
| Membership # | `core_member.membership_number` | narrow | Plain text; em-dash when `null`. |
| Membership type | `core_membership_type.name` | narrow-medium | Plain text; em-dash when `null`. |
| Requested | `team_member_request.created_at` (most recent open request) | narrow | Localised short date (e.g. "5 May 2026"). Sortable. |
| Request type | `team_member_request.request_type` | narrow | Badge: "Join" or "Transfer" (title case). |

Toolbar: same as Members tab minus the Membership-type filter.

**Picker mode banner** (`@solvera/pace-core/components` — `Alert`)
- When `selectedIds.length` is in `[0, 500]`: `<Alert variant="default">` with `<AlertTitle>Selecting members for a comms send</AlertTitle>` and `<AlertDescription>{count} selected</AlertDescription>`.
- When `selectedIds.length` is in `(500, 2000]`: `<Alert variant="default">` with `<AlertTitle>Large audience</AlertTitle>` and `<AlertDescription>Confirm you intend to message {count} members.</AlertDescription>`.
- When `selectedIds.length > 2000`: `<Alert variant="destructive">` with `<AlertTitle>Selection too large</AlertTitle>` and `<AlertDescription>Reduce selection to at most 2000 members.</AlertDescription>`.

**Picker mode action bar**
- Renders as a sticky element at the bottom of the viewport, full-width within `PaceMain`'s width constraint.
- Left side: a counter span reading `"{count} selected"`. When `selectedIds.length === 0`, an additional helper text reads "Select at least one member." after the counter.
- Right side: a `Button` with text `"Cancel"` (default / secondary visual) followed by a `Button` with text `"Done"` (primary visual). The Done button is disabled when `selectedIds.length === 0` or `selectedIds.length > 2000`.

**Error state — list query failure**
- Replaces the failing tab's `DataTable` with an `<Alert variant="destructive">` containing `<AlertTitle>Could not load members</AlertTitle>` (Members tab) or `<AlertTitle>Could not load pending members</AlertTitle>` (Pending tab) and `<AlertDescription>` populated from the normalised `HandleSupabaseError` message. Below the Alert renders a `Button` with text `"Retry"` (default / primary visual) that re-runs the list query.

**Toasts** — surfaced via the module-level `toast({ title, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'default'` (org-switch in picker mode). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### States

- **Loading (Members tab)** — `DataTable` renders Card + Table + TableCaption (title + `"{count} members"` description + toolbar) + a single full-width row with `<LoadingSpinner label="Loading table" />`.
- **Loading (Pending tab)** — `DataTable` renders the same loading shape with description `"{count} pending members"`.
- **Empty (Members tab)** — `DataTable` renders the empty state heading "No active or suspended members yet." and description "New members appear here once approved via /approvals." inside the table area. The toolbar (search) remains visible above the empty area.
- **Empty (Pending tab)** — `DataTable` renders the empty state heading "No pending members." and description "New join requests appear here once submitted via your org signup form."
- **Error (list query failure)** — The failing tab's `DataTable` is replaced by the destructive `Alert` + Retry button described above.
- **Permission denied** — `<AccessDenied />` in `PaceMain` with TEAM-01 chrome (header, footer) visible.
- **Picker — no selection** — Banner shows `"0 selected"`. Bottom action bar shows `"0 selected"`, helper text "Select at least one member.", and a disabled Done button.
- **Picker — selection in range (1–500)** — Banner reads `"{count} selected"`. Bottom action bar shows `"{count} selected"` and an enabled Done button.
- **Picker — soft cap (501–2000)** — Banner reads "Large audience — Confirm you intend to message {count} members." Bottom action bar's Done button remains enabled.
- **Picker — hard cap (>2000)** — Banner switches to destructive variant with title "Selection too large" and description "Reduce selection to at most 2000 members." Bottom action bar's Done button is disabled.
- **Org switch — picker mode active** — Banner and counters reset to `"0 selected"`; a `default`-variant toast renders with copy "Selection cleared — organisation changed."

### Interactions

- **Tab switch** — Click on a `TabsTrigger` updates `activeView` and exposes the corresponding `TabsContent` panel. The DataTable for the newly active tab uses its own list query state (data, loading, error). Switching back and forth does not re-run the queries unnecessarily.
- **Row click — normal mode** — Hover: row receives the `DataTable` default hover treatment. Click: navigates to `/members/:memberId` using `core_member.id`.
- **Row click — picker mode** — Click anywhere on a row toggles its selection. The row receives a selected visual state (DataTable default for selected rows). The leftmost checkbox cell reflects the same state and is also clickable.
- **Search input** — Typing filters table rows in the active tab in real time with no submit step. Clearing the input restores the unfiltered list. Search applies only to the active tab; switching tabs does not carry the search string across.
- **Membership-type filter (Members tab)** — Selecting a type triggers a server refetch with `membership_type_id = :id`. Selecting "All" removes the filter and refetches.
- **Sort headers** — Click on a column header toggles asc/desc/none on that column. The (last name, first name) compound default sort applies on initial render for both tabs.
- **Pagination controls** — Page size dropdown changes rows per page on the active tab; prev/next change page index; current page indicator updates immediately.
- **Done button — picker mode** — Click writes the sessionStorage payload, then navigates to `/communications`. Disabled state ignores clicks.
- **Cancel button — picker mode** — Click navigates to `/communications` without writing the payload.
- **Toast** — On org switch in picker mode, the toast appears bottom-right and auto-dismisses after 5000 ms.

### Permission-conditional rendering

| Condition | Page entry | Tabs | Rows | Picker mode behaviour |
|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a |
| Authenticated, org, `read:page.members` denied | `<AccessDenied />` | Hidden | Hidden | n/a |
| Authenticated, org, `read:page.members` allowed, normal mode | Page visible | Members + Pending tabs visible | Row click navigates to `/members/:memberId` | n/a |
| Authenticated, org, `read:page.members` allowed, picker mode | Page visible | Members tab only | Row click toggles selection | Banner + sticky action bar visible; Done writes payload and navigates |

---

## §6 Business rules

**BR-01 — Org-scoped reads.**
- Input: any list query in this slice.
- Output: every query filters `core_member.organisation_id = selectedOrganisation.id` and `core_member.deleted_at IS NULL`. Cross-org rows are never returned.
- Edge: a current org with zero matching rows returns an empty array; rows from another org are not returned even if RLS were misconfigured (defensive).

**BR-02 — Members view membership-status filter.**
- Input: a Members tab list query.
- Output: include rows WHERE `core_member.membership_status IN ('Active', 'Suspended')`. Exclude `Provisional`, `Lapsed`, `Resigned`, `Revoked`.

**BR-03 — Pending view filter.**
- Input: a Pending tab list query.
- Output: include `core_member` rows for the current org WHERE `core_member.deleted_at IS NULL` AND `core_member.membership_status = 'Provisional'` AND there exists at least one `team_member_request` row for the same `organisation_id` and matching the member by `subject_member_id = core_member.id` (or by `subject_person_id = core_member.person_id` when `subject_member_id IS NULL`) with `team_member_request.status IN ('pending','on_hold')` AND `team_member_request.request_type IN ('join','transfer')`.
- Edge: a Provisional `core_member` row with no matching open request is excluded from the Pending tab in v1 (data-quality edge case — orphan handling).

**BR-04 — Default sort.**
- Input: any list query in this slice.
- Output: rows are returned ordered by `core_person.last_name` asc, then `core_person.first_name` asc. The DataTable default `initialSorting` is the same compound key.

**BR-05 — Filter and search semantics.**
- Server-side filters: `core_member.organisation_id`, `core_member.deleted_at IS NULL`, per-view `membership_status` (BR-02 / BR-03), and on the Members tab `core_member.membership_type_id` when the membership-type filter is active.
- Client-side filter: free-text search across `core_person.last_name`, `core_person.first_name`, `core_person.preferred_name`, `core_person.email`, and `core_member.membership_number`. The search performs case-insensitive substring matching against the in-memory rows returned by the server query.
- Edge: a search string that matches no rows results in zero visible rows; switching tabs does not carry the search string between tabs.

**BR-06 — Row navigation in normal mode.**
- Input: a click on any row in either tab when picker mode is not active.
- Output: navigate to `/members/:memberId` using `core_member.id`. No secondary row actions are exposed in v1.

**BR-07 — Picker mode entry and selection hydration.**
- Input: a navigation to `/members` and any prior `pace:team:comms:manual-pick` payload already in `sessionStorage`.
- Output: picker mode activates only when `location.state.intent === 'commsManualPick'` is set on the navigation. When picker mode activates, the slice reads `sessionStorage['pace:team:comms:manual-pick']`. If a payload exists and `payload.organisationId === selectedOrganisation.id`, `selectedIds` is initialised from `payload.memberIds`. Otherwise `selectedIds` is initialised to an empty array. The `?pick=comms` query string alone does not activate picker mode.

**BR-08 — Picker mode interaction model.**
- Input: row click and checkbox click in picker mode.
- Output: a selection checkbox column renders as the leftmost column of the Members `DataTable`. Row click toggles `selectedIds` membership for that row. Pending tab is hidden in picker mode.

**BR-09 — Picker selection caps.**
- Input: `selectedIds.length`.
- Output:
  - `selectedIds.length === 0` → Done button is disabled; helper copy "Select at least one member." renders next to Done.
  - `1 <= selectedIds.length <= 500` → Done button is enabled; banner reads "Selecting members for a comms send — {count} selected".
  - `500 < selectedIds.length <= 2000` → Done button remains enabled; banner reads "Large audience — Confirm you intend to message {count} members.".
  - `selectedIds.length > 2000` → Done button is disabled; banner switches to destructive variant with title "Selection too large" and description "Reduce selection to at most 2000 members.".

**BR-10 — Picker Done and Cancel.**
- Input: click on Done; click on Cancel.
- Output:
  - **Done:** if `selectedIds.length` is in `[1, 2000]`, write `{ organisationId: selectedOrganisation.id, memberIds: selectedIds, updatedAt: Date.now() }` to `sessionStorage['pace:team:comms:manual-pick']`, then call `navigate('/communications')`. Member ids are never placed in the URL.
  - **Cancel:** call `navigate('/communications')` without writing the payload. Do not clear any prior payload from `sessionStorage`. TEAM-13 reads-and-clears the key on `/communications` mount.

**BR-11 — Org-switch behaviour.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output: both lists refetch against the new org. In normal mode the user simply sees the new org's data. In picker mode, `selectedIds` is set to `[]`, the lists refetch, and a `default`-variant toast renders with copy "Selection cleared — organisation changed." No sessionStorage payload is written or cleared as part of org switch.

**BR-12 — RLS authority and defensive filtering.**
- Input: every SELECT in this slice.
- Output: RLS on `core_member` enforces `is_super_admin` OR `core_person.user_id = current user` OR org access via `core_member_role`. RLS on `team_member_request` enforces `team_member_request_can_read(organisation_id, requester_person_id)`. The slice additionally filters `core_member.organisation_id = selectedOrganisation.id` defensively on every list query — a belt-and-braces guard against future RLS regression.

**BR-13 — Page guard.**
- Input: route entry to `/members`.
- Output: shell `routeAccessDenied` evaluates the route registry entry with org scope resolved internally. On deny, `<AccessDenied />` is rendered. On allow, the page body renders.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. The directory UX lives behind `/members`.

### Read contracts

- **Members list query.** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_member')
    .select('id, person_id, membership_number, membership_status, membership_type_id, organisation_id, core_person!inner(id, first_name, last_name, preferred_name, email), core_membership_type(id, name)')
    .eq('organisation_id', selectedOrganisation.id)
    .is('deleted_at', null)
    .in('membership_status', ['Active', 'Suspended'])
    .order('core_person(last_name)', { ascending: true })
    .order('core_person(first_name)', { ascending: true })
  ```
  When the membership-type filter is active, `.eq('membership_type_id', :id)` is appended.
- **Pending list query.** PostgREST shape — join against `team_member_request`:
  ```
  useSecureSupabase()
    .from('core_member')
    .select('id, person_id, membership_number, membership_status, membership_type_id, organisation_id, core_person!inner(id, first_name, last_name, preferred_name, email), core_membership_type(id, name), team_member_request!inner(id, request_type, status, created_at)')
    .eq('organisation_id', selectedOrganisation.id)
    .is('deleted_at', null)
    .eq('membership_status', 'Provisional')
    .in('team_member_request.status', ['pending', 'on_hold'])
    .in('team_member_request.request_type', ['join', 'transfer'])
    .eq('team_member_request.organisation_id', selectedOrganisation.id)
  ```
  The slice picks the most recent matching `team_member_request` row per member when more than one open request exists. The exact PostgREST query shape is the build agent's choice provided the result honours the rule above.
- **Membership-type filter source.** `useSecureSupabase().from('core_membership_type').select('id, name').eq('organisation_id', selectedOrganisation.id).eq('is_active', true).order('name', { ascending: true })`.

### Query-key contract

- Members list: `['members', 'active', selectedOrganisation.id, membershipTypeFilter ?? 'all']`.
- Pending list: `['members', 'pending', selectedOrganisation.id]`.
- Membership-type filter source: `['membership-types', selectedOrganisation.id, 'active-only']`.
- Org-switch invalidates all three keys against the new org.

### Write contracts

This slice has no write contracts. There are no inserts, updates, or deletes performed by TEAM-02. The only persistence side effect is a non-DB write: `sessionStorage['pace:team:comms:manual-pick'] = JSON.stringify({ organisationId, memberIds, updatedAt })` on Done in picker mode (BR-10).

### RLS / permission contracts

- **SELECT** on `core_member` is permitted on dev by `rbac_select_core_member` (super-admin OR own person OR org access via `core_member_role`) and `rbac_select_core_member_delegated`.
- **SELECT** on `core_person` is permitted by `rbac_select_core_person` (super-admin OR own user OR via `check_user_person_access_via_member_roles(id)`).
- **SELECT** on `team_member_request` is permitted by `rbac_select_team_member_request` via `team_member_request_can_read(organisation_id, requester_person_id)`.
- **SELECT** on `core_membership_type` is permitted on dev by `read_team_membership_types` (`USING is_authenticated_user()`).
- The page guard uses canonical `pageName = 'members'` and `operation = 'read'`. `rbac_app_pages` must have a row with `page_name = 'members'`, `app_id = data_get_app_id('TEAM')`, and `scope_type = 'organisation'` (post-build seeding noted in TEAM-01 §8).

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-02 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Members"), and the `PaceAppLayout` chrome. TEAM-02 renders inside that chrome.
- **TEAM-03** owns `/members/:memberId`. TEAM-02 navigates to that route on row click using `core_member.id`. TEAM-03 is responsible for any further authorisation on the detail surface.
- **TEAM-13** owns `/communications`. TEAM-02 hands off the picker payload via `sessionStorage['pace:team:comms:manual-pick']` with shape `{ organisationId: string, memberIds: string[], updatedAt: number }`. TEAM-13 reads-and-clears the key on mount when `payload.organisationId === selectedOrganisation.id`. TEAM-02 only writes on Done.
- **TEAM-05** owns `/approvals` and the `team_member_request` queue. TEAM-02 reads the same `team_member_request` table for the Pending tab join condition only; it does not modify request status.
- **TEAM-06** owns `core_membership_type` mutations. TEAM-02 reads `core_membership_type.id` and `name` for the membership-type filter dropdown.

### ID contracts

- `core_member.id` (uuid) — primary identifier used in row navigation (`/members/:memberId`) and in the picker payload's `memberIds` array. Both consumed by TEAM-03 and TEAM-13.
- `core_membership_type.id` (integer) — used as the membership-type filter value on the Members tab. Consumed by the server query as `membership_type_id`.
- The `subject_member_id` and `subject_person_id` columns on `team_member_request` are read-only inputs for the Pending tab join; this slice does not write them.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_member` | SELECT | `useSecureSupabase()` |
| `core_person` | SELECT (joined) | `useSecureSupabase()` |
| `core_membership_type` | SELECT | `useSecureSupabase()` |
| `team_member_request` | SELECT (joined for Pending tab) | `useSecureSupabase()` |
| `core_member_role` | (indirect — RLS-only) | RLS helper for `rbac_select_core_member` |

### `core_member` columns (live dev-db)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `person_id` | uuid | NO | — |
| `membership_number` | text | YES | — |
| `deleted_at` | timestamptz | YES | — |
| `membership_status` | `pace_membership_status` enum | YES | `'Provisional'` |
| `organisation_id` | uuid | NO | — |
| `membership_type_id` | integer | YES | — |
| `joined_at` | timestamptz | NO | `now()` |
| `valid_from` | date | YES | — |
| `valid_to` | date | YES | — |
| `created_at` / `updated_at` / `created_by` / `updated_by` | per dev schema | — | — |

### `pace_membership_status` enum (live)

`Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked`.

### `team_member_request` columns (live dev-db) and planned contract

Live columns: `id (uuid)`, `organisation_id (uuid NOT NULL)`, `requester_person_id (uuid NOT NULL)`, `subject_person_id (uuid NULL)`, `subject_member_id (uuid NULL)`, `request_type (team_member_request_type NOT NULL)`, `status (team_member_request_status NOT NULL)`, plus `reason`, `resolution_note`, `resolved_by`, `resolved_at`, `created_at`, `updated_at`.

Planned platform contract for this slice (see §15 implementation gate):
- `team_member_request_type` enum extended with values `'join'` and `'transfer'`. After the migration, the enum carries `'member_profile_access'`, `'join'`, and `'transfer'`.
- `team_member_request_status` enum extended with value `'on_hold'`. After the migration, the enum carries `'pending'`, `'approved'`, `'rejected'`, `'withdrawn'`, and `'on_hold'`.
- RPCs `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request` updated to accept and surface the new enum values; signature/behaviour deltas referenced in §17.

### `core_membership_type` columns (live dev-db)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | integer | NO | sequence |
| `name` | text | NO | — |
| `is_active` | boolean | NO | `true` |
| `organisation_id` | uuid | NO | — |
| (plus min/max age columns, audit columns) | per dev schema | — | — |

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `core_member.organisation_id` is `NOT NULL` (DB-309) and `core_member.deleted_at` exists.
- Confirm `pace_membership_status` enum values match the six listed above (no `Cancelled`).
- Confirm `team_member_request_type` enum has been extended with `'join'` and `'transfer'`. **If not yet present on dev, this slice is blocked — see §15.**
- Confirm `team_member_request_status` enum has been extended with `'on_hold'`. **If not yet present on dev, this slice is blocked — see §15.**
- Confirm `core_membership_type.is_active` is `NOT NULL DEFAULT true` (DB-317).
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Confirm an `rbac_app_pages` row for `page_name = 'members'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` is in place (post-TEAM-01 seeding).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; RBAC permission policy template (referenced for §10 server-side enforcement).
- `pace-core2/packages/core/docs/database/domains/team.md` — `team_member_request` shape and `team_member_request_type` / `team_member_request_status` enum reference (subject to the planned contract noted above).

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for Members, Pending, and membership-type filter SELECTs |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="members"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for org filter and picker hand-off org id |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle="Members"` on page mount |
| `DataTable` | `@solvera/pace-core/components` | Members and Pending tables; toolbar; sort; search; pagination; selection in picker mode |
| `Tabs` | `@solvera/pace-core/components` | View switcher root |
| `TabsList` | `@solvera/pace-core/components` | Tab list container |
| `TabsTrigger` | `@solvera/pace-core/components` | Members and Pending triggers |
| `TabsContent` | `@solvera/pace-core/components` | Members and Pending panels |
| `Alert` | `@solvera/pace-core/components` | Picker banner; error state for failed list query |
| `AlertTitle` | `@solvera/pace-core/components` | Title slot inside `Alert` |
| `AlertDescription` | `@solvera/pace-core/components` | Description slot inside `Alert` |
| `Button` | `@solvera/pace-core/components` | Picker action bar (Done, Cancel); Retry button on error state |
| `LoadingSpinner` | `@solvera/pace-core/components` | Used internally by `DataTable` loading state (listed for awareness; not invoked directly by this slice) |
| `toast` | `@solvera/pace-core/components` | Module-level toast for org-switch in picker mode |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalise list-query errors for inline `Alert` description and logging |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in query handlers must still abort the SELECT when `selectedOrganisation` is null mid-render (for example during an org switch). Do not issue cross-org SELECTs.
- **`DataTable` selection is controlled in picker mode only.** Pass `features.selection: true` and a controlled `selection: Record<string, boolean>` derived from `selectedIds` only when picker mode is active. In normal mode, do not pass `selection` and leave `features.selection` at `false`. Toggling `features.selection` between renders is supported by the component but the row-click handler must dispatch correctly per mode (navigate vs toggle).
- **`DataTable` row-click semantics.** This slice does not use `actions`, `onCreateRow`, `onEditRow`, or `onDeleteRow`. Row-click is wired via the slice's own click handler attached to each row (or via an `actions` entry whose visible button is hidden but whose `onClick` is invoked on row click — pick whichever the build agent confirms is the supported `DataTable` row-click affordance). The handler branches on picker mode: navigate to `/members/:memberId` in normal mode; toggle selection in picker mode.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **No `useResourcePermissions` consumption.** This slice does not call `useResourcePermissions('members')`. The page guard alone gates access; there are no per-row create / update / delete affordances.
- **Implementation gate.** The Pending tab depends on the planned platform contract for `team_member_request` enum values and RPC signatures — see §15.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/members` | `members` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read directory (Members + Pending) | `read:page.members` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Row navigate to `/members/:memberId` | n/a at this slice | TEAM-03 enforces detail-page guard | TEAM-03's responsibility |
| Comms picker Done | n/a at this slice | TEAM-13 enforces send-side authorisation | TEAM-13's responsibility |

### Server-side enforcement

- **`core_member` SELECT** is enforced by RLS policies `rbac_select_core_member` and `rbac_select_core_member_delegated`. A user without an applicable membership row in `core_member_role` for the target org receives an empty array.
- **`core_person` SELECT** is enforced by RLS `rbac_select_core_person`.
- **`team_member_request` SELECT** is enforced by RLS `rbac_select_team_member_request` via `team_member_request_can_read(organisation_id, requester_person_id)`.
- **`core_membership_type` SELECT** is enforced by RLS `read_team_membership_types`.

---

## §11 Acceptance criteria

- [ ] **AC-01 — Page entry, authenticated, has org, has read permission.**

Given a user is authenticated, has an org, and has `read:page.members`, when they navigate to `/members`, then the page renders the title "Members" and the Members tab is selected by default with active and suspended members of the current org listed and the Pending tab visible alongside. (Traces F-01, F-03, F-04, F-15.)

- [ ] **AC-02 — Members tab default sort.**

Given the Members tab has rows with last names "Brown", "Adams", "Carter" (each with distinct first names), when the page loads, then the rows render in the order Adams, Brown, Carter under the **Name** column. (Traces F-16, F-33, BR-04.)

- [ ] **AC-03 — Members tab empty state.**

Given a user enters `/members` for an org that has zero active or suspended members, when the page loads, then the Members tab renders the empty state heading "No active or suspended members yet." and description "New members appear here once approved via /approvals." with no CTA. (Traces F-11.)

- [ ] **AC-04 — Pending tab visible and populated.**

Given the current org has at least one Provisional `core_member` with an open `team_member_request` of `request_type IN ('join','transfer')` and `status IN ('pending','on_hold')`, when the user clicks the Pending tab, then the Pending tab renders rows for those members with columns Name, Membership #, Membership type, Requested, and Request type. (Traces F-04, F-21, F-22, F-23, F-24.)

- [ ] **AC-05 — Pending tab empty state.**

Given the current org has zero Provisional members with open join or transfer requests, when the user clicks the Pending tab, then the Pending tab renders the empty state heading "No pending members." and description "New join requests appear here once submitted via your org signup form." with no CTA. (Traces F-12.)

- [x] **AC-06 — Provisional member without open request is excluded.**

Given the current org has a Provisional `core_member` row with no matching open `team_member_request`, when the user views the Pending tab, then that member does not appear in the list. (Traces F-49, BR-03.)

- [ ] **AC-07 — Search filters in-memory.**

Given the Members tab has multiple rows and the user types "smit" into the search input, when the search executes, then only rows whose last name, first name, preferred name, email, or membership number contains "smit" (case-insensitive) remain visible; clearing the input restores all rows. (Traces F-31, BR-05.)

- [x] **AC-08 — Membership-type filter (Members tab only).**

Given the Members tab has multiple rows assigned to different membership types, when the user selects a specific type from the membership-type filter, then only rows with that `membership_type_id` remain visible; selecting "All" restores the unfiltered list. The Pending tab does not surface this filter. (Traces F-32.)

- [ ] **AC-09 — Pagination.**

Given the Members tab has 60 rows, when the page loads with `initialPageSize = 25`, then page 1 shows the first 25 rows, page 2 shows rows 26–50, and page 3 shows rows 51–60; changing the page size dropdown to 50 collapses pagination to two pages. (Traces F-34.)

- [x] **AC-10 — Row click navigates to Member 360.**

Given a user has the Members tab visible in normal mode, when they click a row, then the app navigates to `/members/:memberId` where `:memberId` is the clicked row's `core_member.id`. (Traces F-26, BR-06.)

- [x] **AC-11 — Permission denied — read.**

Given a user is authenticated and has org context but lacks `read:page.members`, when they navigate to `/members`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside the `AuthenticatedShell` chrome and no tab, table, or toolbar renders. (Traces F-14, F-36.)

- [ ] **AC-12 — Error state on list query failure.**

Given the Members list query fails, when the error is returned, then the Members tab renders an inline `Alert` with `variant="destructive"`, title "Could not load members", a description sourced from `HandleSupabaseError`, and a Retry button alongside; clicking Retry re-runs the query. (Traces F-13.)

- [ ] **AC-13 — Org switch refetches both lists.**

Given the user has the Members tab visible for org A, when they switch to org B in the org context selector, then the Members list refetches against org B and the user sees org B's data (or the Members empty state). (Traces F-42, BR-01, BR-11.)

- [ ] **AC-14 — Picker mode entry hides Pending tab.**

Given a user navigates to `/members` with `location.state.intent === 'commsManualPick'` set, when the page renders, then a sticky banner reads "Selecting members for a comms send — 0 selected", a sticky bottom action bar shows Done (disabled) and Cancel, and only the Members tab is visible. (Traces F-04, F-07, F-44, BR-08.)

- [x] **AC-15 — Picker mode hydration when org matches.**

Given an existing `pace:team:comms:manual-pick` payload in `sessionStorage` whose `organisationId === selectedOrganisation.id` and `memberIds` contains three ids matching rows in the current org, when the user enters picker mode, then those three rows are pre-selected (their checkboxes ticked) and the counter reads "3 selected". (Traces F-08, BR-07.)

- [x] **AC-16 — Picker mode does not hydrate when org mismatch.**

Given an existing `pace:team:comms:manual-pick` payload whose `organisationId` differs from `selectedOrganisation.id`, when the user enters picker mode, then `selectedIds` is empty and the counter reads "0 selected". (Traces F-48, BR-07.)

- [x] **AC-17 — Picker mode Done writes payload and navigates.**

Given the user is in picker mode with three rows selected, when they click Done, then `sessionStorage['pace:team:comms:manual-pick']` is updated to `{ organisationId: <currentOrgId>, memberIds: [<id1>, <id2>, <id3>], updatedAt: <ms> }` and the app navigates to `/communications`. (Traces F-29, BR-10.)

- [x] **AC-18 — Picker mode Cancel does not write payload.**

Given the user is in picker mode with rows selected and a prior payload already in `sessionStorage`, when they click Cancel, then the app navigates to `/communications` and `sessionStorage['pace:team:comms:manual-pick']` is unchanged from its prior value. (Traces F-30, BR-10.)

- [x] **AC-19 — Picker empty selection blocks Done.**

Given the user is in picker mode with `selectedIds.length === 0`, when they look at the action bar, then Done is disabled and the helper copy "Select at least one member." is visible. (Traces F-44, BR-09.)

- [x] **AC-20 — Picker soft cap warning.**

Given the user is in picker mode and selects 700 members, when the selection updates, then the banner reads "Large audience — Confirm you intend to message 700 members." and the Done button remains enabled. (Traces F-45, BR-09.)

- [x] **AC-21 — Picker hard cap blocks Done.**

Given the user is in picker mode and selects 2001 members, when the selection updates, then the banner switches to destructive variant with title "Selection too large" and description "Reduce selection to at most 2000 members." and Done is disabled. (Traces F-46, BR-09.)

- [x] **AC-22 — URL-only picker entry does not activate picker mode.**

Given a user navigates directly to `/members?pick=comms` without `location.state.intent === 'commsManualPick'`, when the page renders, then picker mode is not active — both Members and Pending tabs are visible, no banner, no sticky action bar. (Traces F-47, BR-07.)

- [x] **AC-23 — Org switch in picker mode clears selection and toasts.**

Given the user is in picker mode with three rows selected for org A, when they switch the org context to org B, then `selectedIds` is reset to `[]`, the lists refetch against org B, and a `default`-variant toast renders with copy "Selection cleared — organisation changed." (Traces F-43, BR-11.)

- [ ] **AC-24 — Cross-org leakage prevention.**

Given a member exists in org B but not in org A, when the user is signed in with org A selected, then no SELECT against `core_member`, `core_person`, or `team_member_request` returns the org-B row, regardless of search input or filter combination. (Traces F-50, BR-12.)

---

## §12 Verification

- **MCP test — RLS authority.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), as a user with org-admin access on org A, run a SELECT on `core_member` that does not include an `organisation_id` filter. Confirm only org A's rows are returned (RLS enforces isolation). Repeat with the slice's defensive `organisation_id = :orgA` filter present and confirm the same row set.
- **MCP test — `pace_membership_status` enum.** Confirm the enum has exactly six values: `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked` (no `Cancelled`).
- **MCP test — `team_member_request` planned contract.** Confirm `team_member_request_type` enum has been extended with `'join'` and `'transfer'`. Confirm `team_member_request_status` enum has been extended with `'on_hold'`. If either is missing, the slice is blocked (see §15).
- **MCP test — RPC contract.** Confirm `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request` accept the new enum values where applicable. Smoke-test by invoking each RPC with a known payload and verifying no enum-mismatch error.
- **MCP test — `core_member.organisation_id NOT NULL`.** Confirm `core_member.organisation_id` is `NOT NULL` (DB-309).
- **MCP test — `core_membership_type.is_active`.** Confirm `core_membership_type.is_active` is `NOT NULL DEFAULT true` (DB-317).
- **MCP test — `rbac_app_pages` seeding.** Confirm a row exists with `page_name = 'members'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'`.
- **In-app demo flow — happy path.** Sign in as a TEAM org-admin. Visit `/members`. Confirm the Members tab renders with rows in (last name, first name) order. Click a row and confirm navigation to `/members/:memberId`. Return to `/members`. Click the Pending tab and confirm rows or the empty state.
- **In-app demo flow — search and filter.** Type a partial last name into the search; confirm only matching rows remain. Pick a membership type from the filter; confirm only rows of that type remain. Clear both; confirm all rows return.
- **In-app demo flow — picker mode entry.** From a stub `/communications` page, navigate to `/members` with `location.state.intent = 'commsManualPick'`. Confirm picker banner, sticky action bar, Pending tab hidden, and the Members tab's leftmost column is a checkbox column.
- **In-app demo flow — picker hand-off.** Select three members. Click Done. Inspect `sessionStorage['pace:team:comms:manual-pick']`; confirm the payload shape `{ organisationId, memberIds, updatedAt }` with the expected ids. Confirm navigation to `/communications`.
- **In-app demo flow — picker org-switch.** Re-enter picker mode. Select two members. Switch the org context. Confirm the toast renders with copy "Selection cleared — organisation changed." and the counter resets to "0 selected".
- **In-app demo flow — picker caps.** Stage a fixture with 2010 selectable members. Select all. Confirm the destructive banner ("Selection too large") and the disabled Done button.

---

## §13 Testing requirements

- Unit / integration tests covering the picker mode hydration logic: org match, org mismatch, and missing payload cases.
- Component test that asserts row click navigates to `/members/:memberId` in normal mode and toggles selection in picker mode.
- Component test that asserts `selectedIds.length` boundary transitions (0, 500, 501, 2000, 2001) drive the correct banner copy and Done-button enabled state.
- Component test that asserts org switch in picker mode clears selection and renders the `default`-variant toast.
- Integration test that asserts the Pending tab join condition uses `team_member_request.status IN ('pending','on_hold')` and `team_member_request.request_type IN ('join','transfer')` against a fixture dataset.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads must go via `useSecureSupabase()`. Do not call `createClient` directly. Do not reach for any client that bypasses RBAC scope resolution.
- Do not implement any insert, update, or delete from this slice. The directory is read-only.
- Do not consume `useResourcePermissions('members')` — `<PagePermissionGuard>` is the sole permission gate for this surface.
- Do not author the `team_member_request` enum extension migration or the related RPC updates from inside this slice. Those are upstream platform work; the slice depends on them (§15).
- Do not put member ids in the URL on Done — write them to `sessionStorage` only.
- Do not clear `sessionStorage['pace:team:comms:manual-pick']` on Cancel — TEAM-13 reads-and-clears on `/communications` mount.
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.

---

## §15 Done criteria

- All 24 acceptance criteria (AC-01 through AC-24) verified via the slice's QA pack.
- **Implementation blocked until:**
  - **(a)** `team_member_request_type` enum is extended with `'join'` and `'transfer'` on verified-contract project `yihzsfcceciimdoiibif` (backend-ready MCP target).
  - **(b)** `team_member_request_status` enum is extended with `'on_hold'` on dev.
  - **(c)** RPC contract updates for `app_submit_member_request`, `app_resolve_member_request`, and `app_withdraw_member_request` to accept and surface the new enum values have landed on dev (no compatibility alias is expected for the removed legacy resolver).
  The v6 slice does not author the migration. Until items (a), (b), and (c) are confirmed via Supabase MCP against dev, this slice cannot be marked Done.
- Post-build RBAC seeding reminder noted in TEAM-01: `rbac_app_pages` must include the row for `page_name = 'members'` with `scope_type = 'organisation'` for the TEAM app before release.
- Picker mode hand-off contract verified end-to-end with TEAM-13: a Done click writes the payload, a `/communications` mount in TEAM-13 reads-and-clears it, the resulting recipient list matches `selectedIds`.

---

## §16 Do not

- Do not surface any view of `Resigned`, `Lapsed`, or `Revoked` members in v1.
- Do not surface a photo thumbnail column in v1; member photos live on Member 360 (TEAM-03).
- Do not surface an active-roles column in v1; roles are TEAM-03 / TEAM-04 territory.
- Do not surface a top-level membership-status dropdown filter on the Members tab; staff use column sort to group Active vs Suspended.
- Do not surface secondary row actions in v1; row click is the single primary action.
- Do not list Provisional `core_member` rows that have no matching open `team_member_request` in any tab.
- Do not show the Pending tab in picker mode; picker selection is Members-only.
- Do not put member ids in the URL on picker Done — payload goes to `sessionStorage` only.
- Do not clear `sessionStorage['pace:team:comms:manual-pick']` on Cancel — TEAM-13 reads-and-clears on `/communications` mount.
- Do not implement any insert / update / delete on `core_member`, `core_person`, or `team_member_request` from this slice.
- Do not consume `useResourcePermissions('members')` — `PagePermissionGuard` alone gates this surface.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not introduce sticky toolbars or sticky pagination beyond the picker banner and picker action bar described in §5.
- Do not run any verification or smoke test against production. Dev-db only.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; member directory scope; comms picker hand-off.
- `/rebuild/architecture.md` — slice ownership, route registry, canonical `pageName` map (`members`), Members vs Pending split, comms picker contract.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Members entry), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`** so any descendant route (including this slice) can call `toast(...)`. TEAM-02 depends on this mount; without it, `toast(...)` throws.
- **TEAM-03** — owns `/members/:memberId`. TEAM-02 navigates there on row click using `core_member.id`.
- **TEAM-05** — owns `/approvals` and the `team_member_request` queue. TEAM-02 reads `team_member_request` for the Pending tab join only; mutations on requests live in TEAM-05.
- **TEAM-06** — owns `core_membership_type` mutations. TEAM-02 reads `core_membership_type.id` and `name` for the Members-tab filter dropdown.
- **TEAM-13** — owns `/communications`. TEAM-02 hands off the picker payload via `sessionStorage['pace:team:comms:manual-pick']` with shape `{ organisationId: string, memberIds: string[], updatedAt: number }`. TEAM-13 reads-and-clears the key on mount when the org id matches.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates for read-only surfaces.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage; `pageName` + `operation`; no `scope` prop at page level.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and shell chrome (provided by TEAM-01).
- `pace-core2/packages/core/docs/database/domains/team.md` — `team_member_request` shape and enum reference (subject to the planned platform contract — see §15 implementation gate). The slice depends on enum extensions `'join'` / `'transfer'` (`team_member_request_type`) and `'on_hold'` (`team_member_request_status`), and on RPC contract updates for `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request` to accept and surface these values.
- DB-309 — `core_member.organisation_id NOT NULL` (live on dev).
- DB-317 — `core_membership_type.is_active NOT NULL DEFAULT true` (live on dev).
