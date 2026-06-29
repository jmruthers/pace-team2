# TEAM-09 — Org form authoring

## §1 Slice metadata

```
Slice ID:        TEAM-09
Name:            Org form authoring
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems, Forms nav cell)
Backend impact:  Schema changes (upstream platform: extend core_forms_workflow_type_check to permit 'org_signup'; add partial unique index core_forms_primary_org_signup_per_org_unique; deliver planned-contract app_submit_member_request signature accepting p_request_type + provisional core_member creation; seed core_field_list with org_signup person/contact/address fields; seed rbac_app_pages row for pageName='forms' under TEAM app — see §15 implementation gates)
Frontend impact: UI
Routes owned:    /forms; /forms/new; /forms/:formId
QA pack:         docs/test-packs/TM09-qa-pack.md
```

---

## §2 Overview

TEAM-09 delivers the org-admin authoring surface for `core_forms` rows owned by the currently selected organisation, covering the four org-scoped workflow types `org_signup`, `information_collection`, `consent_capture`, and `generic`. The list page at `/forms` uses **`PageHeader`** (title, subtitle, **New form** primary action in the header) above a searchable `DataTable`. The create page at `/forms/new` and edit page at `/forms/:formId` use **`PageHeader`** (dynamic title, workflow · slug · field-count subtitle; **Preview** and **Duplicate** ghost/secondary actions on the author route) above the shared **`FormsWorkstation`** layout — field list, metadata panels, validation, and save bar in one workstation surface (no tabs). Mutations are direct DML via `useSecureSupabase` against the live `check_user_is_org_admin(organisation_id)` RLS gate. Participant rendering of submitted forms lives on Portal at `/forms/:formSlug` and is out of scope.

- **Prototype reference:** `pace-prototype/apps/pace-team/pages/FormsReportsSettingsPages.jsx` — `FormsPage` (list) and `FormAuthoringPage` (author). Shared workstation: prototype `_pace-core` **`FormsWorkstation`** (maps to pace-core form authoring shell in production).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single, org-scoped place to author the forms their members fill out at `org_signup` (join / transfer entry), `information_collection`, `consent_capture`, and `generic` workflow points. TEAM-09 produces that surface. It does not own form submission, response display, audience binding to membership types, conditional-visibility authoring, or the Portal participant render.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Forms list | `/forms` | `DataTable` of `core_forms` rows for the currently selected organisation, regardless of `is_active` and `status`. |
| Create form | `/forms/new` | Authoring shell with blank state. On Save, INSERT lands and the slice navigates to `/forms/:formId` (the new form's id). |
| Edit form | `/forms/:formId` | Authoring shell pre-populated from the SELECT. |
| Delete confirmation | overlay on `/forms` or `/forms/:formId` | Either a destructive `ConfirmationDialog` (when `core_form_responses.count = 0`) or a non-destructive `Dialog` "Cannot delete this form" (when count > 0) per BR-I. |

### Boundaries

TEAM-09 does **not** own:
- Participant rendering or submission of forms — Portal owns `/forms/:formSlug` and the submission workflow runtime.
- The `app_submit_member_request` RPC body — TEAM-09 + Portal **own the contract** (planned-contract; cross-slice with TEAM-02 + TEAM-05); the RPC body is platform-DB work (see §15).
- Form response display — TEAM-05 reads the responses authored against forms produced here for the approval review panel.
- Audience binding (form-to-membership-type) — deferred to a follow-up slice. v1 implicit audience is "all active membership types" (BR-O).
- Conditional visibility (`displayOptions.visibility`) — `WorkflowFieldVisibilityEditor` is not in the pace-core2 barrel; not authored in v1 (BR-G).
- Field catalogue picker (`field_key` selection from `core_field_list`) — pace-core2 capability gap. The shipped `WorkflowFormFieldEditor` exposes a free-text `field_key` Input; the slice does not build a TEAM-local picker (see §15 / §16).
- Authoring of `base_registration`, `activity_booking`, or `merch_order` workflows — those are BASE / event-scoped and out of scope (§16).
- The schema migration extending `core_forms_workflow_type_check`, the partial unique index for primary `org_signup`, the planned-contract `app_submit_member_request` signature, and the `core_field_list` seed — those are upstream platform work (§15).

### Architectural posture

**Mutation contract — live `check_user_is_org_admin(organisation_id)` RLS gate.** All reads and writes go via `useSecureSupabase().from(...)`. Authorisation on the two mutated tables (`core_forms`, `core_form_fields`) is enforced at the database layer by RLS policies that gate INSERT / UPDATE / DELETE on whether the acting user is an `org_admin` for the target `organisation_id`. These policies already exist on dev and work today; this slice authors against them. Future cross-app convergence to RBAC-checked RLS for these tables is informational only and captured in §17.

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**Action gating.** Create / Edit / Delete visibility is gated by `useResourcePermissions('forms')`: the **Create form** toolbar button is hidden when `canCreate === false`; row Edit / Delete actions are hidden when `canUpdate === false` / `canDelete === false`. Copy share URL and Open in new tab are not permission-gated — they are read-only navigation affordances visible to anyone who can read the row.

**Authoring layout.** Single scrollable page rendered by `WorkflowFormAuthoringShell` directly, with `middleContent` populated by a slice-owned "Schedule & limits" Card. No tabs wrapper. No `WorkflowFormBuilderLayout`.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (Save success, Save error, Delete success, Delete error, copy-URL confirmation, org-switch redirect, form-not-found redirect). `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it. Toast variants used: `'default'`, `'destructive'`, `'success'`. Default duration 5000 ms.

**Page metadata.** `usePaceMain({ printTitle })` is called on mount: `'Forms'` for the list, `'Create form'` for `/forms/new`, the loaded form's name for `/forms/:formId` (until the form resolves, `printTitle` is `'Edit form'`).

**Org-scoped reads and writes.** Every list query and every mutation is filtered or stamped with `organisation_id = selectedOrganisation.id`. Switching the org context refetches the list against the new org and silently navigates `/forms/:formId` to `/forms` when the form does not belong to the new org (BR-L).

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider`. The shell's `eventSlug?` prop is passed as `null`.

### Page-level guards and evaluation ordering

The routes `/forms`, `/forms/new`, and `/forms/:formId` sit inside `AuthenticatedShell` (TEAM-01) and register read access in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts); shell `routeAccessDenied` enforces entry. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state from TEAM-01; the page guard does not evaluate.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the no-org empty state from TEAM-01 ("No organisation assigned. Please contact your administrator."). shell route read is not evaluated; no RBAC query fires.
4. **Route read access** — Once org context is resolved, shell `routeAccessDenied` (via [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts)) evaluates the route's registered `pageName` / `read` permission. Scope resolves internally from `OrganisationServiceProvider`; no page-level read guard wraps the component tree. While the shell RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable. On deny, `<AccessDenied />` renders in the shell main region. On allow, the page body renders.
5. **Form fetch (edit route only)** — Inside the page body of `/forms/:formId`, the slice fetches `core_forms` joined to `core_form_fields` for `core_forms.id = :formId AND organisation_id = selectedOrganisation.id`. While the query is in flight, a full-page `<LoadingSpinner />` renders inside `PaceMain`. On a zero-row result (unknown id, deleted form, cross-org form), the slice navigates to `/forms` and surfaces a `'default'`-variant toast "Form not found in this organisation."

If `selectedOrganisation` resolves to `null` after step 3 (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/forms` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.forms` permission.
- **F-02** On entry to `/forms`, the page fetches all `core_forms` rows for `selectedOrganisation.id`, regardless of `is_active` and `status`.
- **F-03** The page title on `/forms` is "Forms" (sentence case). No breadcrumb is rendered.
- **F-04** On entry to `/forms/new`, the page renders a blank `WorkflowFormAuthoringShell` with an initial state where `metadata.name=''`, `metadata.slug=''`, `metadata.description=''`, `metadata.workflowType='org_signup'`, `metadata.accessMode='authenticated_member'`, `metadata.status='draft'`, `metadata.isPrimaryEntrypoint=false`, `metadata.isActive=false`, `metadata.workflowConfig={}`, `metadata.organisationId=selectedOrganisation.id`, `fields=[]`. The shell's `heading` is "Create form" and `subheading` is "Define an org-scoped form for {selectedOrganisation.name}."
- **F-05** On entry to `/forms/:formId`, the page fetches `core_forms` joined to `core_form_fields` for `id = :formId AND organisation_id = selectedOrganisation.id`. On resolve, the shell's `state` is hydrated from the row (metadata + fields), the shell's `heading` is the form's `name`, and `subheading` is `"Edit form for {selectedOrganisation.name}."`. `slugReadOnly` is set to `true` (slug is immutable on edit per BR-D).
- **F-06** On `/forms/new` and `/forms/:formId`, `usePaceMain({ printTitle })` is set per BR-Q on mount.
- **F-07** Switching `selectedOrganisation` while on `/forms` refetches the list against the new org. Switching while on `/forms/:formId` runs BR-L.

### Loading states

- **F-08** While the list query on `/forms` is in flight, the table renders the `DataTable` loading state: a Card → Table → TableCaption (title + toolbar) → a single full-width row containing `<LoadingSpinner label="Loading forms" />`.
- **F-09** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).
- **F-10** On `/forms/:formId`, while the form fetch is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; the shell does not render until the form resolves.
- **F-11** While a Save mutation is in flight on `/forms/new` or `/forms/:formId`, the shell's Save `Button` is disabled and shows `<LoadingSpinner size="sm" />` next to the label "Save".
- **F-12** While a Delete mutation is in flight inside the destructive `ConfirmationDialog`, the dialog's Confirm button is disabled and shows `<LoadingSpinner size="sm" />` next to the label "Delete".
- **F-13** While the response-count fetch (used by BR-I delete dependency check) is in flight, the row's Delete action shows a brief `<LoadingSpinner size="sm" />` inline; the dialog does not open until the count resolves.

### Empty states

- **F-14** When `/forms` lists zero rows for the current org, the `DataTable` empty state renders heading "No forms yet." and description "Create your first form for {selectedOrganisation.name}." The toolbar's **Create form** button remains visible above the empty area when `canCreate === true`.

### Error states

