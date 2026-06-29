# TEAM-05 — Member requests queue & review

## §1 Slice metadata

```
Slice ID:        TEAM-05
Name:            Member requests queue & review
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems, Approvals nav cell)
Backend impact:  Schema changes (upstream platform: extend team_member_request_type enum with 'join'/'transfer'; extend team_member_request_status enum with 'on_hold'; add columns target_organisation_id, source_organisation_id, membership_type_id, applicant_member_number, review_notes to team_member_request; update app_submit_member_request RPC to accept request_type and insert provisional core_member; update app_resolve_member_request RPC to accept 'on_hold' and execute member-side effects atomically — see §15 implementation gate)
Frontend impact: UI
Routes owned:    /approvals; /approvals/:requestId
QA pack:         docs/test-packs/TM05-qa-pack.md
```

---

## §2 Overview

TEAM-05 delivers the join and transfer request queue and review surface for org-admin staff at `/approvals`. The page renders two tabs — **Open queue** (default: `pending` and `on_hold` requests for the currently selected organisation) and **Resolved** (read-only history of `approved`, `rejected`, and `withdrawn` requests) — with in-page list selection driving a **two-pane** layout: a custom scrollable request list on the left and a detail/review panel on the right. Selection is held in component state (not a child URL). The review panel shows applicant details, request metadata, form responses, and the resolve action rail (Approve / Put on hold / Reject) for `pending` requests. All resolve transitions go through the `app_resolve_member_request` RPC. Route read is enforced by shell `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts).

**Prototype reference:** `pace-prototype/apps/pace-team/pages/ApprovalsEventsPages.jsx` — `ApprovalsPage` (two-pane queue + in-page review; optional `initialId` for deep-link only in prototype hash router).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single, request-centric surface to triage incoming join and transfer requests for their currently selected organisation, review applicant details and submitted form answers in one place, and resolve each request with an audit-tracked outcome. TEAM-05 produces that surface. It does not own membership directory listing, member detail editing, role assignments, comms composition, form authoring, external-validation configuration, or request submission — those live in adjacent slices.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Approvals queue — Open tab (default) | `/approvals` | `team_member_request` rows for the current organisation where `status IN ('pending','on_hold')` and `request_type IN ('join','transfer')`. |
| Approvals queue — Closed tab | `/approvals` | `team_member_request` rows for the current organisation where `status IN ('approved','rejected','withdrawn')` and `request_type IN ('join','transfer')`. Read-only history. |
| Review panel | `/approvals/:requestId` | Single-request review and resolve. Hybrid layout: side-by-side at `md+`, stacked at `<md` (queue is hidden when child route is active). |
| Resolve dialogs | overlay on `/approvals/:requestId` | Approve, Reject, Put on hold confirmation dialogs (per BR-04 / BR-05 / BR-06). |

### Boundaries

TEAM-05 does **not** own:
- The Member 360 detail surface at `/members/:memberId` — that is TEAM-03. The review panel cross-links to it when the member row exists.
- The Member directory at `/members` — that is TEAM-02. The Pending view there reads the same `team_member_request` rows but is a directory list, not a review surface.
- Org form authoring (`org_signup`) — that is TEAM-09 (`/forms`). The right column of the review panel renders responses to a form authored by TEAM-09; it does not author or edit the form.
- External validation configuration on `core_org_settings.member_validation_config` — that is TEAM-08 (`/settings/org`).
- External validation status / message display on the review panel — out of v1 scope (mirrors TEAM-08 Operational deferral). Deferred to a follow-up slice once `external_validation_status` / `external_validation_message` columns and the effective-config helper land on dev.
- Submission of member requests (creating the `team_member_request` row and the provisional `core_member` row) — that is TEAM-09 + Portal via `app_submit_member_request`.
- Withdrawal of member requests — that is the Portal participant flow via `app_withdraw_member_request`. Org admins never withdraw on behalf of an applicant.
- The schema migration that extends `team_member_request_type` and `team_member_request_status` enums, adds the planned-contract columns, and updates the RPCs — that is upstream platform work (see §15).
- Profile-completeness indicator — out of v1 scope (deferred).

### Architectural posture

**RPC-only resolve mutations.** All resolve transitions go through `app_resolve_member_request(p_request_id, p_status, p_review_notes?, p_member_number?)`. The slice does not call `.from('team_member_request').update(...)` or `.delete(...)` directly, and does not write `core_member` from the client. Member-side effects (set `core_member.membership_status='Active'`, assign member number, DELETE provisional row on reject, set source-org member to `Resigned` on transfer-approve) execute server-side inside the RPC, atomically with the request status change.

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**Action-level RBAC.** The action rail (Approve / Put on hold / Reject) is rendered only when `useResourcePermissions('approvals', 'update')` returns a `canUpdate === true` flag for the current org context. Server-side authority is `team_member_request_can_resolve`, which checks `update:member-profiles` under app PACE; the two keys do not need to agree because the server is the final authority and the UI gate is a render hint.

**Hybrid routing.** Parent layout component renders the queue as the default content when no `:requestId` is present, and renders `<Outlet />` for the review panel when a `:requestId` is present. At `md` and above, the layout is two-column (queue ~360–480px wide on the left, review panel `flex-1` on the right). Below `md`, the layout is single-column: when a child route is active, the queue is hidden; when no child route is active, the review panel is hidden. Composition uses CSS grid/flex inline; no new pace-core2 capability is introduced.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (resolve success, resolve error, stale-resolve warning, org-switch redirect, request-not-found redirect). `ToastProvider` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it.

**Page metadata.** `usePaceMain({ printTitle: 'Approvals' })` is called on parent layout mount.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

**Open count nav badge contract.** TEAM-05 publishes a count query at the key `['approvals', 'open-count', selectedOrganisation.id]` returning the count of `team_member_request` rows for the current org where `status = 'pending'` AND `request_type IN ('join','transfer')`. TEAM-01's nav cell consumes this key. The slice invalidates the key on resolve success and on org-switch.

### Page-level guards and evaluation ordering

The routes `/approvals` and `/approvals/:requestId` sit inside `AuthenticatedShell` (TEAM-01) and register read access in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts); shell `routeAccessDenied` enforces entry. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; no feature content or guard is shown.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state from TEAM-01. shell route read is not evaluated; no RBAC query fires.
4. **Route read access** — Once org context is resolved, shell `routeAccessDenied` (via [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts)) evaluates the route's registered `pageName` / `read` permission. Scope resolves internally from `OrganisationServiceProvider`; no page-level read guard wraps the component tree. While the shell RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable. On deny, `<AccessDenied />` renders in the shell main region. On allow, the page body renders.
5. **Action-rail visibility check** — Inside the page body, when a review panel is rendered, the slice calls `useResourcePermissions('approvals', 'update')`. While that check is in flight, the action rail does not render. On `canUpdate === false`, the action rail is hidden. On `canUpdate === true`, the action rail renders.

If `selectedOrganisation` resolves to `null` after step 3 (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/approvals` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.approvals` permission.
- **F-02** On parent layout mount, the page sets `printTitle` to "Approvals" via `usePaceMain`.
- **F-03** The page title is "Approvals" (sentence case). No breadcrumb is rendered.
- **F-04** The page renders two tabs in this order — **Open** (default, active) and **Closed**.
- **F-05** On entry, the Open tab issues a SELECT against `team_member_request` joined to `core_person` (subject), optional `core_member` (subject), optional `core_membership_type`, and optional `core_organisations` (source-org name when transfer), filtered by `organisation_id = selectedOrganisation.id`, `status IN ('pending','on_hold')`, `request_type IN ('join','transfer')`, ordered by `created_at` ascending (BR-14).
- **F-06** When the Closed tab is opened, the page issues a SELECT with the same joins, filtered by `organisation_id = selectedOrganisation.id`, `status IN ('approved','rejected','withdrawn')`, `request_type IN ('join','transfer')`, ordered by `resolved_at` descending (BR-14).
- **F-07** The route `/approvals/:requestId` renders the review panel inside the parent layout's `<Outlet />`. The review panel issues a SELECT against `team_member_request` joined to subject `core_person`, optional `core_member`, optional `core_membership_type`, optional source-org `core_organisations`, and optional resolver `core_person` (via `resolved_by`), filtered by `id = :requestId AND organisation_id = selectedOrganisation.id`. A separate SELECT fetches form responses (BR-11).

### Loading states

- **F-08** While the Open or Closed list query is in flight, the corresponding tab's `DataTable` renders its built-in loading state: a Card → Table → TableCaption (title + description + toolbar with search + request-type filter pill + column-visibility popover) → a single full-width row containing `<LoadingSpinner label="Loading table" />`. Switching tabs does not cancel the other tab's data when prefetched.
- **F-09** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).
- **F-10** While the review-panel request query is in flight, a full-pane `<LoadingSpinner />` renders inside the review panel area. The action rail does not render until the query resolves.
- **F-11** While the form-responses query is in flight, the right column of the review panel renders `<LoadingSpinner label="Loading responses" />` inside its area; the left column continues to display whatever request data has resolved.
- **F-12** While an RPC resolve call is in flight after the user clicks Confirm in a dialog, the dialog's primary button is disabled and shows `<LoadingSpinner size="sm" />` next to the button label.

### Empty states

- **F-13** Open tab with zero rows for the current org renders an empty state inside the `DataTable`: heading "No requests waiting for review." and description "New join and transfer requests appear here once submitted via your org signup form." The description includes a text link "Configure org signup form" pointing to `/forms`. The toolbar (search, filter pill) remains visible above the empty area.
- **F-14** Closed tab with zero rows for the current org renders an empty state inside the `DataTable`: heading "No closed requests yet." and description "Resolved requests appear here for audit." No CTA.
- **F-15** Empty right pane on `md+` desktop with no `:requestId` selected renders inside the review-panel area an empty state: heading "Select a request to review" and description "Click a row in the queue to open the review panel."
- **F-16** Form-responses query returns zero rows or no form is configured for the request type renders inside the right column: heading "No form configured for this request type." and description "Configure your org signup form at /forms." with a text link to `/forms`.

### Error states

- **F-17** When a list query (Open or Closed) fails, the corresponding tab's `DataTable` is not rendered; instead the tab's content area renders an inline `<Alert variant="destructive">` with title "Could not load requests", description set from the normalised error returned by `HandleSupabaseError`, and a Retry button alongside that re-runs the query. The slice also calls `HandleSupabaseError(error, { context: 'team_member_request' })` for normalised logging.
- **F-18** When the review-panel request query fails, the review panel renders `<Alert variant="destructive">` with title "Could not load request", description from `HandleSupabaseError`, and a Retry button.
- **F-19** When the form-responses query fails, the right column renders `<Alert variant="destructive">` with title "Could not load form responses" and a Retry button. The left column and action rail continue to display normally.
- **F-20** When the resolve RPC raises `'Resolvable request not found'` (stale resolve), the slice surfaces a destructive toast "This request has already been resolved by another admin. Refreshing the queue.", invalidates the queue query keys (Open + Closed for current org) and the `['approvals', 'open-count', orgId]` key, and navigates to `/approvals` (clearing the `:requestId` from the URL).
- **F-21** When the resolve RPC raises `'Permission denied'`, the slice surfaces a destructive toast "Could not resolve request: Permission denied." and the dialog stays open (so the user does not lose typed notes).
- **F-22** When the resolve RPC raises any other error, the slice surfaces a destructive toast "Could not resolve request: {normalised error message}." and the dialog stays open.
- **F-23** A user without `read:page.approvals` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).

### Primary content — Open tab

- **F-24** The Open tab `DataTable` renders one row per `team_member_request` row matching the BR-02 filter, in this column order: **Applicant**, **Request type**, **Submitted**, **Source org**, **Membership type**, **Status**.
- **F-25** The **Applicant** column shows the subject person's full name composed as `core_person.preferred_name` followed by `core_person.last_name` when `preferred_name` is non-empty; otherwise `core_person.first_name` followed by `core_person.last_name`. The subject person is `team_member_request.subject_person_id` (or the `person_id` of the joined `subject_member` when `subject_person_id` is null).
- **F-26** The **Request type** column shows a `Badge` with default tone whose label is "Join" when `request_type='join'` or "Transfer" when `request_type='transfer'`.
- **F-27** The **Submitted** column shows `team_member_request.created_at` as a relative date string (e.g. "2 days ago", "5 May 2026"). The cell value sorts by the underlying timestamp.
- **F-28** The **Source org** column shows `core_organisations.name` (joined via `team_member_request.source_organisation_id`) for `request_type='transfer'`; otherwise an em-dash ("—") for `request_type='join'`.
- **F-29** The **Membership type** column shows `core_membership_type.name` (joined via `team_member_request.membership_type_id`) as plain text, or an em-dash ("—") when `membership_type_id` is null.
- **F-30** The **Status** column shows a `Badge`: "Pending" (default tone) when `status='pending'`, "On hold" (warning/muted tone) when `status='on_hold'`. Sortable; sorting groups Pending rows together and On-hold rows together.
- **F-31** The `DataTable.description` for the Open tab reads `"{count} open"` where `{count}` is the unfiltered server-result count for the current org's Open view.

### Primary content — Closed tab

- **F-32** The Closed tab `DataTable` renders one row per `team_member_request` row matching the BR-03 filter, in this column order: **Applicant**, **Request type**, **Submitted**, **Resolved**, **Outcome**, **Resolved by**.
- **F-33** The **Applicant**, **Request type**, and **Submitted** columns follow the same rendering rules as the Open tab (F-25, F-26, F-27).
- **F-34** The **Resolved** column shows `team_member_request.resolved_at` as a localised short date (e.g. "5 May 2026"). Sortable; default direction is descending (BR-14).
- **F-35** The **Outcome** column shows a `Badge`: "Approved" (success tone) for `status='approved'`, "Rejected" (destructive tone) for `status='rejected'`, "Withdrawn" (neutral tone) for `status='withdrawn'`.
- **F-36** The **Resolved by** column shows the resolver's full name composed from the joined `core_person` (via `resolved_by` user → `core_person.user_id`). When the join returns no row (resolver person record removed), the cell shows an em-dash ("—").
- **F-37** The `DataTable.description` for the Closed tab reads `"{count} closed"` where `{count}` is the unfiltered server-result count for the current org's Closed view.

### Primary content — Review panel left column

- **F-38** When `:requestId` is present and the request query has resolved with a row, the review panel's left column renders two grouped sections — **Applicant** and **Request** — followed by a "View member 360" link button when BR-12 is satisfied.
- **F-39** The **Applicant** group lists, in this order: subject person's full name (composed per F-25), preferred name (when non-empty and different from first name), email (`core_person.email`), and applicant photo thumbnail rendered as `<Avatar>` with initials-only fallback (the avatar shows the subject's initials derived from `core_person.preferred_name` ?? `first_name` + `last_name`; matches TEAM-03's photo-display approach — TEAM v1 does not render uploaded photos directly even when `core_person.photo_url` is non-empty). Em-dash ("—") for any null/empty value.
- **F-40** The **Request** group lists, in this order: request-type badge (Join / Transfer per F-26), submitted-at (`team_member_request.created_at` as full date and time, e.g. "5 May 2026 at 14:30"), target organisation name (`core_organisations.name` via `target_organisation_id`), source organisation name (only when `request_type='transfer'`; via `source_organisation_id`), membership type (`core_membership_type.name` via `membership_type_id`; em-dash when null), applicant-supplied member number (`team_member_request.applicant_member_number`; em-dash when null), and current status badge (per F-30 / F-35).
- **F-41** When BR-12 is satisfied, a `<Button variant="outline">View member 360 →</Button>` renders below the Request group, navigating to `/members/:memberId` using `core_member.id` on click.
- **F-42** When BR-12 is not satisfied (no `subject_member_id`, or member row deleted), the "View member 360" link is suppressed; no replacement copy renders.
- **F-42a (Option A)** When the resolved issuing org differs from the request's selected org, the **Request** group shows **Membership issuing org** with copy `Membership record will be held at: {issuing org name}` (resolved client-side via org hierarchy or `subject_member.organisation_id` when present).
- **F-42b (Option A)** When `request_type='transfer'` and `status='pending'`, the **Request** group shows **Transfer closure** with copy `Membership at {source org name} will be closed on approval.`
- **F-42c (Option A)** When `status='approved'` and BR-12 is satisfied, a `<Button variant="outline">View placements →</Button>` renders beside the member 360 link, navigating to `/members/:memberId/roles`, with helper copy that a standing role may be required for directory visibility.
- **F-42d (Option A)** Approve resolve calls `app_resolve_member_request` with `p_placement_role_id = null` explicitly (role assignment deferred to TEAM-04).

### Primary content — Review panel right column

- **F-43** When `:requestId` is present and the form-responses query has resolved, the review panel's right column shows a heading "Form responses" followed by a flat list of `(label → value)` rows. Each row renders the field label sourced from `core_form_fields.label` (joined via `core_form_response_values.field_key` → `core_form_fields.field_key` for the form referenced by `core_form_responses.form_id`) and the value sourced from the populated `value_*` column on `core_form_response_values` (whichever of `value_text`, `value_number`, `value_boolean`, `value_date`, `value_uuid` is non-null for the row, rendered as a string per type).
- **F-44** When the form-responses query returns zero rows or no `core_form_responses` row exists for `workflow_subject_type='team_member_request' AND workflow_subject_id=:requestId`, the empty state from F-16 renders.

### Primary content — Review panel header strip

- **F-45** Above the left and right columns, a header strip renders within the review panel: title "Review request" (h2) and subtitle "Reviewing request from {applicant full name}" (per F-25).
- **F-46** When the request's `status !== 'pending'`, an additional read-only header strip renders below the title and above the action rail area: an `<Alert variant="default">` with title `"{Outcome} by {resolver full name} on {resolved date}"` (where `{Outcome}` is "Approved" / "Rejected" / "Withdrawn" / "On hold" per status; `{resolver full name}` is composed per F-36; `{resolved date}` is `team_member_request.resolved_at` as a localised short date) and description containing `team_member_request.resolution_note` (or successor `review_notes` field) — or "No note recorded." when both are null/empty.

### Primary actions — Action rail

- **F-47** When `status === 'pending'` AND `useResourcePermissions('approvals', 'update').canUpdate === true`, the action rail renders, anchored at the top of the right pane just below the panel title strip (not sticky).
- **F-48** The action rail contains three `Button` controls in left-to-right visual order: **Reject** (destructive variant), **Put on hold** (outline variant), **Approve** (primary variant). Right-aligned: Approve sits at the right edge, then Put on hold to its left, then Reject at the leftmost. (Read right-to-left as Approve | Put on hold | Reject per the resolution.)
- **F-49** When `status !== 'pending'` OR `canUpdate === false`, the action rail does not render. (When `status === 'pending'` and `canUpdate === false`, the read-only state shows the request as still pending without offering a resolve affordance.)
- **F-50** **Approve** click — when `applicant_member_number` on the request is non-null and non-empty, the slice opens a `ConfirmationDialog` (per BR-19) with title "Approve request?", description "{applicant} will become an active member with member number {applicant_member_number}.", confirmLabel "Approve", cancelLabel "Cancel", variant "default". On confirm, the slice calls `app_resolve_member_request(p_request_id=:requestId, p_status='approved', p_review_notes=null, p_member_number=null)` (server-side uses the request's `applicant_member_number`).
- **F-51** **Approve** click — when `applicant_member_number` is null or empty, the slice opens a composed `Dialog` (per BR-19) with title "Approve request?", body containing a required `<Input label="Member number">` defaulting to empty (helper text "Required. Must be unique within this organisation."), and a `<DialogFooter>` with a Cancel `Button` (default/outline variant) and an "Approve" `Button` (primary variant). The Approve button is disabled while the input is empty/whitespace-only or while the RPC is in flight. On confirm, the slice calls `app_resolve_member_request(p_request_id=:requestId, p_status='approved', p_review_notes=null, p_member_number={trimmed input})`.
- **F-52** **Reject** click — the slice opens a composed `Dialog` (per BR-19) with title "Reject request?", body containing a required `<Textarea label="Reason for rejection (visible to admins only)">` (helper text "At least 10 characters."), and a `<DialogFooter>` with a Cancel `Button` (default/outline variant) and a "Reject" `Button` (destructive variant). The Reject button is disabled while the trimmed textarea length is less than 10 or while the RPC is in flight. On confirm, the slice calls `app_resolve_member_request(p_request_id=:requestId, p_status='rejected', p_review_notes={trimmed textarea}, p_member_number=null)`.
- **F-53** **Put on hold** click — the slice opens a composed `Dialog` (per BR-19) with title "Put request on hold?", body containing an optional `<Textarea label="Note (optional)">` (helper text "Visible to admins only."), and a `<DialogFooter>` with a Cancel `Button` (default/outline variant) and a "Put on hold" `Button` (outline variant). The Put on hold button is enabled by default; disabled while the RPC is in flight. On confirm, the slice calls `app_resolve_member_request(p_request_id=:requestId, p_status='on_hold', p_review_notes={trimmed textarea or null}, p_member_number=null)`.
- **F-54** On a successful Approve RPC return, the slice closes the dialog, invalidates the Open + Closed list query keys for the current org and the `['approvals', 'open-count', orgId]` key, navigates to `/approvals`, and surfaces a `'success'`-variant toast "Request approved. {applicant} is now an active member." (where `{applicant}` is the subject person's full name).
- **F-55** On a successful Reject RPC return, the slice closes the dialog, invalidates the same query keys, navigates to `/approvals`, and surfaces a `'success'`-variant toast "Request rejected.".
- **F-56** On a successful Put-on-hold RPC return, the slice closes the dialog, invalidates the Open list query key for the current org and the `['approvals', 'open-count', orgId]` key (Closed list does not change), navigates to `/approvals`, and surfaces a `'success'`-variant toast "Request placed on hold.".
- **F-57** On any RPC failure, F-20 / F-21 / F-22 apply.

### Primary actions — Row click

- **F-58** Clicking anywhere on a row in either tab navigates to `/approvals/:requestId` using `team_member_request.id`. No secondary row actions render.

### Secondary actions

- **F-59** **Search.** A toolbar text-search input (rendered by `DataTable`) filters the in-memory rows of the active tab by case-insensitive substring across the applicant's composed full name (per F-25) and `team_member_request.applicant_member_number`. Clearing the input restores the unfiltered list.
- **F-60** **Request-type filter.** Each tab's toolbar offers a request-type filter pill with options "All" / "Join" / "Transfer". When "Join" or "Transfer" is selected, the server query adds `request_type = :value`. Selecting "All" removes the filter and refetches.
- **F-61** **Sort.** Each column header on each tab is sortable. Default sort: Open tab — Submitted ascending (FIFO); Closed tab — Resolved descending (most recent first). Subsequent clicks toggle asc/desc/none on a column.
- **F-62** **Pagination.** `initialPageSize` is `25`; page size options are `[10, 25, 50]`. The current page indicator and prev/next controls are rendered by `DataTable` below the table.
- **F-63** **No import / export / hierarchical / grouping affordances.** The `DataTable.features` toggles set: `import: false`, `export: false`, `hierarchical: false`, `grouping: false`, `creation: false`, `editing: false`, `deletion: false`, `deleteSelected: false`, `selection: false`. `search: true`, `pagination: true`, `sorting: true`, `filtering: true`, `columnVisibility: true`, `columnReordering: true`.

### Permission-conditional rendering

- **F-64** When `read:page.approvals` is denied, `PagePermissionGuard` renders `<AccessDenied />` and no tab, table, toolbar, or review panel renders.
- **F-65** When `read:page.approvals` is allowed but `useResourcePermissions('approvals', 'update').canUpdate === false`, the queue renders normally but the action rail on the review panel is hidden — the user can read requests but cannot resolve them.
- **F-66** When `read:page.approvals` and `update:page.approvals` are both allowed, the action rail renders only when `request.status === 'pending'`. For Closed-tab rows (`status IN ('approved','rejected','withdrawn')`), the action rail is hidden and the read-only header strip from F-46 renders instead.

### Navigation

- **F-67** The page is reachable from the TEAM-01 navigation menu via the **Approvals** entry (`/approvals`), and via deep-link.
- **F-68** Row click in either tab navigates to `/approvals/:requestId`.
- **F-69** "View member 360" button on the review panel navigates to `/members/:memberId` (TEAM-03).
- **F-70** Empty-state link "Configure org signup form" navigates to `/forms` (TEAM-09).
- **F-71** "No form configured" empty-state link navigates to `/forms` (TEAM-09).
- **F-72** On successful resolve (F-54 / F-55 / F-56), the slice navigates to `/approvals`. On stale resolve (F-20), the slice navigates to `/approvals`. On request-not-found redirect (F-74), the slice navigates to `/approvals`.

### Edge cases and constraints

- **F-73** **Org switch.** When `selectedOrganisation` changes while the page is mounted, both list queries and the open-count query refetch against the new org. If `:requestId` is present in the URL and the request does not belong to the new org (or no longer exists), the slice navigates to `/approvals` for the new org and surfaces a `'default'`-variant toast "Switched organisations. Showing approvals for {newOrgName}." (where `{newOrgName}` is the new `selectedOrganisation.name`).
- **F-74** **Unknown / wrong-org request id.** When `:requestId` does not match any `team_member_request` row for the current org (RLS-permitted SELECT returns zero rows), the slice navigates to `/approvals` and surfaces a `'default'`-variant toast "Request not found in this organisation."
- **F-75** **Closed-tab read-only.** When the user navigates to `/approvals/:requestId` for a Closed-tab row, the action rail is hidden, the read-only header strip from F-46 renders, and the rest of the review panel (left column, right column with form responses) renders normally.
- **F-76** **Withdrawn request with deleted member row.** A `team_member_request` with `status='withdrawn'` and `subject_member_id IS NULL` (the FK ON DELETE SET NULL fired when Portal deleted the provisional `core_member` row) remains fully reviewable from `/approvals/:requestId`. The "View member 360" link is suppressed (BR-12).
- **F-77** **Open count nav badge integration.** The slice exposes `useQuery({ queryKey: ['approvals', 'open-count', selectedOrganisation.id], queryFn: () => count of team_member_request WHERE status='pending' AND organisation_id=:orgId AND request_type IN ('join','transfer') })`. TEAM-01's nav cell consumes this query. The slice invalidates this key on resolve success (F-54 / F-55 / F-56) and on org switch (F-73).
- **F-78** **Member-number uniqueness.** The Approve RPC returns a server error when the supplied / applicant-supplied member number already exists for the org's `(organisation_id, membership_number)` pair. The slice surfaces the normalised error via destructive toast (F-22) and the dialog stays open so the user can edit the value and retry.
- **F-79** **Cross-org leakage prevention.** Every list and detail query carries `team_member_request.organisation_id = selectedOrganisation.id` defensively; even if RLS were misconfigured, cross-org rows would not return.

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `OrgContextBar`, `PaceMain`, footer). `OrgContextBar` renders above page content per TEAM-01.

Within `PaceMain`:

- **Page header** — `PageHeader`:
  - `title`: "Approvals".
  - `sub`: "Review join and transfer requests submitted to your branch."
  - `right`: primary `Button` "Approval rules" (stub/deferred configuration surface in prototype; pass 2 may wire to settings or rules editor).
- **Tabs row** — `Tabs` with `TabsList` triggers in order: **Open queue** (default, with count badge) and **Resolved** (with count badge). Tab switch resets in-page selection (prototype clears `selectedId`).
- **Two-pane queue + review** — Below tabs, a `section` (or grid) with class recipe matching prototype `tk-2pane`:
  - **Left pane — custom list (not `DataTable`)** — `Card` or `article` list card with list header ("Awaiting decision" / "Recently resolved" + item count). Rows are semantic `<ul>` / `<li>` with `<button type="button">` row activators showing avatar initials, applicant name, request-type badge, membership type, target org, relative submitted time. Active row uses `is-active` visual state. Empty list shows `EmptyState` inside the list card ("All caught up").
  - **Right pane — detail/review panel** — Renders when a row is selected in component state (`selectedRequestId`). When no selection, pane shows empty prompt ("Select a request to review") or collapses with `no-selection` modifier at narrow widths. Review content matches existing functional groups (applicant, request metadata, form responses, action rail, resolve `Dialog`s).
  - **Selection model** — Row click sets `selectedRequestId` in React state. **No child route** `/approvals/:requestId` for layout (prototype uses in-page selection only). Deep-link behaviour is pass 2 optional.
  - **Responsive** — At `md+`, side-by-side two-pane. Below `md`, stack: show list or detail based on whether a request is selected (prototype pattern).

**Breakpoints** — `md` = 768px (pace-core standard). `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Layout acceptance criteria (prototype alignment)

