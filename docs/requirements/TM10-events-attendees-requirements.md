# TEAM-10 — Events & attendees

## §1 Slice metadata

```
Slice ID:        TEAM-10
Name:            Events & attendees
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems), TEAM-03 (Member 360 — attendee row navigation target)
Backend impact:  Read contract only (two SECURITY DEFINER RPCs authored by platform: app_org_event_summaries(p_organisation_id uuid) and app_org_event_attendees(p_organisation_id uuid, p_event_id uuid). The v6 slice cites the planned contracts; platform-DB engineers author the RPC bodies. Implementation is gated on both RPCs landing on dev — see §15).
Frontend impact: UI
Routes owned:    /events; /events/:eventId
QA pack:         docs/test-packs/TM10-qa-pack.md
```

---

## §2 Overview

TEAM-10 delivers the events surface for org-admin staff at `/events` (a list of every event for which the current organisation has at least one non-draft member application) and `/events/:eventId` (an event header plus a member-centric attendee list of those applicants). Both surfaces are member-centric: each row at `/events` represents an event the organisation has presence in; each row at `/events/:eventId` represents a member of the current organisation whose application is recorded for that event. The data is sourced through two SECURITY DEFINER RPCs that join `core_events`, `base_application`, `core_member`, and `core_person` server-side, scope reads to the current organisation's presence, exclude drafts, and authorise on org-admin caller identity. Both routes are read-only and wrapped by `<PagePermissionGuard pageName="events" operation="read">`.

- **Prototype reference:** `EventsPage`, `NewEventPage` in `pace-prototype/apps/pace-team/pages/ApprovalsEventsPages.jsx`; `EventDetailPage` in `pace-prototype/apps/pace-team/pages/EventDetailCommsPages.jsx`.

**Layout authority** is the pace-team prototype kit. Pass 1 aligns §5 and layout acceptance criteria to that kit; RPC contracts and read-only boundaries below are unchanged.

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single surface where they can see every event their organisation is touching — through a member application or registration — and drill from a row into the list of their organisation's members participating in that event. TEAM-10 produces both surfaces. It does not own event creation, event configuration, application authoring, application status transitions, participant-side event browsing, registration windows, capacity, or visibility — those are BASE-app or Portal-participant concerns.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Events list | `/events` | One row per event for which the current organisation has at least one `core_member` with a non-draft `base_application` |
| Event detail with attendee list | `/events/:eventId` | Header (`event_name`, `event_date` / range, `event_venue`) + `DataTable` of current-org members whose application is recorded for the event |
| Event-not-found page | (in-page replacement at `/events/:eventId`) | Single safe UX for unknown id, no-org-presence id, or org-mismatch after switch |
| Org-mismatch alert | (in-page replacement at `/events/:eventId`) | Destructive `Alert` with "Back to events" button |

### Boundaries

TEAM-10 does **not** own:
- Event creation, editing, configuration (capacity, registration types, registration windows, visibility, descriptions, branding) — BASE-app concerns.
- Application creation, editing, or status transitions (`draft → submitted → under_review → approved | rejected | withdrawn`) — BASE-app and Portal-participant flows.
- Participant-side event browsing or registration.
- Event hierarchy / sub-event navigation.
- Member 360 detail — that is TEAM-03. TEAM-10 hands off the row click to `/members/:memberId`.
- The `base_event_registration` table reference — no such table exists in the platform schema.
- The `team_unit` legacy construct — TEAM-10 has no unit / squad / team concept.
- Any mutation against `core_events` or `base_application`. The slice is read-only.
- Authoring of the SECURITY DEFINER RPC bodies (`app_org_event_summaries`, `app_org_event_attendees`) — that is platform-DB work; the slice cites the planned contracts and gates implementation on them landing on dev.

### Architectural posture

**Read-only surface.** Every data path in this slice is a `useSecureSupabase().rpc(...)` invocation against one of the two SECURITY DEFINER RPCs. There are no `insert`, `update`, or `delete` calls, no PostgREST embedded selects, and no direct reads against `core_events` or `base_application` from the client. The cross-app dependency on BASE `read:page.applications` that would otherwise apply to a direct `base_application` SELECT is eliminated by the SECURITY DEFINER bypass — the RPCs run as definer and the caller's authorisation is checked inside the RPC body (caller is org admin of the requesting `p_organisation_id`).

**Page guard.** Both `/events` and `/events/:eventId` are wrapped by `<PagePermissionGuard pageName="events" operation="read">`. Same `pageName` for both routes. The guard resolves scope internally from `OrganisationServiceProvider` — no `scope` prop is passed.

**Resource-level action gating.** `useResourcePermissions('events')` is **not** invoked. The slice is read-only with no inline mutation affordances; the page guard alone gates access.

**Identifier in path.** `:eventId` is `core_events.event_id` (uuid). NEVER text. NEVER a `base_application.id`. Verified against dev — both `core_events.event_id` and `base_application.event_id` are `uuid`.

**Upcoming / past tabs.** The events list is split by `Tabs` (**Upcoming** | **Past**) with per-tab counts. Each tab renders its own filtered `DataTable`. Default tab is **Upcoming**. Within a tab, default sort is `event_date` ascending for Upcoming and descending for Past (matching prototype `initialSorting` behaviour).

**Loading split.** The `/events` page renders a full-page `<LoadingSpinner />` inside the `PaceMain` content area while the events RPC is in flight. The `/events/:eventId` page renders a full-page `<LoadingSpinner />` while the attendees RPC (`app_org_event_attendees`) is in flight; neither the header card nor the attendee table renders until that RPC resolves (F-13). Background refetches after initial load use the attendee `DataTable`'s built-in loading row (F-12 / §5 States).

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` and uses it only for unexpected fetch failures (network errors, RPC failures surfaced outside the inline `Alert` retry path — for example a one-off RPC failure on a fresh in-flight request). Variant vocabulary used: `'destructive'`. Default duration 5000 ms. `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it.

**Page metadata.**
- `/events`: `usePaceMain({ printTitle: 'Events' })` is called on page mount.
- `/events/:eventId`: `usePaceMain({ printTitle: 'Event' })` is called on page mount; once the event resolves, `printTitle` is updated to the resolved `event_name`.

**Org-scoped reads.** Every RPC call passes `selectedOrganisation.id` as `p_organisation_id`. The RPC body restricts results to that org's presence server-side; the slice does not invent an additional client-side org filter that contradicts the RPC contract.

**No event scope.** TEAM-10 reads events but is not event-scoped at the RBAC layer. The slice does not consume `EventServiceProvider` or pass an `eventId` as a guard scope. The `event_id` value flows only as a passive RPC parameter on `/events/:eventId`.

### Page-level guards and evaluation ordering

Both `/events` and `/events/:eventId` sit inside `AuthenticatedShell` (TEAM-01) and are wrapped by `<PagePermissionGuard pageName="events" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the page guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state from TEAM-01; the page guard does not evaluate.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the no-org empty state from TEAM-01. The page guard is not reached.
4. **Page permission guard** — Once org context is resolved, `<PagePermissionGuard pageName="events" operation="read">` evaluates with scope resolved internally. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside `PaceMain` is acceptable). On `can === false`, `<AccessDenied />` renders. On `can === true`, the page body renders.
5. **Data fetch** —
   - On `/events`: the slice invokes `app_org_event_summaries(p_organisation_id: selectedOrganisation.id)`. While the RPC is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area.
   - On `/events/:eventId`: the slice invokes `app_org_event_attendees(p_organisation_id: selectedOrganisation.id, p_event_id: :eventId)`. While the RPC is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area. On a zero-row result, the "Event not found" page renders (header data is otherwise carried in the same row shape — see §6 BR-A2).

If `selectedOrganisation` resolves to `null` mid-render (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the page guard returns `null` (pending), and the no-org check at step 3 prevents the path under normal conditions. If `selectedOrganisation` changes after the page has rendered, the RPCs refetch against the new org id (BR-W).

---

## §4 Functional specification

### Page entry / surface entry — `/events`

- **F-01** The route `/events` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.events` permission.
- **F-02** On page mount, `printTitle` is set to `'Events'` via `usePaceMain`.
- **F-03** The page title "Events" (sentence case) renders as a heading at the top of the `PaceMain` content area. No breadcrumb, no description sub-text.
- **F-04** On entry, the page invokes `useSecureSupabase().rpc('app_org_event_summaries', { p_organisation_id: selectedOrganisation.id })`. The RPC returns one row per event for which the current organisation has at least one `core_member` with a non-draft `base_application` for that event.
- **F-05** Switching the currently selected organisation refetches the list against the new org. Any in-flight RPC for the previous org is discarded.

### Page entry / surface entry — `/events/:eventId`