- **F-15** When the list query on `/forms` fails, the table is replaced inline by `<Alert variant="destructive">` with title "Could not load forms", description set from `HandleSupabaseError(error, { context: 'core_forms' })`, and a Retry `Button` that re-runs the query.
- **F-16** When the form fetch on `/forms/:formId` fails, the page replaces the shell with `<Alert variant="destructive">` titled "Could not load form", description set from `HandleSupabaseError(error, { context: 'core_forms' })`, and a Retry `Button` that re-runs the fetch.
- **F-17** When the response-count fetch fails on a row's Delete action, the slice surfaces a `'destructive'`-variant toast "Could not check responses: {normalised error}." and does not open a Delete dialog.
- **F-18** When the Save mutation fails on `/forms/new` or `/forms/:formId`, the slice surfaces a `'destructive'`-variant toast "Could not save form: {normalised error}." (normalised by `HandleSupabaseError(error, { context: 'core_forms' })`) and the shell remains rendered with the user's edits intact.
- **F-19** When the Delete mutation fails (count = 0 path, after Confirm), the slice surfaces a `'destructive'`-variant toast "Could not delete form: {normalised error}." and the dialog closes; the row remains in the list.
- **F-20** A user without `read:page.forms` sees `<AccessDenied />` rendered inside `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).

### Primary content — `/forms` list

- **F-21** The `DataTable` renders one row per `core_forms` row in the current org, in the columns and order: **Name**, **Workflow type**, **Status**, **Active**, **Primary**, **Updated**, **Actions**.
- **F-22** The **Name** column shows `core_forms.name` as plain text. Sortable.
- **F-23** The **Workflow type** column shows the title-cased label of `workflow_type` (per BR-P): "Org signup" for `'org_signup'`, "Information collection" for `'information_collection'`, "Consent capture" for `'consent_capture'`, "Generic" for `'generic'`. Plain text. Sortable.
- **F-24** The **Status** column shows a `Badge`: "Draft" (default tone) for `status='draft'`, "Published" (success tone) for `status='published'`, "Closed" (muted tone) for `status='closed'`. Sortable.
- **F-25** The **Active** column shows a `Badge`: "Active" (success tone) when `is_active === true`, "Inactive" (muted tone) when `is_active === false`. Sortable.
- **F-26** The **Primary** column shows a `Badge` "Primary" (default tone) when `is_primary_entrypoint === true`, otherwise an em-dash ("—"). Sortable; sort places primary rows first ascending.
- **F-27** The **Updated** column shows `updated_at` as a localised short date with time (e.g. "5 May 2026, 14:30"). Default sort: descending.
- **F-28** The **Actions** column shows row-level action triggers per BR-R (Edit, Copy share URL, Open in new tab, Delete), gated by `canUpdate` / `canDelete`.
- **F-29** Audit fields (`created_by`, `updated_by`, `created_at`) are not displayed in any column.

### Primary content — `/forms/new` and `/forms/:formId`

- **F-30** The page renders `WorkflowFormAuthoringShell` directly inside `PaceMain`. The shell composes a header (h1 heading + p subheading) → ValidationSummary → Preview target Card → Form metadata Card → Schedule & limits Card (slice-owned, in `middleContent`) → Fields Card → right-aligned Save Button. The shell's `allowedWorkflowTypes` prop is `['org_signup', 'information_collection', 'consent_capture', 'generic']` (BR-B). The shell's `eventSlug` prop is `null`. The shell's `disabled` prop is `false` while editable; toggled `true` while a Save mutation is in flight.
- **F-31** The **ValidationSummary** sub-section renders inside the shell. When `validateWorkflowAuthoringState(state).errors.length === 0 && warnings.length === 0`, a single `Alert` titled "Ready" with description "Authoring state passes shared validation." renders. Otherwise a `Card` titled "Validation" renders, containing one `Alert variant="destructive"` titled "Errors" (description concatenates each error's `message` separated by single spaces) when `errors.length > 0`, and one `Alert` titled "Warnings" (same concatenation pattern) when `warnings.length > 0`.
- **F-32** The **Preview target** Card renders inside the shell with title "Preview target" and two paragraph rows: the path returned by `buildWorkflowPreviewTarget(state, { eventSlug: null })` (e.g. `"/forms/{slug}"` for `org_signup` and `generic`-type slug entry), and the reason code (e.g. `"org_signup_entrypoint"`, `"generic_slug_entrypoint"`).
- **F-33** The **Form metadata** Card renders the pace-core2 metadata editor with stacked Label rows for: Name (`Input`, required, BR-F), Slug (`Input`; disabled on edit per `slugReadOnly=true`; required, BR-D), Description (`Textarea`, optional), Workflow type (`Select` populated from `allowedWorkflowTypes` — four values listed in F-30), Access mode (`Select` for `'public' | 'authenticated_member'`; v1 uses `'authenticated_member'`, BR-C), Status (`Select` for `'draft' | 'published' | 'closed'`), Primary entrypoint (`Checkbox`), Active (`Checkbox`).
- **F-34** The **Schedule & limits** Card (slice-owned, rendered into the shell's `middleContent` slot) renders, in order, stacked Label rows for: **Opens at** (`Input` `type="datetime-local"`, optional; helper text "ISO date and time when the form opens for submissions."), **Closes at** (`Input` `type="datetime-local"`, optional; helper text "ISO date and time when the form stops accepting submissions."), **Maximum submissions** (`Input` `type="number"` with `min=0`, optional; helper text "Leave blank for no limit."), **Confirmation message** (`Textarea`, optional; helper text "Shown to participants after a successful submission."), **Required** (`Switch` with label "Form submission is required for this workflow"; persists to `core_forms.is_required`).
- **F-35** The **Fields** Card renders the pace-core2 field editor. Per active field, the editor shows a bordered article with stacked Labels for: **Field key** (`Input`, free-text; helper text "e.g. core_person.first_name. The shared field-catalogue picker is not available in v1."), **Label** (`Input`), **Field type** (`Input`, free-text; helper text "Supported types: text, textarea, address. Other values surface a publish warning."), **Sort order** (`Input` `type="number"`), **Display options (JSON)** (`Textarea`; helper text "Optional JSON. Conditional visibility authoring is not available in v1."), **Required** (`Checkbox`), **Active** (`Checkbox`), and a right-aligned Remove field outline `Button`. Below the field list, a right-aligned Add field `Button` appends a default field with `fieldKey='generic.field_<n+1>'`, `fieldType='text'`, `fieldLabel='Field <n+1>'`, `isActive=true`, `isRequired=false` (per pace-core2 source).
- **F-36** The **Save** `Button` renders right-aligned at the bottom of the shell. The label is "Save". It is disabled when `validateWorkflowAuthoringState(state).isValid === false` OR while the Save mutation is in flight.

### Primary actions — `/forms` list

- **F-37** **Create form.** A toolbar button labelled "Create form" with a `Plus` icon glyph renders right-aligned in the table caption. Click navigates to `/forms/new`. The button is hidden when `canCreate === false`.
  - **Placement note:** TM09 forbids DataTable wired create (`creation: false`, F-47); pace-core `onCreateRow` opens an inline modal row-create flow. The slice therefore renders **Create form** slice-owned in `CardHeader` directly above `DataTable`, right-aligned adjacent to the table caption/toolbar chrome.
- **F-38** **Edit row action.** Click navigates to `/forms/:formId` using `core_forms.id`. Hidden when `canUpdate === false`.
- **F-39** **Copy share URL row action.** Click writes `${VITE_FORM_PORTAL_URL}/forms/${row.slug}` (URL-joined safely per BR-J) to the clipboard via `navigator.clipboard.writeText(...)` and surfaces a `'success'`-variant toast "Share URL copied to clipboard." On clipboard failure (rejected promise), surfaces a `'destructive'`-variant toast "Could not copy share URL: {normalised error}.". Visible to all users who can see the row.
- **F-40** **Open in new tab row action.** Click invokes `window.open('${VITE_FORM_PORTAL_URL}/forms/${row.slug}', '_blank', 'noopener,noreferrer')`. No toast. Visible to all users who can see the row.
- **F-41** **Delete row action.** Click runs the dependency check (BR-I): the slice fetches `count` of `core_form_responses` for `form_id = row.id`. If count > 0, the slice opens a non-destructive `Dialog` "Cannot delete this form" (per F-46). If count = 0, the slice opens a destructive `ConfirmationDialog` (per F-45). Hidden when `canDelete === false`.

### Primary actions — `/forms/new` and `/forms/:formId`

- **F-42** **Save.** Click runs the shell's `onSave` handler:
  - On `/forms/new`: INSERT into `core_forms` with the metadata payload (BR-N field list); on success, INSERT each active field row into `core_form_fields`; on overall success, the slice navigates to `/forms/:formId` using the new id, refreshes the form fetch query, and surfaces a `'success'`-variant toast "Form created."
  - On `/forms/:formId`: UPDATE `core_forms` with the metadata payload; replace `core_form_fields` rows (DELETE rows whose `id` is no longer in state, INSERT new rows whose `id` is not in the table, UPDATE rows whose `id` exists in both); on overall success, the slice refreshes the form fetch query and surfaces a `'success'`-variant toast "Form saved."
  - On any failure during Save, F-18 applies.
- **F-43** **Org switch — edit page.** When `selectedOrganisation` changes while `/forms/:formId` is mounted, BR-L applies. If the form belongs to the new org, the page silently rebinds (the shell re-hydrates from the new fetch). If the form does not belong to the new org (zero rows), the slice navigates to `/forms` and surfaces a `'default'`-variant toast "Switched organisations. Showing forms for {newOrgName}."

### Secondary actions — `/forms` list

- **F-44** **Search.** A toolbar text-search input (rendered by `DataTable`) filters the in-memory rows by case-insensitive substring across `core_forms.name`, the title-cased workflow type label (per BR-P), and the title-cased status label (per F-24). Clearing the input restores the unfiltered list.
- **F-45** **Sort.** Each column header is sortable. Default sort: **Updated** descending (BR-S).
- **F-46** **Pagination.** `initialPageSize` is `25`; page size options are `[10, 25, 50]`.
- **F-47** **No import / export / hierarchical / grouping affordances.** The `DataTable.features` toggles set: `import: false`, `export: false`, `hierarchical: false`, `grouping: false`, `creation: false`, `editing: false`, `deletion: false`, `deleteSelected: false`, `selection: false`. `search: true`, `pagination: true`, `sorting: true`, `filtering: true`, `columnVisibility: true`, `columnReordering: true`. The toolbar Create button is rendered by the slice (not by `DataTable`'s `onCreateRow`).

### Permission-conditional rendering

- **F-48** When `read:page.forms` is denied, `<AccessDenied />` renders and no list / shell / dialog renders.
- **F-49** When `useResourcePermissions('forms').canCreate === false`, the **Create form** button on `/forms` is hidden, and direct navigation to `/forms/new` still renders the shell (the page guard's `read` permits read-mode display) but Save fails with a server-side RLS deny — the slice surfaces a `'destructive'` toast on Save attempt with the normalised message.
- **F-50** When `useResourcePermissions('forms').canUpdate === false`, the row Edit action is hidden, and direct navigation to `/forms/:formId` renders the shell with `disabled=true` so all metadata editor fields, Schedule & limits inputs, fields editor controls, and the Save Button are non-interactive.
- **F-51** When `useResourcePermissions('forms').canDelete === false`, the row Delete action is hidden.

### Navigation

- **F-52** The page is reachable from the TEAM-01 navigation menu under **Forms** (`/forms`).
- **F-53** Toolbar **Create form** button → `/forms/new`.
- **F-54** Row Edit action → `/forms/:formId`.
- **F-55** Row Open in new tab action → `${VITE_FORM_PORTAL_URL}/forms/${row.slug}` in a new tab.
- **F-56** On Save success on `/forms/new` → `/forms/:formId` (the new form id).
- **F-57** Cancel-style navigation: there is no Cancel button on `/forms/new` or `/forms/:formId` in v1. Users navigate away via TEAM-01's nav menu or browser back. Unsaved edits are discarded silently on navigation.
- **F-58** On Delete success → list refetches; the user remains on `/forms` (or `/forms/:formId` is replaced with `/forms` if the user was on the edit route — see BR-I).

### Edge cases and constraints

- **F-59** **Org switch — list page.** `selectedOrganisation` change triggers list refetch against the new org and discards any open Delete dialog state.
- **F-60** **Org switch — edit page.** Per BR-L: silent rebind when the form belongs to the new org, redirect with toast otherwise.
- **F-61** **Unknown / wrong-org form id.** When the SELECT on `/forms/:formId` returns zero rows, the slice navigates to `/forms` and surfaces a `'default'`-variant toast "Form not found in this organisation."
- **F-62** **Cross-org leakage prevention.** Every list and detail SELECT carries `organisation_id = selectedOrganisation.id` defensively; even if RLS were misconfigured, cross-org rows would not return.
- **F-63** **Last-write-wins on Save.** Edits use last-write-wins. No optimistic locking; no `updated_at` watermark check. If a second admin saves between this user's read and Save, the second-save values overwrite the first; the next refetch reflects the second-save state.
- **F-64** **Activate gate.** The Active checkbox visually toggles `metadata.isActive`, but the Save Button is disabled while validation errors exist (per F-36 and BR-F's `'activation_blocked'` rule). A user attempting to publish (set `status='published'` AND `isActive=true`) with errors present sees the Save Button disabled and the ValidationSummary listing the errors that must be fixed.

---

## §5 Visual specification

### Layout

The pages render inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`:

**`/forms`** — **`PageHeader`** at the top of `PaceMain`:
- **Title:** "Forms".
- **Subtitle:** one sentence describing application, consent, and information-collection forms and the primary org-signup entry-point role (prototype copy: "Application, consent, and information-collection forms. The first published org-signup form becomes your join entry-point.").
- **Header-right:** primary **`New form`** button (`Plus` icon) navigates to `/forms/new` when `canCreate === true`. This is the sole create entry — not a DataTable toolbar create button.
- Below the header, a **`DataTable`** (no outer `Card` wrapper in prototype; pace-core `Card` wrapper acceptable in production if audit requires it) with search, sort, pagination, and row activate → `/forms/:formId`. Modal overlays (`ConfirmationDialog` for delete confirm; `Dialog` for delete blocked) mount as full-viewport overlays via `DialogPortal`.

**`/forms/new` and `/forms/:formId`** — **`PageHeader`** then **`FormsWorkstation`** (shared workstation layout):
- **PageHeader title:** "Create form" on `/forms/new`; the loaded form's `name` (or "Untitled form") on `/forms/:formId`.
- **PageHeader subtitle:** `{workflowShort} · /{slug} · {fieldCount} field(s)` — workflow short label from `PACE_RESOLVE_WORKFLOW`, slug from form metadata, field count excluding section markers.
- **PageHeader header-right (author routes):** **Preview** (ghost, external icon) and **Duplicate** (secondary) — non-persistence actions; visible on edit route; Preview may stub on create until first save.
- **`FormsWorkstation`** body (below header): composed field editor, form metadata, schedule/limits, validation summary, preview target, and save/publish actions in the workstation's canonical vertical layout (prototype `_pace-core/forms/FormsWorkstation`; production equivalent: pace-core **`WorkflowFormAuthoringShell`** or successor shell wired to the same slots). Slug input is editable on create, read-only on edit (`slugReadOnly={true}` on `/forms/:formId`).

Breakpoints: standard pace-core2 responsive behaviour applies — the `DataTable` shows horizontal scroll on narrow viewports rather than collapsing to a card list. The shell's vertical stack flows naturally on narrow viewports (each Card is full-width). `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Components