- [ ] `PageHeader` with title "Approvals", subtitle, and header CTA "Approval rules".
- [ ] `OrgContextBar` breadcrumb above content.
- [ ] Tab labels **Open queue** and **Resolved** (with count badges).
- [ ] Queue is a **custom two-pane list**, not a `DataTable`.
- [ ] Request selection is **in-page state**; URL stays `/approvals` (no `/approvals/:requestId` child route for layout).
- [ ] Right pane shows review detail for selected row; empty state when none selected.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- `ApprovalsPage.tsx` uses plain `<h1>Approvals</h1>` instead of `PageHeader` + "Approval rules" CTA.
- Open/Closed tabs use labels "Open" / "Closed" not "Open queue" / "Resolved".
- Queue is implemented as `DataTable` with column sort/search/pagination — prototype uses custom scrollable list rows.
- Hybrid **URL child route** `/approvals/:requestId` with `Outlet` and responsive queue hide/show — prototype keeps selection in component state on `/approvals` only.
- Tab names and list chrome in requirement §4 functional spec still describe DataTable columns — pass 2 reconciles data presentation with list-row layout while preserving query/RPC contracts.

### Components

**`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`** (`@solvera/pace-core/components`)
- Purpose: switch between Open and Closed views.
- `Tabs` props: `value={activeView}`, `onValueChange={setActiveView}`. Initial `activeView` is `'open'`.
- `TabsList` renders a `<nav>` containing the trigger controls left-aligned.
- `TabsTrigger` controls — Open trigger has `value="open"` and label "Open"; Closed trigger has `value="closed"` and label "Closed".
- `TabsContent` panels — `value="open"` panel hosts the Open hybrid layout; `value="closed"` panel hosts the Closed hybrid layout. Only the active panel is visible at a time.