- **F-06** The route `/events/:eventId` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.events` permission, where `:eventId` is interpreted as `core_events.event_id` (uuid).
- **F-07** On page mount, `printTitle` is set to `'Event'` via `usePaceMain`. Once the attendee RPC returns at least one row, `printTitle` is updated to `event_name` from the RPC payload (every row carries the event identity columns; see §7 read contract).
- **F-08** On entry, the page invokes `useSecureSupabase().rpc('app_org_event_attendees', { p_organisation_id: selectedOrganisation.id, p_event_id: :eventId })`.
- **F-09** When the attendees RPC returns at least one row, the page renders the event header (sourced from the row's event identity columns) followed by the attendee `DataTable`. When the RPC returns zero rows, the page renders the "Event not found" UX (F-15).
- **F-10** A `<Button variant="outline">← Back to events</Button>` renders at top-left of the `PaceMain` content area, navigating to `/events` on click.
- **F-11** Switching the currently selected organisation refetches the attendee RPC against the new org. If the new org has presence in this event, the page silently rebinds. If it does not, the page replaces its content with the org-mismatch alert (F-19).

### Loading states

- **F-12** While the events RPC is in flight on `/events`, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; no list content renders.
- **F-13** While the attendees RPC is in flight on `/events/:eventId`, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; neither header nor table renders.
- **F-14** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).

### Empty states

- **F-15** **Events list empty.** When the events RPC returns zero rows for the current org, the events `DataTable` renders the empty-state title "No registered-member events" and description "Events appear here once a member of your organisation has an application or registration." inside the table area. The toolbar (search) remains visible above the empty area.
- **F-16** **Event not found.** When the attendees RPC returns zero rows for `(p_organisation_id, p_event_id)` — unknown event id, current org has no presence in the event, or RLS-deny equivalent — the page replaces its content with a centred vertical stack containing the heading "Event not found", the description "We couldn't find this event for your current organisation.", and a `<Button variant="outline">← Back to events</Button>` linking to `/events`.
- **F-17** **Attendee list empty (theoretical).** Because the RPC's row shape requires at least one attendee for the event to be returned at all, an empty attendee list cannot occur for a resolvable event id under normal conditions. If the RPC returns header-only rows (a defensive code path), the attendee `DataTable` renders the empty state with title "No applicants from your organisation" and description "Members of your organisation have no applications recorded for this event."

### Error states

- **F-18** **RPC fetch error.** When the events RPC fails on `/events` or the attendees RPC fails on `/events/:eventId`, the page replaces its content with `<Alert variant="destructive">` titled "Could not load events" (on `/events`) or "Could not load event" (on `/events/:eventId`), with description sourced from the normalised `HandleSupabaseError(error, { context })` message (`context` is `'app_org_event_summaries'` for the events RPC; `'app_org_event_attendees'` for the attendees RPC). Below the alert, a `<Button>Retry</Button>` re-runs the RPC.
- **F-19** **Org-mismatch (post-org-switch).** When the user is on `/events/:eventId`, the org context changes, and the new org's `app_org_event_attendees` invocation returns zero rows for the same `p_event_id`, the page replaces its content with `<Alert variant="destructive">` titled "This event is not in your current organisation", description "Switch back, or return to the events list.", and a `<Button variant="outline">Back to events</Button>` navigating to `/events`.
- **F-20** **Permission denied (read).** A user without `read:page.events` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).
- **F-21** **Unexpected toast-only failure.** A transient RPC failure surfaced outside the inline alert path (for example a background refetch failure during stale-while-revalidate) renders a `destructive` toast with the normalised error message; the previously rendered list / detail remains in place.

### Primary content — `/events` list

- **F-22** The events `DataTable` renders one row per event returned by the events RPC, in the columns and order: **Event name**, **Event date**, **Event venue**, **Members registered**.
- **F-23** The **Event name** column shows `event_name` as plain text. Sortable.
- **F-24** The **Event date** column shows the formatted event date per BR-L: when `event_days > 1` and `event_date` is non-null, the cell renders `"{event_date_short} – {end_date_short}"` where `end_date_short` is `event_date + (event_days - 1) days` formatted as a localised short date (e.g. "5 May 2026 – 7 May 2026"); when `event_days IS NULL` or `event_days <= 1`, the cell renders `event_date` formatted as a localised short date alone; em-dash "—" when `event_date` is null. Sort key is `event_date`; default sort `event_date DESC NULLS LAST`.
- **F-25** The **Event venue** column shows `event_venue` as plain text; em-dash "—" when null. Sortable.
- **F-26** The **Members registered** column shows `members_registered_count` as a plain integer (right-aligned per `DataTable` numeric defaults). Sortable.
- **F-27** The `DataTable.description` for the events list reads `"{count} events"` where `{count}` is the unfiltered server-result count from the RPC.

### Primary content — `/events/:eventId` header

- **F-28** The page header renders inside its own `Card` at the top of `PaceMain` content (below the Back row): a heading line with `event_name` (rendered as a `CardTitle`-equivalent heading); below it, a sub-line containing the formatted event-date span per BR-L; below the date, the `event_venue` subtitle (em-dash "—" when null).
- **F-29** No other `core_events` columns render in the header — `event_code`, `is_visible`, `registration_scope`, `public_readable`, `expected_participants`, `typical_unit_size`, `event_email`, `participant_blurb`, `participant_admin_email`, `participant_website_url`, `event_colours`, `logo_id`, `description` are excluded.

### Primary content — `/events/:eventId` attendee list

- **F-30** The attendee `DataTable` renders one row per `core_member` returned by the attendees RPC, in the columns and order: **Name**, **Application status**.
- **F-31** The **Name** column shows the member's full name composed from the row's name fields per BR-F: `preferred_name` followed by `last_name` when `preferred_name` is non-empty, otherwise `first_name` followed by `last_name`. Sortable. Default sort: **Name** ascending using the (last name, first name) compound sort key.
- **F-32** The **Application status** column shows a `Badge` whose label is `application_status` rendered title-case ("Submitted", "Under review", "Approved", "Rejected", "Withdrawn"). Tone per BR-E: Approved → success; Rejected → destructive; Withdrawn → muted; Submitted / Under review → default. Sortable; sorting groups same-status rows together.
- **F-33** The `DataTable.description` reads `"{count} attendees"` where `{count}` is the unfiltered server-result count from the RPC.

### Primary actions

- **F-34** **Row click — `/events`.** Clicking anywhere on a row in the events `DataTable` navigates to `/events/:eventId` using the row's `event_id`. No secondary row actions render in v1.
- **F-35** **Row click — `/events/:eventId` attendee list.** Clicking anywhere on an attendee row navigates to `/members/:memberId` using the row's `member_id`. No secondary row actions render in v1.
- **F-36** **Back button on `/events/:eventId`.** Click navigates to `/events`.

### Secondary actions

- **F-37** **Search — `/events`.** A toolbar text-search input (rendered by `DataTable`) filters the in-memory rows by case-insensitive substring against `event_name`. Clearing restores the unfiltered list.
- **F-38** **Search — `/events/:eventId` attendee list.** A toolbar text-search input filters the in-memory rows by case-insensitive substring across the row's `last_name`, `first_name`, and `preferred_name`. Clearing restores the unfiltered list.
- **F-39** **Sort — both lists.** Each column header is sortable. Default sorts: events list → Event date desc; attendee list → Name asc.
- **F-40** **Pagination — both lists.** `initialPageSize` is `25`; page size options are `[10, 25, 50]`. The current page indicator and prev/next controls are rendered by `DataTable` below the table.
- **F-41** **No import / export / hierarchical / grouping / selection / CRUD affordances.** The toolbar's `DataTable` defaults for these features are disabled (`features.import: false`, `features.export: false`, `features.hierarchical: false`, `features.grouping: false`, `features.creation: false`, `features.editing: false`, `features.deletion: false`, `features.deleteSelected: false`, `features.selection: false`).

### Permission-conditional rendering

- **F-42** When `read:page.events` is denied at the page level, `<AccessDenied />` renders and no list, header, table, or toolbar renders.
- **F-43** When `read:page.events` is allowed, the events list and the event detail render in full. No row-level permission check fires from this slice; row click navigates to `/events/:eventId` (TEAM-10) or `/members/:memberId` (TEAM-03), and any further authorisation is the responsibility of the receiving slice.

### Navigation

- **F-44** The page is reachable from the TEAM-01 navigation menu via the **Events** entry (`/events`).
- **F-45** Row click on `/events` navigates to `/events/:eventId` (same slice).
- **F-46** Row click on `/events/:eventId` attendee list navigates to `/members/:memberId` (TEAM-03).
- **F-47** The Back button on `/events/:eventId` navigates to `/events`.

### Edge cases and constraints

- **F-48** **Org switch — `/events`.** When `selectedOrganisation` changes, the events RPC refetches against the new org. Any in-flight RPC for the previous org is discarded. The user sees the new org's data (or the events-list empty state).
- **F-49** **Org switch — `/events/:eventId`.** When `selectedOrganisation` changes while on the detail surface, the attendees RPC refetches against the new org with the same `:eventId`. If the new org has presence in this event, the page silently rebinds with the new attendee rows. If it does not, the page replaces its content with the org-mismatch alert (F-19).
- **F-50** **Cross-org leakage prevention.** The RPCs scope reads to `p_organisation_id` server-side; cross-org events and cross-org attendees are never returned.
- **F-51** **Direct URL access for an event the current org has no presence in.** Renders the "Event not found" page (F-16). The user does not see a "permission denied" message; the slice's contract treats no-presence and unknown-id identically.
- **F-52** **Drafts excluded.** Member applications with `base_application.status = 'draft'` are excluded from both the events list (no event row appears solely on the strength of a draft application) and the attendee list (no draft application produces an attendee row). The RPC enforces this server-side.
- **F-53** **Cross-org applicants excluded.** The RPC excludes applicants whose `base_application.organisation_id` differs from `p_organisation_id`. A `core_person` who has applications against the same event from multiple orgs renders only the current-org row.
- **F-54** **Member-row-missing applicants excluded.** The RPC excludes applicants who do not have a `core_member` row in the current org (`core_member.organisation_id = p_organisation_id AND core_member.deleted_at IS NULL`). Provisional / cross-org applicants without a current-org member row do not appear in the attendee list.

---

## §5 Visual specification

### Layout — `/events`

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`:

- **Page header row** — `PageHeader` (or equivalent pace-core page header) with title **Events**, subtitle describing branch-run camps/weekends/one-off events, and a primary header action **Create event** on the right (navigates to `/events/new` — route ownership deferred; prototype shows a standalone create page; TEAM-10 v1 does not implement creation but preserves the header CTA placement for layout parity).
- **Tab row** — `Tabs` / `TabsList` with two triggers:
  - **Upcoming** — events with `event_date >= today` (local org timezone); badge/count shows row count.
  - **Past** — events with `event_date < today`; badge/count shows row count.
  Default selected tab: **Upcoming**.
- **List panel** — Below the tabs, a single `DataTable` for the active tab's filtered rows. Columns per prototype kit (mapped to RPC fields):
  - **Event** — primary line `event_name`; secondary muted line `event_venue` (em-dash when null).
  - **Date** — formatted span per BR-L.
  - **Days** — `event_days` as plain integer (right-aligned).
  - **Registered** — `members_registered_count` (right-aligned).
  Row activate navigates to `/events/:eventId`. Toolbar search filters in-memory within the active tab.

Breakpoints: standard pace-core2 responsive behaviour applies. The `DataTable` shows horizontal scroll on narrow viewports rather than collapsing to a card list. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Layout — `/events/:eventId`

Within `PaceMain`:

- **Page header row** — `PageHeader` with title `event_name`, subtitle `{formatted event-date span} · {event_venue}`, and optional header actions per prototype (**Message attendees** → `/communications/new?event=:eventId`, **Invite** — both deferred out of TEAM-10 read scope; preserve action region for pass 2 layout parity).
- **KPI stat grid** — A four-column `<section className="grid …">` of stat cards (prototype `tk-stat-card` pattern → pace-core KPI / stat tile equivalents):
  1. **Registered** — `members_registered_count`; footnote "members on the list".
  2. **Approved** — count of attendee rows with `application_status = 'approved'`.
  3. **Pending review** — sum of `submitted` + `under_review` counts.
  4. **Withdrawn / rejected** — sum of `withdrawn` + `rejected` counts.
  KPI values derive from the attendees RPC payload (client-side aggregation in v1).
- **Tab row** — `Tabs` / `TabsList` with five triggers: **Attendees** (default, with count), **Details**, **Forms**, **Activities**, **Comms log**. TEAM-10 v1 implements **Attendees** tab content only (read-only attendee `DataTable` per below). Other tabs render placeholder / empty states in pass 2 until owning slices land; tab shell and labels match prototype for IA parity.
- **Attendees tab panel** — When **Attendees** is active:
  - **Back affordance** — Optional outline **Back to events** in header or above tabs (prototype uses header-only navigation; either placement acceptable if breadcrumb/`OrgContextBar` covers wayfinding).
  - **Attendee `DataTable`** — columns **Member** (display name per BR-F; prototype uses `MemberCell`), **Application status** (`Badge` per BR-E). Row activate → `/members/:memberId`.
  - Empty state when zero attendees: title/description per BR-S with optional **Invite members** CTA (deferred — stub acceptable in pass 2).

Other tab panels (prototype reference — pass 2 / downstream slices):

- **Details** — definition list of event metadata (name, date span, venue, days, capacity, cost, visibility).
- **Forms** — linked forms list with link-form action.
- **Activities** — empty state with add-activity CTA.
- **Comms log** — mini table of sent messages for the event.

Breakpoints: same as `/events`.

### Components

**Back button (`/events/:eventId` only)** (`Button` from `@solvera/pace-core/components`)
- Variant: `outline`.
- Label: `← Back to events` (the arrow glyph is rendered by the `ChevronLeft` icon from `@solvera/pace-core/icons`, preceding the text label).
- Click: navigates to `/events`.

**Page-title heading (`/events`)**
- A top-of-page heading rendered as a top-level page heading (h1 visual). Copy: "Events".

**Header card (`/events/:eventId`)** (`Card`, `CardHeader`, `CardTitle`, `CardContent` from `@solvera/pace-core/components`)
- `CardHeader` contains `CardTitle` rendering `event_name`.
- `CardContent` renders two stacked rows:
  - Date row — plain text formatted per BR-L; em-dash when `event_date` is null.
  - Venue row — plain text from `event_venue`; em-dash when null.

**Events `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list events the current organisation has presence in (via at least one non-draft member application), with search, sort, and pagination.
- `data`: array of rows returned by `app_org_event_summaries(p_organisation_id)` after the in-memory search filter is applied.
- `rbac.pageName`: `'events'`.
- `title`: omitted (the page title sits above).
- `description`: `"{count} events"` (where `{count}` is the unfiltered server-result count for the current org).
- `isLoading`: bound to the events RPC's loading state (`/events` page renders a full-page `<LoadingSpinner />` outside the `DataTable` while initial load is in flight; `isLoading` covers any background refetches inside the table).
- `emptyState`: `{ title: "No registered-member events", description: "Events appear here once a member of your organisation has an application or registration." }`.
- `getRowId`: `(row) => row.event_id`.
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'event_date', desc: true }]`.
- `actions`: empty — row click is wired to navigate via the slice's row-click handler (no per-row buttons).
- `onCreateRow`, `onEditRow`, `onDeleteRow`: not used.
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, creation: false, editing: false, deletion: false, deleteSelected: false, selection: false, search: true, pagination: true, sorting: true, filtering: true, columnVisibility: true, columnReordering: true }`.

Events list columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Event name | `event_name` | flexible | Plain text. Sortable. |
| Event date | composed from `event_date` and `event_days` per BR-L | narrow-medium | `"{event_date_short} – {end_date_short}"` when `event_days > 1`; `event_date_short` alone otherwise; em-dash "—" when `event_date` is null. Sort key is `event_date`. Default sort `event_date DESC NULLS LAST`. |
| Event venue | `event_venue` | flexible | Plain text. Em-dash "—" when null. Sortable. |
| Members registered | `members_registered_count` | narrow | Plain integer; right-aligned (`DataTable` numeric default). Sortable. |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search events". Filters in-memory rows by case-insensitive substring against `event_name`.
- Column-visibility popover (default `DataTable` affordance).
- The toolbar does not show Create / Import / Export / Edit / Delete — features are off.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Attendee `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list current-org members whose application is recorded for this event, with search, sort, and pagination.
- `data`: array of rows returned by `app_org_event_attendees(p_organisation_id, p_event_id)` after the in-memory search filter is applied.
- `rbac.pageName`: `'events'`.
- `description`: `"{count} attendees"`.
- `isLoading`: bound to the attendees RPC's loading state.
- `emptyState`: `{ title: "No applicants from your organisation", description: "Members of your organisation have no applications recorded for this event." }`.
- `getRowId`: `(row) => row.member_id`.
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'last_name', desc: false }, { id: 'first_name', desc: false }]`.
- `actions`: empty — row click is wired to navigate via the slice's row-click handler.
- `features`: same as the events table (all CRUD off; search / sort / pagination / filtering on; selection off).

Attendee columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Name | composed from row's `preferred_name`, `first_name`, `last_name` per BR-F | flexible | Sortable; default sort uses (last name asc, first name asc). Plain text. No avatar. |
| Application status | `application_status` (title-case) | narrow | `Badge`. Tone per BR-E: Approved → success; Rejected → destructive; Withdrawn → muted; Submitted / Under review → default. Sortable. |

Toolbar: Search input — placeholder "Search attendees"; filters by case-insensitive substring across the contact's first name, last name, preferred name.

**Event-not-found page (`/events/:eventId`)**
- Replaces the entire `PaceMain` content area when the attendees RPC returns zero rows.
- Layout: a centred vertical stack containing:
  - A heading "Event not found".
  - A description paragraph "We couldn't find this event for your current organisation."
  - A `<Button variant="outline">← Back to events</Button>` linking to `/events`.

**Org-mismatch alert (`/events/:eventId`)**
- Replaces the entire `PaceMain` content area when the loaded event has no presence in the new org after an org switch.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>This event is not in your current organisation</AlertTitle>` and `<AlertDescription>Switch back, or return to the events list.</AlertDescription>`. Below the alert, a `<Button variant="outline">Back to events</Button>` that navigates to `/events`.