**`/forms` list `DataTable`** (`@solvera/pace-core/components`)
- Purpose: table of `core_forms` rows for the current org with sort, search, and pagination.
- `data`: array of rows from the list query.
- `rbac.pageName`: `'forms'`.
- `title`: omitted (the page heading sits above the card).
- `description`: `"{count} forms"` where `{count}` is the unfiltered server-result count.
- `isLoading`: bound to the list query's loading state.
- `emptyState`: `{ title: "No forms yet.", description: "Create your first form for {selectedOrganisation.name}." }`.
- `getRowId`: `(row) => row.id`.
- `initialPageSize`: `25`.
- `initialSorting`: `[{ id: 'updated_at', desc: true }]`.
- `actions`: array of row-action descriptors for **Edit**, **Copy share URL**, **Open in new tab**, **Delete** per BR-R.
- `onCreateRow`: handler that navigates to `/forms/new`. The DataTable's built-in create modal is not used.
- `onEditRow`, `onDeleteRow`: not used.
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, deletion: false, deleteSelected: false, selection: false, search: true, pagination: true, sorting: true, filtering: true, creation: true, editing: false, columnVisibility: true, columnReordering: true }`.

Columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Name | `core_forms.name` | flexible | Plain text. Sortable. |
| Workflow type | title-cased label of `workflow_type` per BR-P | narrow-medium | Plain text. Sortable. |
| Status | `core_forms.status` | narrow | `Badge`: "Draft" (default tone) / "Published" (success tone) / "Closed" (muted tone). Sortable. |
| Active | `core_forms.is_active` | narrow | `Badge`: "Active" (success tone) / "Inactive" (muted tone). Sortable. |
| Primary | `core_forms.is_primary_entrypoint` | narrow | `Badge` "Primary" (default tone) when `true`; em-dash ("—") otherwise. Sortable; primary-true rows sort first ascending. |
| Updated | `core_forms.updated_at` | narrow | Localised short date with time ("5 May 2026, 14:30"). Sortable. Default sort: desc. |
| Actions | (n/a) | narrow | Edit / Copy share URL / Open in new tab / Delete triggers per row. Edit and Delete gated by `canUpdate` / `canDelete`; Copy and Open are visible to anyone who can see the row. |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search forms".
- Column-visibility popover (default `DataTable` affordance).
- **Create form** primary button (right-aligned), visible when `canCreate === true`. Glyph: `Plus` icon precedes the label.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

Row-action triggers (per row, in the Actions column):
- **Edit** — outline `Button` with `SquarePen` icon glyph (from `@solvera/pace-core/icons`); label "Edit". Click navigates to `/forms/:formId`. Hidden when `canUpdate === false`.
- **Copy share URL** — outline `Button` with `Copy` icon glyph (from `lucide-react` — see §9.2 caveat); label "Copy URL". Click writes `${VITE_FORM_PORTAL_URL}/forms/${row.slug}` to the clipboard and surfaces the success toast.
- **Open in new tab** — outline `Button` with `ExternalLink` icon glyph (from `lucide-react` — see §9.2 caveat); label "Open". Click invokes `window.open` to the same URL in a new tab.
- **Delete** — outline destructive `Button` with `Trash2` icon glyph; label "Delete". Click runs BR-I dependency check. Hidden when `canDelete === false`.

**`/forms/new` and `/forms/:formId` — `WorkflowFormAuthoringShell`** (`@solvera/pace-core/forms`)
- Purpose: composed authoring shell that renders ValidationSummary, Preview target Card, Form metadata Card, slice-owned Schedule & limits Card via `middleContent`, Fields Card, and right-aligned Save Button.
- Props:
  - `state`: the `WorkflowAuthoringState` held in the slice's local state.
  - `onStateChange`: setter that updates the slice's local state.
  - `onSave`: slice handler that runs Save (per F-42).
  - `onPreviewTarget`: not used (slice renders the preview path directly via the shell).
  - `heading`: "Create form" on `/forms/new`; the form's `name` on `/forms/:formId`.
  - `subheading`: "Define an org-scoped form for {orgName}." on `/forms/new`; "Edit form for {orgName}." on `/forms/:formId`.
  - `allowedWorkflowTypes`: `['org_signup', 'information_collection', 'consent_capture', 'generic']`.
  - `middleContent`: the slice-owned Schedule & limits Card (described below).
  - `eventSlug`: `null`.
  - `disabled`: `false` while editable; `true` during Save mutation; `true` when `canUpdate === false` on the edit page.
  - `saveLabel`: omitted (defaults to `'Save'`).
  - `slugReadOnly`: `false` on `/forms/new`; `true` on `/forms/:formId`.
- Internals: the shell renders `<section className="grid gap-6">` containing, in order:
  1. `<header className="grid gap-2">` — `<h1>{heading}</h1>` and `<p>{subheading}</p>`.
  2. `<ValidationSummary>` — described in F-31. When clean, a single `<Alert>` with `<AlertTitle>Ready</AlertTitle>` and `<AlertDescription>Authoring state passes shared validation.</AlertDescription>`. When dirty, a `<Card>` titled "Validation" with errors and warnings as nested Alerts.
  3. `<Card>` titled "Preview target" — `<CardContent className="grid gap-2">` with `<p>{previewTarget.path}</p>` and `<p>{previewTarget.reason}</p>`.
  4. `<WorkflowFormMetadataEditor>` — Card "Form metadata" (described below).
  5. `middleContent` — the slice's Schedule & limits Card.
  6. `<WorkflowFormFieldEditor>` — Card "Fields" (described below).
  7. `<fieldset className="grid justify-items-end">` containing `<Button>{saveLabel}</Button>`. The Save Button is disabled when `disabled === true` OR `validation.isValid === false`.

**Form metadata Card** (rendered by `WorkflowFormMetadataEditor`)
- Heading: `<CardTitle>Form metadata</CardTitle>`.
- Body: stacked `<Label className="grid gap-2">` rows in this order:
  - **Name** — `<Input>` bound to `metadata.name`. Required. Placeholder omitted. Helper text omitted.
  - **Slug** — `<Input>` bound to `metadata.slug`. Required. Disabled when `slugReadOnly={true}` (edit page). Pattern `^[a-z0-9]+(-[a-z0-9]+)*$` enforced by validator. Placeholder omitted. Helper text omitted.
  - **Description** — `<Textarea>` bound to `metadata.description`. Optional. Helper text omitted.
  - **Workflow type** — `<Select>` populated from `allowedWorkflowTypes`. Placeholder option labelled "Workflow type". Visible options: `org_signup`, `information_collection`, `consent_capture`, `generic` (the raw enum strings, per pace-core2 source).
  - **Access mode** — `<Select>` for `'public' | 'authenticated_member'`. Placeholder "Access mode". v1 selects `'authenticated_member'`; the validator blocks publishing when `org_signup` + `'public'`.
  - **Status** — `<Select>` for `'draft' | 'published' | 'closed'`. Placeholder "Status".
  - **Primary entrypoint** — `<Label className="grid grid-cols-[auto_1fr]">` containing a `<Checkbox>` and the label "Primary entrypoint".
  - **Active** — same Checkbox row pattern with the label "Active".

**Schedule & limits Card** (slice-owned, rendered into `middleContent`)
- Container: `<Card>` with `<CardHeader><CardTitle>Schedule & limits</CardTitle></CardHeader><CardContent className="grid gap-4">`.
- Body: stacked `<Label className="grid gap-2">` rows in this order:
  - **Opens at** — `<Input type="datetime-local">` bound to `metadata.workflowConfig`-adjacent slice state for `opens_at` (mapped to `core_forms.opens_at` on save). Optional. Helper text "ISO date and time when the form opens for submissions.".
  - **Closes at** — `<Input type="datetime-local">` bound to `closes_at`. Optional. Helper text "ISO date and time when the form stops accepting submissions.".
  - **Maximum submissions** — `<Input type="number" min="0">` bound to `max_submissions`. Optional. Helper text "Leave blank for no limit.". Empty input persists as NULL.
  - **Confirmation message** — `<Textarea>` bound to `confirmation_message`. Optional. Helper text "Shown to participants after a successful submission.".
  - **Required** — `<Label className="grid grid-cols-[auto_1fr]">` containing a `<Switch>` and the label "Form submission is required for this workflow". Bound to `is_required`.

**Fields Card** (rendered by `WorkflowFormFieldEditor`)
- Heading: `<CardTitle>Fields</CardTitle>`.
- Body: per active field (sorted by `sortOrder`), an `<article className="grid gap-3 rounded-md border p-3">` containing stacked `<Label className="grid gap-2">` rows:
  - **Field key** — `<Input>` (free-text) bound to `field.fieldKey`. Helper text "e.g. core_person.first_name. The shared field-catalogue picker is not available in v1." (per BR-V).
  - **Label** — `<Input>` bound to `field.fieldLabel`.
  - **Field type** — `<Input>` (free-text) bound to `field.fieldType`. Helper text "Supported types: text, textarea, address. Other values surface a publish warning." (per BR-W).
  - **Sort order** — `<Input type="number">` bound to `field.sortOrder`.
  - **Display options (JSON)** — `<Textarea>` bound to a JSON-stringified `field.displayOptions`. Helper text "Optional JSON. Conditional visibility authoring is not available in v1." (per BR-G).
  - **Required** — `<Label className="grid grid-cols-[auto_1fr]">` Checkbox row labelled "Required".
  - **Active** — same Checkbox row pattern labelled "Active".
  - **Remove field** — right-aligned outline `<Button>` labelled "Remove field".
- After all fields, a right-aligned `<Button>` labelled "Add field" appends a default field (per pace-core2 source: `fieldKey='generic.field_<n+1>'`, `fieldType='text'`, `fieldLabel='Field <n+1>'`, `isActive=true`, `isRequired=false`).

**ValidationSummary** (rendered by the shell)
- Clean state: a single `<Alert>` containing `<AlertTitle>Ready</AlertTitle>` and `<AlertDescription>Authoring state passes shared validation.</AlertDescription>`. No tone variant (default).
- Dirty state: a `<Card>` titled "Validation" with `<CardContent className="grid gap-3">` containing:
  - When `errors.length > 0`: `<Alert variant="destructive">` with `<AlertTitle>Errors</AlertTitle>` and `<AlertDescription>` whose body is each error's `message` string concatenated, separated by single spaces (per pace-core2 source).
  - When `warnings.length > 0`: `<Alert>` with `<AlertTitle>Warnings</AlertTitle>` and `<AlertDescription>` whose body is each warning's `message` string concatenated, separated by single spaces.

**Preview target Card** (rendered by the shell)
- Heading: `<CardTitle>Preview target</CardTitle>`.
- Body: `<CardContent className="grid gap-2">` with two `<p>` rows. The first paragraph shows `previewTarget.path` (e.g. `/forms/{slug}` for `org_signup` and `generic` slug entry). The second paragraph shows `previewTarget.reason` (e.g. `org_signup_entrypoint`, `generic_slug_entrypoint`).

**Save `Button`** (rendered inside the shell's right-aligned `<fieldset>`)
- Variant: default (primary).
- Label: "Save".
- Disabled when `disabled === true` OR `validation.isValid === false` OR Save mutation in flight.
- During Save mutation: shows `<LoadingSpinner size="sm" />` next to the label.

**Delete `ConfirmationDialog` (count = 0 path)** (`@solvera/pace-core/components`)
- Trigger: row Delete action when `core_form_responses.count === 0` for the row.
- `title`: "Delete '{name}'?" (with the form's `name` interpolated).
- `description`: "This cannot be undone."
- `confirmLabel`: "Delete".
- `cancelLabel`: "Cancel".
- `variant`: `'destructive'`.
- `onConfirm`: awaits the DELETE on `core_forms`; closes on resolution. `isPending` reflects the in-flight mutation; the Confirm button shows `<LoadingSpinner size="sm" />` when pending.

**Delete blocked `Dialog` (count > 0 path)** (`@solvera/pace-core/components`)
- Trigger: row Delete action when `core_form_responses.count > 0` for the row.
- Container: `<Dialog open onOpenChange><DialogPortal><DialogContent><DialogHeader><DialogTitle>Cannot delete this form</DialogTitle></DialogHeader><DialogBody>{body}</DialogBody><DialogFooter><Button variant="default">OK</Button></DialogFooter></DialogContent></DialogPortal></Dialog>`.
- Header title: "Cannot delete this form".
- Body: a single paragraph `"{N} submitted response(s) reference this form. Forms with responses cannot be deleted."` where `{N}` is the integer count.
- Footer: a single `<Button variant="default">OK</Button>` that closes the dialog.
- Close behaviour: native escape key (DialogContent uses `dialog.showModal()`), the OK button, click outside.
- Focus management: focus moves to OK on open; returns to the row's Delete trigger on close.

**Toasts** — surfaced via the module-level `toast({ title, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'success'` (Save success, Delete success, Copy URL success), `'destructive'` (Save failure, Delete failure, response-count failure, copy-URL failure, list-load failure escalation), `'default'` (org-switch redirect, form-not-found redirect). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### Layout acceptance criteria (prototype alignment)

- [ ] **`/forms`** renders **`PageHeader`** with title "Forms", descriptive subtitle, and **New form** primary action in the header-right slot (not DataTable toolbar create).
- [ ] **`/forms`** list is a searchable **`DataTable`** below the header; row activate opens the author route.
- [ ] **`/forms/new`** and **`/forms/:formId`** render **`PageHeader`** above the workstation (dynamic title + workflow · slug · field-count subtitle).
- [ ] Author routes expose **Preview** and **Duplicate** in **`PageHeader`** header-right (ghost/secondary; non-persistence labels).
- [ ] Author body uses shared **`FormsWorkstation`** layout (field list + metadata + save bar); no tabbed authoring shell.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- List page uses plain **`<h1>Forms</h1>`** instead of **`PageHeader`** with subtitle.
- **Create form** lives in the **`DataTable`** toolbar, not a header **New form** button.
- Author routes mount **`WorkflowFormAuthoringShell`** with shell-owned **`<h1>`** heading row instead of **`PageHeader`** + **Preview** / **Duplicate** header actions.
- Workstation internals may differ from prototype **`FormsWorkstation`** slot order until shell/workstation naming converges in pace-core.

### States

- **Loading — list** — `DataTable` renders Card + Table + TableCaption (toolbar with search + Create form button) + a single full-width row containing `<LoadingSpinner label="Loading forms" />`.
- **Loading — edit page (initial fetch)** — Full-page `<LoadingSpinner />` centred inside `PaceMain`; the shell does not render until the form resolves.
- **Loading — RBAC check** — Brief blank inside `PaceMain` content area.
- **Loading — Save mutation** — Shell remains visible; Save Button disabled with `<LoadingSpinner size="sm" />`.
- **Loading — Delete mutation** — Destructive `ConfirmationDialog` open; Confirm button disabled with `<LoadingSpinner size="sm" />`.
- **Loading — response-count fetch** — Inline `<LoadingSpinner size="sm" />` on the Delete row trigger.
- **Empty — list** — `DataTable` empty state heading "No forms yet." description "Create your first form for {orgName}." Toolbar Create form button visible above when `canCreate === true`.
- **Error — list query failure** — Inline `<Alert variant="destructive">` titled "Could not load forms" with description from `HandleSupabaseError` and a Retry `Button`.
- **Error — form fetch failure** — Inline `<Alert variant="destructive">` titled "Could not load form" with description from `HandleSupabaseError` and a Retry `Button` replacing the shell.
- **Error — Save failure** — Destructive toast surfaced; the shell remains rendered with the user's edits intact.
- **Error — Delete failure** — Destructive toast surfaced; dialog closes; row remains.
- **Error — response-count failure** — Destructive toast surfaced; no Delete dialog opens.
- **Error — clipboard failure** — Destructive toast surfaced; no further effect.
- **Permission denied — page** — `<AccessDenied />` renders inside `AuthenticatedShell` chrome with copy "You do not have permission to view this page."
- **Permission denied — actions** — Per F-49 / F-50 / F-51: Create button hidden, row Edit / Delete hidden, edit page renders disabled.
- **Validation — clean** — ValidationSummary shows the single "Ready" Alert. Save Button enabled (assuming not in flight).
- **Validation — errors** — ValidationSummary shows the "Validation" Card with the destructive Errors Alert (and optionally a Warnings Alert). Save Button disabled.
- **Validation — warnings only** — ValidationSummary shows the "Validation" Card with only a Warnings Alert. Save Button enabled.

### Interactions

- **Toolbar Create form button** — Hover: pace-core2 default primary-button hover. Click: navigates to `/forms/new`.
- **Row click** — Hover: pace-core2 row hover treatment. Click on the row body (outside an action trigger) does nothing in v1 (row click navigation is not wired to avoid conflicting with row-action click handling). The user must click the **Edit** action to navigate to the edit page.
- **Edit row action** — Click: navigates to `/forms/:formId`.
- **Copy share URL row action** — Click: writes `${VITE_FORM_PORTAL_URL}/forms/${row.slug}` to clipboard, surfaces the success or destructive toast per F-39.
- **Open in new tab row action** — Click: invokes `window.open` to the same URL with `_blank` and `noopener,noreferrer`.
- **Delete row action** — Click: runs response-count fetch; opens the appropriate dialog (destructive `ConfirmationDialog` when count = 0, non-destructive `Dialog` when count > 0).
- **Search input** — Typing filters table rows in real time with no submit step. Clearing restores the unfiltered list.
- **Sort headers** — Click toggles asc / desc / none on a column. Default sort: Updated desc.
- **Pagination controls** — Page size dropdown (10 / 25 / 50), prev / next, current page indicator.
- **Workflow type Select (in metadata editor)** — Click opens the Select; choosing an option updates `metadata.workflowType`. If the chosen value is no longer in `allowedWorkflowTypes`, the editor auto-resets to `allowedWorkflowTypes[0]` (per pace-core2 source effect).
- **Access mode Select (in metadata editor)** — Click opens the Select; choosing `'public'` while `metadata.workflowType==='org_signup'` does not block input but the validator surfaces a destructive Errors Alert and the Save Button stays disabled until the user reverts to `'authenticated_member'`.
- **Status Select (in metadata editor)** — Click opens the Select; choosing `'published'` while errors are present does not block input but the validator's `'activation_blocked'` rule surfaces and the Save Button stays disabled until errors are fixed.
- **Primary entrypoint Checkbox** — Click toggles `metadata.isPrimaryEntrypoint`. When set to `true` while `metadata.workflowType !== 'org_signup'` and `!== 'base_registration'`, the validator surfaces an Errors Alert and the Save Button stays disabled.
- **Active Checkbox** — Click toggles `metadata.isActive`. When set to `true` while errors exist, the validator's `'activation_blocked'` rule surfaces and the Save Button stays disabled.
- **Schedule & limits inputs** — Standard input behaviour. Empty optional inputs persist as NULL.
- **Add field Button** — Click appends a default field (per pace-core2 source: `fieldKey='generic.field_<n+1>'`, `fieldType='text'`, `fieldLabel='Field <n+1>'`, `isActive=true`, `isRequired=false`) and the field's article renders below.
- **Remove field Button** — Click removes the field from `state.fields`.
- **Field-row inputs** — Standard input behaviour; updates flow through `WorkflowFormFieldEditor`'s `onChange` to the slice's state setter.
- **Save Button** — Hover: pace-core2 default primary-button hover. Click runs the Save handler per F-42; while in flight, button disabled with `<LoadingSpinner size="sm" />`.
- **Delete `ConfirmationDialog`** — Modal overlay; focus on the destructive Delete button. Confirm runs the DELETE; on success, dialog closes, list refreshes, success toast renders. On failure, dialog closes, destructive toast renders.
- **Delete blocked `Dialog`** — Modal overlay; focus on the OK button. Click OK closes the dialog. Native escape key, click outside also close.
- **Toast** — On any toast trigger, the toast appears bottom-right and auto-dismisses after 5000 ms.

### Permission-conditional rendering

| Condition | List page entry | Create form button | Row Edit | Row Copy URL / Open | Row Delete | `/forms/new` shell | `/forms/:formId` shell |
|---|---|---|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a | n/a | n/a | n/a |
| Authenticated, org, `read:page.forms` denied | `<AccessDenied />` | Hidden | Hidden | Hidden | Hidden | `<AccessDenied />` | `<AccessDenied />` |
| Authenticated, org, `read` allowed, `canCreate=false`, `canUpdate=false`, `canDelete=false` | List visible | Hidden | Hidden | Visible (read-only nav) | Hidden | Renders disabled (Save fails server-side on attempt) | Renders disabled |
| Authenticated, org, `read` allowed, `canCreate=true`, `canUpdate=false`, `canDelete=false` | List visible | Visible | Hidden | Visible | Hidden | Renders editable; Save attempts INSERT | Renders disabled |
| Authenticated, org, `read` allowed, `canCreate=true`, `canUpdate=true`, `canDelete=false` | List visible | Visible | Visible | Visible | Hidden | Renders editable | Renders editable; Save attempts UPDATE |
| Authenticated, org, `read` allowed, all of `canCreate=true`, `canUpdate=true`, `canDelete=true` | List visible | Visible | Visible | Visible | Visible | Renders editable | Renders editable |

---

## §6 Business rules

**BR-A — Org scope.**
- Input: any list, fetch, mutation, or response-count query in this slice.
- Output: every query filters or stamps `organisation_id = selectedOrganisation.id`. Cross-org rows never appear.
- Edge: a current org with zero rows returns an empty array; rows from another org do not return even if RLS were misconfigured (defensive belt-and-braces).

**BR-B — Allowed workflow types (TEAM v1).**
- Input: the `allowedWorkflowTypes` prop on `WorkflowFormAuthoringShell` and the `workflow_type` value persisted on Save.
- Output: only `org_signup`, `information_collection`, `consent_capture`, and `generic` are permitted. `base_registration`, `activity_booking`, and `merch_order` are excluded from the TEAM authoring surface.
- Edge: server-side, `core_forms_workflow_type_check` must permit `'org_signup'`; until the platform extends the CHECK, any INSERT or UPDATE with `workflow_type='org_signup'` fails. See §15 implementation gate.

**BR-C — Access mode pin.**
- Input: the access mode Select inside the metadata editor.
- Output: v1 selects `'authenticated_member'`. The shipped pace-core2 metadata editor renders both options (`'public'` and `'authenticated_member'`); the validator (`validateWorkflowAuthoringState`) blocks publishing when `workflow_type='org_signup'` AND `accessMode='public'` by emitting an `'invalid_workflow_access_combination'` error.
- Edge: a user toggling to `'public'` while `workflow_type='org_signup'` sees the ValidationSummary "Errors" Alert and the Save Button disabled.

**BR-D — Slug shape and immutability.**
- Input: the slug `Input` inside the metadata editor.
- Output: the slug must match `^[a-z0-9]+(-[a-z0-9]+)*$` (per `validateWorkflowAuthoringState`). Uniqueness is enforced server-side via `core_forms_org_slug_unique` UNIQUE (`organisation_id`, `slug`) WHERE `event_id IS NULL`. On `/forms/:formId`, the slug Input is disabled (`slugReadOnly=true`); slug is immutable after the form's first INSERT.
- Edge: a duplicate slug for the same org returns Postgres 23505; the slice surfaces the destructive Save toast with the normalised message.

**BR-E — Field-key uniqueness per form.**
- Input: the field-key `Input` for each active field.
- Output: server-side enforced by `core_form_fields_form_id_field_key_key` UNIQUE; client-side enforced by `validateWorkflowAuthoringState` (which emits `'duplicate_field_key'` errors). Save is blocked when duplicates exist among active fields.

**BR-F — Publish gate (fail-closed).**
- Input: the validator's evaluation of `state` on every state change and on every Save attempt.
- Output: `validateWorkflowAuthoringState(state).isValid` must be `true` for the Save Button to enable. The validator emits errors for any of the following (rules restated from `validateWorkflowAuthoringState`'s source):
  1. `metadata.name.trim() === ''` → `'invalid_name'` "Name is required."
  2. `metadata.slug` does not match `^[a-z0-9]+(?:-[a-z0-9]+)*$` → `'invalid_slug'` "Slug must use lowercase letters, numbers, and hyphens only."
  3. `metadata.accessMode` not in `['public','authenticated_member']` → `'invalid_access_mode'` "Access mode must be public or authenticated_member."
  4. `metadata.workflowType` not in the supported set (see BR-B) → `'invalid_workflow_type'`.
  5. `metadata.workflowType === 'org_signup'` AND `metadata.accessMode !== 'authenticated_member'` → `'invalid_workflow_access_combination'` "Org signup currently requires authenticated_member access mode."
  6. `metadata.workflowType === 'org_signup'` AND `metadata.organisationId` empty/null → `'missing_scope'` "Org signup forms require organisationId."
  7. `metadata.isPrimaryEntrypoint && metadata.workflowType !== 'base_registration' && metadata.workflowType !== 'org_signup'` → `'invalid_entrypoint'` "Primary entrypoint is only valid for base_registration and org_signup forms."
  8. Zero active fields → `'missing_active_fields'` "At least one active field is required."
  9. Empty-string trimmed `field.fieldKey` among active fields → `'duplicate_field_key'` "Field key cannot be empty." (the validator reuses the duplicate code for this case).
  10. Repeated `field.fieldKey` among active fields → `'duplicate_field_key'` "Duplicate field key detected: {key}.".
  11. Pre-submission check shape invalid (string non-empty OR object with non-empty `key`+`label`) → `'invalid_workflow_config'`.
  12. `metadata.isActive && errors.length > 0` → an additional `'activation_blocked'` error "Activation is blocked until all validation errors are fixed."
- Warnings (do not block Save): `field.fieldType` outside `['text','textarea','address']` → `'unknown_field_type'` "Unknown field type \"{value}\". Default registry types are text, textarea, and address." For `base_registration` (excluded from TEAM via BR-B), a `'missing_scope'` warning fires when `eventId` is empty — not applicable to TEAM v1.
- Edge: the Save Button is disabled when `isValid === false`; the ValidationSummary surfaces every error inline.

**BR-G — Conditional visibility (`displayOptions.visibility`) is not authored in v1.**
- Input: the Display options (JSON) Textarea on each field.
- Output: free-text JSON is accepted and persisted into `core_form_fields.display_options`, but the slice does not provide structured authoring or validation of `displayOptions.visibility` rules. The Display options Textarea's helper text reads "Optional JSON. Conditional visibility authoring is not available in v1." (BR-G2).
- Edge: a malformed JSON string in the Textarea is held as the last-valid value by `WorkflowFormFieldEditor`'s `onChange` per pace-core2 source — the prior `displayOptions` object remains in `state.fields[i].displayOptions` until a parseable JSON string is typed. This is the shipped behaviour and is not a slice-level guarantee.

**BR-H — RLS authority and direct DML.**
- Input: any INSERT / UPDATE / DELETE on `core_forms` or `core_form_fields` from this slice.
- Output: the mutation goes via `useSecureSupabase().from(...)`. Server-side authorisation is enforced by RLS policies that gate INSERT / UPDATE / DELETE on `check_user_is_org_admin(organisation_id)` (already in place on dev). The slice does not author these RLS policies; they exist today and work for org-admin staff. Future cross-app convergence to RBAC-checked RLS for these tables is informational only and captured in §17.
- Edge: a non-org-admin staff member with `read:page.forms` (page guard satisfied) but no `org_admin` role still cannot mutate; RLS denies. The destructive Save toast surfaces the normalised RLS deny message via `HandleSupabaseError`.

**BR-I — Delete dependency block.**
- Input: row Delete action click.
- Output:
  - The slice fetches `count` of `core_form_responses` for `form_id = row.id` AND `organisation_id = selectedOrganisation.id` (defensive).
  - When `count > 0`: open a non-destructive `Dialog` titled "Cannot delete this form" with body `"{count} submitted response(s) reference this form. Forms with responses cannot be deleted."` and a single "OK" button. Dismiss closes the dialog; no mutation runs.
  - When `count === 0`: open a destructive `ConfirmationDialog` titled `"Delete '{name}'?"` (with the form's `name` interpolated) and description "This cannot be undone." Confirm "Delete" runs `DELETE FROM core_forms WHERE id = row.id AND organisation_id = selectedOrganisation.id` (with FK CASCADE removing `core_form_fields` rows server-side). On success: the dialog closes, the list refreshes, a `'success'`-variant toast renders with copy `"{name} deleted."` (where `{name}` is the deleted form's name). On failure: the dialog closes, a `'destructive'`-variant toast renders with the normalised error.
- Edge: the response-count fetch is itself a query that can fail; on failure, the slice surfaces a destructive toast and does not open any dialog (F-17).

**BR-J — Share URL composition.**
- Input: a row's Copy share URL or Open in new tab action; a slug value.
- Output: the slice constructs `${import.meta.env.VITE_FORM_PORTAL_URL}/forms/${slug}` by:
  1. Reading `import.meta.env.VITE_FORM_PORTAL_URL` as a string (expected to be an absolute origin like `https://forms.example.com` with no trailing slash; if a trailing slash is present, the slice trims it before joining).
  2. Concatenating with `/forms/`.
  3. Concatenating with the row's `slug` value.
- The URL is not hardcoded; the env var is the only source. The slice does not invent any other env-var name.
- Edge: when `VITE_FORM_PORTAL_URL` is empty / unset at runtime, the Copy and Open actions surface a `'destructive'`-variant toast "Portal origin not configured. Contact your administrator." and do not write to clipboard or open a tab.

**BR-K — Primary entrypoint scope.**
- Input: the Primary entrypoint Checkbox in the metadata editor.
- Output: `is_primary_entrypoint = true` is meaningful only for `org_signup` in TEAM (per validator rule 7 in BR-F). At most one active primary `org_signup` per organisation should exist server-side. Partial unique index `core_forms_primary_org_signup_per_org_unique UNIQUE (organisation_id) WHERE workflow_type = 'org_signup' AND is_primary_entrypoint AND is_active AND status = 'published'` enforces this. Until the index lands (§15), the slice cannot rely on uniqueness — see §15 implementation gate.
- Edge: a duplicate primary returns Postgres 23505 once the index lands; the destructive Save toast surfaces the normalised message.

**BR-L — Org-switch behaviour.**
- Input: `selectedOrganisation` changes while a TEAM-09 route is mounted.
- Output:
  - On `/forms`: the list query refetches against the new org; any open Delete dialog state is discarded silently.
  - On `/forms/new`: the slice's local `state.metadata.organisationId` updates to the new org's id; the shell continues with the user's draft (no toast, no redirect).
  - On `/forms/:formId`: the slice refetches the form for the new org. If the form belongs to the new org (the new fetch returns one row), the page silently rebinds the shell's `state` to the new fetch (the user's unsaved edits are discarded). If the form does not belong to the new org (zero rows), the slice navigates to `/forms` and surfaces a `'default'`-variant toast "Switched organisations. Showing forms for {newOrgName}."

**BR-M — `core_forms.title` column.**
- Input: every INSERT and every UPDATE on `core_forms` from this slice.
- Output: the payload sets `title` to NULL. v1 does not surface a `title` field to authors; the column's semantic role is undefined in pace-core2 documentation (informational §17 note: platform doc-drift).

**BR-N — Save payload composition.**
- Input: the slice's local state (metadata + Schedule & limits + fields) on Save.
- Output:
  - `core_forms` payload columns: `name` (from `metadata.name`, trimmed), `slug` (from `metadata.slug`, trimmed; only on INSERT — UPDATE excludes slug per BR-D), `description` (from `metadata.description`, nullable), `workflow_type` (from `metadata.workflowType`), `access_mode` (from `metadata.accessMode`), `status` (from `metadata.status`), `is_primary_entrypoint` (from `metadata.isPrimaryEntrypoint`), `is_active` (from `metadata.isActive`), `organisation_id` (from `selectedOrganisation.id`; only on INSERT — UPDATE excludes), `event_id` (NULL — TEAM is org-scoped), `workflow_config` (`'{}'` — Q-UX-7), `title` (NULL — BR-M), `opens_at` (from Schedule & limits, nullable), `closes_at` (from Schedule & limits, nullable), `max_submissions` (from Schedule & limits, nullable), `confirmation_message` (from Schedule & limits, nullable), `is_required` (from Schedule & limits, default `false`).
  - `core_form_fields` payload columns per row: `form_id` (the form's id), `field_key` (from `field.fieldKey`, trimmed), `field_label` (from `field.fieldLabel`), `field_type` (from `field.fieldType`, trimmed lowercase), `field_description` (NULL in v1 — not authored), `is_required` (from `field.isRequired`, default `false`), `is_active` (from `field.isActive`, default `true`), `sort_order` (from `field.sortOrder`), `validation_rules` (NULL in v1), `display_options` (from `field.displayOptions`, JSON-stringified or NULL when undefined), `organisation_id` (from `selectedOrganisation.id`).
  - Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) are populated server-side via column defaults and triggers; the slice never patches them from the client.

**BR-O — Audience default (no binding in v1).**
- Input: form submission via the planned `app_submit_member_request` RPC.
- Output: zero membership-type bindings means "all active membership types in the organisation". Multi-tier organisations (e.g. Scouts age tiers) work around the absence of a binding table by including an in-form tier `Select` field that lists active membership types from the org; the submission flow reads the chosen value and passes it as `p_membership_type_id` to the RPC (Q-DB-5). Audience binding (form-to-membership-type subset) is OUT OF SCOPE in v1 and becomes its own follow-up slice.

**BR-P — Workflow type display label mapping.**
- Input: `core_forms.workflow_type` value rendered in the list column or the search filter.
- Output:
  - `org_signup` → "Org signup"
  - `information_collection` → "Information collection"
  - `consent_capture` → "Consent capture"
  - `generic` → "Generic"
- Within the metadata editor's Workflow type Select, the options render as the raw enum strings (per pace-core2 source).

**BR-Q — Page metadata.**
- Input: page mount.
- Output: `usePaceMain({ printTitle })` is called on mount with `printTitle`:
  - `'Forms'` on `/forms`.
  - `'Create form'` on `/forms/new`.
  - the loaded form's `name` on `/forms/:formId` (until the form resolves, `printTitle` is `'Edit form'`).

**BR-R — Row action set.**
- Input: a row in the `/forms` list.
- Output: the Actions column renders four triggers in this order: **Edit**, **Copy share URL**, **Open in new tab**, **Delete**. Edit and Delete are gated by `canUpdate` / `canDelete`; Copy and Open are visible to anyone who can read the row. The list does NOT surface an `is_active` toggle as a row action — `is_active` is edited inside the form authoring shell (the metadata editor's Active Checkbox).

**BR-S — Default sort and search semantics.**
- Input: list query.
- Output: `initialSorting=[{ id: 'updated_at', desc: true }]`. Search filters the in-memory rows by case-insensitive substring across `core_forms.name`, the title-cased workflow type label (per BR-P), and the title-cased status label. Subsequent header clicks toggle asc/desc/none.

**BR-T — Concurrency.**
- Input: any UPDATE originated by this slice.
- Output: last-write-wins. No optimistic locking; no `updated_at` watermark check; no `If-Match` header or version column. Concurrent edits resolve to the second-save state on the next refetch.
- Edge: if a second admin saves between this user's read and Save, the second admin's values are overwritten by this Save. The slice does not warn the user.

**BR-U — Helper text — supported field types.**
- Input: the Field type `Input` inside the Fields card.
- Output: the helper text reads "Supported types: text, textarea, address. Other values surface a publish warning." The shared validator emits the warning via the `'unknown_field_type'` code; the warning does not block Save.

**BR-V — Helper text — field key catalogue.**
- Input: the Field key `Input` inside the Fields card.
- Output: the helper text reads "e.g. core_person.first_name. The shared field-catalogue picker is not available in v1." The slice does NOT build a TEAM-local picker (§16). Once pace-core2 ships the shared picker, the field editor's UX improves automatically; this slice does not own the picker.

**BR-W — Helper text — display options.**
- Input: the Display options Textarea inside the Fields card.
- Output: the helper text reads "Optional JSON. Conditional visibility authoring is not available in v1." (paired with BR-G).

**BR-X — Audit attribution.**
- Input: any INSERT / UPDATE / DELETE originated by this slice.
- Output: the payload omits `created_at`, `updated_at`, `created_by`, `updated_by`. These columns are populated server-side via column defaults (`now()`, `auth.uid()`) and database triggers that refresh `updated_at` / `updated_by` on UPDATE.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for cross-slice consumption. Form authoring lives behind `/forms`, `/forms/new`, `/forms/:formId`. Other slices (TEAM-05) read `core_forms`, `core_form_fields`, `core_form_responses`, and `core_form_response_values` directly per their own contracts.

### Read contracts

- **List query (`/forms`).** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_forms')
    .select('id, name, slug, description, workflow_type, status, access_mode, is_active, is_primary_entrypoint, opens_at, closes_at, max_submissions, confirmation_message, is_required, updated_at')
    .eq('organisation_id', selectedOrganisation.id)
    .is('event_id', null)
    .order('updated_at', { ascending: false })
  ```

- **Form fetch (`/forms/:formId`).** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_forms')
    .select('id, name, slug, description, workflow_type, status, access_mode, is_active, is_primary_entrypoint, organisation_id, opens_at, closes_at, max_submissions, confirmation_message, is_required, workflow_config, title, fields:core_form_fields(id, field_key, field_label, field_type, sort_order, is_required, is_active, display_options)')
    .eq('id', formId)
    .eq('organisation_id', selectedOrganisation.id)
    .is('event_id', null)
    .maybeSingle()
  ```
  Returns one row or `null` (zero rows triggers F-61).

- **Response-count query (Delete dependency check).** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId)
    .eq('organisation_id', selectedOrganisation.id)
  ```
  Returns a `count` value used by BR-I.

### Query-key contract

- List query: `['forms', 'list', selectedOrganisation.id]`.
- Form fetch: `['forms', 'detail', formId, selectedOrganisation.id]`.
- Response-count query: `['forms', 'response-count', formId, selectedOrganisation.id]`.
- Save success on `/forms/new` invalidates the list query for the current org and pre-populates the form-fetch cache for the new id.
- Save success on `/forms/:formId` invalidates the list query for the current org and refetches the form-fetch query for the current id.
- Delete success invalidates the list query for the current org.
- Org switch invalidates all three key prefixes against the new org.

### Write contracts

All writes go via `useSecureSupabase().from(...)` against the live `check_user_is_org_admin(organisation_id)` RLS gate (BR-H).

- **INSERT — `core_forms` (Save on `/forms/new`).** `.from('core_forms').insert([{ ...payload }]).select().single()` with the payload composed per BR-N. Returns the new row including its generated `id`. On success, the slice runs the field INSERT.
- **INSERT — `core_form_fields` (Save on `/forms/new`, after form INSERT).** `.from('core_form_fields').insert([...rows]).select()` where `rows` is one row per field in `state.fields` (both active and inactive — `is_active` is recorded on each row), each composed per BR-N. On success, the slice navigates to `/forms/:formId` for the new form id and surfaces a `'success'`-variant toast "Form created."
- **UPDATE — `core_forms` (Save on `/forms/:formId`).** `.from('core_forms').update({ ...payload }).eq('id', formId).eq('organisation_id', selectedOrganisation.id).select().single()` with the payload composed per BR-N (slug excluded per BR-D; organisation_id excluded — never mutated).
- **Replace `core_form_fields` (Save on `/forms/:formId`).** Three sub-operations within the slice:
  1. DELETE rows whose `id` is in the prior fetch but not in current state: `.from('core_form_fields').delete().eq('form_id', formId).in('id', removedIds).eq('organisation_id', selectedOrganisation.id)`.
  2. INSERT rows whose `id` is not in the prior fetch (newly added fields): `.from('core_form_fields').insert([...newRows]).select()`.
  3. UPDATE rows whose `id` is in both prior fetch and current state: per row, `.from('core_form_fields').update({ field_key, field_label, field_type, sort_order, is_required, is_active, display_options }).eq('id', fieldId).eq('organisation_id', selectedOrganisation.id).select().single()`.
  On overall success: refresh the form-fetch query, surface a `'success'`-variant toast "Form saved."
- **DELETE — `core_forms` (BR-I count = 0 path).** `.from('core_forms').delete().eq('id', formId).eq('organisation_id', selectedOrganisation.id).select().single()`. FK CASCADE removes `core_form_fields` rows server-side. On success: refresh the list query, surface a `'success'`-variant toast `"{name} deleted."` (with the form's `name` interpolated). On failure: destructive toast with the normalised error.

### Failure outcomes the slice handles

- 23505 unique violation on slug (per-org) → destructive toast with the normalised message ("This record already exists." or similar). The shell remains rendered; the user can edit and retry.
- 23505 unique violation on primary entrypoint (once Q-DB-4 partial unique index lands) → destructive toast with the normalised message. The shell remains rendered.
- 23514 CHECK violation on `workflow_type` (until Q-DB-2 lands, every `org_signup` INSERT/UPDATE fails) → destructive toast with the normalised message; this is the v1 implementation gate. Slice cannot ship its primary workflow type until Q-DB-2 lands on dev.
- RLS deny (non-org-admin caller attempting INSERT/UPDATE/DELETE) → destructive toast with the normalised message; the shell remains rendered.
- Generic 5xx / network error → destructive toast with the normalised message via `HandleSupabaseError(error, { context: 'core_forms' })`.

### RLS / permission contracts

- **SELECT** on `core_forms` is permitted on dev by `core_forms` policies that allow:
  - public anon SELECT for `status='published' AND organisation_id IS NOT NULL AND (event_id IS NULL OR check_public_event_visible(event_id))` (Portal/public read; not used by this slice).
  - org-admin / org-member SELECT for `organisation_id IS NOT NULL AND (is_super_admin(...) OR check_user_is_org_admin(organisation_id) OR check_user_organisation_access(organisation_id))`.
- **INSERT** on `core_forms` is permitted for `organisation_id IS NOT NULL AND get_effective_user_id() = created_by AND (is_super_admin(...) OR check_user_is_org_admin(organisation_id))`. The slice authors against this live gate.
- **UPDATE** on `core_forms` is permitted for `organisation_id IS NOT NULL AND (is_super_admin(...) OR check_user_is_org_admin(organisation_id))`. The slice authors against this live gate.
- **DELETE** on `core_forms` is permitted for `organisation_id IS NOT NULL AND (is_super_admin(...) OR check_user_is_org_admin(organisation_id))`. The slice authors against this live gate.
- **SELECT / INSERT / UPDATE / DELETE** on `core_form_fields` follow the same `check_user_is_org_admin(organisation_id)` pattern as `core_forms`. The slice authors against the live gates.
- **SELECT** on `core_form_responses` is permitted by platform-standard policies; the slice uses it only for the count head-query in BR-I.
- The page guard uses canonical `pageName='forms'` and `operation='read'`. `rbac_app_pages` must have a row with `page_name='forms'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` (post-build seeding noted in §15).
- Action-rail visibility uses `useResourcePermissions('forms', '<op>')` per PDLC's RBAC API usage contract.

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-09 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws. TEAM-01 also owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Forms"), and the `PaceAppLayout` chrome.
- **TEAM-05** owns `/approvals` and the member-request review surface. TEAM-05's review panel right column reads `core_form_responses` joined to `core_form_response_values` joined to `core_form_fields` for forms authored here. TEAM-05 does not author or edit forms; TEAM-09 does not display responses. The data contract at the boundary: TEAM-09 produces `core_forms` rows with `workflow_type IN ('org_signup', 'information_collection', 'consent_capture', 'generic')` and matching `core_form_fields` rows; TEAM-05 reads them for the review right column.
- **Submission orchestrator boundary (Q-DB-5).** TEAM-09 + Portal own the planned-contract `app_submit_member_request(p_organisation_id uuid, p_request_type team_member_request_type, p_form_response_id uuid DEFAULT NULL, p_membership_type_id uuid DEFAULT NULL, p_subject_person_id uuid DEFAULT NULL) RETURNS jsonb` (returns `{ request_id, member_id }`). The Portal-side runtime calls the RPC at `org_signup` form submission; the platform-DB authors the RPC body that creates `team_member_request` row + provisional `core_member` row atomically when `request_type IN ('join','transfer')`. TEAM-09 captures the contract for traceability; the RPC body is platform-DB work (cross-slice with TEAM-02 + TEAM-05; already shared platform backlog item — see §15 implementation gate).
- **Portal** owns `/forms/:formSlug` participant rendering and submission. The Copy share URL and Open in new tab actions construct `${VITE_FORM_PORTAL_URL}/forms/${slug}` and rely on Portal to resolve the slug to a published form per the CR21 entrypoint resolution rules.

### ID contracts

- `core_forms.id` (uuid) — primary identifier in the `/forms/:formId` route path.
- `core_forms.slug` (text) — used in the share URL (`${VITE_FORM_PORTAL_URL}/forms/${slug}`). Per-org unique.
- `core_organisations.id` (uuid) — read from `selectedOrganisation.id` for org scoping.
- `core_form_fields.id` (uuid) — used by the field-replace pattern on Save (UPDATE existing, DELETE removed, INSERT new).

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_forms` | SELECT, INSERT, UPDATE, DELETE | `useSecureSupabase()` |
| `core_form_fields` | SELECT (joined for fetch), INSERT, UPDATE, DELETE | `useSecureSupabase()` |
| `core_form_responses` | SELECT (count, head-only) | `useSecureSupabase()` |
| `core_organisations` | (indirect — read via `OrganisationServiceProvider` context, not directly queried) | `useOrganisationsContext()` |

### `core_forms` columns (historic dev DB snapshot; MCP catalogue checks use `yihzsfcceciimdoiibif` via [`npm run mcp:verification`](../../package.json))

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `name` | text | NO | — | Form name (BR-N) |
| `description` | text | YES | — | (BR-N) |
| `slug` | text | NO | — | Per-org unique, immutable on edit (BR-D) |
| `event_id` | uuid | YES | — | NULL for org-scoped forms |
| `is_active` | boolean | YES (default applies) | `true` | (BR-N) |
| `sort_order` | integer | YES (default applies) | `0` | Not authored in v1 (Q-UX-2) |
| `max_submissions` | integer | YES | — | (BR-N, Schedule & limits Card) |
| `confirmation_message` | text | YES | — | (BR-N, Schedule & limits Card) |
| `created_at`, `updated_at` | timestamptz | NO | `now()` | Server-side defaults (BR-X) |
| `created_by`, `updated_by` | uuid | YES | — | Server-side defaults / triggers (BR-X) |
| `opens_at` | timestamptz | YES | — | (BR-N, Schedule & limits Card) |
| `closes_at` | timestamptz | YES | — | (BR-N, Schedule & limits Card) |
| `organisation_id` | uuid | NO | — | FK → `core_organisations.id` ON DELETE CASCADE |
| `status` | `form_status` | NO | `'draft'` | enum values `draft`, `published`, `closed` |
| `is_required` | boolean | NO | `false` | (BR-N, Schedule & limits Card) |
| `workflow_type` | text | NO | — | CHECK constraint must permit `'org_signup'` (Q-DB-2 §15 gate) |
| `is_primary_entrypoint` | boolean | NO | `false` | (BR-K) |
| `owner_app_id` | uuid | YES | — | FK → `rbac_apps.id` ON DELETE SET NULL |
| `access_mode` | text | NO | `'authenticated_member'` | CHECK in `('public','authenticated_member')` |
| `workflow_config` | jsonb | NO | `'{}'` | v1 persists `'{}'` (Q-UX-7) |
| `title` | text | YES | — | v1 writes NULL (BR-M) |

CHECK constraints:
- `core_forms_access_mode_check` — `access_mode IN ('public','authenticated_member')`.
- `core_forms_workflow_type_check` — currently `workflow_type IN ('base_registration','information_collection','activity_booking','merch_order','consent_capture','generic')`. **Implementation gate (Q-DB-2):** must extend to permit `'org_signup'`.

Indexes:
- `core_forms_org_slug_unique` UNIQUE (`organisation_id`, `slug`) WHERE `event_id IS NULL` — enforces BR-D.
- **Implementation gate (Q-DB-4):** `core_forms_primary_org_signup_per_org_unique UNIQUE (organisation_id) WHERE workflow_type='org_signup' AND is_primary_entrypoint AND is_active AND status='published'` — enforces BR-K.

### `core_form_fields` columns (dev DB snapshot)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `form_id` | uuid | NO | — | FK → `core_forms.id` ON DELETE CASCADE |
| `field_key` | text | NO | `''` | Per-form unique; semantic identifier (CR21) |
| `field_label` | text | YES | — | (BR-N) |
| `field_type` | text | YES | — | Free-text in v1; supported `text`, `textarea`, `address` (BR-U) |
| `field_description` | text | YES | — | NULL in v1 (BR-N) |
| `is_required` | boolean | YES | `false` | (BR-N) |
| `sort_order` | integer | YES | `0` | (BR-N) |
| `validation_rules` | jsonb | YES | — | NULL in v1 (BR-N) |
| `display_options` | jsonb | YES | — | (BR-N) |
| `is_active` | boolean | YES | `true` | (BR-N) |
| `organisation_id` | uuid | NO | — | (BR-N, defensive scoping) |

Index: `core_form_fields_form_id_field_key_key UNIQUE (form_id, field_key)` — enforces BR-E.

### `core_form_responses` columns (used by BR-I count head-query)

`id`, `form_id`, `respondent_id`, `submitted_at`, `status`, `metadata`, `organisation_id`, `workflow_subject_type`, `workflow_subject_id` — see TEAM-05 §8 for full schema reference. TEAM-09 only counts rows; it does not read or write any data on this table.

### `core_field_list` (capability gap reference)

`core_field_list` (post-DB-414 rename) carries `core_form_availability` boolean plus `friendly_field_name`, `field_description`, etc. The shared `data_core_field_list_core_form()` SECURITY DEFINER function returns rows where `core_form_availability=true`. Used by the planned shared field-catalogue picker (Q-UX-4 §15 gate); not consumed directly by this slice in v1. The architecture's post-build platform-data tasks include seeding `core_field_list` with org_signup person/contact/address fields (Q-DB-6 §15 gate).

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `core_forms_workflow_type_check` permits `'org_signup'` (Q-DB-2 implementation gate).
- Confirm partial unique index `core_forms_primary_org_signup_per_org_unique` exists with the expected WHERE clause (Q-DB-4 implementation gate).
- Confirm `app_submit_member_request` planned-contract signature accepts `p_request_type` and creates a provisional `core_member` row when `request_type IN ('join','transfer')` (Q-DB-5 implementation gate).
- Confirm `core_field_list` has rows seeded for org_signup person/contact/address fields (Q-DB-6 implementation gate; informational — v1 ships against whatever the catalogue contains).
- Confirm an `rbac_app_pages` row for `page_name='forms'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` is in place (Q-RBAC-1 post-build seeding).
- Confirm RLS on `core_forms` and `core_form_fields` permits org-admin INSERT / UPDATE / DELETE via `check_user_is_org_admin(organisation_id)` (live).
- Confirm DB-414 (`core_form_availability` rename) is live (Q-CT-1 confirmed live; no gate).

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates.
- `pace-core2/packages/core/docs/requirements/CR21-workflow-forms-runtime.md` — shared forms runtime contract; `core_forms` / `field_key` semantics; `org_signup` and member-facing org-form route resolution.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for list, fetch, response-count, INSERT, UPDATE, DELETE |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="forms"` `operation="read"` on all three routes |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Action gating via `useResourcePermissions('forms')` for create / update / delete |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation.id` and `selectedOrganisation.name` for scoping queries, mutations, and toast copy |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle` per BR-Q on each route mount |
| `WorkflowFormAuthoringShell` | `@solvera/pace-core/forms` | Authoring shell for `/forms/new` and `/forms/:formId` (renders ValidationSummary + Preview target Card + metadata + middleContent + fields + Save) |
| `validateWorkflowAuthoringState` | `@solvera/pace-core/forms` | Shared validator referenced in BR-F (the shell calls it internally; the slice does not call it directly but BR-F restates its rules) |
| `buildWorkflowPreviewTarget` | `@solvera/pace-core/forms` | Computes the preview path shown in the shell's Preview target Card (the shell calls it internally; not called directly by the slice) |
| `WorkflowAuthoringState` | `@solvera/pace-core/forms` | Type for the slice's local state held against the shell's `state` / `onStateChange` |
| `WorkflowAuthoringMetadata` | `@solvera/pace-core/forms` | Type for `state.metadata` (used for typed payload construction in BR-N) |
| `WorkflowFieldDefinition` | `@solvera/pace-core/forms` | Type for `state.fields[i]` (used for typed payload construction in BR-N) |
| `WorkflowType` | `@solvera/pace-core/forms` | Type for `metadata.workflowType`; `allowedWorkflowTypes` array typed as `WorkflowType[]` |
| `DataTable` | `@solvera/pace-core/components` | List page table with toolbar, search, sort, pagination, row actions |
| `Card` | `@solvera/pace-core/components` | Container for Schedule & limits Card via `middleContent` |
| `CardHeader` | `@solvera/pace-core/components` | Schedule & limits Card header |
| `CardTitle` | `@solvera/pace-core/components` | Schedule & limits Card title |
| `CardContent` | `@solvera/pace-core/components` | Schedule & limits Card content wrapper |
| `Input` | `@solvera/pace-core/components` | Schedule & limits inputs (datetime-local, number) |
| `Textarea` | `@solvera/pace-core/components` | Schedule & limits Confirmation message |
| `Switch` | `@solvera/pace-core/components` | Schedule & limits Required toggle |
| `Label` | `@solvera/pace-core/components` | Field labels inside the Schedule & limits Card |
| `Button` | `@solvera/pace-core/components` | Toolbar Create form button; row Edit / Copy URL / Open / Delete triggers; OK button in delete-blocked Dialog |
| `Dialog` | `@solvera/pace-core/components` | Container for the delete-blocked dialog (count > 0) |
| `DialogContent` | `@solvera/pace-core/components` | Content slot inside delete-blocked Dialog |
| `DialogHeader` | `@solvera/pace-core/components` | Header slot inside delete-blocked Dialog |
| `DialogTitle` | `@solvera/pace-core/components` | Title "Cannot delete this form" |
| `DialogBody` | `@solvera/pace-core/components` | Body slot for the descriptive paragraph |
| `DialogFooter` | `@solvera/pace-core/components` | Footer slot for the OK Button |
| `DialogPortal` | `@solvera/pace-core/components` | Portal for delete-blocked Dialog |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Destructive delete confirmation when `core_form_responses.count = 0` |
| `Alert` | `@solvera/pace-core/components` | List error state and form-fetch error state inline alerts |
| `AlertTitle` | `@solvera/pace-core/components` | Title slot in error Alerts |
| `AlertDescription` | `@solvera/pace-core/components` | Description slot in error Alerts |
| `LoadingSpinner` | `@solvera/pace-core/components` | List loading state, full-page form-fetch spinner, in-button mid-flight indicator (`size="sm"`) |
| `toast` | `@solvera/pace-core/components` | Module-level toast for success / destructive / default notifications |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalises Supabase errors for inline Alerts and toasts (`context: 'core_forms'`) |
| `Plus` | `@solvera/pace-core/icons` | Glyph on the Create form toolbar button |
| `SquarePen` | `@solvera/pace-core/icons` | Glyph on the row Edit action (pace-core2 canonical edit icon) |
| `Copy` | `lucide-react` | Glyph on the Copy share URL action — pace-core2 does not yet re-export this icon (see §9.2) |
| `ExternalLink` | `lucide-react` | Glyph on the Open in new tab action — pace-core2 does not yet re-export this icon (see §9.2) |
| `Trash2` | `@solvera/pace-core/icons` | Glyph on the row Delete action |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in query / mutation handlers still abort the operation when `selectedOrganisation` is null mid-render (for example during an org switch). Cross-org SELECTs and mutations are not issued.
- **`WorkflowFormAuthoringShell` `eventSlug` prop is `null`.** TEAM is not event-scoped; the shell's preview-target compute treats `null` as "no event slug" and falls back to `/forms/{slug}` for `org_signup` and `generic` workflow types per the shipped `buildWorkflowPreviewTarget` source.
- **`WorkflowFormAuthoringShell` `slugReadOnly`.** Set to `true` on `/forms/:formId` so the slug `Input` inside the metadata editor is non-editable. Slug is immutable on edit per BR-D.
- **`WorkflowFormAuthoringShell` `disabled`.** Toggled `true` while a Save mutation is in flight (so the entire shell becomes non-interactive) and when `useResourcePermissions('forms').canUpdate === false` on the edit page (so a permitted reader can view the shell without editing).
- **`ConfirmationDialog` is used for the count = 0 delete path only.** The count > 0 path composes from the `Dialog` family because `ConfirmationDialog` has no body slot; the descriptive sentence "{N} submitted response(s) reference this form. Forms with responses cannot be deleted." cannot be rendered inside `ConfirmationDialog`.
- **`Dialog` footer composes a single `Button` for the count > 0 path.** Dialogs needing form fields compose from the `Dialog` family (per the Toaster / Dialog rules in the cross-app decisions log). The slice does not use `SaveActions` in any composed Dialog because `SaveActions` hardcodes "Save".
- **`LoadingSpinner` `size="sm"` is used for in-button mid-flight indication.** No third-party spinner icon is imported; `Loader2` is not exported from the pace-core2 icons barrel.
- **`Copy` and `ExternalLink` row-action icons import from `lucide-react` directly.** The pace-core2 icons barrel re-exports `SquarePen` (used for Edit) but not `Copy` or `ExternalLink`. v1 imports those two from `lucide-react` (the underlying source `pace-core/icons` already wraps). Future enhancement: extend the pace-core2 icons barrel to re-export `Copy` and `ExternalLink`; v6 of this slice should swap the import path back to `@solvera/pace-core/icons` once that lands.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **Direct `validateWorkflowAuthoringState` and `buildWorkflowPreviewTarget` calls.** The shell calls these internally on every state change. The slice does not call them directly; BR-F and §5 restate the validator's rules and the preview path computation for traceability and design accuracy. The build agent reads pace-core2 source for the function signatures and behaviour.
- **Implementation gates.** The slice depends on multiple platform-side prerequisites — see §15.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/forms` | `forms` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |
| `/forms/new` | `forms` | `read` | inherited from same `pageName` guard configuration |
| `/forms/:formId` | `forms` | `read` | inherited |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read list, fetch, and response counts | `read:page.forms` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Create form | `create:page.forms` | `useResourcePermissions('forms').canCreate` | Toolbar Create form button hidden; direct nav to `/forms/new` renders disabled shell; Save attempt fails server-side with destructive toast |
| Edit form (UPDATE) | `update:page.forms` | `useResourcePermissions('forms').canUpdate` | Row Edit action hidden; direct nav to `/forms/:formId` renders disabled shell |
| Delete form | `delete:page.forms` | `useResourcePermissions('forms').canDelete` | Row Delete action hidden |
| Copy share URL / Open in new tab | n/a — read-only nav | n/a (visible to anyone who can read the row) | n/a |

### Server-side enforcement

- **SELECT** on `core_forms` enforced by RLS — see §7 RLS contracts.
- **INSERT / UPDATE / DELETE** on `core_forms` and `core_form_fields` enforced by `check_user_is_org_admin(organisation_id)` (live RLS gate). Any client that bypasses the UI and submits a mutation as a non-org-admin user receives a Postgres permission / RLS deny error.
- The page guard uses canonical `pageName='forms'` and `operation='read'`. The `rbac_app_pages` row keyed to TEAM app id is post-build seeded (Q-RBAC-1).

---

## §11 Acceptance criteria

Implementation progress: **code-complete / unit-tested** items are marked `[x]` below (**23 / 33** from implementation and Vitest; not a substitute for QA pack sign-off). Items remain `[ ]` until the [TM09 QA pack](../test-packs/TM09-qa-pack.md) and §12 MCP rows (e.g. RLS) are satisfied where applicable.

- [ ] **AC-01 — List page entry, authenticated, has org, has read permission.**

Given a user is authenticated, has an org, and has `read:page.forms`, when they navigate to `/forms`, then the page renders the title "Forms" and a `DataTable` of all `core_forms` rows for the current org regardless of `is_active` and `status`. (Traces F-01, F-02, F-21.)

- [x] **AC-02 — List page default sort.**

Given the list has rows with distinct `updated_at` values across 2026-04-30, 2026-05-01, 2026-05-02, when the page loads, then the rows render with the 2026-05-02 row first, the 2026-05-01 row second, and the 2026-04-30 row third under the **Updated** column. (Traces F-27, F-45, BR-S.)

- [x] **AC-03 — List page empty state.**

Given a user enters `/forms` for an org that has zero `core_forms` rows, when the page loads, then the table renders the empty state heading "No forms yet." and description "Create your first form for {selectedOrganisation.name}." with the **Create form** button visible in the toolbar (assuming `canCreate === true`). (Traces F-14.)

- [x] **AC-04 — Search filters in-memory.**

Given the list has multiple rows, when the user types "sign" into the search input, then only rows whose `name`, title-cased workflow type label, or title-cased status label contains "sign" (case-insensitive) remain visible; clearing the input restores all rows. (Traces F-44, BR-S.)

- [ ] **AC-05 — Pagination.**

Given the list has 60 rows, when the page loads with `initialPageSize=25`, then page 1 shows the first 25 rows, page 2 shows rows 26–50, and page 3 shows rows 51–60; changing the page size dropdown to 50 collapses pagination to two pages. (Traces F-46.)

- [ ] **AC-06 — Create form happy path.**

Given a user has `canCreate === true`, when they click **Create form**, fill `name="Org signup 2026"`, `slug="org-signup-2026"`, leave description empty, choose `workflowType='org_signup'`, leave access mode at `authenticated_member`, leave status at `draft`, leave Primary entrypoint unchecked, leave Active unchecked, configure no Schedule & limits values, add one active field with `field_key='core_person.first_name'`, `label='First name'`, `field_type='text'`, `sort_order=1`, Required checked, Active checked, and click Save, then `core_forms` INSERT succeeds, `core_form_fields` INSERT succeeds, the slice navigates to `/forms/:formId` for the new id, and a `'success'`-variant toast renders with copy "Form created.". (Traces F-04, F-30, F-42, BR-N.)

- [ ] **AC-07 — Edit form happy path.**

Given a user has `canUpdate === true` and an existing form, when they navigate to `/forms/:formId`, change the form's `name` to "Updated form", and click Save, then `core_forms` UPDATE succeeds, no field rows are added or removed, and a `'success'`-variant toast renders with copy "Form saved.". (Traces F-05, F-42, BR-N.)

- [ ] **AC-08 — Slug immutable on edit.**

Given a user has navigated to `/forms/:formId`, when they inspect the slug `Input` inside the Form metadata Card, then the Input is disabled and shows the persisted slug value; the Input cannot accept keystrokes. (Traces F-05, BR-D.)

- [x] **AC-09 — Publish gate — name required.**

Given a user is on `/forms/new` with `metadata.name=''`, when the ValidationSummary renders, then it shows the destructive Errors Alert with the message "Name is required." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 1.)