**Open tab `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list pending and on-hold join/transfer requests for the current organisation with toolbar search, request-type filter, sort, and pagination.
- `data`: array of joined rows (`team_member_request` + subject `core_person` + optional `core_member` + optional `core_membership_type` + optional source `core_organisations`) returned by the server query, after the client-side search filter is applied.
- `rbac.pageName`: `'approvals'`.
- `title`: omitted (the page title sits above the tabs).
- `description`: `"{count} open"`.
- `isLoading`: bound to the Open list query's loading state.
- `emptyState`: `{ title: "No requests waiting for review.", description: "New join and transfer requests appear here once submitted via your org signup form. Configure org signup form" }` (where the "Configure org signup form" tail is a text link to `/forms`).
- `getRowId`: `(row) => row.id` (where `row.id` is `team_member_request.id`).
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'submitted_at', desc: false }]`.
- `actions`: empty — row click handles navigation via the slice's row-click handler (no per-row buttons).
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, creation: false, editing: false, deletion: false, deleteSelected: false, search: true, pagination: true, sorting: true, filtering: true, columnVisibility: true, columnReordering: true, selection: false }`.

Open tab columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Applicant | composed (`core_person.preferred_name` ?? `first_name`) + `last_name` | flexible | Sortable. Default sort key uses `last_name` asc, `first_name` asc as a tiebreaker for equal submitted-at values. |
| Request type | `team_member_request.request_type` | narrow | `Badge` (default tone) labelled "Join" or "Transfer" (title case). Sortable. |
| Submitted | `team_member_request.created_at` | narrow | Relative date string ("2 days ago", "5 May 2026"). Sortable; default sort: ascending (FIFO). |
| Source org | `core_organisations.name` via `source_organisation_id` | narrow-medium | Plain text for transfers; em-dash ("—") for joins. Sortable. |
| Membership type | `core_membership_type.name` via `membership_type_id` | narrow-medium | Plain text; em-dash ("—") when null. Sortable. |
| Status | `team_member_request.status` | narrow | `Badge`: "Pending" (default tone) when `status='pending'`; "On hold" (warning/muted tone) when `status='on_hold'`. Sortable. |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search requests". Filters across applicant full name and `applicant_member_number`.
- Request-type filter pill — segmented control labelled "All" / "Join" / "Transfer". Selection drives the server query refetch.
- Column-visibility popover (default `DataTable` affordance).
- The toolbar does not show Create / Import / Export / Delete buttons — features are off.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Closed tab `DataTable`** (`@solvera/pace-core/components`)
- Purpose: list approved, rejected, and withdrawn join/transfer requests for the current organisation. Read-only history.
- `data`: array of joined rows (`team_member_request` + subject `core_person` + optional `core_member` + optional `core_membership_type` + optional resolver `core_person`) returned by the server query, after the client-side search filter is applied.
- `rbac.pageName`: `'approvals'`.
- `description`: `"{count} closed"`.
- `isLoading`: bound to the Closed list query's loading state.
- `emptyState`: `{ title: "No closed requests yet.", description: "Resolved requests appear here for audit." }`.
- `getRowId`: `(row) => row.id`.
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'resolved_at', desc: true }]`.
- `actions`: empty.
- `features`: same as Open tab.

Closed tab columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Applicant | composed (`core_person.preferred_name` ?? `first_name`) + `last_name` | flexible | Sortable. |
| Request type | `team_member_request.request_type` | narrow | `Badge` (default tone): "Join" or "Transfer". Sortable. |
| Submitted | `team_member_request.created_at` | narrow | Localised short date ("5 May 2026"). Sortable. |
| Resolved | `team_member_request.resolved_at` | narrow | Localised short date. Sortable; default sort: descending (most recent first). |
| Outcome | `team_member_request.status` | narrow | `Badge`: "Approved" (success tone), "Rejected" (destructive tone), "Withdrawn" (neutral tone). Sortable. |
| Resolved by | resolver `core_person` (composed full name via `resolved_by` user → `core_person.user_id`) | flexible | Plain text; em-dash ("—") when join returns no row. Sortable. |

Toolbar: same as Open tab.

**Review panel** (composed inline; no shared pace-core2 panel primitive)

The review panel is a single container occupying the right pane (`md+`) or the full pane (`<md` when child route is active). It is composed from layout primitives:

- **Header strip section** — A `<header>` block containing:
  - `<h2>` "Review request" (text-xl, semibold).
  - `<p>` "Reviewing request from {applicant full name}" (text-sm, muted).
  - When `status !== 'pending'`: an `<Alert variant="default">` directly below the subtitle with `<AlertTitle>{Outcome} by {resolver full name} on {resolved date}</AlertTitle>` and `<AlertDescription>{resolution_note or "No note recorded."}</AlertDescription>`.
- **Action rail section** — Hidden when `status !== 'pending'` or when `canUpdate === false`. When shown:
  - A right-aligned flex row with three `<Button>` controls.
  - From left to right (rendered order): `<Button variant="destructive">Reject</Button>`, `<Button variant="outline">Put on hold</Button>`, `<Button variant="default">Approve</Button>`. Right-aligned so Approve sits at the right edge.
  - Anchored at the top of the right pane just below the header strip; not sticky.
- **Body section** — A two-column flex/grid (collapses to single-column at `<lg`):
  - **Left column** (~360–420px width at `lg+`): Two grouped sections, "Applicant" and "Request", each with a small `<h3>` heading (text-sm, semibold, muted) and a definition-list-style content block. Below the Request group, when BR-12 is satisfied, a `<Button variant="outline">View member 360 →</Button>` renders.
  - **Right column** (`flex-1`): A heading "Form responses" (text-sm, semibold) followed by either the flat list of `(label → value)` rows or the empty state (F-16) or the loading spinner (F-11) or the error alert (F-19).

**Applicant group content** — rendered as label/value pairs:

| Label | Value source | Empty handling |
|---|---|---|
| Name | composed full name per F-25 | always non-empty (subject person required) |
| Preferred name | `core_person.preferred_name` | row hidden when null/empty or equal to first_name |
| Email | `core_person.email` | em-dash when null/empty |
| Photo | `<Avatar>` with initials-only fallback (initials derived from `core_person.preferred_name` ?? `first_name` + `last_name`); matches TEAM-03's photo-display approach — TEAM v1 does not render uploaded photos directly | always rendered (initials are always derivable from the subject person's name) |

**Request group content** — rendered as label/value pairs:

| Label | Value source | Empty handling |
|---|---|---|
| Type | `team_member_request.request_type` rendered as a `Badge` (default tone, label "Join" or "Transfer") | always present |
| Submitted | `team_member_request.created_at` formatted as full date and time (e.g. "5 May 2026 at 14:30") | always present |
| Target organisation | `core_organisations.name` via `target_organisation_id` | always present (NOT NULL) |
| Source organisation | `core_organisations.name` via `source_organisation_id` | row hidden when `request_type='join'`; em-dash when `request_type='transfer'` and value null |
| Membership type | `core_membership_type.name` via `membership_type_id` | em-dash when null |
| Applicant member number | `team_member_request.applicant_member_number` | em-dash when null |
| Status | `team_member_request.status` rendered as a `Badge` (per F-30 / F-35) | always present |

**Form-responses list content** — rendered as label/value pairs:

| Label | Value source | Notes |
|---|---|---|
| `core_form_fields.label` | populated `value_*` column on `core_form_response_values` (rendered as string per type) | One row per `core_form_response_values` row joined to `core_form_responses` for `workflow_subject_type='team_member_request' AND workflow_subject_id=:requestId`. Render order: by `core_form_response_values.field_key` order or, when available, by the form's authoring order (subject to TEAM-09 form structure). |

**Approve confirmation — `ConfirmationDialog`** (`@solvera/pace-core/components`)
- Used when `applicant_member_number` is non-null and non-empty.
- Props: `open`, `onOpenChange`, `title="Approve request?"`, `description="{applicant full name} will become an active member with member number {applicant_member_number}."`, `confirmLabel="Approve"`, `cancelLabel="Cancel"`, `variant="default"`, `onConfirm` calls the RPC, `isPending` bound to RPC in-flight state.

**Approve confirmation — composed `Dialog`** (`@solvera/pace-core/components`)
- Used when `applicant_member_number` is null or empty.
- Structure: `<Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Approve request?</DialogTitle></DialogHeader><DialogBody><Label>Member number</Label><Input value={memberNumber} onChange={...} placeholder=""/><p class="text-xs text-muted">Required. Must be unique within this organisation.</p></DialogBody><DialogFooter><Button variant="outline" onClick={cancel}>Cancel</Button><Button variant="default" onClick={confirm} disabled={memberNumber.trim() === '' || isPending}>{isPending ? <LoadingSpinner size="sm"/> : null} Approve</Button></DialogFooter></DialogContent></Dialog>`.

**Reject confirmation — composed `Dialog`** (`@solvera/pace-core/components`)
- Always used (required Textarea).
- Structure: `<Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Reject request?</DialogTitle></DialogHeader><DialogBody><Label>Reason for rejection (visible to admins only)</Label><Textarea value={note} onChange={...} placeholder=""/><p class="text-xs text-muted">At least 10 characters.</p></DialogBody><DialogFooter><Button variant="outline" onClick={cancel}>Cancel</Button><Button variant="destructive" onClick={confirm} disabled={note.trim().length < 10 || isPending}>{isPending ? <LoadingSpinner size="sm"/> : null} Reject</Button></DialogFooter></DialogContent></Dialog>`.