**RPC fetch error state**
- Replaces the entire `PaceMain` content area when an RPC fails on initial load.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>Could not load events</AlertTitle>` (on `/events`) or `<AlertTitle>Could not load event</AlertTitle>` (on `/events/:eventId`), and `<AlertDescription>` populated from the normalised `HandleSupabaseError` message. Below the alert, a `<Button>Retry</Button>` that re-runs the RPC.

**Toasts** — surfaced via the module-level `toast({ title, description?, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'destructive'` (unexpected RPC / network failures during background refetch). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### States

- **Loading — `/events` initial** — Full-page `<LoadingSpinner />` centred inside the `PaceMain` content area; no list content renders. The page-title heading is not yet rendered.
- **Loading — `/events/:eventId` initial** — Full-page `<LoadingSpinner />` centred inside the `PaceMain` content area; neither header card nor attendee table renders. The Back button is not yet rendered.
- **Loading — `DataTable` background** — `DataTable` renders Card + Table + TableCaption (description + toolbar) + a single full-width row containing `<LoadingSpinner label="Loading table" />` while a background refetch is in flight (e.g. after org switch).
- **Empty — `/events` events list** — `DataTable` renders the empty state title "No registered-member events" and description "Events appear here once a member of your organisation has an application or registration." inside the table area. The toolbar (search) remains visible above the empty area.
- **Empty — `/events/:eventId` attendee list** — `DataTable` renders the empty state title "No applicants from your organisation" and description "Members of your organisation have no applications recorded for this event."
- **Event not found** — Replaces the `/events/:eventId` page; layout per the "Event-not-found page" component above.
- **Org-mismatch** — Replaces the `/events/:eventId` page; layout per the "Org-mismatch alert" component above.
- **RPC fetch error** — Replaces the page; layout per the "RPC fetch error state" component above.
- **Permission denied** — `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page."
- **Unexpected toast-only failure** — The previously rendered list / detail remains in place; a `destructive` toast renders bottom-right with the normalised error message and auto-dismisses after 5000 ms.

### Interactions

- **Back button (`/events/:eventId`)** — Hover: pace-core2 default outline-button hover. Click: navigates to `/events`. Default / focused / disabled visuals follow pace-core2 `Button` defaults.
- **Row click — `/events`** — Hover: pace-core2 row-hover treatment. Click: navigates to `/events/:eventId` using the row's `event_id`.
- **Row click — `/events/:eventId` attendee list** — Hover: pace-core2 row-hover treatment. Click: navigates to `/members/:memberId` using the row's `member_id`.
- **Search inputs (events list and attendee list)** — Typing filters in-memory rows of the active list in real time with no submit step. Clearing the input restores the unfiltered list. Searches are independent per surface.
- **Sort headers (any DataTable)** — Click toggles asc / desc / none on that column.
- **Pagination controls (any DataTable)** — Page size dropdown changes rows per page; prev / next change page index; current page indicator updates immediately.
- **Toast** — On unexpected fetch failure, a toast renders bottom-right and auto-dismisses after 5000 ms.

### Layout acceptance criteria (prototype alignment)

- [ ] `/events` renders `PageHeader` with title **Events**, descriptive subtitle, and **Create event** primary action in the header right.
- [ ] `/events` renders **Upcoming** / **Past** tabs with counts; default tab is **Upcoming**; each tab shows a filtered `DataTable`.
- [ ] Events list columns match prototype order: Event (name + venue sub-line), Date, Days, Registered.
- [ ] `/events/:eventId` renders `PageHeader` with event name and `{date span} · {venue}` subtitle.
- [ ] `/events/:eventId` renders a four-tile KPI stat grid (Registered, Approved, Pending review, Withdrawn / rejected) above tabs.
- [ ] `/events/:eventId` renders five tabs: Attendees (default), Details, Forms, Activities, Comms log; **Attendees** tab shows the read-only attendee `DataTable`.
- [ ] Attendee row activate navigates to `/members/:memberId`.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- `EventsListPage` uses a plain `<h1>Events</h1>` and a **single combined** `DataTable` with no **Upcoming / Past** tabs and no **Create event** header action.
- List columns use separate Event name / Event date / Event venue / Members registered headers instead of prototype's stacked Event column + Days column.
- `EventDetailPage` uses a back button + `Card` header + attendee table only — no KPI stat grid, no five-tab shell, no `PageHeader` with subtitle actions.
- No route or page for `/events/new` (prototype `NewEventPage` exists as layout reference only).
- Non-**Attendees** tabs (Details, Forms, Activities, Comms log) are not implemented; pass 2 adds tab shell placeholders before downstream slices own content.

### Permission-conditional rendering

| Condition | `/events` entry | `/events/:eventId` entry | Row click |
|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | Redirect to `/login` | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | TEAM-01 no-org empty state | n/a |
| Authenticated, org, `read:page.events` denied | `<AccessDenied />` | `<AccessDenied />` | n/a |
| Authenticated, org, `read:page.events` allowed | Page visible | Page visible | Row click navigates per F-34 / F-35 |

---

## §6 Business rules

**BR-A — Identifier in path.**
- Input: a navigation to `/events/:eventId`.
- Output: `:eventId` is interpreted as `core_events.event_id` (uuid). It is never `base_application.id`, never `text`. The attendees RPC is invoked with `p_event_id = :eventId`.
- Edge: the "Event not found" UX renders when the RPC returns zero rows for any reason (unknown id, no current-org presence, RLS-deny equivalent inside the RPC body).

**BR-A2 — Header data sourced from RPC payload.**
- Input: the attendees RPC returns at least one row for `(p_organisation_id, p_event_id)`.
- Output: every attendee row carries the event identity columns (`event_id`, `event_name`, `event_date`, `event_days`, `event_venue`). The page header on `/events/:eventId` reads these columns from the first row (all rows for the same event share the same event identity columns). When the RPC returns zero rows, the page renders the "Event not found" UX (BR-A).

**BR-B — Org-scoped reads.**
- Input: any RPC invocation in this slice.
- Output: every RPC invocation passes `p_organisation_id = selectedOrganisation.id`. The RPC body restricts results to that org's presence server-side. The slice does not invent a client-side org filter.

**BR-C — Existence filter for `/events` list.**
- Input: a navigation to `/events`.
- Output: the slice invokes `useSecureSupabase().rpc('app_org_event_summaries', { p_organisation_id: selectedOrganisation.id })`. The RPC returns one row per event for which at least one `core_member` of the requesting org has a non-draft `base_application`. Each row carries `event_id`, `event_name`, `event_date`, `event_days`, `event_venue`, and `members_registered_count` (count of distinct `core_member.id` values that match the existence rule for the event).

**BR-D — Status filter for v1.**
- Input: any RPC body for this slice.
- Output: the RPC excludes `base_application.status = 'draft'` from the count and from the attendee list. Drafts are participant work-in-progress and not visible to the org as a registered presence; both surfaces require at least one submitted-or-beyond application.

**BR-E — Status badge tone.**
- Input: `application_status` value from the attendees RPC row.
- Output: `Badge` tone — Approved → success; Rejected → destructive; Withdrawn → muted; Submitted / Under review → default. Label is the value rendered title-case ("Submitted", "Under review", "Approved", "Rejected", "Withdrawn").

**BR-F — Member identity composition.**
- Input: the attendees RPC row's name fields (`preferred_name`, `first_name`, `last_name`).
- Output: when `preferred_name` is non-empty (after trim), display name is `"{preferred_name} {last_name}"`. Otherwise display name is `"{first_name} {last_name}"`. Used for the Name column copy and for in-memory search matching alongside `last_name`, `first_name`, and `preferred_name`.

**BR-G — Cross-org applicant exclusion.**
- Input: the attendees RPC body.
- Output: rows are restricted to `base_application.organisation_id = p_organisation_id`. A `core_person` who has applications against the same event from multiple orgs renders only the current-org row in the current-org's TEAM-10 view.

**BR-H — Member-row-missing applicants excluded.**
- Input: the attendees RPC body.
- Output: rows are restricted to applicants who have a current-org `core_member` row (`core_member.organisation_id = p_organisation_id AND core_member.deleted_at IS NULL AND core_member.person_id = base_application.person_id`). Provisional / cross-org applicants without a current-org member row do not appear in the attendee list.

**BR-I — Cross-org event read via SECURITY DEFINER bypass.**
- Input: an event whose `core_events.organisation_id` differs from `p_organisation_id` but for which the requesting org has at least one `core_member` with a non-draft `base_application`.
- Output: the SECURITY DEFINER RPC includes the event in the events-list result set and the attendees-list result set. The dev `rbac_select_core_events` policy gap (which would otherwise hide the cross-org event) is bypassed by the RPC running as definer. The slice authors against the planned RPC contract; the RPC body is platform-DB work and is gated in §15.

**BR-J — Cross-app permission contract.**
- Input: the slice's authorisation surface.
- Output: under the SECURITY DEFINER RPC (Path C) the RPC bodies bypass caller-side RLS on `base_application`. The cross-app dependency on BASE `read:page.applications` that would otherwise apply to a direct `base_application` SELECT is eliminated for this surface. The RPC's own access gate (caller is org admin of `p_organisation_id`) is the sole authorisation surface beyond the page guard. Documented in §10.

**BR-K — Event identity columns displayed.**
- Input: the events RPC row and the page header on `/events/:eventId`.
- Output: only `event_name`, `event_date`, `event_days`, `event_venue` are surfaced. All other `core_events` columns (`event_code`, `is_visible`, `registration_scope`, `public_readable`, `expected_participants`, `typical_unit_size`, `event_email`, `participant_blurb`, `participant_admin_email`, `participant_website_url`, `event_colours`, `logo_id`, `description`) are excluded from both surfaces.

**BR-L — Event date span composition.**
- Input: `event_date` and `event_days` from the events RPC row.
- Output:
  - When `event_date IS NULL`: render em-dash "—".
  - When `event_date` is non-null and (`event_days IS NULL` OR `event_days <= 1`): render `event_date` formatted as a localised short date alone (e.g. "5 May 2026").
  - When `event_date` is non-null AND `event_days > 1`: render `"{event_date_short} – {end_date_short}"` where `end_date_short` is `event_date + (event_days - 1) days` formatted as a localised short date (e.g. "5 May 2026 – 7 May 2026").

**BR-M — Upcoming / past tabs.**
- Input: a render of `/events`.
- Output: the events list renders inside `Tabs` with **Upcoming** and **Past** triggers, each showing a filtered `DataTable`. **Upcoming** includes rows where `event_date >= today` (or `event_date IS NULL` treated as upcoming per product decision — default: null dates appear in Upcoming). **Past** includes rows where `event_date < today`. Default selected tab is **Upcoming**. Sort within Upcoming: `event_date ASC NULLS LAST`; within Past: `event_date DESC NULLS LAST`.

**BR-N — Default sort, search, and pagination.**
- Input: a render of either list.
- Output:
  - Events list — default sort `event_date DESC NULLS LAST`; search by case-insensitive substring against `event_name`; `initialPageSize 25`, options `[10, 25, 50]`.
  - Attendee list — default sort `last_name asc, first_name asc`; search by case-insensitive substring across `last_name`, `first_name`, `preferred_name`; `initialPageSize 25`, options `[10, 25, 50]`.

**BR-O — List style.**
- Input: a render of either list.
- Output: both lists render as `DataTable` per TEAM-02 / TEAM-03 convention.

**BR-P — Members-registered count.**
- Input: the events RPC row.
- Output: each row carries `members_registered_count` — the count of distinct `core_member.id` values in the requesting org with a non-draft `base_application` for the event. The events list shows this value in the **Members registered** column.

**BR-Q — Registration type column excluded.**
- Input: the attendee list column set.
- Output: no "Registration type" column renders. The slice does not join `base_registration_type` and does not surface registration-type identity. Member-centric framing only.

**BR-R — Carer column excluded.**
- Input: the attendee list column set.
- Output: no "Carer" column renders. The slice does not join `core_person` via `carer_person_id` and does not surface carer identity. Excluded for v1.

**BR-S — Empty state and not-found copy.**
- Input: a render of an empty list or a not-found event.
- Output:
  - `/events` empty: title "No registered-member events", description "Events appear here once a member of your organisation has an application or registration." No CTA.
  - `/events/:eventId` attendee empty: title "No applicants from your organisation", description "Members of your organisation have no applications recorded for this event." No CTA.
  - `/events/:eventId` not-found: title "Event not found", description "We couldn't find this event for your current organisation.", `<Button variant="outline">← Back to events</Button>` linking to `/events`.

**BR-T — Page guard and resource permissions.**
- Input: route entry.
- Output: both routes are wrapped by `<PagePermissionGuard pageName="events" operation="read">`. No `useResourcePermissions('events')` invocation — the slice is read-only with no inline mutation gating.

**BR-U — Page metadata.**
- Input: page mount.
- Output:
  - `/events`: `usePaceMain({ printTitle: 'Events' })` is called on page mount.
  - `/events/:eventId`: `usePaceMain({ printTitle: 'Event' })` is called on page mount; once the attendees RPC resolves with at least one row, `printTitle` is updated to `event_name` from the RPC payload.

**BR-V — Cross-slice link to Member 360.**
- Input: a click on an attendee row.
- Output: navigate to `/members/:memberId` (TEAM-03) using the row's `member_id` (a `core_member.id` value).

**BR-W — Org switch.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output:
  - On `/events`: the events RPC refetches against the new org; the user sees the new org's data (or the empty state). Any in-flight RPC for the previous org is discarded.
  - On `/events/:eventId`: the attendees RPC refetches against the new org with the same `:eventId`. If the new org has presence in this event, the page silently rebinds. If it does not (the new RPC returns zero rows), the page replaces its content with the org-mismatch alert.

**BR-X — Concurrency and read freshness.**
- Input: any RPC invocation in this slice.
- Output: each invocation reads the current state of the underlying tables. There is no caching beyond what `useSecureSupabase()` provides. A second admin granting / removing access between page renders does not require any client-side reconciliation — the next render reflects the server state.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. The events surface lives behind `/events` and `/events/:eventId`.

### Read contracts

**RPC — `app_org_event_summaries(p_organisation_id uuid)`**

Invocation:
```
useSecureSupabase()
  .rpc('app_org_event_summaries', { p_organisation_id: selectedOrganisation.id })
```

Return shape — array of rows. Each row contract:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `event_id` | uuid | NO | `core_events.event_id` |
| `event_name` | varchar | NO | `core_events.event_name` |
| `event_date` | date | YES | `core_events.event_date` |
| `event_days` | integer | YES | `core_events.event_days` |
| `event_venue` | varchar | YES | `core_events.event_venue` |
| `members_registered_count` | integer | NO | Distinct `core_member.id` count for the event in the requesting org, post-non-draft filter |

Row inclusion criteria (RPC body):
- The event has at least one `base_application` row WHERE `base_application.event_id = core_events.event_id` AND `base_application.organisation_id = p_organisation_id` AND `base_application.status != 'draft'`.
- The applicant has a `core_member` row WHERE `core_member.person_id = base_application.person_id` AND `core_member.organisation_id = p_organisation_id` AND `core_member.deleted_at IS NULL`.
- `members_registered_count` is the count of distinct `core_member.id` values that satisfy the above for the event.

Authorisation gate (RPC body): SECURITY DEFINER. Reads are permitted when the caller is super-admin OR the caller is an org admin of `p_organisation_id` (per the platform's `check_user_is_org_admin(p_organisation_id)` or equivalent helper — exact gate is the platform-DB engineer's choice, recorded in the RPC body documentation).

**RPC — `app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)`**

Invocation:
```
useSecureSupabase()
  .rpc('app_org_event_attendees', { p_organisation_id: selectedOrganisation.id, p_event_id: :eventId })
```

Return shape — array of rows. Each row contract:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `member_id` | uuid | NO | `core_member.id` |
| `person_id` | uuid | NO | `core_person.id` |
| `first_name` | text | NO | `core_person.first_name` |
| `last_name` | text | NO | `core_person.last_name` |
| `preferred_name` | text | YES | `core_person.preferred_name` |
| `application_status` | text | NO | `base_application.status` (one of `'submitted'`, `'under_review'`, `'approved'`, `'rejected'`, `'withdrawn'` — drafts excluded by BR-D) |
| `event_id` | uuid | NO | `core_events.event_id` (carried for header rendering) |
| `event_name` | varchar | NO | `core_events.event_name` (carried for header rendering) |
| `event_date` | date | YES | `core_events.event_date` (carried for header rendering) |
| `event_days` | integer | YES | `core_events.event_days` (carried for header rendering) |
| `event_venue` | varchar | YES | `core_events.event_venue` (carried for header rendering) |

Row inclusion criteria (RPC body):
- The applicant has a `base_application` row WHERE `base_application.event_id = p_event_id` AND `base_application.organisation_id = p_organisation_id` AND `base_application.status != 'draft'`.
- The applicant has a `core_member` row WHERE `core_member.person_id = base_application.person_id` AND `core_member.organisation_id = p_organisation_id` AND `core_member.deleted_at IS NULL`.
- The row's name fields are sourced from `core_person` joined on `core_person.id = base_application.person_id`.
- The row's event identity columns are sourced from `core_events` joined on `core_events.event_id = p_event_id`.

Empty result shape: when no rows satisfy the criteria, the RPC returns `[]`. The page interprets `[]` as "Event not found" (BR-A).

Authorisation gate (RPC body): SECURITY DEFINER. Same gate as `app_org_event_summaries` — caller is super-admin OR org admin of `p_organisation_id`.

### Query-key contract

- Events list: `['events', selectedOrganisation.id]`.
- Attendees: `['events', selectedOrganisation.id, eventId, 'attendees']`.
- Org switch invalidates both keys against the new org.

### Write contracts

This slice has no write contracts. There are no inserts, updates, or deletes performed by TEAM-10. Both surfaces are read-only.

### RLS / permission contracts

The slice does not perform PostgREST reads against `core_events` or `base_application` directly; the SECURITY DEFINER RPCs are the only data path, so caller-side RLS on those tables is not the authorisation surface for this slice.

For completeness:
- The RPCs are SECURITY DEFINER; their bodies bypass RLS on the tables they read. The RPC's own access gate (caller is super-admin OR org admin of `p_organisation_id`) is the sole authorisation surface beyond the page guard.
- The page guard uses canonical `pageName = 'events'` and `operation = 'read'`. `rbac_app_pages` must have a row with `page_name = 'events'`, `app_id = data_get_app_id('TEAM')`, and `scope_type = 'organisation'` (post-build seeding noted in TEAM-01).

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-10 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Events"), and the `PaceAppLayout` chrome. TEAM-10 renders inside that chrome.
- **TEAM-03** owns `/members/:memberId`. TEAM-10 navigates there on attendee row click using the row's `member_id` (a `core_member.id` value). TEAM-03 is responsible for any further authorisation on the detail surface.

### ID contracts

- `core_events.event_id` (uuid) — primary identifier in the route path `/events/:eventId` and the parameter to `app_org_event_attendees(p_event_id)`. Verified `uuid` on dev for both `core_events.event_id` and `base_application.event_id`.
- `core_member.id` (uuid) — used in the `/events/:eventId` attendee row navigation to `/members/:memberId`. Consumed by TEAM-03.
- `selectedOrganisation.id` (uuid) — passed as `p_organisation_id` to both RPCs. Read from `useOrganisationsContext().selectedOrganisation`.

---

## §8 Data and schema references

### RPCs accessed

| RPC | Access | Via |
|---|---|---|
| `app_org_event_summaries(p_organisation_id uuid)` | INVOKE | `useSecureSupabase().rpc(...)` |
| `app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)` | INVOKE | `useSecureSupabase().rpc(...)` |

### Tables read indirectly via the RPC bodies

| Table | Access | Notes |
|---|---|---|
| `core_events` | SELECT (inside RPC body, as definer) | Only `event_id`, `event_name`, `event_date`, `event_days`, `event_venue` are surfaced |
| `base_application` | SELECT (inside RPC body, as definer) | Only `event_id`, `person_id`, `organisation_id`, `status` participate; status filter `!= 'draft'` is applied server-side |
| `core_member` | SELECT (inside RPC body, as definer) | Only `id`, `person_id`, `organisation_id`, `deleted_at IS NULL` participate; rows without a current-org member are excluded |
| `core_person` | SELECT (inside RPC body, as definer) | Only `id`, `first_name`, `last_name`, `preferred_name` are surfaced for attendee identity |

### `core_events` columns relevant to the RPC return shape (live dev-db)

| Column | Type | Nullable |
|---|---|---|
| `event_id` | uuid | NO (PK; default `gen_random_uuid()`) |
| `event_name` | varchar | NO |
| `event_date` | date | YES |
| `event_days` | integer | YES |
| `event_venue` | varchar | YES |
| `organisation_id` | uuid | NO |

### `base_application` columns relevant to the RPC body (live dev-db)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | NO | FK → `core_events.event_id` |
| `person_id` | uuid | NO | FK → `core_person.id` |
| `organisation_id` | uuid | NO | FK → `core_organisations.id` |
| `status` | text | NO | CHECK `(status = ANY (ARRAY['draft','submitted','under_review','approved','rejected','withdrawn']))`; default `'draft'` |

UNIQUE constraint: `(event_id, person_id)` — one application per person per event.

### `core_member` columns relevant to the RPC body (live dev-db)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `person_id` | uuid | NO | FK → `core_person.id` |
| `organisation_id` | uuid | NO | FK → `core_organisations.id` |
| `deleted_at` | timestamptz | YES | RPC filters `deleted_at IS NULL` |

### `core_person` columns relevant to the RPC return shape (live dev-db)

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NO |
| `first_name` | text | NO |
| `last_name` | text | NO |
| `preferred_name` | text | YES |

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

Every verification step here targets dev-db only.

- Confirm `app_org_event_summaries(p_organisation_id uuid)` exists, is `SECURITY DEFINER`, and returns the documented row shape. **If absent on dev, this slice is blocked — see §15.**
- Confirm `app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)` exists, is `SECURITY DEFINER`, and returns the documented row shape. **If absent on dev, this slice is blocked — see §15.**
- Confirm `core_events.event_id` is `uuid` (verified) and `base_application.event_id` is `uuid` (verified). The FK `base_application_event_id_fkey` is `(event_id) REFERENCES core_events(event_id) ON DELETE CASCADE`.
- Confirm `base_application.status` CHECK constraint accepts the six values listed above and that `'draft'` is one of them.
- Confirm `core_events.event_days` is `integer` (used for date-span composition per BR-L).
- Confirm `core_events.event_venue` is `varchar` (nullable; em-dash when null).
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Confirm an `rbac_app_pages` row for `page_name = 'events'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` is in place (post-TEAM-01 seeding).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `PagePermissionGuard` page-level gate.
- `pace-core2/packages/core/docs/database/domains/team.md` — `core_member`, `core_person` shape references.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for both RPC invocations |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="events"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for the RPC org parameter and org-switch detection |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle` to "Events" on `/events` and to the resolved event name on `/events/:eventId` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@solvera/pace-core/components` | Event header card on `/events/:eventId` |
| `Button` | `@solvera/pace-core/components` | Back button on `/events/:eventId`; Retry button on RPC error state; "Back to events" button on Event-not-found and Org-mismatch surfaces |
| `DataTable` | `@solvera/pace-core/components` | Events list on `/events`; attendee list on `/events/:eventId` |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | RPC fetch-error alert; Org-mismatch alert |
| `Badge` | `@solvera/pace-core/components` | Application status badge on the attendee list |
| `LoadingSpinner` | `@solvera/pace-core/components` | Full-page initial loading on both routes; background refetch loading row inside `DataTable` |
| `toast` | `@solvera/pace-core/components` | Module-level toast for unexpected RPC / network failures during background refetch |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalise RPC errors for inline `Alert` description and toast copy |
| `ChevronLeft` | `@solvera/pace-core/icons` | Back-button glyph on `/events/:eventId` |

### §9.2 Slice-specific caveats

- **`useSecureSupabase().rpc(...)` is the only data path.** Do not author PostgREST embedded selects against `core_events` or `base_application`. Both lists go through the SECURITY DEFINER RPCs. If the RPCs do not exist on dev, the slice is implementation-blocked per §15.
- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in RPC handlers must abort the invocation when `selectedOrganisation` is null mid-render (for example during an org switch). Do not invoke either RPC with `p_organisation_id: undefined`.
- **`DataTable` row-click semantics.** This slice does not use `actions`, `onCreateRow`, `onEditRow`, or `onDeleteRow`. Row-click is wired via the slice's own click handler attached to each row (or via an `actions` entry whose visible button is hidden but whose `onClick` is invoked on row click — pick whichever the build agent confirms is the supported `DataTable` row-click affordance). The handler navigates: events list → `/events/:eventId`; attendee list → `/members/:memberId`.
- **`DataTable` features for read-only sections.** Both tables set `features.import: false`, `features.export: false`, `features.hierarchical: false`, `features.grouping: false`, `features.creation: false`, `features.editing: false`, `features.deletion: false`, `features.deleteSelected: false`, `features.selection: false`, `features.search: true`, `features.pagination: true`, `features.sorting: true`, `features.filtering: true`, `features.columnVisibility: true`, `features.columnReordering: true`. Do not pass `onCreateRow`, `onEditRow`, or `onDeleteRow`.
- **No `useResourcePermissions` consumption.** This slice does not call `useResourcePermissions('events')`. The page guard alone gates access; there are no per-row create / update / delete affordances.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **Implementation gate.** Both RPCs (`app_org_event_summaries`, `app_org_event_attendees`) must land on dev before this slice can be implemented — see §15.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/events` | `events` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |
| `/events/:eventId` | `events` | `read` | `<AccessDenied />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read events list and event detail | `read:page.events` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Row navigate to `/events/:eventId` | n/a at this slice | TEAM-10 page guard re-evaluates on the new route | Event-not-found / `<AccessDenied />` per the new route's evaluation |
| Row navigate to `/members/:memberId` | n/a at this slice | TEAM-03 enforces detail-page guard | TEAM-03's responsibility |

### Server-side enforcement

- The two RPCs are `SECURITY DEFINER`. Their bodies enforce authorisation by checking that the caller is super-admin OR an org admin of `p_organisation_id` before joining and returning rows. Inside the function body, the join over `core_events`, `base_application`, `core_member`, `core_person` runs as definer and is not constrained by caller-side RLS on those tables. As a result, the slice does not consume the cross-app BASE `read:page.applications` permission that would otherwise be required for a direct caller-side `base_application` SELECT.
- The page guard (`pageName = 'events'`, `operation = 'read'`, app `TEAM`) is the only RBAC permission this slice depends on at the caller-side surface. TEAM staff are seeded with `read:page.events` for their org admin scope at production seeding time.

---

## §11 Acceptance criteria

- [x] **AC-01 — `/events` page entry, authenticated, has org, has read permission.**
Given a user is authenticated, has an org, and has `read:page.events`, when they navigate to `/events`, then the page renders the heading "Events" and a `DataTable` with columns Event name, Event date, Event venue, Members registered, populated from the `app_org_event_summaries` RPC call. (Traces F-01, F-02, F-03, F-04, F-22, F-23, F-24, F-25, F-26.)

- [x] **AC-02 — `/events` default sort.**
Given the events RPC returns three rows with `event_date` values "2026-05-10", "2026-05-01", and `null`, when the page renders with `initialSorting: [{ id: 'event_date_sort_key', desc: true }]`, then rows render in the order "2026-05-10", "2026-05-01", `null` (NULLS LAST in descending order). (Traces F-39, BR-M, BR-N.)

- [x] **AC-03 — `/events` event-date range when `event_days > 1`.**
Given an events row has `event_date = "2026-05-05"` and `event_days = 3`, when the row renders, then the **Event date** cell shows "5 May 2026 – 7 May 2026" (the end date is computed as `event_date + (event_days - 1) days`). (Traces F-24, BR-L.)

- [x] **AC-04 — `/events` event-date single day when `event_days <= 1`.**
Given an events row has `event_date = "2026-05-05"` and `event_days IS NULL` (or `event_days = 1`), when the row renders, then the **Event date** cell shows "5 May 2026". (Traces F-24, BR-L.)

- [x] **AC-05 — `/events` event-date em-dash when null.**
Given an events row has `event_date IS NULL`, when the row renders, then the **Event date** cell shows "—" and the row sorts to the bottom under default descending sort. (Traces F-24, BR-L, BR-M.)

- [x] **AC-06 — `/events` event-venue em-dash when null.**
Given an events row has `event_venue IS NULL`, when the row renders, then the **Event venue** cell shows "—". (Traces F-25.)

- [x] **AC-07 — `/events` members-registered count.**
Given an events row has `members_registered_count = 4`, when the row renders, then the **Members registered** cell shows "4". (Traces F-26, BR-P.)

- [x] **AC-08 — `/events` empty state.**
Given a user enters `/events` for an org that has zero events with current-org member presence, when the page loads, then the events `DataTable` renders the empty state title "No registered-member events" and description "Events appear here once a member of your organisation has an application or registration." with no CTA. (Traces F-15, BR-S.)

- [ ] **AC-09 — `/events` search filters in-memory.**
Given the events list has multiple rows and the user types "summer" into the search input, when the search executes, then only rows whose `event_name` contains "summer" (case-insensitive) remain visible; clearing the input restores all rows. (Traces F-37, BR-N.)

- [x] **AC-10 — `/events` row click navigates to event detail.**
Given the events list has at least one row, when the user clicks a row, then the app navigates to `/events/:eventId` where `:eventId` is the clicked row's `event_id`. (Traces F-34, F-45.)

- [x] **AC-11 — `/events/:eventId` page entry and header render.**
Given a user has `read:page.events` and navigates to `/events/:eventId` for an event the current org has presence in, when the attendees RPC returns at least one row, then the page renders the Back button at top-left, an event header card showing `event_name` as heading, the formatted event-date span beneath, and `event_venue` as subtitle, followed by the attendee `DataTable` with columns Name and Application status. (Traces F-06, F-07, F-09, F-10, F-28, F-30, F-31, F-32.)

- [x] **AC-12 — `/events/:eventId` event-not-found UX.**
Given a user navigates to `/events/:eventId` for an event id that the current org has no presence in (RPC returns zero rows), when the page renders, then the page replaces its content with the heading "Event not found", description "We couldn't find this event for your current organisation.", and a "← Back to events" button that navigates to `/events`. (Traces F-16, BR-A, BR-S.)

- [x] **AC-13 — `/events/:eventId` attendee name composition.**
Given an attendee row has `preferred_name = "Sam"`, `first_name = "Samantha"`, `last_name = "Doe"`, when the row renders, then the **Name** cell shows "Sam Doe". When `preferred_name IS NULL` or empty, the cell shows "Samantha Doe". (Traces F-31, BR-F.)

- [x] **AC-14 — `/events/:eventId` application status badge tones.**
Given the attendee list has rows with statuses "submitted", "under_review", "approved", "rejected", "withdrawn", when the rows render, then the **Application status** cells render badges "Submitted" (default tone), "Under review" (default tone), "Approved" (success tone), "Rejected" (destructive tone), "Withdrawn" (muted tone). (Traces F-32, BR-E.)

- [ ] **AC-15 — `/events/:eventId` drafts excluded.**
Given a member of the current org has a `base_application` with `status = 'draft'` for the event, when the page renders, then that member does not appear in the attendee list and the count in the description does not include them. (Traces F-52, BR-D.)

- [ ] **AC-16 — `/events/:eventId` cross-org applicants excluded.**
Given a `core_person` has applications for the same event from two organisations and the user is signed in with org A selected, when the page renders, then the attendee list shows only the org A application row (not the other-org application row). (Traces F-53, BR-G.)

- [ ] **AC-17 — `/events/:eventId` member-row-missing applicants excluded.**
Given a `base_application` exists for the event but the applicant has no `core_member` row in the current org (`core_member.organisation_id != p_organisation_id` OR no row at all), when the page renders, then that applicant does not appear in the attendee list. (Traces F-54, BR-H.)

- [x] **AC-18 — `/events/:eventId` row click navigates to Member 360.**
Given the attendee list has at least one row, when the user clicks a row, then the app navigates to `/members/:memberId` where `:memberId` is the clicked row's `member_id`. (Traces F-35, F-46, BR-V.)

- [x] **AC-19 — `/events/:eventId` Back button navigates to events list.**
Given the page has loaded, when the user clicks the "← Back to events" button at top-left of the `PaceMain` content area, then the app navigates to `/events`. (Traces F-36, F-47.)

- [x] **AC-20 — Permission denied — read.**
Given a user is authenticated and has org context but lacks `read:page.events`, when they navigate to `/events` or `/events/:eventId`, then `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." and no list, header, or table renders. (Traces F-20, F-42.)

- [x] **AC-21 — RPC error state on `/events`.**
Given the `app_org_event_summaries` RPC fails, when the error is returned, then the page replaces its content with `<Alert variant="destructive">` titled "Could not load events" with description sourced from `HandleSupabaseError(error, { context: 'app_org_event_summaries' })` and a Retry button beneath; clicking Retry re-runs the RPC. (Traces F-18.)

- [x] **AC-22 — Org switch on `/events` refetches list.**
Given the user has the events list visible for org A, when they switch to org B in the org context selector, then the events RPC refetches against org B and the user sees org B's data (or the events-list empty state). (Traces F-48, BR-W.)

- [x] **AC-23 — Org switch on `/events/:eventId` with no presence renders org-mismatch.**
Given the user is on `/events/:eventId` for an event where org A has presence, when they switch the org context to org B (which has no presence in this event), then the page replaces its content with `<Alert variant="destructive">` titled "This event is not in your current organisation", description "Switch back, or return to the events list.", and a "Back to events" button navigating to `/events`. (Traces F-19, F-49, BR-W.)

- [ ] **AC-24 — Cross-org leakage prevention.**
Given an event exists for org B but org A has no presence, when the user is signed in with org A selected and the events RPC returns its list, then no row for the org-B-only event is returned by the RPC, regardless of search input. (Traces F-50, BR-G, BR-I.)

---

## §12 Verification

- **MCP test — `app_org_event_summaries` exists and is `SECURITY DEFINER`.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), confirm the function exists (`pg_proc`), `prosecdef = true`, and the argument list is `(p_organisation_id uuid)`. **If absent, the slice is blocked — see §15.**
- **MCP test — `app_org_event_attendees` exists and is `SECURITY DEFINER`.** Against dev-db, confirm the function exists (`pg_proc`), `prosecdef = true`, and the argument list is `(p_organisation_id uuid, p_event_id uuid)`. **If absent, the slice is blocked — see §15.**
- **MCP test — `app_org_event_summaries` return shape.** Invoke the RPC with a known org id and confirm the row shape contains `event_id (uuid)`, `event_name (varchar)`, `event_date (date)`, `event_days (integer)`, `event_venue (varchar)`, `members_registered_count (integer)`.
- **MCP test — `app_org_event_attendees` return shape.** Invoke the RPC with a known org id and event id and confirm the row shape contains `member_id (uuid)`, `person_id (uuid)`, `first_name (text)`, `last_name (text)`, `preferred_name (text)`, `application_status (text)`, `event_id (uuid)`, `event_name (varchar)`, `event_date (date)`, `event_days (integer)`, `event_venue (varchar)`.
- **MCP test — `core_events.event_id` and `base_application.event_id` are uuid.** Confirm via `information_schema.columns` that both are `uuid`. The FK `base_application_event_id_fkey` is intact.
- **MCP test — `base_application.status` CHECK constraint.** Confirm the CHECK accepts the six values `'draft'`, `'submitted'`, `'under_review'`, `'approved'`, `'rejected'`, `'withdrawn'`.
- **MCP test — `rbac_app_pages` seeding.** Confirm a row exists with `page_name = 'events'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'`.
- **MCP test — drafts excluded.** Insert a `base_application` row for a known member and event with `status = 'draft'`. Invoke `app_org_event_summaries` for the org. Confirm the event does not appear in the result if the draft is the only application; confirm the `members_registered_count` does not include the draft applicant when other applicants exist.
- **In-app demo — happy path `/events`.** Sign in as a TEAM org admin. Visit `/events`. Confirm the events list renders with rows in `event_date DESC NULLS LAST` order. Confirm each row shows Event name, Event date (single day or range), Event venue (or "—"), Members registered count.
- **In-app demo — happy path `/events/:eventId`.** Click an event row. Confirm navigation to `/events/:eventId`. Confirm the header card shows the event name, formatted date span, and venue. Confirm the attendee list shows current-org members with non-draft applications. Click an attendee row. Confirm navigation to `/members/:memberId`.
- **In-app demo — event-not-found.** Manually navigate to `/events/<known-other-org-event-id>` for an event the current org has no presence in. Confirm the "Event not found" page renders with a "← Back to events" button.
- **In-app demo — org switch on `/events/:eventId`.** Open a `/events/:eventId` page for org A. Switch the org context to org B. Confirm either silent rebind (org B has presence) or org-mismatch alert (org B has no presence).
- **In-app demo — search.** Type a partial event name into the events list search; confirm only matching rows remain. Type a partial member name into the attendee list search; confirm only matching rows remain.

---

## §13 Testing requirements

- Component test — events `DataTable` renders the four columns in order (Event name, Event date, Event venue, Members registered) and applies the default `event_date DESC NULLS LAST` sort.
- Component test — attendee `DataTable` renders the two columns in order (Name, Application status) and applies the default `(last_name asc, first_name asc)` sort.
- Component test — event-date span composition: `event_days > 1` produces a range, `event_days <= 1` or null produces a single date, `event_date IS NULL` produces "—".
- Component test — attendee name composition prefers `preferred_name + last_name` when `preferred_name` is non-empty, else falls back to `first_name + last_name`.
- Component test — application status badge tone mapping: Approved → success; Rejected → destructive; Withdrawn → muted; Submitted / Under review → default.
- Component test — event-not-found UX renders when the attendees RPC returns zero rows.
- Component test — org-mismatch UX renders when the org switches and the new org has no presence in the loaded event.
- Integration test — both RPCs are invoked with `p_organisation_id` from `selectedOrganisation.id`; mocked RPC returning the documented shape.
- Integration test — drafts excluded by the RPC contract: a fixture with mixed-status applications produces a row count and `members_registered_count` that exclude drafts.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads must go via `useSecureSupabase().rpc(...)`. Do not call `createClient` directly. Do not author PostgREST embedded selects against `core_events` or `base_application`.
- Do not implement any insert, update, or delete from this slice. Both surfaces are read-only.
- Do not consume `useResourcePermissions('events')` — `<PagePermissionGuard>` is the sole permission gate for this surface.
- Do not author the SECURITY DEFINER RPC bodies (`app_org_event_summaries`, `app_org_event_attendees`) from inside this slice. Those are upstream platform-DB work; the slice depends on them (§15).
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.

---

## §15 Done criteria

- All 24 acceptance criteria (AC-01 through AC-24) verified via the slice's QA pack.
- **Implementation blocked until:**
  - **(a)** `app_org_event_summaries(p_organisation_id uuid)` RPC lands on verified-contract project `yihzsfcceciimdoiibif` (backend-ready MCP target) with the documented return shape (per §7), is `SECURITY DEFINER`, joins `core_events` + `base_application` + `core_member` + `core_person` server-side, scopes reads to the requesting org's presence, excludes draft applications (`base_application.status != 'draft'`), and bypasses the `rbac_select_core_events` cross-org gap by running as definer.
  - **(b)** `app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)` RPC lands on dev with the documented return shape (per §7), is `SECURITY DEFINER`, joins the same tables server-side, applies the same status / org-membership / draft exclusions, and returns `[]` when no rows match (interpreted by the slice as Event-not-found).
  - The v6 slice does not author the RPC bodies. Until items (a) and (b) are confirmed via Supabase MCP against dev, this slice cannot be marked Done.
- Post-build RBAC seeding reminder noted in TEAM-01: `rbac_app_pages` must include the row for `page_name = 'events'` with `scope_type = 'organisation'` for the TEAM app before release.
- The cross-org event read scenario (current org's members are registered for an event hosted by another org) renders correctly: the event appears on `/events`, the detail page renders the event header from the RPC payload, and the attendee list shows the current-org members. This relies on the SECURITY DEFINER bypass (BR-I).

---

## §16 Do not

- Do not implement any insert, update, or delete on `core_events` or `base_application` from this slice. Both surfaces are read-only.
- Do not surface a "list of applications" anywhere in the slice. The framing is member-centric: a list of events the org has presence in (at `/events`) and a list of members of the org with applications for the event (at `/events/:eventId`).
- Do not surface the BASE-leaning `core_events` columns: `is_visible`, `registration_scope`, `public_readable`, `event_code`, `expected_participants`, `typical_unit_size`, `event_email`, `participant_blurb`, `participant_admin_email`, `participant_website_url`, `event_colours`, `logo_id`, `description`. Only `event_name`, `event_date`, `event_days`, `event_venue` are in scope.
- Do not surface a "Registration type" column on the attendee list. Member-centric framing only.
- Do not surface a "Carer" column on the attendee list in v1.
- Do not show drafts (`base_application.status = 'draft'`) in either list. The RPC enforces this server-side; the client must not attempt to relax the filter.
- Do not show attendees who do not have a `core_member` row in the current organisation. The RPC enforces this server-side.
- Do not author a direct PostgREST embedded select against `base_application` joined to `core_events`. The slice's only data path is the SECURITY DEFINER RPCs.
- Do not introduce a `team_unit` legacy construct anywhere in this slice. TEAM-10 owns no unit / team / squad concept.
- Do not reference a `base_event_registration` table — no such table exists in the platform schema.
- Do not implement custom RBAC checks. Use only `<PagePermissionGuard pageName="events" operation="read">`.
- Do not consume `useResourcePermissions('events')` — `PagePermissionGuard` alone gates this surface.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not introduce optimistic locking, watermark checks, or local caching beyond what `useSecureSupabase()` and `DataTable` provide.
- Do not run any verification or smoke test against production. Non-prod only: MCP catalogue queries use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); browser/runtime uses `SUPABASE_PROJECT_REF`.
- Do not author the SECURITY DEFINER RPC bodies from inside this slice — that is platform-DB work.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; events surface; member-centric framing for events × applications.
- `/rebuild/architecture.md` — slice ownership (TEAM-10), route registry (`/events`, `/events/:eventId`), canonical `pageName` map (`events`), member-centric inclusion rule, restrictive existence-filtering posture.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Events entry), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`**, so any descendant route (including this slice) can call `toast(...)`. TEAM-10 depends on this mount; without it, `toast(...)` throws.
- **TEAM-03** — owns `/members/:memberId`. TEAM-10 hands off the attendee row click to TEAM-03 using `core_member.id`.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `PagePermissionGuard` page-level gate. **SECURITY DEFINER RPC posture for cross-app reads:** when caller-side RLS on a referenced table would block the read but the calling surface has its own org-admin authorisation (here, `read:page.events` plus the RPC's own org-admin check), a SECURITY DEFINER RPC is the canonical pattern for joining cross-app tables (`core_events` + `base_application`) without inheriting the cross-app permission requirement (`read:page.applications`) that direct caller-side reads would impose. The two RPCs in this slice apply this pattern.
- **Implementation gate (RPC contracts):** `app_org_event_summaries(p_organisation_id uuid)` and `app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)` must land on dev with the documented return shapes (per §7) before this slice can be implemented. The RPC contract authoring is documented in §7 with explicit row shapes so the platform-DB engineer can author the bodies from the slice alone. Until both RPCs land on dev, the v6 slice cannot be marked Done — see §15.