- [x] **AC-10 — Publish gate — slug shape.**

Given a user is on `/forms/new` with `metadata.slug='Bad Slug!'`, when the ValidationSummary renders, then it shows the destructive Errors Alert with the message "Slug must use lowercase letters, numbers, and hyphens only." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 2.)

- [x] **AC-11 — Publish gate — at least one active field.**

Given a user is on `/forms/new` with `state.fields=[]`, when the ValidationSummary renders, then it shows the destructive Errors Alert with the message "At least one active field is required." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 8.)

- [x] **AC-12 — Publish gate — duplicate field key.**

Given a user is on `/forms/new` with two active fields whose `fieldKey='core_person.first_name'`, when the ValidationSummary renders, then it shows the destructive Errors Alert with the message "Duplicate field key detected: core_person.first_name." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 10.)

- [x] **AC-13 — Publish gate — primary entrypoint on non-canonical workflow.**

Given a user is on `/forms/new` with `metadata.workflowType='generic'` and `metadata.isPrimaryEntrypoint=true`, when the ValidationSummary renders, then it shows the destructive Errors Alert with the message "Primary entrypoint is only valid for base_registration and org_signup forms." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 7, BR-K.)

- [x] **AC-14 — Publish gate — activation blocked.**

Given a user is on `/forms/new` with one validation error AND `metadata.isActive=true`, when the ValidationSummary renders, then it shows the destructive Errors Alert containing both the prior error and the activation-blocked message "Activation is blocked until all validation errors are fixed." and the Save Button is disabled. (Traces F-31, F-36, BR-F rule 12.)