**Put-on-hold confirmation — composed `Dialog`** (`@solvera/pace-core/components`)
- Always used (optional Textarea).
- Structure: `<Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Put request on hold?</DialogTitle></DialogHeader><DialogBody><Label>Note (optional)</Label><Textarea value={note} onChange={...} placeholder=""/><p class="text-xs text-muted">Visible to admins only.</p></DialogBody><DialogFooter><Button variant="outline" onClick={cancel}>Cancel</Button><Button variant="outline" onClick={confirm} disabled={isPending}>{isPending ? <LoadingSpinner size="sm"/> : null} Put on hold</Button></DialogFooter></DialogContent></Dialog>`.

**Error state — list query failure**
- Replaces the failing tab's `DataTable` with an `<Alert variant="destructive">` containing `<AlertTitle>Could not load requests</AlertTitle>` and `<AlertDescription>` populated from `HandleSupabaseError`. Below the Alert renders a `<Button variant="default">Retry</Button>` that re-runs the list query.

**Error state — review panel request query failure**
- Replaces the review-panel body with an `<Alert variant="destructive">` containing `<AlertTitle>Could not load request</AlertTitle>` and a Retry button.

**Error state — form-responses query failure**
- Replaces the right column's content with an `<Alert variant="destructive">` containing `<AlertTitle>Could not load form responses</AlertTitle>` and a Retry button. Left column and action rail continue rendering.

**Toasts** — surfaced via the module-level `toast({ title, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'success'` (resolve success), `'destructive'` (resolve failure, stale resolve), `'default'` (org-switch redirect, request-not-found redirect). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### States

- **Loading (Open tab table)** — `DataTable` renders Card + Table + TableCaption (title omitted + `"{count} open"` description + toolbar with search, filter pill, column-visibility popover) + a single full-width row with `<LoadingSpinner label="Loading table" />`.
- **Loading (Closed tab table)** — `DataTable` renders the same loading shape with description `"{count} closed"`.
- **Loading (review panel request)** — Full-pane `<LoadingSpinner />` inside the review-panel area; no header strip, no action rail, no body content.
- **Loading (form responses)** — Right column shows `<LoadingSpinner label="Loading responses" />`; left column and action rail render normally.
- **Loading (RPC in flight)** — Dialog stays open; the dialog's primary button is disabled and shows `<LoadingSpinner size="sm" />` next to the label.
- **Empty (Open tab)** — `DataTable` renders the empty state heading "No requests waiting for review." and description "New join and transfer requests appear here once submitted via your org signup form. Configure org signup form" (the tail is a text link to `/forms`).
- **Empty (Closed tab)** — `DataTable` renders the empty state heading "No closed requests yet." and description "Resolved requests appear here for audit."
- **Empty (right pane, no selection on `md+`)** — Inside the review-panel area, an empty state renders with heading "Select a request to review" and description "Click a row in the queue to open the review panel." No CTA.
- **Empty (form responses)** — Right column renders heading "No form configured for this request type." and description "Configure your org signup form at /forms." with a text link to `/forms`.
- **Error (list query failure)** — Failing tab's `DataTable` is replaced by the destructive `Alert` + Retry button.
- **Error (review-panel request query failure)** — Review-panel body is replaced by the destructive `Alert` + Retry button.
- **Error (form-responses query failure)** — Right column is replaced by the destructive `Alert` + Retry button; left column and action rail continue.
- **Error (RPC failure)** — Destructive toast surfaced; dialog stays open with typed input intact.
- **Permission denied (page)** — `<AccessDenied />` in `PaceMain` with TEAM-01 chrome (header, footer) visible.
- **Permission denied (action rail)** — Queue and review panel render normally; action rail is hidden inside the review panel.
- **Closed-tab read-only** — Action rail hidden; read-only header strip (`<Alert variant="default">` with outcome / resolver / resolved date title and `resolution_note` description) renders below the subtitle.

### Interactions

- **Tab switch** — Click on a `TabsTrigger` updates `activeView` and exposes the corresponding `TabsContent` panel. The DataTable for the newly active tab uses its own list query state (data, loading, error). Switching back and forth does not re-run the queries unnecessarily.
- **Row click** — Hover: row receives the `DataTable` default hover treatment. Click: navigates to `/approvals/:requestId` using `team_member_request.id`. At `md+`, the queue stays visible and the right pane updates with the review panel; below `md`, the queue is replaced by the review panel.
- **Search input** — Typing filters table rows in the active tab in real time with no submit step. Clearing the input restores the unfiltered list. Search applies only to the active tab; switching tabs does not carry the search string across.
- **Request-type filter pill** — Selecting "Join" or "Transfer" triggers a server refetch with `request_type = :value`. Selecting "All" removes the filter and refetches.
- **Sort headers** — Click on a column header toggles asc/desc/none on that column. Default sort applies on initial render per F-61.
- **Pagination controls** — Page size dropdown changes rows per page on the active tab; prev/next change page index; current page indicator updates immediately.
- **Approve button (action rail)** — Click opens the Approve dialog (per F-50 / F-51).
- **Reject button (action rail)** — Click opens the Reject dialog (per F-52).
- **Put on hold button (action rail)** — Click opens the Put-on-hold dialog (per F-53).
- **Dialog Cancel** — Closes the dialog without calling the RPC; typed input is discarded. The user remains on `/approvals/:requestId`.
- **Dialog Confirm (Approve / Reject / Put on hold)** — Calls the RPC; while the RPC is in flight, the primary button is disabled and shows `<LoadingSpinner size="sm" />`. On success: dialog closes, query keys invalidate, navigation to `/approvals`, success toast (per F-54 / F-55 / F-56). On failure: destructive toast surfaces, dialog stays open with typed input intact.
- **View member 360 button** — Click navigates to `/members/:memberId` using `core_member.id`.
- **Empty-state link "Configure org signup form"** — Click navigates to `/forms`.
- **Empty-state link "Configure your org signup form at /forms"** — Click navigates to `/forms`.
- **Toast** — On any toast trigger, the toast appears bottom-right and auto-dismisses after 5000 ms.

### Permission-conditional rendering

| Condition | Page entry | Tabs | Rows | Action rail | Read-only header strip |
|---|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a | n/a |
| Authenticated, org, `read:page.approvals` denied | `<AccessDenied />` | Hidden | Hidden | Hidden | Hidden |
| Authenticated, org, `read` allowed, `update` denied, status `pending` | Page visible | Open + Closed visible | Row click navigates to detail | Hidden | Hidden |
| Authenticated, org, `read` allowed, `update` denied, status `approved`/`rejected`/`withdrawn`/`on_hold` | Page visible | Open + Closed visible | Row click navigates to detail | Hidden | Visible (when `status !== 'pending'`) |
| Authenticated, org, `read` and `update` allowed, status `pending` | Page visible | Open + Closed visible | Row click navigates to detail | Visible (Approve, Put on hold, Reject) | Hidden |
| Authenticated, org, `read` and `update` allowed, status `approved`/`rejected`/`withdrawn` | Page visible | Open + Closed visible | Row click navigates to detail | Hidden | Visible |
| Authenticated, org, `read` and `update` allowed, status `on_hold` | Page visible | Open + Closed visible | Row click navigates to detail | Action rail hidden (`on_hold` is read-only in v1; no Reopen affordance — see §16). Read-only header strip shows the on_hold metadata. | Visible |

(Clarification on `on_hold`: the action rail visibility uses `status === 'pending'` strictly. An `on_hold` request appears in the Open tab but its review panel does not show the action rail; instead the read-only header strip from F-46 renders with title "On hold". To resume action, an admin would need a future "Reopen" affordance — out of v1 scope; flagged in §16.)

---

## §6 Business rules

**BR-01 — Org-scoped reads.**
- Input: any list or detail query in this slice.
- Output: every query filters `team_member_request.organisation_id = selectedOrganisation.id`. Cross-org rows are never returned.
- Edge: a current org with zero matching rows returns an empty array; rows from another org do not return even if RLS were misconfigured (defensive).

**BR-02 — Open queue filter.**
- Input: an Open tab list query.
- Output: include rows WHERE `team_member_request.organisation_id = :orgId` AND `team_member_request.status IN ('pending','on_hold')` AND `team_member_request.request_type IN ('join','transfer')`.
- Edge: rows with `request_type='member_profile_access'` do not appear in the approvals queue.

**BR-03 — Closed queue filter.**
- Input: a Closed tab list query.
- Output: include rows WHERE `team_member_request.organisation_id = :orgId` AND `team_member_request.status IN ('approved','rejected','withdrawn')` AND `team_member_request.request_type IN ('join','transfer')`.

**BR-04 — Approve resolve transition (server-side, atomic).**
- Input: Approve confirm action — calls `app_resolve_member_request(p_request_id, p_status='approved', p_review_notes=null, p_member_number)` (optional `p_placement_role_id` deferred for MVP).
- Server-side outputs (executed atomically inside the RPC):
  - UPDATE `team_member_request` SET `status='approved'`, `resolved_by`, `resolved_at`, audit columns WHERE `id=:requestId AND status IN ('pending','on_hold')`.
  - UPDATE the issuing-org `core_member` (via `subject_member_id`) SET `membership_status='Active'`, `membership_number=:p_member_number ?? :request.applicant_member_number`.
  - When issuing org ≠ selected (sub-org) org AND `p_placement_role_id IS NOT NULL`: INSERT `core_member_role` placement at the request's selected org. MVP: TEAM admin assigns standing role separately after approval when placement role is not supplied.
  - When `request_type='transfer'` AND `source_organisation_id IS NOT NULL`: close the active `core_member_role` at the source sub-org (`end_date = CURRENT_DATE`). Issuing-org `core_member` stays `Active` (no auto-resign when last placement closes in v1).
  - On success: returns TRUE.
- Edge: stale call (status no longer pending/on_hold) raises `'Resolvable request not found'`. UI catches and surfaces destructive toast + refetch (BR-10).
- Edge: duplicate member number raises `'Membership number already exists for this organisation'` (or equivalent normalised message). UI surfaces destructive toast + leaves dialog open.
- Client never writes `core_member` directly.

**BR-05 — Reject resolve transition (server-side, atomic).**
- Input: Reject confirm action — calls `app_resolve_member_request(p_request_id, p_status='rejected', p_review_notes, p_member_number=null)`.
- Validation (client-side): trimmed `p_review_notes` length ≥ 10. Confirm button disabled until valid.
- Server-side outputs:
  - UPDATE `team_member_request` SET `status='rejected'`, `review_notes=trim(:p_review_notes)`, `resolved_by`, `resolved_at`, audit columns WHERE `id=:requestId`.
  - DELETE the issuing-org `core_member` row only when `membership_status = 'Provisional'` and no other active placements exist. Second-placement reject leaves the existing Active issuing-org membership intact. FK ON DELETE SET NULL clears `team_member_request.subject_member_id` when the row is deleted.
- Client never writes `core_member` directly.

**BR-06 — Put-on-hold transition (server-side).**
- Input: Put-on-hold confirm action — calls `app_resolve_member_request(p_request_id, p_status='on_hold', p_review_notes=optional, p_member_number=null)`.
- Server-side outputs:
  - UPDATE `team_member_request` SET `status='on_hold'`, `review_notes=trim(:p_review_notes) when supplied`, `resolved_by`, `resolved_at`, audit columns WHERE `id=:requestId`.
  - No change to `core_member`; provisional row stays `Provisional`.
- Note: `resolved_by` / `resolved_at` columns are repurposed to record the most recent state-change author and timestamp for any non-pending status, including `on_hold`. Column rename to `last_action_by` / `last_action_at` is a future polish item; v1 reuses these column names as-is.

**BR-07 — Withdrawn handling (read-only).**
- Input: any Closed-tab row with `status='withdrawn'`.
- Output: TEAM-05 displays the row in the Closed tab and renders the review panel as read-only. TEAM-05 NEVER produces a `withdrawn` transition. The Portal participant flow owns the `app_withdraw_member_request` RPC and the side-effect of DELETEing the provisional `core_member`.

**BR-08 — Member-number assignment validation.**
- Input: Approve action.
- Output:
  - When `team_member_request.applicant_member_number` is non-null and non-empty, the slice opens `ConfirmationDialog`. The RPC receives `p_member_number=null` and uses the request's `applicant_member_number` server-side.
  - When `team_member_request.applicant_member_number` is null or empty, the slice opens a composed `Dialog` with a required `<Input>`. Trimmed input must be non-empty. Confirm button disabled until valid. The RPC receives `p_member_number={trimmed input}`.
- Uniqueness validation is enforced server-side; if duplicate, the RPC returns an error and the slice surfaces a destructive toast and leaves the dialog open.

**BR-09 — Hybrid layout responsive behaviour.**
- Input: viewport width and `:requestId` presence.
- Output:
  - `≥ 768px (md+)`: two-column layout — queue list on the left (~360–480px), review panel on the right (`flex-1`, hosting `<Outlet />`). Empty right pane shows "Select a request to review" when no `:requestId`.
  - `< 768px`: single-column layout — when no `:requestId`, queue list renders alone; when `:requestId` is present, review panel renders alone (queue hidden).