- [x] **AC-15 — Field-type warning surfaces on unknown type.**

Given a user is on `/forms/new` with one active field whose `fieldType='date'`, when the ValidationSummary renders, then it shows the Warnings Alert (default tone) with the message "Unknown field type \"date\". Default registry types are text, textarea, and address." and the Save Button is enabled (warnings do not block Save). (Traces F-31, BR-F warnings, BR-U.)

- [x] **AC-16 — Schedule & limits Card renders in middleContent.**

Given a user is on `/forms/new`, when the page renders, then between the Form metadata Card and the Fields Card a "Schedule & limits" Card renders containing, in order: an Opens at datetime-local Input, a Closes at datetime-local Input, a Maximum submissions number Input, a Confirmation message Textarea, and a Required Switch labelled "Form submission is required for this workflow". (Traces F-30, F-34, BR-N.)

- [ ] **AC-17 — Allowed workflow types.**

Given a user is on `/forms/new`, when they open the Workflow type Select, then the visible options are exactly `org_signup`, `information_collection`, `consent_capture`, `generic` (the raw enum strings per pace-core2 source); no other options appear. (Traces F-33, BR-B.)

- [ ] **AC-18 — Copy share URL happy path.**

Given the env var `VITE_FORM_PORTAL_URL='https://forms.example.com'`, when the user clicks the **Copy share URL** action on a row whose slug is `'org-signup-2026'`, then `https://forms.example.com/forms/org-signup-2026` is written to the clipboard and a `'success'`-variant toast renders with copy "Share URL copied to clipboard.". (Traces F-39, BR-J.)

- [ ] **AC-19 — Open in new tab happy path.**

Given the env var `VITE_FORM_PORTAL_URL='https://forms.example.com'`, when the user clicks the **Open in new tab** action on a row whose slug is `'org-signup-2026'`, then a new tab opens at `https://forms.example.com/forms/org-signup-2026`; no toast renders. (Traces F-40, BR-J.)

- [x] **AC-20 — Copy share URL — env var unset.**

Given `VITE_FORM_PORTAL_URL` is empty or undefined, when the user clicks **Copy share URL** on any row, then a `'destructive'`-variant toast renders with copy "Portal origin not configured. Contact your administrator." and the clipboard is not modified. (Traces BR-J.)

- [x] **AC-21 — Delete blocked when responses exist.**

Given a row whose form has 5 `core_form_responses`, when the user clicks **Delete** on that row, then a non-destructive `Dialog` titled "Cannot delete this form" opens with body "5 submitted response(s) reference this form. Forms with responses cannot be deleted." and a single OK button. Click OK closes the dialog with no mutation. (Traces F-41, BR-I.)

- [x] **AC-22 — Delete confirm when no responses.**

Given a row whose form has 0 `core_form_responses` and the form's name is "Org signup 2026", when the user clicks **Delete**, then a destructive `ConfirmationDialog` opens with title "Delete 'Org signup 2026'?" and description "This cannot be undone." with confirm "Delete" and cancel "Cancel". Click Confirm runs the DELETE; on success, the dialog closes, the list refreshes, and a `'success'`-variant toast renders with copy "Org signup 2026 deleted.". (Traces F-41, BR-I.)