- Selecting a row at any breakpoint navigates to `/approvals/:requestId`.

**BR-10 — Stale resolve recovery.**
- Input: `app_resolve_member_request` raises `'Resolvable request not found'`.
- Output: surface destructive toast "This request has already been resolved by another admin. Refreshing the queue.", invalidate Open + Closed list query keys for the current org and the `['approvals', 'open-count', orgId]` key, and navigate to `/approvals` if the user is on `/approvals/:requestId`.

**BR-11 — Form responses query.**
- Input: review panel mount with `:requestId`.
- Output: SELECT against `core_form_responses` joined to `core_form_response_values` joined to `core_form_fields` (via `field_key`) filtered by `core_form_responses.workflow_subject_type = 'team_member_request'` AND `core_form_responses.workflow_subject_id = :requestId`. Render one row per `core_form_response_values` row, displaying `core_form_fields.label` as the row label and the populated `value_*` column on `core_form_response_values` (whichever of `value_text`, `value_number`, `value_boolean`, `value_date`, `value_uuid` is non-null) as the row value (rendered as a string per type).
- Edge: zero rows → empty state "No form configured for this request type." (F-16).

**BR-12 — Cross-link to Member 360.**
- Input: review panel render.
- Output: render the "View member 360 →" `<Button variant="outline">` (F-41) only when `team_member_request.subject_member_id IS NOT NULL` AND the joined `core_member` row exists AND `core_member.deleted_at IS NULL`. Click navigates to `/members/:memberId` using `core_member.id`.
- Edge: when any of those conditions fails, the link is suppressed; no replacement copy renders.

**BR-13 — Page guard and unknown / wrong-org id.**
- Input: route entry to `/approvals` or `/approvals/:requestId`; review panel SELECT result.
- Output: shell `routeAccessDenied` evaluates the route registry entry with org scope resolved internally. On deny, `<AccessDenied />` renders. On allow, the page body renders. On `/approvals/:requestId`, when the SELECT (filtered by `id=:requestId AND organisation_id=:orgId`) returns zero rows, the slice navigates to `/approvals` and surfaces a `'default'`-variant toast "Request not found in this organisation."

**BR-14 — Default sort.**
- Input: list queries.
- Output:
  - Open: `team_member_request.created_at` ascending (FIFO; oldest pending requests surface first). DataTable `initialSorting=[{ id: 'submitted_at', desc: false }]`.
  - Closed: `team_member_request.resolved_at` descending (most recent resolutions first). DataTable `initialSorting=[{ id: 'resolved_at', desc: true }]`.

**BR-15 — Search and request-type filter semantics.**
- Server-side filters per BR-02 / BR-03, plus `team_member_request.request_type = :value` when the request-type filter pill is set to "Join" or "Transfer".
- Client-side filter: free-text search across the applicant's composed full name (`core_person.preferred_name` ?? `core_person.first_name` + space + `core_person.last_name`) and `team_member_request.applicant_member_number`. Case-insensitive substring match against the in-memory rows returned by the server query.
- Edge: a search string that matches no rows produces zero visible rows; switching tabs does not carry the search string between tabs; the request-type filter is independent on each tab.

**BR-16 — Org-switch behaviour.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output: both list queries and the open-count query refetch against the new org. If the URL contains `:requestId` and the request does not belong to the new org (zero rows on the request SELECT for `id=:requestId AND organisation_id=:newOrgId`), navigate to `/approvals` for the new org and surface a `'default'`-variant toast "Switched organisations. Showing approvals for {newOrgName}." When the URL contains `:requestId` and the request DOES belong to the new org (rare but possible if the user has cross-org admin), the review panel rerenders with the new context.

**BR-17 — Cross-slice referenced behaviour (informational only).**
- These behaviours are owned and enforced by sibling slices and the Portal. Restated here for traceability; TEAM-05 does not enforce them.
  - **Submission of join/transfer request.** TEAM-09 + Portal own `app_submit_member_request`. The planned-contract RPC inserts the `team_member_request` row and (when `request_type IN ('join','transfer')`) the provisional `core_member` row server-side at submission time.
  - **Withdrawal.** Portal owns `app_withdraw_member_request`. The RPC sets `status='withdrawn'` and DELETEs the provisional `core_member` row.
  - **Re-application after rejected/withdrawn.** A new application is a clean INSERT — Portal/TEAM-09 own this; no "UPDATE from Declined" path.
  - **Re-join after Resigned.** UPDATE existing `core_member` `Resigned` → `Provisional` — Portal/TEAM-09 own this.
  - **Re-join after Revoked.** Blocked at submit RPC — Portal/TEAM-09 own this.

**BR-18 — Open count nav badge.**
- Input: TEAM-01 nav cell consuming the query at key `['approvals', 'open-count', selectedOrganisation.id]`.
- Output: TEAM-05 publishes a count query at that key returning the count of `team_member_request` rows for `organisation_id=:orgId` AND `status='pending'` AND `request_type IN ('join','transfer')`. Excludes `on_hold`. The slice invalidates the key on resolve success (Approve / Reject / Put on hold) and on org switch.

**BR-19 — Confirmation-dialog composition.**
- Input: action rail click.
- Output:
  - **Approve, `applicant_member_number` populated** → `ConfirmationDialog` (no body needed).
  - **Approve, `applicant_member_number` null/empty** → composed `Dialog` family with required `<Input>`.
  - **Reject** → composed `Dialog` family with required `<Textarea>` (≥10 trimmed chars).
  - **Put on hold** → composed `Dialog` family with optional `<Textarea>`.
- Rationale: `ConfirmationDialog` has no body slot. Dialogs needing form input compose from `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogBody`, `DialogFooter` with `Button` + `Button` inside `DialogFooter` for custom button labels.

**BR-20 — RLS authority and defensive filtering.**
- Input: every SELECT in this slice.
- Output: RLS on `team_member_request` enforces `team_member_request_can_read(organisation_id, requester_person_id)` for SELECT, `team_member_request_can_resolve(organisation_id) OR team_member_request_is_requester(requester_person_id)` for UPDATE. RLS on `core_member`, `core_person`, and `core_form_responses` apply per platform standards. The slice additionally filters `team_member_request.organisation_id = selectedOrganisation.id` on every list and detail query as a defensive belt-and-braces guard against future RLS regression.

---

## §7 API / Contract

### Public exports

This slice publishes one symbol for cross-slice consumption:
- The open-count query at the key `['approvals', 'open-count', selectedOrganisation.id]`. TEAM-01's nav cell consumes this key. The shape returned is `{ count: number }`. Invalidated by TEAM-05 on resolve success and on org switch.

No other symbols are exported. The approvals UX lives behind `/approvals` and `/approvals/:requestId`.

### Read contracts

- **Open list query.** PostgREST shape:
  ```
  useSecureSupabase()
    .from('team_member_request')
    .select(`
      id, organisation_id, request_type, status, created_at, resolved_at,
      target_organisation_id, source_organisation_id, membership_type_id, applicant_member_number, resolution_note,
      subject_person:core_person!subject_person_id(id, first_name, last_name, preferred_name, email, photo_url),
      subject_member:core_member!subject_member_id(id, deleted_at, person_id),
      membership_type:core_membership_type(id, name),
      source_org:core_organisations!source_organisation_id(id, name)
    `)
    .eq('organisation_id', selectedOrganisation.id)
    .in('status', ['pending', 'on_hold'])
    .in('request_type', ['join', 'transfer'])
    .order('created_at', { ascending: true })
  ```
  When the request-type filter is set to "Join" or "Transfer", `.eq('request_type', :value)` is appended (replacing the `.in('request_type', ...)` filter).