- [x] **AC-23 — Delete cancelled.**

Given the destructive `ConfirmationDialog` is open, when the user clicks Cancel or presses Escape, then the dialog closes with no mutation. (Traces F-41, BR-I.)

- [x] **AC-24 — Permission denied — read.**

Given a user is authenticated and has org context but lacks `read:page.forms`, when they navigate to `/forms`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside `AuthenticatedShell` chrome. (Traces F-20, F-48.)

- [x] **AC-25 — Permission denied — create.**

Given a user has `read:page.forms` but `canCreate === false`, when they view `/forms`, then the **Create form** button is not rendered in the toolbar. (Traces F-37, F-49.)

- [x] **AC-26 — Permission denied — update.**

Given a user has `read:page.forms` but `canUpdate === false`, when they navigate to `/forms/:formId`, then the shell renders with `disabled=true` so all editable controls and the Save Button are non-interactive. (Traces F-50.) **F-49:** direct navigation to `/forms/new` when `canCreate === false` also renders the shell with `disabled=true` (see §9 action table).

- [x] **AC-27 — Permission denied — delete.**

Given a user has `read:page.forms` but `canDelete === false`, when they view `/forms`, then no row's Delete action renders. (Traces F-51.)

- [ ] **AC-28 — Org switch on list.**

Given a user has the page open with rows visible for org A, when they switch the org context to org B, then the list refetches and shows org B's rows (or the empty state). (Traces F-07, F-59, BR-L.)

- [x] **AC-29 — Org switch on edit page — wrong org.**

Given a user has `/forms/:formId` open for a form belonging to org A, when they switch the org context to org B and the form does not belong to org B, then the slice navigates to `/forms` and renders a `'default'`-variant toast with copy "Switched organisations. Showing forms for {newOrgName}.". (Traces F-43, BR-L.)

- [x] **AC-30 — Unknown form id.**

Given a user navigates directly to `/forms/:formId` for a `:formId` that does not exist in the current org's `core_forms` rows, when the SELECT returns zero rows, then the slice navigates to `/forms` and renders a `'default'`-variant toast with copy "Form not found in this organisation.". (Traces F-61.)

- [x] **AC-31 — Save error surfaces destructive toast.**

Given a user submits Save with valid client-side state but the server returns a duplicate-slug 23505 error, when the mutation rejects, then the shell remains rendered with the user's edits intact and a `'destructive'`-variant toast renders with the normalised error message from `HandleSupabaseError`. (Traces F-18, BR-G, BR-H.)

- [x] **AC-32 — List query failure surfaces inline alert.**

Given the list query fails on `/forms`, when the error is returned, then the table is replaced inline by an `Alert variant="destructive"` titled "Could not load forms" with description from `HandleSupabaseError` and a Retry button alongside; clicking Retry re-runs the query. (Traces F-15.)

- [ ] **AC-33 — Cross-org leakage prevention.**

Given a form exists in org B but not in org A, when the user is signed in with org A selected, then no SELECT against `core_forms`, `core_form_fields`, or `core_form_responses` returns the org-B row, regardless of search input or filter combination. (Traces F-62, BR-A.)

---

## §12 Verification

- **MCP test — workflow_type CHECK extension (Q-DB-2 gate).** Confirm `core_forms_workflow_type_check` permits `'org_signup'` via `select pg_get_constraintdef(oid) from pg_constraint where conname='core_forms_workflow_type_check';`. If the definition does not include `'org_signup'`, the slice is blocked. If yes, smoke-test by INSERTing a row with `workflow_type='org_signup'` and confirming no CHECK violation.
- **MCP test — primary org_signup unique index (Q-DB-4 gate).** Confirm partial unique index `core_forms_primary_org_signup_per_org_unique` exists with the WHERE clause `workflow_type = 'org_signup' AND is_primary_entrypoint AND is_active AND status = 'published'` via `select indexdef from pg_indexes where indexname='core_forms_primary_org_signup_per_org_unique';`. Smoke-test by attempting to INSERT a second row with `workflow_type='org_signup'`, `is_primary_entrypoint=true`, `is_active=true`, `status='published'` for the same `organisation_id`; confirm 23505.
- **MCP test — `app_submit_member_request` planned-contract (Q-DB-5 gate).** Confirm the function signature accepts `p_request_type` via `select pg_get_function_arguments(oid) from pg_proc where proname='app_submit_member_request';`. Smoke-test by calling the RPC with `p_request_type='join'`, `p_form_response_id=<test response id>`, `p_membership_type_id=<test type id>`, `p_subject_person_id=<test person id>` and confirming the return shape `{ request_id, member_id }` and that both `team_member_request` and provisional `core_member` rows are created atomically.
- **MCP test — `core_field_list` seed (Q-DB-6 gate).** Confirm the catalogue contains entries for `core_person.first_name`, `core_person.last_name`, `core_person.date_of_birth`, `core_person.email`, plus address fields suitable for org_signup forms via `select table_name, field_name from core_field_list where core_form_availability=true and table_name in ('core_person','core_address');`. Informational — v1 ships against whatever rows exist; missing seeds do not block this slice but make the eventual shared picker less useful.
- **MCP test — `rbac_app_pages` seeding (Q-RBAC-1 post-build).** Confirm a row exists with `page_name='forms'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'` via `select * from rbac_app_pages where page_name='forms' and app_id=data_get_app_id('TEAM');`.
- **MCP test — RLS authority.** As a TEAM org-admin signed in for org A, run a SELECT on `core_forms` without an `organisation_id` filter. Confirm only org-A rows return. As the same user, run an INSERT into `core_forms` with `organisation_id=<org B>` and confirm the INSERT fails with RLS deny / WITH CHECK violation.
- **In-app demo flow — happy path Create.** Sign in as a TEAM org-admin. Navigate to `/forms`. Click **Create form**. Fill `name="Org signup 2026"`, `slug="org-signup-2026"`, choose `workflowType='org_signup'`, leave access mode `authenticated_member`, leave status `draft`, leave Primary unchecked, leave Active unchecked, add one field `field_key='core_person.first_name'`, `label='First name'`, `field_type='text'`, Required checked, Active checked. Click Save. Confirm the slice navigates to `/forms/:formId` for the new id and the success toast "Form created." appears. Confirm the new row appears in the list at `/forms`.
- **In-app demo flow — happy path Edit.** From the list, click **Edit** on the row created above. Change `name` to "Org signup 2026 (revised)". Click Save. Confirm the success toast "Form saved." appears. Refresh the page; confirm the updated name persists.
- **In-app demo flow — happy path Delete (count = 0).** From the list, click **Delete** on a freshly created form with no responses. Confirm the destructive `ConfirmationDialog` opens with the form's name in the title. Click Delete. Confirm the success toast "{name} deleted." appears and the row no longer appears in the list.
- **In-app demo flow — Delete blocked (count > 0).** From the list, click **Delete** on a form with at least one `core_form_responses` row. Confirm the non-destructive `Dialog` "Cannot delete this form" opens with the response count interpolated and a single OK button. Click OK. Confirm the dialog closes and the row remains in the list.
- **In-app demo flow — Copy share URL.** From the list, click **Copy share URL** on any row. Confirm the success toast "Share URL copied to clipboard." appears. Paste into a text field; confirm the URL matches `${VITE_FORM_PORTAL_URL}/forms/${row.slug}`.
- **In-app demo flow — Open in new tab.** From the list, click **Open in new tab** on any row. Confirm a new browser tab opens to the same URL.
- **In-app demo flow — Validation gate.** Navigate to `/forms/new`. Without filling any field, observe the ValidationSummary "Errors" Alert with multiple messages and the Save Button disabled. Fill each field per AC-06; observe the Errors Alert empty out and finally show the "Ready" green Alert; the Save Button becomes enabled.
- **In-app demo flow — Org switch on edit page.** Open `/forms/:formId` for a form in org A. Switch the org context selector to org B (where the form does not exist). Confirm the slice navigates to `/forms` and the default-variant toast "Switched organisations. Showing forms for {newOrgName}." appears.
- **In-app demo flow — Permission gating.** Sign in as a TEAM staff member with `read:page.forms` but without `create:page.forms`, `update:page.forms`, or `delete:page.forms`. Navigate to `/forms`. Confirm the **Create form** button is not rendered. Confirm no row shows Edit or Delete actions. Confirm the Copy share URL and Open in new tab actions are visible.