- **Closed list query.** Same shape with these differences:
  - Filter `.in('status', ['approved', 'rejected', 'withdrawn'])`.
  - Add `.order('resolved_at', { ascending: false })` (replaces the Open ordering).
  - Add a join to `resolver_person:core_person(id, first_name, last_name, preferred_name, user_id)` via `team_member_request.resolved_by` → `core_person.user_id` (or via a view/helper if the join is more easily expressed; the result must populate the resolver's name for F-36).

- **Review panel request query.** Same select shape as Open list, plus the resolver join, filtered by `.eq('id', requestId).eq('organisation_id', selectedOrganisation.id).single()`. Returns one row or zero rows; zero rows triggers F-74 / BR-13.

- **Form responses query.** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_form_responses')
    .select(`
      id, form_id, workflow_subject_type, workflow_subject_id,
      values:core_form_response_values(id, field_key, value_text, value_number, value_boolean, value_date, value_uuid),
      form:core_forms(id, fields:core_form_fields(field_key, label, sort_order))
    `)
    .eq('workflow_subject_type', 'team_member_request')
    .eq('workflow_subject_id', requestId)
    .single()
  ```
  Falls back to zero-row handling per F-16 when no response exists. The exact PostgREST shape is the build agent's choice provided the result honours the rule above (one `(label, value)` row per `core_form_response_values` entry, ordered by the form's authoring order via `core_form_fields.sort_order` when available).

- **Open count query.** PostgREST shape:
  ```
  useSecureSupabase()
    .from('team_member_request')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', selectedOrganisation.id)
    .eq('status', 'pending')
    .in('request_type', ['join', 'transfer'])
  ```

### Query-key contract

- Open list: `['approvals', 'open', selectedOrganisation.id, requestTypeFilter ?? 'all']`.
- Closed list: `['approvals', 'closed', selectedOrganisation.id, requestTypeFilter ?? 'all']`.
- Review panel request: `['approvals', 'request', requestId, selectedOrganisation.id]`.
- Form responses: `['approvals', 'form-responses', requestId]`.
- Open count nav badge: `['approvals', 'open-count', selectedOrganisation.id]`.
- Org-switch invalidates all six key prefixes against the new org.
- Resolve success invalidates Open list, Closed list, review panel request (current `requestId`), and Open count keys for the current org.

### Write contracts

This slice has one mutation path: `app_resolve_member_request` RPC.

- **RPC: `app_resolve_member_request(p_request_id uuid, p_status team_member_request_status, p_review_notes text DEFAULT NULL, p_member_number text DEFAULT NULL) RETURNS boolean`** (planned contract). Note: the RPC returns `boolean` but TEAM-05 ignores the value — success is signalled by the absence of a thrown error. The return is reserved for future use (e.g. an explicit `false` if the resolve was a no-op due to status guard).
- **Behaviour (planned contract):**
  - Validates user → resolver person.
  - Asserts `p_status IN ('approved','rejected','on_hold')`. Other values raise `'Resolution status must be approved, rejected, or on_hold'`.
  - SELECTs request row where `id=p_request_id AND status IN ('pending','on_hold')`. Stale → raises `'Resolvable request not found'`.
  - Calls `team_member_request_can_resolve(v_org_id)`. FALSE → raises `'Permission denied'`.
  - UPDATEs `team_member_request` SET `status=p_status`, `review_notes=trim(p_review_notes) when supplied`, `resolved_by=current user → core_person`, `resolved_at=now()`, audit columns WHERE `id=p_request_id`.
  - When `p_status='approved'`: UPDATE the joined provisional `core_member` SET `membership_status='Active'`, `membership_number=p_member_number ?? request.applicant_member_number ?? platform-generated`. If duplicate `(organisation_id, membership_number)`, raise `'Membership number already exists for this organisation'`. When `request_type='transfer'` AND `source_organisation_id IS NOT NULL`, also UPDATE the source-org `core_member` SET `membership_status='Resigned'` WHERE `organisation_id=source_organisation_id AND person_id=subject_person_id`.
  - When `p_status='rejected'`: DELETE the joined provisional `core_member` row identified by `subject_member_id`. FK ON DELETE SET NULL clears `team_member_request.subject_member_id`.
  - When `p_status='on_hold'`: no `core_member` change.
  - Returns TRUE on success.

- **Failure outcomes the slice handles:**
  - `'Resolvable request not found'` → BR-10 stale-resolve recovery; toast + invalidate + navigate.
  - `'Permission denied'` → destructive toast "Could not resolve request: Permission denied."; dialog stays open.
  - `'Membership number already exists for this organisation'` → destructive toast with normalised message; dialog stays open.
  - Any other error → destructive toast "Could not resolve request: {message}."; dialog stays open.

### RLS / permission contracts

- **SELECT** on `team_member_request` enforced by `rbac_select_team_member_request` via `team_member_request_can_read(organisation_id, requester_person_id)`.
- **SELECT** on `core_person` enforced by `rbac_select_core_person`.
- **SELECT** on `core_member` enforced by `rbac_select_core_member`.
- **SELECT** on `core_membership_type` enforced by `read_team_membership_types`.
- **SELECT** on `core_organisations` enforced by platform-standard RLS.
- **SELECT** on `core_form_responses` / `core_form_response_values` / `core_form_fields` / `core_forms` enforced by platform-standard RLS for read access.
- **UPDATE** on `team_member_request` (via the RPC, which runs `SECURITY DEFINER`) is gated by `team_member_request_can_resolve(organisation_id)`. Direct DML from the client is RLS-permitted but not used by this slice (BR-X14).
- **UPDATE / DELETE** on `core_member` (via the RPC, `SECURITY DEFINER`) is gated by the RPC's permission check; not exposed to client direct DML in this slice.
- The page guard uses canonical `pageName='approvals'` and `operation='read'`. `rbac_app_pages` must have a row with `page_name='approvals'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` (post-build seeding noted in §15).
- The action-rail visibility gate uses `useResourcePermissions('approvals', 'update')` under app TEAM. Server-side authority is `team_member_request_can_resolve` under app PACE — different keys; server is the final authority.

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-05 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws. TEAM-01 also owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Approvals"), and the `PaceAppLayout` chrome. TEAM-01's nav cell consumes the open-count query at the key `['approvals', 'open-count', selectedOrganisation.id]` published by TEAM-05.
- **TEAM-02** owns `/members` — the member directory. TEAM-02 reads the same `team_member_request` rows for its Pending tab join condition. TEAM-05 does not interact with TEAM-02 directly; both are downstream readers of the planned-contract `team_member_request` table.
- **TEAM-03** owns `/members/:memberId`. TEAM-05 navigates there from the review panel's "View member 360" button using `core_member.id` when BR-12 is satisfied. TEAM-03 enforces detail-page authorisation.
- **TEAM-08** owns `/settings/org` Operational section, including `member_validation_config`. TEAM-05 v1 does not display external validation; the bundled deferral lives in §16 / §17.
- **TEAM-09** owns `/forms`, including authoring of the `org_signup` form whose responses appear in TEAM-05's review panel right column. TEAM-09 + Portal also own the submission RPC `app_submit_member_request` (planned contract) which inserts both the `team_member_request` row and the provisional `core_member` row server-side at submission time. TEAM-05 reads both tables.
- **Portal** owns `app_withdraw_member_request`, called by participants from outside TEAM. TEAM-05 displays withdrawn rows in the Closed tab as read-only history.

### ID contracts

- `team_member_request.id` (uuid) — primary identifier used in row navigation (`/approvals/:requestId`) and in the resolve RPC's `p_request_id` parameter.
- `core_member.id` (uuid) — used in the "View member 360" link target (`/members/:memberId`) when BR-12 is satisfied.
- `core_organisations.id` (uuid) — used by `target_organisation_id` and `source_organisation_id` columns on `team_member_request` (planned contract).
- `core_membership_type.id` (uuid per planned contract — see §8 verification step) — used by `membership_type_id` column on `team_member_request`.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `team_member_request` | SELECT, RPC-write | `useSecureSupabase()` SELECT for queues + detail; `app_resolve_member_request` RPC for resolve |
| `core_person` | SELECT (joined for subject + resolver) | `useSecureSupabase()` |
| `core_member` | SELECT (joined for subject) | `useSecureSupabase()` |
| `core_membership_type` | SELECT (joined for membership type name) | `useSecureSupabase()` |
| `core_organisations` | SELECT (joined for source-org name) | `useSecureSupabase()` |
| `core_form_responses` | SELECT (review panel right column) | `useSecureSupabase()` |
| `core_form_response_values` | SELECT (review panel right column, joined to core_form_responses) | `useSecureSupabase()` |
| `core_form_fields` | SELECT (review panel right column, joined for label + sort_order) | `useSecureSupabase()` |
| `core_forms` | SELECT (review panel right column, joined for form metadata) | `useSecureSupabase()` |

### `team_member_request` columns (planned platform contract — §15 implementation gate)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `organisation_id` | uuid | NO | — | FK → `core_organisations.id` ON DELETE CASCADE |
| `target_organisation_id` | uuid | NO (planned) | — | FK → `core_organisations.id`; for joins, equals `organisation_id`; for transfers, equals the destination org |
| `source_organisation_id` | uuid | YES | — | FK → `core_organisations.id`; populated only for transfers |
| `requester_person_id` | uuid | NO | — | FK → `core_person.id` ON DELETE RESTRICT |
| `subject_person_id` | uuid | YES | — | FK → `core_person.id` ON DELETE SET NULL |
| `subject_member_id` | uuid | YES | — | FK → `core_member.id` ON DELETE SET NULL |
| `membership_type_id` | uuid | YES (planned) | — | FK → `core_membership_type.id` |
| `applicant_member_number` | text | YES (planned) | — | Applicant-supplied member number; null when not supplied at submission |
| `request_type` | `team_member_request_type` enum | NO | — | Planned values: `'join'`, `'transfer'`, `'member_profile_access'` |
| `status` | `team_member_request_status` enum | NO | `'pending'` | Planned values: `'pending'`, `'on_hold'`, `'approved'`, `'rejected'`, `'withdrawn'` |
| `reason` | text | YES | — | Free-text reason supplied by requester at submit |
| `resolution_note` | text | YES | — | Internal-only review note set by resolver |
| `review_notes` | text | YES (planned) | — | Successor of / alongside `resolution_note` (the planned contract may consolidate; the slice references `resolution_note` for v1 with §17 note that the column may be renamed) |
| `resolved_by` | uuid | YES | — | FK → user (SET NULL on user delete) |
| `resolved_at` | timestamptz | YES | — | |
| `created_at` | timestamptz | NO | `now()` | Submitted-at timestamp |
| `updated_at` | timestamptz | NO | `now()` | |
| `created_by` | uuid | YES | — | FK → user (SET NULL) |
| `updated_by` | uuid | YES | — | FK → user (SET NULL) |

**CHECK constraint:** `team_member_request_subject_check` — `((subject_person_id IS NOT NULL) OR (subject_member_id IS NOT NULL))`.

### Enums (planned platform contract)

- `team_member_request_type` — `'member_profile_access'`, `'join'`, `'transfer'`. **Live enum has only `'member_profile_access'`; extension is part of the §15 implementation gate.**
- `team_member_request_status` — `'pending'`, `'on_hold'`, `'approved'`, `'rejected'`, `'withdrawn'`. **Live enum has all values except `'on_hold'`; extension is part of the §15 implementation gate.**
- `pace_membership_status` — `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked` (live; six values).

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `team_member_request_type` enum has been extended with `'join'` and `'transfer'`.
- Confirm `team_member_request_status` enum has been extended with `'on_hold'`.
- Confirm `team_member_request` has columns `target_organisation_id`, `source_organisation_id`, `membership_type_id`, `applicant_member_number`, `review_notes`.
- Confirm `app_resolve_member_request` accepts `p_status='on_hold'` and `p_member_number` parameter, and executes member-side effects atomically (Approve → `core_member.membership_status='Active'` + member number assignment + transfer source-org adjustment; Reject → DELETE provisional `core_member`; On-hold → no member change).
- Confirm `app_submit_member_request` accepts a `request_type` parameter and inserts the provisional `core_member` row when `request_type IN ('join','transfer')`. (Owned by TEAM-09 + Portal; verified for upstream readiness only.)
- Confirm `core_form_responses` carries `workflow_subject_type` (text) and `workflow_subject_id` (uuid) columns; convention used by this slice is `workflow_subject_type='team_member_request'`.
- Confirm `rbac_apps` row `name='TEAM'`, `is_active=true`.
- Confirm an `rbac_app_pages` row for `page_name='approvals'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` is in place (post-TEAM-01 seeding).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates.
- `pace-core2/packages/core/docs/database/domains/team.md` — `team_member_request` shape and enum reference (subject to the planned platform contract noted above).

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for queue, detail, form-response, count SELECTs and resolve RPC |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="approvals"` `operation="read"` on parent layout |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Action-rail visibility gate via `useResourcePermissions('approvals', 'update')` |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation.id` and `selectedOrganisation.name` for org filter, badge nav-key, org-switch toast |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle="Approvals"` on parent layout mount |
| `DataTable` | `@solvera/pace-core/components` | Open and Closed queue tables; toolbar; sort; search; request-type filter; pagination |
| `Tabs` | `@solvera/pace-core/components` | View switcher root |
| `TabsList` | `@solvera/pace-core/components` | Tab list container |
| `TabsTrigger` | `@solvera/pace-core/components` | Open and Closed triggers |
| `TabsContent` | `@solvera/pace-core/components` | Open and Closed panels |
| `Dialog` | `@solvera/pace-core/components` | Composed dialogs for Reject, On-hold, and Approve-with-input |
| `DialogContent` | `@solvera/pace-core/components` | Dialog content slot |
| `DialogHeader` | `@solvera/pace-core/components` | Dialog header slot |
| `DialogTitle` | `@solvera/pace-core/components` | Dialog title slot |
| `DialogDescription` | `@solvera/pace-core/components` | Dialog description slot |
| `DialogBody` | `@solvera/pace-core/components` | Dialog body slot for required Textarea / Input |
| `DialogFooter` | `@solvera/pace-core/components` | Dialog footer slot for Cancel + Confirm `Button` pair |
| `DialogClose` | `@solvera/pace-core/components` | Dialog close affordance |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Approve confirm when `applicant_member_number` is supplied (no body slot needed) |
| `Alert` | `@solvera/pace-core/components` | Error states for failed list/detail/form-response queries; read-only Closed-tab header strip |
| `AlertTitle` | `@solvera/pace-core/components` | Title slot inside `Alert` |
| `AlertDescription` | `@solvera/pace-core/components` | Description slot inside `Alert` |
| `Avatar` | `@solvera/pace-core/components` | Initials-only avatar for applicant photo thumbnail in review panel; matches TEAM-03 convention |
| `Badge` | `@solvera/pace-core/components` | Status badge (Pending / On hold / Approved / Rejected / Withdrawn); request-type badge (Join / Transfer) |
| `Button` | `@solvera/pace-core/components` | Action rail (Approve, Reject, Put on hold); Cancel/Confirm in dialogs; Retry on error; "View member 360" link |
| `Input` | `@solvera/pace-core/components` | Member-number input inside Approve dialog when applicant value is null |
| `Textarea` | `@solvera/pace-core/components` | Reject dialog (required) and On-hold dialog (optional) |
| `Label` | `@solvera/pace-core/components` | Field labels inside dialogs |
| `LoadingSpinner` | `@solvera/pace-core/components` | Page-level spinner for review panel; in-button spinner during RPC mid-flight (`size="sm"`); used internally by `DataTable` loading state |
| `toast` | `@solvera/pace-core/components` | Module-level toast for resolve success, resolve failure, stale resolve, org-switch redirect, request-not-found redirect |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalise list-query and RPC errors for inline `Alert` description and toast copy |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in query handlers must still abort the SELECT when `selectedOrganisation` is null mid-render (for example during an org switch). Cross-org SELECTs are not issued.
- **`ConfirmationDialog` is used for Approve-without-input only.** Reject, On-hold, and Approve-with-input all compose from the `Dialog` family because `ConfirmationDialog` has no body slot; a required Textarea or Input cannot be rendered inside it.
- **Dialog footers compose two `Button` controls inline** rather than using a shared save-actions primitive, because the slice needs custom button labels ("Approve", "Reject", "Put on hold") and the save-actions primitive hardcodes "Save".
- **`LoadingSpinner` `size="sm"` is used for in-button RPC mid-flight indication.** No third-party spinner icon is imported.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **`useResourcePermissions('approvals', 'update')` and the server-side `team_member_request_can_resolve` use different permission keys.** The UI gate uses `update:page.approvals` under app TEAM (a render hint). The server-side authority uses `update:member-profiles` under app PACE. The two keys do not need to agree — server is the final authority. This is intentional and not a bug.
- **Implementation gate.** The slice depends on the planned platform contract — see §15.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/approvals` (parent layout) | `approvals` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |
| `/approvals/:requestId` (child route inside parent layout) | `approvals` | `read` | inherited from parent layout |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read queue (Open + Closed) | `read:page.approvals` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Read review panel | `read:page.approvals` | `PagePermissionGuard` (parent layout) | `<AccessDenied />` |
| Approve / Reject / Put on hold (visibility) | `update:page.approvals` (UI render hint) | `useResourcePermissions('approvals', 'update')` | Action rail hidden |
| Approve / Reject / Put on hold (server enforcement) | `update:member-profiles` under app PACE | `team_member_request_can_resolve(organisation_id)` (RPC server-side) | RPC raises `'Permission denied'` → destructive toast |
| Row navigate to `/approvals/:requestId` | n/a at this slice (same `pageName`) | Parent guard already passed | n/a |
| Cross-link to `/members/:memberId` | n/a at this slice | TEAM-03 enforces detail-page guard | TEAM-03's responsibility |

### Server-side enforcement

- **`team_member_request` SELECT** enforced by RLS `rbac_select_team_member_request` via `team_member_request_can_read(organisation_id, requester_person_id)`. A user without read access for the target org receives an empty array.
- **`team_member_request` UPDATE / DELETE** are RLS-permitted for users where `team_member_request_can_resolve(organisation_id) OR team_member_request_is_requester(requester_person_id)` — but this slice does not call direct DML; all resolve transitions go through `app_resolve_member_request` (RPC, `SECURITY DEFINER`).
- **`core_member`, `core_person`, `core_membership_type`, `core_organisations`, `core_form_responses`, `core_form_response_values`, `core_form_fields`, `core_forms`** SELECTs enforced by their respective RLS policies per platform standards.
- **`app_resolve_member_request` RPC** runs `SECURITY DEFINER`. Internal call to `team_member_request_can_resolve(organisation_id)` enforces authorisation; FALSE raises `'Permission denied'`. Stale call (status no longer pending/on_hold) raises `'Resolvable request not found'`.

---

## §11 Acceptance criteria

- [ ] **AC-01 — Page entry, authenticated, has org, has read permission.**

Given a user is authenticated, has an org, and has `read:page.approvals`, when they navigate to `/approvals`, then the page renders the title "Approvals" and the Open tab is selected by default with `pending` and `on_hold` join/transfer requests of the current org listed and the Closed tab visible alongside. (Traces F-01, F-03, F-04, F-24.)

- [ ] **AC-02 — Open tab default sort.**

Given the Open tab has rows submitted at distinct times across 2026-04-30, 2026-05-01, 2026-05-02, when the page loads, then the rows render with the 2026-04-30 row first, the 2026-05-01 row second, and the 2026-05-02 row third under the **Submitted** column. (Traces F-27, F-61, BR-14.)

- [ ] **AC-03 — Open tab empty state.**

Given a user enters `/approvals` for an org that has zero pending or on_hold join/transfer requests, when the page loads, then the Open tab renders the empty state heading "No requests waiting for review." and description "New join and transfer requests appear here once submitted via your org signup form." with a text link "Configure org signup form" pointing to `/forms`. (Traces F-13.)

- [ ] **AC-04 — Closed tab default sort.**

Given the Closed tab has rows resolved at distinct times across 2026-04-30, 2026-05-01, 2026-05-02, when the user clicks the Closed tab, then the rows render with the 2026-05-02 row first, the 2026-05-01 row second, and the 2026-04-30 row third under the **Resolved** column. (Traces F-34, F-61, BR-14.)

- [ ] **AC-05 — Closed tab empty state.**

Given the current org has zero closed join/transfer requests, when the user clicks the Closed tab, then the Closed tab renders the empty state heading "No closed requests yet." and description "Resolved requests appear here for audit." with no CTA. (Traces F-14.)

- [ ] **AC-06 — Search filters in-memory.**

Given the Open tab has multiple rows and the user types "smit" into the search input, when the search executes, then only rows whose applicant full name or `applicant_member_number` contains "smit" (case-insensitive) remain visible; clearing the input restores all rows. (Traces F-59, BR-15.)

- [ ] **AC-07 — Request-type filter.**

Given the Open tab has rows with `request_type` values "join" and "transfer", when the user selects "Transfer" from the request-type filter pill, then only rows with `request_type='transfer'` remain visible; selecting "All" restores the unfiltered list. (Traces F-60, BR-15.)

- [ ] **AC-08 — Pagination.**

Given the Open tab has 60 rows, when the page loads with `initialPageSize=25`, then page 1 shows the first 25 rows, page 2 shows rows 26–50, and page 3 shows rows 51–60; changing the page size dropdown to 50 collapses pagination to two pages. (Traces F-62.)

- [x] **AC-09 — Row click navigates to review panel.**

Given a user has the Open tab visible and the viewport is at `md+`, when they click a row, then the URL changes to `/approvals/:requestId` where `:requestId` is the clicked row's `team_member_request.id`, the queue list stays visible on the left, and the review panel renders on the right with the request's applicant and form responses. (Traces F-58, F-68, BR-09.)

- [ ] **AC-10 — Review panel left column displays applicant + request groups.**

Given the user has navigated to `/approvals/:requestId` for a transfer request from "Jane Smith" submitted 2026-05-01 14:30 with target org "Acme Choir" and source org "Beta Choir" and membership type "Senior" and applicant member number "AC-001", when the review panel renders, then the left column shows the **Applicant** group with name "Jane Smith" and email displayed, and the **Request** group with type badge "Transfer", submitted "1 May 2026 at 14:30", target organisation "Acme Choir", source organisation "Beta Choir", membership type "Senior", applicant member number "AC-001", and a status badge "Pending". (Traces F-38, F-39, F-40.)

- [ ] **AC-11 — Review panel right column displays form responses.**

Given the user has navigated to `/approvals/:requestId` for a request whose `core_form_responses` row exists with three `core_form_response_values` rows for fields "Date of birth", "Phone", and "Marketing opt-in", when the review panel renders, then the right column shows a heading "Form responses" followed by three rows: "Date of birth → 1985-03-15", "Phone → +61 4 1234 5678", "Marketing opt-in → true" (or equivalent rendering of each value type). (Traces F-43, BR-11.)

- [ ] **AC-12 — Review panel right column empty state.**

Given the user has navigated to `/approvals/:requestId` for a request whose `core_form_responses` table has no row for `workflow_subject_id=:requestId`, when the review panel renders, then the right column shows heading "No form configured for this request type." and description "Configure your org signup form at /forms." with a text link to `/forms`. (Traces F-16, F-44.)

- [ ] **AC-13 — Approve happy path with applicant-supplied member number.**

Given the user has `update:page.approvals` AND the request has `applicant_member_number='AC-001'` AND `status='pending'`, when they click Approve, then a `ConfirmationDialog` opens with title "Approve request?", description "Jane Smith will become an active member with member number AC-001.", and a primary "Approve" button. When the user clicks Approve, then `app_resolve_member_request(:requestId, 'approved', null, null)` is called, on success the dialog closes, the slice navigates to `/approvals`, the Open + Closed + Open count query keys for the current org are invalidated, and a `'success'`-variant toast renders with copy "Request approved. Jane Smith is now an active member." (Traces F-50, F-54, BR-04, BR-19.)

- [ ] **AC-14 — Approve happy path requiring member-number input.**

Given the request has `applicant_member_number=NULL` AND `status='pending'`, when the user clicks Approve, then a composed `Dialog` opens with title "Approve request?" and a body containing a required `<Input label="Member number">` (helper "Required. Must be unique within this organisation."). The "Approve" button is disabled while the input is empty. When the user types "AC-002" and clicks Approve, then `app_resolve_member_request(:requestId, 'approved', null, 'AC-002')` is called, on success the dialog closes, the slice navigates to `/approvals`, query keys are invalidated, and a success toast renders. (Traces F-51, F-54, BR-04, BR-08, BR-19.)

- [ ] **AC-15 — Reject happy path with required notes.**

Given the request has `status='pending'`, when the user clicks Reject, then a composed `Dialog` opens with title "Reject request?" and a body containing a required `<Textarea label="Reason for rejection (visible to admins only)">` (helper "At least 10 characters."). The "Reject" button is disabled while the trimmed length is less than 10. When the user types "Application incomplete after follow-up" (longer than 10 chars) and clicks Reject, then `app_resolve_member_request(:requestId, 'rejected', 'Application incomplete after follow-up', null)` is called, on success the dialog closes, the slice navigates to `/approvals`, query keys are invalidated, and a `'success'`-variant toast renders with copy "Request rejected." (Traces F-52, F-55, BR-05, BR-19.)

- [ ] **AC-16 — Put-on-hold happy path with optional note.**

Given the request has `status='pending'`, when the user clicks "Put on hold", then a composed `Dialog` opens with title "Put request on hold?" and a body containing an optional `<Textarea label="Note (optional)">` (helper "Visible to admins only."). The "Put on hold" button is enabled by default. When the user clicks "Put on hold" without typing, then `app_resolve_member_request(:requestId, 'on_hold', null, null)` is called, on success the dialog closes, the slice navigates to `/approvals`, the Open + Open count query keys are invalidated (Closed list is not affected), and a `'success'`-variant toast renders with copy "Request placed on hold." (Traces F-53, F-56, BR-06, BR-19.)

- [x] **AC-17 — Reject blocked by insufficient note length.**

Given the request has `status='pending'` AND the user has typed "too short" (8 chars) into the Reject dialog's textarea, when they look at the dialog footer, then the "Reject" button is disabled. (Traces F-52, BR-05.)

- [x] **AC-18 — Stale resolve recovery.**

Given two admins have the Open tab open, admin A has clicked Approve on request R, the RPC has succeeded, and admin B then clicks Approve on the same request R, when admin B's RPC call returns, then the RPC raises `'Resolvable request not found'`, the slice surfaces a destructive toast "This request has already been resolved by another admin. Refreshing the queue.", invalidates the Open + Closed + Open count query keys for the current org, and navigates back to `/approvals`. (Traces F-20, BR-10.)

- [ ] **AC-19 — Permission denied — read.**

Given a user is authenticated and has org context but lacks `read:page.approvals`, when they navigate to `/approvals`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside the `AuthenticatedShell` chrome and no tab, table, toolbar, or review panel renders. (Traces F-23, F-64.)

- [x] **AC-20 — Permission denied — update.**

Given a user has `read:page.approvals` but lacks `update:page.approvals`, when they navigate to `/approvals/:requestId` for a `pending` request, then the queue list and the review panel (header strip + left column + right column) render normally, the action rail is hidden, and no Approve / Reject / Put on hold buttons appear. (Traces F-65.)

- [x] **AC-21 — Closed-tab read-only header strip.**

Given the user has navigated to `/approvals/:requestId` for a request with `status='approved'` resolved by "Alice Reviewer" on 2026-05-01, when the review panel renders, then the action rail does NOT render and a read-only `<Alert variant="default">` strip renders below the subtitle with title "Approved by Alice Reviewer on 1 May 2026" and description containing the `resolution_note` text (or "No note recorded." when null/empty). (Traces F-46, F-66, F-75.)

- [ ] **AC-22 — Withdrawn request with deleted member row.**

Given a request has `status='withdrawn'` AND `subject_member_id IS NULL` (the FK ON DELETE SET NULL fired when Portal deleted the provisional `core_member`), when the user navigates to `/approvals/:requestId`, then the review panel renders the left column (Applicant + Request groups read from `subject_person_id`) and the right column (form responses) normally; the "View member 360" link is suppressed. (Traces F-42, F-76, BR-12.)

- [x] **AC-23 — Cross-link to Member 360 — visible.**

Given a request has `subject_member_id` non-null AND the joined `core_member.deleted_at IS NULL`, when the review panel renders, then a `<Button variant="outline">View member 360 →</Button>` renders below the Request group; clicking it navigates to `/members/:memberId` using `core_member.id`. (Traces F-41, F-69, BR-12.)

- [ ] **AC-24 — Error state on list query failure.**

Given the Open list query fails, when the error is returned, then the Open tab renders an inline `Alert` with `variant="destructive"`, title "Could not load requests", a description sourced from `HandleSupabaseError`, and a Retry button alongside; clicking Retry re-runs the query. (Traces F-17.)

- [ ] **AC-25 — Org switch with detail open.**

Given the user is on `/approvals/:requestId` for org A, when they switch the org context to org B and `:requestId` does not belong to org B, then the slice navigates to `/approvals` for org B and renders a `'default'`-variant toast with copy "Switched organisations. Showing approvals for {newOrgName}." (Traces F-73, BR-16.)

- [ ] **AC-26 — Unknown / wrong-org request id.**

Given the user navigates directly to `/approvals/:requestId` for a `:requestId` that does not exist in the current org's `team_member_request` rows, when the review-panel SELECT returns zero rows, then the slice navigates to `/approvals` and renders a `'default'`-variant toast with copy "Request not found in this organisation." (Traces F-74, BR-13.)

- [x] **AC-27 — Mobile responsive layout.**

Given the viewport width is 600px (below `md`) AND the user is on `/approvals` with no `:requestId`, when the page renders, then the queue list renders in a single column with no review panel. When the user clicks a row, then the URL changes to `/approvals/:requestId`, the queue list is hidden, and the review panel renders alone. (Traces F-58, BR-09.)

- [x] **AC-28 — Hybrid layout at md+.**

Given the viewport width is 1024px (`lg`) AND the user is on `/approvals` with no `:requestId`, when the page renders, then the queue list renders on the left column (~360–480px) and the right column shows the empty state heading "Select a request to review" and description "Click a row in the queue to open the review panel." (Traces F-15, BR-09.)

- [ ] **AC-29 — Cross-org leakage prevention.**

Given a request exists in org B but not in org A, when the user is signed in with org A selected, then no SELECT against `team_member_request`, `core_person`, `core_member`, `core_organisations`, or `core_form_responses` returns the org-B row, regardless of search input or filter combination. (Traces F-79, BR-20.)

- [ ] **AC-30 — Open count nav badge updates on resolve.**

Given the open-count query at key `['approvals', 'open-count', selectedOrganisation.id]` returns `5` for the current org, when the user resolves one pending request via Approve, then on RPC success the slice invalidates the open-count key, the count query refetches, and the new returned value reflects the post-resolve count (`4` if no `on_hold` rows are excluded as per BR-18 — i.e. one fewer pending). (Traces F-77, BR-18.)

---

## §12 Verification

- **MCP test — `team_member_request_type` enum.** Confirm the enum has at least values `'member_profile_access'`, `'join'`, `'transfer'`. If `'join'` or `'transfer'` is missing, the slice is blocked (see §15).
- **MCP test — `team_member_request_status` enum.** Confirm the enum has at least values `'pending'`, `'on_hold'`, `'approved'`, `'rejected'`, `'withdrawn'`. If `'on_hold'` is missing, the slice is blocked.
- **MCP test — `team_member_request` columns.** Confirm `target_organisation_id`, `source_organisation_id`, `membership_type_id`, `applicant_member_number`, and `review_notes` exist on the table. If any are missing, the slice is blocked.
- **MCP test — `app_resolve_member_request` contract.** Smoke-test by invoking the RPC with `p_status='on_hold'` and `p_member_number=null` against a known pending request fixture; confirm no enum-mismatch error and that the row's `status` updates to `'on_hold'`. Smoke-test with `p_status='approved'` and `p_member_number='TEST-001'` against a separate fixture; confirm the joined `core_member.membership_status` updates to `'Active'` and `core_member.membership_number` becomes `'TEST-001'`. Smoke-test with `p_status='rejected'` and `p_review_notes='QA test reject'` against a separate fixture; confirm the joined `core_member` row is DELETEd and `team_member_request.subject_member_id` becomes NULL. If member-side effects do not execute server-side, the slice is blocked.
- **MCP test — `app_resolve_member_request` stale-resolve.** Invoke the RPC with `p_status='approved'` against a request whose `status` is already `'approved'`; confirm the RPC raises `'Resolvable request not found'`.
- **MCP test — `app_resolve_member_request` permission-denied.** Invoke the RPC as a user without org-admin access for the target org; confirm the RPC raises `'Permission denied'`.
- **MCP test — `app_resolve_member_request` member-number uniqueness.** Invoke the RPC with `p_status='approved'` and a `p_member_number` that already exists in the org; confirm the RPC raises a duplicate error.
- **MCP test — `core_form_responses` link convention.** Insert a fixture row with `workflow_subject_type='team_member_request'` and `workflow_subject_id=<test request id>`; confirm a SELECT joining to `core_form_response_values` and `core_form_fields` returns the expected `(label, value)` pairs.
- **MCP test — RLS authority.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), as a user with org-admin access on org A, run a SELECT on `team_member_request` that does not include an `organisation_id` filter. Confirm only org A's rows are returned.
- **MCP test — `rbac_app_pages` seeding.** Confirm a row exists with `page_name='approvals'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'`.
- **In-app demo flow — happy path Approve (member number supplied).** Sign in as a TEAM org-admin. Visit `/approvals`. Click a `pending` row whose `applicant_member_number` is supplied. In the review panel, click Approve. Confirm the `ConfirmationDialog` opens with the description listing the applicant's name and member number. Click Approve. Confirm the slice navigates to `/approvals`, the success toast appears, and the row no longer appears in the Open tab (it is now in the Closed tab as Approved).
- **In-app demo flow — happy path Approve (member number entered).** Click a `pending` row whose `applicant_member_number` is NULL. In the review panel, click Approve. Confirm the composed Dialog opens with the Member-number Input. Type a unique member number. Click Approve. Confirm the success toast and tab transition.
- **In-app demo flow — happy path Reject.** Click a `pending` row. Click Reject. Type "Application has insufficient information for review." (≥10 chars). Click Reject. Confirm the dialog closes, success toast appears, and the row moves to the Closed tab as Rejected.
- **In-app demo flow — happy path Put on hold.** Click a `pending` row. Click Put on hold. Click Put on hold without typing. Confirm the dialog closes, success toast appears, and the row stays in the Open tab with status badge "On hold".
- **In-app demo flow — Closed tab read-only.** Click any Closed tab row. Confirm the action rail is hidden and the read-only header strip shows "Approved by ... on ..." (or "Rejected by ..." or "Withdrawn by ...") with the resolution note below.
- **In-app demo flow — withdrawn with deleted member.** Stage a fixture with `status='withdrawn'` and `subject_member_id=NULL`. Navigate to `/approvals/:requestId`. Confirm the review panel renders the left column (Applicant + Request groups from `subject_person_id`) and the right column (form responses), and the "View member 360" link is suppressed.
- **In-app demo flow — stale resolve.** Open the same request in two browser tabs as the same admin. In tab A, click Approve and confirm. In tab B, click Approve and confirm. Confirm tab B receives the destructive toast "This request has already been resolved by another admin. Refreshing the queue." and navigates back to `/approvals`.
- **In-app demo flow — org switch with detail open.** Navigate to `/approvals/:requestId` for org A. Switch the org context to org B. Confirm the slice navigates to `/approvals` for org B and the default-variant toast appears with copy "Switched organisations. Showing approvals for {newOrgName}."
- **In-app demo flow — open count badge.** Visit `/approvals` for an org with 5 pending requests. Confirm TEAM-01's nav badge for "Approvals" reads `5`. Approve one request. Confirm the badge updates to `4` after the resolve success.
- **Transfer-approve smoke test.** Create a transfer request from sub-org A to sub-org B under the same issuing org; approve as Org B admin; verify (a) `team_member_request.status = 'approved'`, (b) issuing-org `core_member` becomes `Active` with assigned member number, (c) source sub-org `core_member_role.end_date` is set, (d) issuing-org membership remains `Active`. Confirms BR-04 Option A transfer-approve side-effects.

---

## §13 Testing requirements

- Unit / integration tests covering the resolve dialog validation rules: Reject confirm disabled when trimmed Textarea length < 10; Approve-with-input confirm disabled when trimmed Input is empty; Put-on-hold confirm enabled by default with empty Textarea.
- Component test that asserts the action rail is hidden when `useResourcePermissions('approvals', 'update').canUpdate === false`.
- Component test that asserts the action rail is hidden when `request.status !== 'pending'` and the read-only header strip renders instead.
- Component test that asserts the "View member 360" link is rendered only when `subject_member_id IS NOT NULL` AND `core_member.deleted_at IS NULL`.
- Component test that asserts the row click navigates to `/approvals/:requestId` and the layout switches to side-by-side at `md+` and stacks at `<md`.
- Integration test that asserts the Open list query filters `request_type IN ('join','transfer')` and `status IN ('pending','on_hold')` against a fixture dataset.
- Integration test that asserts the Closed list query filters `request_type IN ('join','transfer')` and `status IN ('approved','rejected','withdrawn')` against a fixture dataset.
- Integration test that asserts the open-count query at `['approvals', 'open-count', orgId]` excludes `on_hold` rows.
- Integration test that asserts a stale-resolve error from `app_resolve_member_request` ('Resolvable request not found') triggers the destructive toast, query-key invalidation, and navigation back to `/approvals`.
- Integration test that asserts a member-number uniqueness error from `app_resolve_member_request` leaves the Approve dialog open with the typed input intact.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads must go via `useSecureSupabase()`. Direct `createClient` calls are forbidden. Any client that bypasses RBAC scope resolution is forbidden.
- All resolve mutations must go via `app_resolve_member_request` RPC. Direct `.from('team_member_request').update(...)` and `.delete(...)` calls are forbidden, even though RLS would technically permit them for resolvers. The slice does not write `core_member` from the client.
- Do not author the migration extending `team_member_request_type` or `team_member_request_status` enums, adding the planned-contract columns, or updating the RPC behaviour. Those are upstream platform work; the slice depends on them (§15).
- Do not implement org form authoring, external-validation configuration, request submission, or request withdrawal in this slice.
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- Do not import any third-party spinner icon — use `<LoadingSpinner size="sm" />` for in-button mid-flight indication.

---

## §15 Done criteria

- All 30 acceptance criteria (AC-01 through AC-30) verified via the slice's QA pack.
- **Implementation blocked until:**
  - **(a)** `team_member_request_type` enum is extended with `'join'` and `'transfer'` on verified-contract project `yihzsfcceciimdoiibif` (backend-ready MCP target).
  - **(b)** `team_member_request_status` enum is extended with `'on_hold'` on dev.
  - **(c)** `team_member_request` table extended with columns `target_organisation_id` (uuid NOT NULL, FK `core_organisations.id`), `source_organisation_id` (uuid NULL, FK `core_organisations.id`), `membership_type_id` (uuid NULL, FK `core_membership_type.id`), `applicant_member_number` (text NULL), and `review_notes` (text NULL) on dev.
  - **(d)** `app_resolve_member_request` RPC accepts `p_status='on_hold'` and a `p_member_number` parameter, and executes member-side effects atomically server-side per BR-04 / BR-05 / BR-06 (Approve → set issuing-org `core_member.membership_status='Active'` and assign member number; optional placement `core_member_role` when `p_placement_role_id` supplied; transfer-Approve → close source placement; Reject → DELETE `Provisional` `core_member` only when no active placements; On-hold → no `core_member` change).
  - **(e)** `app_submit_member_request` RPC (TEAM-DB-018 Option A) provisions `core_member` at the issuing org when `request_type IN ('join','transfer')` and returns `issuing_org_id`. (Owned by TEAM-09 + Portal; verified for upstream readiness only.)

  The v6 slice does not author the migration. Until items (a) through (e) are confirmed via Supabase MCP against dev, this slice cannot be marked Done.

- Post-build RBAC seeding: the `rbac_app_pages` row for `page_name='approvals'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` must be in place before release.
- Open count nav badge contract verified end-to-end with TEAM-01: TEAM-05 publishes the query at `['approvals', 'open-count', selectedOrganisation.id]`, TEAM-01's nav cell reads it, and resolve-success invalidations propagate to the badge.

---

## §16 Do not

- Do not display external validation status / message on the review panel in v1. The columns (`external_validation_status`, `external_validation_message`) and the effective-config helper are not present on dev. Bundled with TEAM-08 Operational deferral and the national-DB validation API readiness; see §17.
- Do not display a profile-completeness indicator on the review panel in v1. Deferred from v1.
- Do not author the `org_signup` form here. Form authoring lives in TEAM-09 (`/forms`).
- Do not edit or display the `member_validation_config` on `core_org_settings`. That is TEAM-08 (`/settings/org`).
- Do not implement request submission in this slice. The org_signup form runtime in TEAM-09 + Portal owns the `app_submit_member_request` RPC, which creates the `team_member_request` row and the provisional `core_member` row server-side at submission time.
- Do not implement request withdrawal in this slice. Portal participants own `app_withdraw_member_request`; org admins never call it.
- Do not call `.from('team_member_request').update(...)` or `.delete(...)` from the client. All resolve transitions go via `app_resolve_member_request` RPC.
- Do not write `core_member` from the client. All member-side effects (`membership_status` change, member-number assignment, transfer source-org adjustment, provisional-row delete on reject) execute server-side inside the RPC, atomically with the request status change.
- Do not surface a "Reopen" or "Move back to pending" affordance on `on_hold` rows in v1. The action rail visibility uses `status === 'pending'` strictly; `on_hold` rows show the read-only header strip.
- Do not surface the `team_unit` legacy construct anywhere in this slice. The slice has no relationship to that construct.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not surface a row-level secondary action menu on the queue tables in v1. Row click is the single primary interaction.
- Do not surface Import / Export / Create / Delete affordances on the queue tables — `DataTable.features` toggles are off.
- Do not put `:requestId` in the URL via `location.state` only; the route param is the single source of truth for the review panel.
- Do not run any verification or smoke test against production. Dev-db only.
- Do not import any third-party spinner icon — `<LoadingSpinner size="sm" />` is the in-button mid-flight affordance.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; member requests scope item 6; canonical model for `team_member_request` vs `core_member.membership_status`.
- `/rebuild/architecture.md` — slice ownership, route registry, canonical `pageName` map (`approvals`), Open vs Closed split, hybrid routing decision (0.19), membership vs requests canonical (0.20).
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Approvals entry), and mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell` so any descendant route (including this slice) can call `toast(...)`. TEAM-05 depends on this mount; without it, `toast(...)` throws. TEAM-01's nav cell consumes the open-count query at the key `['approvals', 'open-count', selectedOrganisation.id]` published by this slice.
- **TEAM-02** — owns `/members`. Reads the same `team_member_request` rows for its Pending tab join condition. Both slices share the planned-contract enum extensions and column additions; both are gated on the same migration landing on dev.
- **TEAM-03** — owns `/members/:memberId`. TEAM-05's review panel navigates there from the "View member 360" button using `core_member.id` when BR-12 is satisfied.
- **TEAM-08** — owns `/settings/org` Operational. Owns `member_validation_config`. The external validation status / message display on the review panel is deferred from v1 and bundles with TEAM-08's Operational deferral pattern (deferred to a follow-up slice when `external_validation_status` and `external_validation_message` columns and `app_get_effective_member_validation_config` helper land on dev, alongside the national-DB validation API readiness).
- **TEAM-09** — owns `/forms`, including authoring of the `org_signup` form whose responses appear in this slice's review panel right column. TEAM-09 + Portal also own the matching `app_submit_member_request` RPC contract — the planned-contract version inserts both the `team_member_request` row and the provisional `core_member` row server-side at submission time when `request_type IN ('join','transfer')`. TEAM-05 is a downstream reader only.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage; `pageName` + `operation`; no `scope` prop at page level. `useResourcePermissions(resource, operation)` for action-level visibility gates.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and shell chrome (provided by TEAM-01).
- `pace-core2/packages/core/docs/requirements/CR21-workflow-forms-runtime.md` — shared forms runtime contract; `core_forms` / `field_key` semantics; future shared form-response viewer that will replace this slice's minimal local rendering when shipped.
- `pace-core2/packages/core/docs/database/domains/team.md` — `team_member_request` shape and enum reference (subject to the planned platform contract — see §15 implementation gate).
- DB-309 — `core_member.organisation_id NOT NULL` (live on dev).
- DB-418 — Upstream platform schema/RPC dependency for `team_member_request` enum extensions, column additions, and `app_resolve_member_request` / `app_submit_member_request` contract updates. The TEAM-05 implementation gate in §15 enumerates the deliverables platform must land on dev before this slice can be built.
- **RPC contract note.** This slice uses `app_resolve_member_request` as the canonical resolver contract. The substantive requirements remain: accept `'on_hold'`, execute member-side effects atomically, and accept `p_member_number` for approvals.