---

## §13 Testing requirements

- Unit / integration tests covering the publish-gate rules in BR-F: name empty → blocked; slug bad shape → blocked; access_mode + workflow_type combination invalid → blocked; org_signup without organisationId → blocked; primary entrypoint on non-canonical workflow → blocked; zero active fields → blocked; duplicate field_key → blocked; activation_blocked when isActive=true with errors. (Each test asserts the correct error code and message.)
- Component test that asserts the toolbar **Create form** button is hidden when `useResourcePermissions('forms').canCreate === false`.
- Component test that asserts row **Edit** and **Delete** actions are hidden when `canUpdate === false` / `canDelete === false`.
- Component test that asserts row **Copy share URL** and **Open in new tab** actions remain visible regardless of mutation permissions.
- Integration test that asserts the list query filters `organisation_id = selectedOrganisation.id` and `event_id IS NULL` against a fixture dataset.
- Integration test that asserts the response-count head-query returns the correct count per form id.
- Integration test that asserts the BR-I delete dependency check opens the destructive `ConfirmationDialog` when count = 0 and the non-destructive `Dialog` when count > 0.
- Integration test that asserts a duplicate-slug 23505 on Save leaves the shell rendered with edits intact and surfaces the destructive toast.
- Integration test that asserts the org-switch behaviour on `/forms/:formId` per BR-L: silent rebind when the form belongs to the new org; redirect-with-toast when not.
- Integration test that asserts the field-replace pattern on `/forms/:formId` Save: DELETE rows whose `id` is no longer in state, INSERT rows newly added in state, UPDATE rows whose `id` is in both prior fetch and current state.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads and writes must go via `useSecureSupabase()`. Direct `createClient` calls are forbidden. Any client that bypasses RBAC scope resolution is forbidden.
- All mutations on `core_forms` and `core_form_fields` are direct DML via `useSecureSupabase`. Do not invent an RPC orchestrator; the live RLS gate is the authorisation surface.
- Do not author the migration extending `core_forms_workflow_type_check`, the partial unique index `core_forms_primary_org_signup_per_org_unique`, the planned-contract `app_submit_member_request` signature, the `core_field_list` seed, or the `rbac_app_pages` row for `pageName='forms'` under TEAM. Those are upstream platform / platform-data work; the slice depends on them (§15).
- Do not implement form submission, form rendering for participants, response display, audience binding, or conditional visibility authoring in this slice.
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- Do not import any third-party spinner icon — use `<LoadingSpinner size="sm" />` for in-button mid-flight indication.

---

## §15 Done criteria

- All 33 acceptance criteria (AC-01 through AC-33) verified via the slice's QA pack.
- **Implementation blocked until** the following platform-side prerequisites land on verified-contract project `yihzsfcceciimdoiibif` (backend-ready MCP target):
  1. **Q-DB-2 — `core_forms_workflow_type_check` extension.** The CHECK constraint must permit `'org_signup'`. Without this, no INSERT/UPDATE with `workflow_type='org_signup'` succeeds.
  2. **Q-DB-4 — Primary org_signup partial unique index.** Partial unique index `core_forms_primary_org_signup_per_org_unique UNIQUE (organisation_id) WHERE workflow_type = 'org_signup' AND is_primary_entrypoint AND is_active AND status = 'published'` must land on dev. Without it, multiple primary `org_signup` forms could coexist for one organisation.
  3. **Q-DB-5 — `app_submit_member_request` planned-contract.** Signature must accept `app_submit_member_request(p_organisation_id uuid, p_request_type team_member_request_type, p_form_response_id uuid DEFAULT NULL, p_membership_type_id uuid DEFAULT NULL, p_subject_person_id uuid DEFAULT NULL) RETURNS jsonb` (return shape `{ request_id, member_id }`). The platform-DB authors the RPC body that creates `team_member_request` row + provisional `core_member` row atomically when `request_type IN ('join','transfer')`. Cross-slice with TEAM-02 + TEAM-05; already shared platform backlog item.
  4. **Q-DB-6 — `core_field_list` seed for org_signup person/contact/address fields.** The catalogue is seeded with rows for `core_person.first_name`, `core_person.last_name`, `core_person.date_of_birth`, `core_person.email`, and address fields appropriate for org_signup forms. v1 ships against whatever the catalogue contains; the seed grows over time. Architecture's post-build platform-data tasks include this seed.
  5. **Q-UX-4 — pace-core2 shared field-catalogue picker.** pace-core2 ships a shared field-catalogue picker bound to `data_core_field_list_core_form()` exposing `field_key`, label, type, and required flag from `core_field_list`. Intended export name `<FieldCatalogPicker source={...} onSelect={...} />` (the slice cites the planned picker by intent without locking in the final symbol). Without this picker, the field editor reverts to free-text `field_key` Input which is unusable for non-engineer admins. **CRITICAL gate.** §16 forbids building a TEAM-local picker.
  6. **Q-RBAC-1 — `rbac_app_pages` row for `pageName='forms'` under TEAM app.** Post-build seeding before release: `page_name='forms'`, `app_id=data_get_app_id('TEAM')`, `scope_type='organisation'`. Architecture pre-authorised; without the row, `<PagePermissionGuard pageName="forms">` evaluations always deny.

  The v6 slice does not author any of the migrations or seeds above. Until items 1, 2, 3, 4, and 6 are confirmed via Supabase MCP against dev, and pace-core2 has shipped the picker per item 5, this slice cannot be marked Done. Items 1, 2, 5, and 6 are hard blockers (the slice is unusable without them); items 3 and 4 are coupled to downstream / catalogue completeness (the slice can be partially exercised without them but Q-DB-5 is required for `org_signup` to be functional end-to-end).

---

## §16 Do not

- Do not implement audience binding (form-to-membership-type subset) in this slice — deferred to a follow-up slice (Q-DB-3). v1 implicit audience is "all active membership types in the organisation"; multi-tier organisations include an in-form tier `Select` field listing active membership types and the submission RPC reads the chosen value via `p_membership_type_id`.
- Do not build a TEAM-local field-catalogue picker. Wait for pace-core2 to ship the shared picker bound to `data_core_field_list_core_form()` (Q-UX-4 §15 gate). The shipped `WorkflowFormFieldEditor` exposes a free-text `field_key` Input in v1; the helper text under the Field key Input directs authors accordingly.
- Do not author conditional visibility (`displayOptions.visibility`) JSON in v1. `WorkflowFieldVisibilityEditor` is not in the pace-core2 barrel; none of the four v1 workflow types need conditional visibility on day one. The Display options Textarea's helper text says so.
- Do not expose a `workflow_config` editor in v1. The slice persists `workflow_config = '{}'` on every INSERT and UPDATE.
- Do not implement client-side concurrency control (optimistic locking, `updated_at` watermark, `If-Match` headers, version columns). v1 ships last-write-wins.
- Do not mount `<Toaster />` per route. TEAM-01's `AuthenticatedShell` mounts `<ToastProvider>` once.
- Do not write to `core_forms` or `core_form_fields` outside `useSecureSupabase`. No `createClient`. No bypass of the RLS scope-resolution path.
- Do not invent a parallel publish/archive lifecycle on top of `is_active`. The pair `is_active` + `status` is the canonical lifecycle (status `draft|published|closed` × `is_active true|false`); the slice does not introduce a third boolean or a separate archived state.
- Do not author forms for BASE workflows: `base_registration`, `activity_booking`, or `merch_order` are excluded from the `allowedWorkflowTypes` list and from the slice's UX.
- Do not surface the `team_unit` legacy construct anywhere in this slice. The slice has no relationship to that construct.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not surface an `is_active` toggle as a row action on `/forms`. The Active checkbox lives inside the metadata editor on the authoring shell.
- Do not surface `core_forms.title` to authors. v1 writes NULL for `title`.
- Do not surface `core_forms.sort_order` to authors. v1 leaves `sort_order` at its default `0` and does not edit it.
- Do not run any verification or smoke test against production. Dev-db only.
- Do not import any third-party spinner icon. `<LoadingSpinner size="sm" />` is the in-button mid-flight affordance.
- Do not delegate the publish-gate rules to a sibling slice. BR-F restates the rules from `validateWorkflowAuthoringState` source for self-contained reading.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; org-scoped admin surfaces; canonical model for `core_forms` authoring vs Portal participant rendering.
- `/rebuild/architecture.md` — slice ownership (TEAM-09 owns `/forms`, `/forms/new`, `/forms/:formId`); route registry; canonical `pageName` map (`forms`); CR21 + DB-414 dependency note (DB-414 LIVE; see Q-CT-1).
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Forms entry), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`** so any descendant route (including this slice) can call `toast(...)`. TEAM-09 depends on this mount; without it, `toast(...)` throws.
- **TEAM-02** — owns `/members` directory. TEAM-02 + Portal share with TEAM-09 the planned-contract `app_submit_member_request` (Q-DB-5) backlog item; the RPC body lands once and serves both submission (Portal/TEAM-09 side) and the resulting member-row creation (TEAM-02 + TEAM-05 read).
- **TEAM-05** — owns `/approvals` and the member-request review surface. TEAM-05's review panel right column reads `core_form_responses` joined to `core_form_response_values` joined to `core_form_fields` for forms authored by TEAM-09. TEAM-05 + TEAM-09 share the `app_submit_member_request` planned-contract (Q-DB-5) at the platform-DB layer.
- **Portal** — owns `/forms/:formSlug` participant rendering and submission orchestration. The Copy share URL and Open in new tab actions construct `${VITE_FORM_PORTAL_URL}/forms/${slug}`; Portal resolves the slug to a published form per CR21 entrypoint resolution rules.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id('TEAM')`; canonical RLS policy templates. **Informational note — future cross-app convergence:** the v6 slice ships against the live `check_user_is_org_admin(organisation_id)` RLS gate on `core_forms` and `core_form_fields` (Q-MUT-1). Future cross-app convergence to RBAC-checked RLS using `data_check_rbac_permission_with_context('<op>:page.forms', 'forms', organisation_id, NULL, data_get_app_id('TEAM'))` is informational only and does not gate v1 implementation. (Per cross-app decisions log entry "Mutation contract Option A is conditional, not universal" 2026-05-04, originating from TEAM-03.)
- `pace-core2/packages/core/docs/requirements/CR21-workflow-forms-runtime.md` — shared forms runtime contract; `core_forms` / `field_key` semantics; `org_signup` and member-facing org-form route resolution; `WorkflowFormAuthoringShell`, `WorkflowFormMetadataEditor`, `WorkflowFormFieldEditor`, `validateWorkflowAuthoringState`, `buildWorkflowPreviewTarget` API surface and rendered layout (read at slice authoring time and captured in the parity audit's pace-core2 dependency map).
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage; `pageName` + `operation`; no `scope` prop at page level. `useResourcePermissions(resource, operation)` for action-level visibility gates.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and shell chrome (provided by TEAM-01).
- DB-414 — `core_form_availability` rename — LIVE on dev (`p4_batch14_core_field_list_rename_availability`, 20260426200100). No implementation gate (Q-CT-1 confirmed).
- **Implementation gates summary** — see §15 Done criteria for the full enumeration. The hard gates are Q-DB-2 (workflow_type CHECK extension), Q-DB-4 (primary org_signup partial unique index), Q-UX-4 (pace-core2 shared field-catalogue picker), and Q-RBAC-1 (post-build `rbac_app_pages` row under TEAM app id). Q-DB-5 (`app_submit_member_request` planned-contract; cross-slice with TEAM-02 + TEAM-05) and Q-DB-6 (`core_field_list` seed) are gates on functional completeness.
- **Informational gap — field-type free-text input (Q-CR21-1).** pace-core2's shipped `WorkflowFormFieldEditor` uses a free-text `Input` for `fieldType` rather than a `Select` driven by a registry. v1 ships with helper text listing supported types and a publish warning for unknown types via `validateWorkflowAuthoringState`. Long-term path: pace-core2 ships a registry-driven `Select`. Captured as pace-core2 capability backlog item.
- **Informational note — `core_forms.title` doc-drift (Q-DB-7).** The platform docs do not define the semantic role of `core_forms.title` (text, nullable) alongside `core_forms.name` (text NOT NULL); v1 writes NULL for `title` (BR-M). pace-core2's `WorkflowAuthoringMetadata` only models `name`. Raised as platform-doc clarification ticket.
