# TEAM-11 — Report builder

## §1 Slice metadata

```
Slice ID:        TEAM-11
Name:            Report builder
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems, organisation context)
Backend impact:  Read + write contracts (no schema changes); platform-DB seed correction prerequisite — see §15
Frontend impact: UI
Routes owned:    /reports
QA pack:         docs/test-packs/TM11-qa-pack.md
```

---

## §2 Overview

TEAM-11 owns the `/reports` route inside the TEAM-01 authenticated shell. It delivers an organisation-scoped, self-service reporting surface for org-admin staff: a single explore (`team.participant`), a field picker drawn from `core_field_list`, filters, sorts, a Run action that previews up to 10,000 rows in a results table with built-in CSV export, and a templates panel for saving, loading, and deleting named report configurations. Layout authority: **`PageHeader`** (title + subtitle) above the shared **`ReportsWorkstation`** wrapper, which composes builder, results, and template lifecycle from pace-core reporting (prototype passes one config object; production may wire adapters around the same workstation contract). The page is wrapped by `<PagePermissionGuard pageName="reports" operation="read">`.

- **Prototype reference:** `pace-prototype/apps/pace-team/pages/FormsReportsSettingsPages.jsx` — `ReportsPage` with **`PageHeader`** + **`ReportsWorkstation`** (`pace-prototype/apps/_pace-core/reports.jsx` shared layer).

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a composable, on-demand reporting surface scoped to the currently selected organisation. They pick fields from the `team.participant` explore, optionally filter and sort, run the report, inspect rows in a results table, optionally export to CSV, and save the configuration as a named template (private or org-shared) so it can be re-loaded in later sessions. TEAM-11 produces that surface and nothing more — there is no schema authoring, no PII allowlist authoring, no other explore, no event-scoped reporting.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Reports page (Report builder + Templates panel + Results table) | `/reports` | Two-column layout on `lg+`: builder card (left, single explore), results table (right). Templates panel renders below or alongside the builder per the breakpoint rules in §5. |
| Delete-template confirmation dialog | (overlay on `/reports`) | `ConfirmationDialog` (destructive variant) — title "Delete template?" |

### Boundaries

TEAM-11 does **not** own:

- Any explore other than `team.participant`. BASE explores (`base.participant`, `base.unit`, `base.activity`, `base.scan`) and PUMP / MEDI explores are outside this slice.
- Authoring of `core_field_list` rows or `report_domains` seed values. Catalogue ownership lies with the data platform.
- Authoring of the `team.participant` explore registration (`baseTable`, joins, `scopeColumn`). That is owned by pace-core2.
- The CSV export wrapper logic — DataTable's built-in `features.export = true` is the entire export surface for v1.
- Org-admin UI override of creator-only edit / delete. v1 is creator-only at the application layer; the org-admin override at the UI is deferred (see §17).
- Cross-org or aggregate-across-orgs reporting.
- XLSX / async export. v1 is browser-side CSV only.
- Member-facing or participant-facing reporting surfaces.
- Event-scoped reporting (TEAM is org-scoped only). No event explore is registered or consumed.
- BASE-table-first presentation of report results.
- The `team_unit` legacy construct (not used in TEAM).
- Forking shared `ReportBuilder` to override the visibility checkbox label. The literal label rendered by `ReportBuilder` is accepted in v1 (see §5 visibility note); the override prop is captured as a §17 capability item.

### Architectural posture

**Mutation contract.** TEAM-11 mutates `core_report_template` (insert, update, delete) via `useSecureSupabase`. Live RLS uses `check_user_is_org_admin(organisation_id)` for org-admin override plus a creator-only path for non-admin staff. The UI is **creator-only at the application layer** for v1 — the slice hides Save / Delete on the active template when the acting user is not the creator, even though RLS would permit org-admin overwrites at the database layer. The org-admin UI override is deferred to a follow-up slice (see §17).

**Page guard.** `<PagePermissionGuard pageName="reports" operation="read">` wraps the page content. The guard resolves scope internally from `OrganisationServiceProvider` context — no `scope` prop is passed.

**Action gating.** `useResourcePermissions('reports')` returns `{ canRead, canCreate, canUpdate, canDelete, canExport, isLoading }`. The slice consumes:
- `canCreate` → controls Save button visibility for new templates.
- `canUpdate` → controls Save button visibility when an existing creator-owned template is loaded.
- `canDelete` → controls Delete button visibility on a creator-owned template.
- `canExport` → controls CSV export visibility in `DataTable`'s toolbar (DataTable consumes this internally via its `rbac.pageName: 'reports'` lookup).
- `canRead` → already covered by the page guard; not separately consumed.

**Single explore.** `availableExploreKeys: ['team.participant']` is passed to `ReportBuilder`. The explore selector renders one option ("Participants — TEAM" — taken from `reportingExplores['team.participant'].label`). `initialExploreKey` is `'team.participant'` (the component's default).

**Layout split.** The page renders three panels: the `ReportBuilder` card on the left (which itself contains explore selector, fields, filters, sorts, and the conditional template controls), the `ReportResultsTable` on the right, and the Templates panel below the builder card on `lg+` (or stacked at narrower breakpoints). All three live inside `PaceMain`.

**Adapters.** Three adapters implement the CR22 interfaces:
1. `ReportingMetadataProvider` → reads `core_field_list` via `useSecureSupabase()` filtered by `report_availability = true` AND `'participant' = ANY(report_domains)`, mapping each row to `ReportingFieldMeta`.
2. `ReportingExecutionAdapter` → translates the planner's `ReportingQueryPlan` into a Supabase query (FROM `plan.explore.baseTable`, joins from `plan.requiredJoins`, scope `WHERE` from `plan.scopeClause`, user filters, user sorts), applies `LIMIT 10000`, and returns `{ rows, totalCount, truncated }`.
3. `ReportingTemplateStore` → list / save / load / delete on `core_report_template`, calling `serializeReportTemplateConfig` before INSERT / UPDATE.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (Save success, Save failure, Delete success, Delete failure, RLS-rejection on race). `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it. Variants used: `'success'`, `'destructive'`, `'default'`. Default duration 5000 ms.

**Page metadata.** `usePaceMain({ printTitle: 'Reports' })` is called on page mount. The shell-level page title is "Reports". The builder card's internal `<CardTitle>Report builder</CardTitle>` is a section title within the page, not the page title.

**Org-scoped reads and writes.** Every read of `core_report_template` carries an `organisation_id = selectedOrganisation.id` filter (defensive belt-and-braces over RLS). Every INSERT / UPDATE writes `organisation_id = selectedOrganisation.id`, `app_id = 'team'`, `domain_id = 'participant'`, and `created_by = currentUserId` (creator stamp). Scope is **never** persisted in the saved template's `selected_fields` / `filters` / `sort_config` / `column_config` blobs — `serializeReportTemplateConfig` enforces this.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere. The execution adapter's `scopeValue` is the organisation uuid string.

### Page-level guards and evaluation ordering

The route `/reports` sits inside `AuthenticatedShell` (TEAM-01) and is wrapped by `<PagePermissionGuard pageName="reports" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the page guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state from TEAM-01; no feature content or page guard is reached.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the no-org empty state from TEAM-01 ("No organisation assigned. Please contact your administrator."). `PagePermissionGuard` is not reached; no RBAC query fires.
4. **Page permission guard** — Once org context is resolved, `<PagePermissionGuard pageName="reports" operation="read">` evaluates with `pageName: 'reports'`, `operation: 'read'`. Scope is resolved internally from the organisation context; no `scope` prop is passed. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside the `PaceMain` content area is acceptable). On `can === false`, `<AccessDenied />` renders. On `can === true`, the page body renders.

If `selectedOrganisation` resolves to `null` mid-render (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions. If the selected organisation changes while the page is mounted, the metadata, templates list, and results refetch against the new org (BR-ORG-SWITCH).

---

## §4 Functional specification

### Page entry

- **F-01** The route `/reports` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.reports` permission.
- **F-02** On entry, the page sets `printTitle` to "Reports" via `usePaceMain`.
- **F-03** The page renders three panels inside `PaceMain`: the **Report builder** card on the left, the **Report results** card on the right (with the empty-result placeholder until the first Run completes), and the **Templates** panel below the builder card.
- **F-04** The builder's explore selector renders one option, **"Participants — TEAM"** (the label of `reportingExplores['team.participant']`), pre-selected. The selector is visible but offers only this single option in v1.
- **F-05** On entry, the slice issues two reads in parallel: `core_field_list` for the field metadata (BR-FIELD-CATALOG) and `core_report_template` for the templates list (BR-TEMPLATE-LIST). The execution query does not fire until the user clicks Run.

### Loading states

- **F-06** **Metadata loading.** While the field metadata query is in flight, the builder card's Fields section shows nothing inside the checkbox list. The rest of the builder card (explore selector, headings) remains visible. A brief blank in the field list during the metadata fetch is acceptable.
- **F-07** **Templates panel loading.** While the templates list query is in flight, the Templates panel renders a centred `<LoadingSpinner />` inside the panel's body area. The panel header ("Templates") and the surrounding page chrome remain visible.
- **F-08** **Run executing.** While `executionAdapter.execute(...)` is running, the **Run report** button is disabled and shows a spinner; `<ReportResultsTable>` renders its loading state (`isLoading=true`) — Card → Table → caption → a single full-width row containing a `LoadingSpinner` labelled "Loading table".
- **F-09** **Save / Delete in flight.** While a template insert / update / delete is in flight, the Save button (or Delete button) is disabled and shows a spinner; other controls in the builder remain interactive.
- **F-10** **Page-level RBAC check in flight.** A brief blank inside `PaceMain` is acceptable (no `loading` prop is passed to `PagePermissionGuard`).

### Empty states

- **F-11** **No fields tagged for `team.participant`.** When the metadata query returns zero rows, the Fields section of the builder shows the copy "No fields available for this explore. Contact your administrator." Run is disabled. Save is disabled (no fields can be selected).
- **F-12** **No templates.** When the templates list returns zero rows, the Templates panel shows the copy "No saved templates yet." with no CTA. The "Load template" `<Select>` inside the builder shows a single placeholder option "Select template…" (no other entries).
- **F-13** **No fields selected.** When `selectedFieldKeys.length === 0`, the Run report button is disabled. Above the field list, an `<Alert variant="default">` reads `<AlertTitle>Select at least one field</AlertTitle><AlertDescription>Pick fields from the list above to run a report.</AlertDescription>`.
- **F-14** **Zero result rows.** When `executionAdapter.execute(...)` returns `result.rows.length === 0`, `<ReportResultsTable>` renders its built-in empty state: heading "No rows returned" and description "Adjust fields or filters and run the report again." The toolbar (search, column visibility, export) remains visible above.

### Error states

- **F-15** **Validation alert.** When `validateReportingSelection` returns errors (codes `unknown_explore`, `unknown_field`, `field_unavailable`, `domain_mismatch`, `unreachable_table`, `missing_aggregate_strategy`), `ReportBuilder` renders an `<Alert variant="destructive">` above the results panel listing the error messages. Run is disabled while errors persist.
- **F-16** **Execution failure.** When `executionAdapter.execute(...)` rejects or returns an error, `ReportBuilder` renders a second `<Alert variant="destructive">` above the results panel with the normalised error message. The Run button re-enables and the user may retry. The previous results table (if any) remains visible.
- **F-17** **Save failure.** When the template store's save call rejects (e.g. RLS denies because the acting user is not the creator), the slice emits a `'destructive'`-variant toast: "Could not save template. Please try again." The form remains in its current state.
- **F-18** **Delete failure.** When the template store's delete call rejects (e.g. RLS denies because the acting user is not the creator), the slice emits a `'destructive'`-variant toast: "Could not delete template. Please try again." The active template remains loaded.
- **F-19** **RLS race on edit.** When a non-creator manages to click Save (e.g. a race where the creator id changed between the lock check and the click), the save rejects. The slice emits a `'destructive'`-variant toast with the literal copy: **"Only the template creator can edit this template."**
- **F-20** **Permission denied (read).** A user without `read:page.reports` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).
- **F-21** **Metadata or templates query failure.** When either query fails, the affected panel renders an inline `<Alert variant="destructive">` containing `<AlertTitle>Could not load fields</AlertTitle>` (or `Could not load templates`) and a Retry button that re-runs the query.

### Primary content — Report builder card

- **F-22** The builder card header reads `<CardTitle>Report builder</CardTitle>` (a section title; the page title "Reports" lives in the page chrome).
- **F-23** The Explore section shows a single `<Select>` labelled "Explore" with the value `team.participant` and the option text "Participants — TEAM".
- **F-24** The Fields section heading reads "Fields". Each available field is a row containing a `<Checkbox>`, a `<Label>` showing the field's friendly name (or `field_name` fallback), and a small caption showing `tableName` (e.g. `core_member`, `core_person`). Fields are listed in the order returned by the metadata query.
- **F-25** The Selected fields section heading reads "Selected fields" and lists each currently-selected field as a row with the field label and a "Remove" button. When `selectedFieldKeys.length === 0`, this section shows the copy "No fields selected".
- **F-26** The Filters section heading reads "Filters". A fieldset row contains: a field `<Select>` (limited to `selectedFieldKeys`), an operator `<Select>` (10 operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is_null`, `not_null`), a value `<Input>`, and an "Add filter" `<Button variant="outline">`. Below, each active filter renders as a row showing `{fieldLabel} {operator} {value}` and a Remove button.
- **F-27** The Sorts section heading reads "Sorts". A fieldset row contains: a field `<Select>`, a direction `<Select>` (`asc` / `desc`), and an "Add sort" button. Below, each active sort renders as a row showing `{fieldLabel} {direction}` and a Remove button.
- **F-28** The Templates control block (rendered by `ReportBuilder` because the slice passes a `templateStore`) appears at the bottom of the builder card and contains: a Template name `<Input>`, a Visibility `<Checkbox>` (label flips between "Private template" and "Event-shared template" — the literal label rendered by pace-core2 in v1; see §17 capability item), a Description `<Input>`, and a "Load template" `<Select>` populated from `templateStore.list('team.participant')`.
- **F-29** When `templateManagementLocked === true` (an active template is loaded whose `created_by !== currentUserId`), the Template name, Visibility, and Description fields are disabled and a small caption renders below them with the literal copy: "Only the template creator can edit or delete this template." (The copy is rendered by pace-core2's `ReportBuilder`.)
- **F-30** The builder card footer (right-aligned) renders three buttons in this order: **Run report** (primary), **Save** (`variant="outline"`), **Delete** (`variant="outline"`). Run is always present; Save is present when the templates panel is mounted and `canCreate === true` (or `canUpdate === true` when an active template is loaded and the user is the creator); Delete is present only when an `activeTemplate` is loaded, the user is the creator, and `canDelete === true`.

### Primary content — Report results panel

- **F-31** The results panel renders `<ReportResultsTable>` from pace-core2, which wraps the result in a `<Card>` with `<CardTitle>Report results</CardTitle>` and a `<DataTable>` body.
- **F-32** Before the first Run, `<ReportResultsTable>` shows its empty state ("No rows returned" / "Adjust fields or filters and run the report again.").
- **F-33** After a successful Run, the table shows one row per result row, with one column per selected field. Column headers use each field's friendly name. Column order follows the order in `selectedFieldKeys`.
- **F-34** When the row count equals the cap (`10000`), the slice renders an `<Alert variant="default">` at the top of `PaceMain` (below the page title row, above the two-column grid) with the literal copy: `<AlertTitle>Result truncated</AlertTitle><AlertDescription>Result truncated at 10,000 rows. Add filters to narrow results.</AlertDescription>`. The truncation banner is dismissible only by re-running with narrower filters; it persists across other interactions on the same result set.

### Primary content — Templates panel

- **F-35** The Templates panel header reads "Templates". The body is a `<DataTable>` with three columns and one row per template visible to the current user under RLS.
- **F-36** Templates panel columns (in order):

  | Header copy | Field / source | Width hint | Notes |
  |---|---|---|---|
  | Name | `core_report_template.name` | flexible | Plain text; fallback to "Untitled template" when null. Sortable. |
  | Modified | `core_report_template.updated_at` (fallback to `created_at` if null) | narrow | Localised short date and time (e.g. "5 May 2026, 14:32"). Sortable; default sort desc (most recent first). |
  | Owner | `core_report_template.created_by` resolved via `core_person.first_name` + `last_name` (joined, read-only) | narrow-medium | Shows the creator's full name. When the row's `created_by === currentUserId`, the cell shows "You". |

  An additional Visibility badge column renders inline at the right edge of the Name cell: "Org-shared" (default tone) when `is_private === false`; "Private" (muted tone) when `is_private === true`. The badge text uses TEAM's correct wording ("Org-shared" / "Private") even though the builder's own visibility checkbox renders the pace-core2 literal "Event-shared template" / "Private template" labels.

- **F-37** Templates panel row actions (rendered as a kebab menu at the row's right edge, opening on click): **Load** (always shown — loads the template into the builder), **Run** (always shown — loads the template AND immediately invokes Run), **Delete** (shown only when `created_by === currentUserId` AND `canDelete === true`).
- **F-38** Clicking anywhere on a template row (outside the kebab menu) calls `templateStore.load(row.id)` and restores the builder's explore, fields, filters, sorts, name, visibility, and description (the same outcome as the kebab menu's Load action). The results table does not refresh until the user presses Run.
- **F-39** The Templates panel description reads `"{count} templates"` where `{count}` is the count of returned rows for the current org. When zero, the description reads `"0 templates"`.
- **F-40** Rows where `domain_id` or `app_id` is null are skipped from the Templates panel list (defensive — see BR-TEMPLATE-LIST). They are not rendered.

### Primary actions

- **F-41** **Run report.** When `selectedFieldKeys.length >= 1` AND validation passes, clicking Run invokes `executionAdapter.execute({ plan })`. The plan carries the explore, selected fields, joins (resolved by the planner), filters, sorts, and the scope clause (`organisation_id = selectedOrganisation.id`). On success, results render in the results panel. On error, an error alert renders above the results panel (F-16). Run is disabled when `selectedFieldKeys.length === 0`, validation errors exist, or a run is already in flight.
- **F-42** **Save template.** Clicking Save persists the current builder state. If `activeTemplateId == null`, the slice INSERTS a row with `app_id = 'team'`, `domain_id = 'participant'`, `organisation_id = selectedOrganisation.id`, `created_by = currentUserId`, `is_private` from the visibility checkbox (default `true`), `name` (or `team.participant template` when blank), `description`, `selected_fields`, `filters`, `sort_config`, `column_config`. If `activeTemplateId != null`, the slice UPDATES that row (only when `created_by === currentUserId` — see BR-OWNERSHIP). On success, the slice emits a `'success'`-variant toast: "Template saved." The Templates panel and the builder's "Load template" `<Select>` refresh to include the new / updated row.
- **F-43** **Delete template.** Clicking Delete on a creator-owned template opens the delete confirmation dialog (F-49). On confirm, the slice DELETES the row by id. On success, the slice emits a `'success'`-variant toast: "Template deleted." The Templates panel and the "Load template" `<Select>` refresh; the active template is cleared from the builder; the results panel resets to its pre-Run empty state.
- **F-44** **Load template.** Selecting a template from the builder's "Load template" `<Select>`, or clicking a row in the Templates panel, calls `templateStore.load(templateId)` and restores the builder's explore, fields, filters, sorts, column config, name, visibility, and description. The results table does not auto-execute — the user must press Run.

### Secondary actions

- **F-45** **CSV export.** The results panel's `<DataTable>` toolbar surfaces a built-in **Export** action (because `features.export = true` is hard-wired in `ReportResultsTable`). Clicking Export downloads the current rendered rows as `export.csv`. The export uses the visible columns in their current order; no separate query is issued. The action is gated by `useResourcePermissions('reports').canExport` (DataTable's own RBAC lookup with `pageName: 'reports'`).
- **F-46** **Search.** The results panel's `<DataTable>` toolbar includes a search input that filters the rendered rows by case-insensitive substring across all visible columns (DataTable built-in).
- **F-47** **Column visibility.** The results panel's `<DataTable>` toolbar includes a column-visibility popover (DataTable built-in).
- **F-48** **Sort and pagination.** The results panel's `<DataTable>` supports column-header sorting and pagination (DataTable built-in). Initial sorting reflects the user's explicit Sorts; if Sorts is empty, the table is unsorted on initial render.
- **F-49** **Delete confirmation dialog.** The Delete button opens a `ConfirmationDialog` with the literal copy: title **"Delete template?"**, description **"This permanently deletes the template '{name}'. This cannot be undone."**, confirm button **"Delete"** (destructive), cancel button **"Cancel"**. `ConfirmationDialog` has no body slot — the description is the entire body. The dialog closes on Confirm or Cancel; Confirm triggers the delete.
- **F-50** **Switching explore (single option).** The explore `<Select>` shows only `team.participant`; switching to itself is a no-op. The component would otherwise clear field / filter / sort / result state on a real change; that path is unreachable in v1.

### Permission-conditional rendering

- **F-51** When `read:page.reports` is denied, `PagePermissionGuard` renders `<AccessDenied />` and no builder, results, or templates panel renders.
- **F-52** When `canCreate === false` AND `canUpdate === false`, the Save button is hidden and saving is impossible. Users may still load and run existing templates and run ad-hoc reports.
- **F-53** When `canDelete === false`, the Delete button in the builder card and the Delete row action in the Templates panel are both hidden.
- **F-54** When `canExport === false`, the DataTable's Export toolbar action is hidden (DataTable does this internally via its `rbac` config).
- **F-55** When the active template's `created_by !== currentUserId`, the Save and Delete buttons in the builder card are hidden and the form fields in the Templates control block are disabled (the locked state — F-29). The Templates panel's Delete row action is also hidden for any row whose `created_by !== currentUserId`.

### Navigation

- **F-56** The page is reachable from the TEAM-01 navigation menu via the **Reports** entry (`/reports`).
- **F-57** No outbound navigation is initiated from this slice. Saving, deleting, or running a template does not navigate away. Cancel actions on dialogs simply close the dialog and remain on `/reports`.

### Edge cases and constraints

- **F-58** **Org switch.** When `selectedOrganisation` changes while the page is mounted, the field metadata query, the templates list query, and the active template state are all reset against the new org. The current results table is cleared (returns to its pre-Run empty state). `activeTemplateId` is cleared. The slice does not emit a toast on org switch in this surface (the org switcher itself is part of the TEAM-01 chrome).
- **F-59** **Truncation cap.** When `executionAdapter.execute(...)` returns `result.totalCount === 10000` (the cap was hit), the truncation banner (F-34) renders above the results table.
- **F-60** **Empty catalogue.** When the metadata query returns zero rows tagged for `'participant'`, F-11 applies. The Save button remains visible (the user may still create a template with zero fields, though Save without fields fails fast — see F-61).
- **F-61** **Save with zero fields.** When the user clicks Save while `selectedFieldKeys.length === 0`, the save fails fast with the literal pace-core2 error rendered as part of the Save error path; the slice surfaces a `'destructive'`-variant toast "Could not save template. Please try again." (F-17). No INSERT / UPDATE is issued.
- **F-62** **Concurrent edit on the same template.** If user A and user B both have the same template loaded, and A saves, B's version is the older one. There is no last-write-wins warning in v1 — B's subsequent Save will overwrite A's. The non-creator path is blocked by the lock (F-29 / F-55) regardless.
- **F-63** **RLS race on UPDATE / DELETE.** If `created_by` changes between the lock check and the click (extremely rare), the mutation rejects at the database. The slice emits the literal toast "Only the template creator can edit this template." (F-19). The form remains as-is; no state mutation.
- **F-64** **Cross-org template access.** RLS prevents listing or loading any `core_report_template` row whose `organisation_id` is not in the user's accessible orgs. The slice's defensive `organisation_id = selectedOrganisation.id` filter on the list query is a belt-and-braces guard; even without it, RLS would enforce isolation.

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`:

- **`PageHeader`** — Title **"Reports"** with a one-line subtitle describing building from member fields, filtering, running/exporting, and saving reusable definitions with org scope applied fresh each run (prototype copy: "Build a report from member fields, filter and sort, then run or export. Save reusable definitions - scope is applied fresh each run."). No breadcrumb. No separate plain `<h1>` page title row.
- **`ReportsWorkstation`** — Immediately below the header, the shared reporting workstation composes the explore selector, field picker, filters, sorts, run/save/delete template controls, results table, and saved-templates surface in the workstation's canonical layout (prototype: single `ReportsWorkstation` `config={{ … }}` object with `explores`, `reporting`, `templates`, `scope`, `currentUserId`, `visibilityLabels`). Production may implement this via pace-core **`ReportBuilder`** + adapters + templates table **inside** a workstation-equivalent wrapper, but the **visual contract** is one workstation block under the header — not a slice-authored page title plus manually placed sibling panels.
- **Truncation banner** — When applicable (F-34), an `<Alert variant="default">` with title "Result truncated" renders below **`PageHeader`** and above **`ReportsWorkstation`**, full-width within `PaceMain`.
- **Validation / execution-error alerts** — Rendered inside the workstation above the results table area. When both validation and execution errors are present, the validation alert renders first (top), the execution-error alert second.

Breakpoints: standard pace-core2 responsive behaviour applies. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01. The `<DataTable>` shows a horizontal scroll on narrow viewports rather than collapsing to a card list. No sticky elements in this slice. No drawers.

### Components

**Page chrome** — TEAM-01 supplies the header, `PaceMain`, and footer via `PaceAppLayout`. `usePaceMain({ printTitle: 'Reports' })` is the only chrome configuration.

**`ReportBuilder`** (`@solvera/pace-core/reporting`)
- Purpose: combined report-authoring surface — explore selector, field picker, filters, sorts, and template controls in one card.
- Wires to the slice's three adapters: `metadataProvider` (for fields), `executionAdapter` (for Run), `templateStore` (for list / load / save / delete).
- `currentUserId` is the acting user's `user.id` from `useUnifiedAuth()`.
- `availableExploreKeys` is `['team.participant']` (single-option selector visible).
- `initialExploreKey` is `'team.participant'`.
- `scopeValue` is `selectedOrganisation.id` (uuid string).
- Renders, in order, inside its outer `<section>`:
  - Outer wrapper: `<section className="grid gap-4">` with one inner `<section className="grid gap-4 lg:grid-cols-[minmax(20rem,24rem)_1fr]">`.
  - Left column: a `<Card>` containing `<CardHeader><CardTitle>Report builder</CardTitle></CardHeader>` and a `<CardContent className="grid gap-4">` with the following sub-sections:
    - Explore — `<Select>` labelled "Explore"; one option ("Participants — TEAM").
    - Fields — `<section><h4>Fields</h4>` followed by a checkbox list. Each item: `<Label>` containing a `<Checkbox>`, the field's friendly name, and a `<small>` showing `tableName`.
    - Selected fields — `<section><h4>Selected fields</h4>` followed by a list of selected fields, each rendered as a row with the field label and a "Remove" button. When empty, shows "No fields selected".
    - Filters — `<section className="grid gap-2"><h4>Filters</h4>` with a fieldset row (field `<Select>`, operator `<Select>`, value `<Input>`, "Add filter" `<Button variant="outline">`) followed by a list of active filters with Remove buttons.
    - Sorts — `<section className="grid gap-2"><h4>Sorts</h4>` with a fieldset row (field `<Select>`, direction `<Select>`, "Add sort" `<Button variant="outline">`) followed by a list of active sorts with Remove buttons.
    - Template control block (rendered because `templateStore` is provided): Template name `<Input>` (placeholder "Template name"), Visibility `<Checkbox>` (label "Private template" when checked, **"Event-shared template"** when unchecked — pace-core2 literal label, accepted in v1; see §17), Description `<Input>` (placeholder "Description (optional)"), "Load template" `<Select>` populated from the templates list. When the active template is locked (`templateManagementLocked === true`), all fields in this block are `disabled` and a `<small>` renders below them with the literal copy "Only the template creator can edit or delete this template."
  - `<CardFooter className="text-right">` with three buttons in this order:
    - **Run report** (default `<Button>`, primary visual). Disabled when metadata is loading, run is in flight, no explore selected, no fields selected, or validation errors present. Shows a spinner when in flight.
    - **Save** (`<Button variant="outline">`, present only when `templateStore` is mounted AND the user has the relevant create / update permission AND the template is not locked).
    - **Delete** (`<Button variant="outline">`, present only when an `activeTemplate` is loaded, `created_by === currentUserId`, AND `canDelete === true`).
  - Right column: a `<section className="grid gap-4">` containing up to two `<Alert variant="destructive">` panels (validation issues, then execution errors), then `<ReportResultsTable>`.

**`ReportResultsTable`** (`@solvera/pace-core/reporting`)
- Purpose: results display with built-in CSV export, search, sort, pagination, column visibility.
- `fields` — the `ReportingFieldMeta[]` for the currently-selected fields.
- `result` — the `ReportingExecutionData | null` returned by the adapter. `null` shows the empty state ("No rows returned" / "Adjust fields or filters and run the report again.").
- `isLoading` — bound to the slice's run-loading state.
- `title` — left at default `'Report results'` (rendered as the Card's `<CardTitle>` and as the DataTable's caption title).
- `columnConfig` — derived from the user's selected field order; defaults to selected order when no explicit column config is set.
- `sorts` — the user's active sorts (mapped into DataTable's `initialSorting`).
- Renders: `<Card><CardHeader><CardTitle>Report results</CardTitle></CardHeader><CardContent><DataTable .../></CardContent></Card>`. DataTable hard-wires `features = { search: true, export: true, filtering: true, sorting: true, pagination: true, columnVisibility: true }` and `rbac = { pageName: 'reports' }`.

**Truncation banner** (`@solvera/pace-core/components` — `Alert`)
- `<Alert variant="default">` with `<AlertTitle>Result truncated</AlertTitle>` and `<AlertDescription>Result truncated at 10,000 rows. Add filters to narrow results.</AlertDescription>`. Rendered above the `<ReportResultsTable>` Card when the cap is hit.

**Templates panel** (custom panel; uses pace-core2 `<Card>` and `<DataTable>`)
- Purpose: list, load, run, and delete saved templates for the current organisation.
- Container: `<Card>` with `<CardHeader><CardTitle>Templates</CardTitle></CardHeader><CardContent>...`.
- Body: a `<DataTable>` rendered with the slice's templates query result.
- `rbac.pageName`: `'reports'`.
- `description`: `"{count} templates"`.
- `isLoading`: bound to the templates list query.
- `emptyState`: `{ title: "No saved templates yet.", description: "Saved templates appear here once you save a configuration." }`.
- `getRowId`: `(row) => row.id` (`core_report_template.id`).
- `initialPageSize`: `10`.
- `initialSorting`: `[{ id: 'updated_at', desc: true }]`.
- `features`: `{ import: false, export: false, hierarchical: false, grouping: false, creation: false, editing: false, deletion: false, deleteSelected: false, search: true, pagination: true, sorting: true, filtering: false, columnVisibility: false, selection: false }`.
- Templates panel columns:

  | Header copy | Field / source | Width hint | Notes |
  |---|---|---|---|
  | Name | `core_report_template.name` (with inline visibility badge) | flexible | Plain text; "Untitled template" fallback when null. Inline badge at right edge: "Org-shared" (default tone) when `is_private === false`; "Private" (muted tone) when `is_private === true`. Sortable. |
  | Modified | `core_report_template.updated_at` (fallback `created_at`) | narrow | Localised short date and time (e.g. "5 May 2026, 14:32"). Sortable; default sort desc. |
  | Owner | `core_report_template.created_by` resolved to `core_person.first_name` + `last_name` via join | narrow-medium | Plain text; "You" when `created_by === currentUserId`. |

  Row kebab menu (rightmost, no header): opens on click and offers **Load**, **Run**, and **Delete** (Delete shown only when `created_by === currentUserId` AND `canDelete === true`).

- Toolbar: search input (placeholder "Search templates"); the toolbar does not show Create / Import / Export / Delete buttons — features are off.
- Pagination: page size 10; current page indicator and prev / next controls below the table (DataTable defaults).

**Delete confirmation dialog** (`@solvera/pace-core/components` — `ConfirmationDialog`)
- Trigger: Delete button in the builder card OR Delete row action in the Templates panel.
- `ConfirmationDialog` has NO body slot. The description is the entire body.
- Title: **"Delete template?"**.
- Description: **"This permanently deletes the template '{name}'. This cannot be undone."** (`{name}` substitutes the template's `name`, falling back to "Untitled template" when null).
- Confirm button: text **"Delete"** (destructive variant).
- Cancel button: text **"Cancel"** (default / secondary variant).
- Close behaviour: confirm triggers the delete and closes the dialog; cancel closes the dialog without action; clicking outside or pressing Escape closes the dialog.
- Focus management: opens with focus on the Cancel button (destructive default).

**Toasts** — surfaced via the module-level `toast({ title, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice:
- `'success'` — Save success ("Template saved."); Delete success ("Template deleted.").
- `'destructive'` — Save failure ("Could not save template. Please try again."); Delete failure ("Could not delete template. Please try again."); RLS race on edit ("Only the template creator can edit this template.").
- `'default'` — not used by this slice.

Notifications appear in an `aside[role="region"][aria-label="Notifications"]` overlay portalled to `document.body`, anchored bottom-right of the viewport. Each toast auto-dismisses after the default duration (5000 ms) and is also dismissible via its close button. The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

**Loading spinners** — `<LoadingSpinner />` from `@solvera/pace-core/components` is used inline in the Templates panel body during the templates list query, and inside `<DataTable>`'s built-in loading row when a list query is in flight. Visual: a centred small spinner with the default DataTable label "Loading table" inside DataTable contexts; centred bare spinner in the Templates panel body.

### Layout acceptance criteria (prototype alignment)

- [ ] **`/reports`** renders **`PageHeader`** with title "Reports" and the descriptive subtitle (scope applied fresh each run).
- [ ] Builder, results, and templates surfaces compose inside **`ReportsWorkstation`** (or production workstation equivalent) directly below the header — not a slice-owned two-column grid with a separate full-width templates card authored only at the page level.
- [ ] Truncation **`Alert`** (when shown) sits between **`PageHeader`** and the workstation, not inside the shell page title row.

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- Page uses plain **`<h1>Reports</h1>`** instead of **`PageHeader`** with subtitle.
- Slice mounts **`ReportBuilder`** (internal two-column builder + results grid) and a separate **`TeamReportTemplatesTable`** below — not the prototype **`ReportsWorkstation`** single-config wrapper.
- Functional reporting behaviour (explore, adapters, templates) is largely correct; pass 2 is primarily **layout/composition** realignment to the workstation pattern.

### States

- **Loading — metadata.** Builder card visible; Fields section's checkbox list is empty (brief blank acceptable). Other builder controls remain enabled.
- **Loading — templates list.** Templates panel header visible; body shows a centred `<LoadingSpinner />`.
- **Loading — run.** Run button disabled with spinner; `<ReportResultsTable>` shows its loading state (Card + DataTable + caption + a single full-width row with `<LoadingSpinner label="Loading table" />`).
- **Loading — save.** Save button disabled with spinner; other builder controls remain enabled.
- **Loading — delete.** Delete button disabled with spinner; confirmation dialog buttons disabled.
- **Empty — no fields tagged for explore.** Fields section copy "No fields available for this explore. Contact your administrator." Run is disabled.
- **Empty — no fields selected.** `<Alert variant="default">` above the Fields section with title "Select at least one field" and description "Pick fields from the list above to run a report." Run is disabled.
- **Empty — no templates.** Templates panel body shows "No saved templates yet." with description "Saved templates appear here once you save a configuration." Builder's Load template `<Select>` shows "Select template…" placeholder only.
- **Empty — zero results.** `<ReportResultsTable>` renders its built-in empty state ("No rows returned" / "Adjust fields or filters and run the report again."). Toolbar (search, column visibility, export) remains visible.
- **Error — validation.** `<Alert variant="destructive">` above the results table area listing the validation error codes / messages. Run remains disabled while errors persist.
- **Error — execution.** Second `<Alert variant="destructive">` above the results table area with the normalised error message. Previous results (if any) remain visible. Run re-enables.
- **Error — metadata or templates query.** Affected panel renders an inline `<Alert variant="destructive">` with `<AlertTitle>Could not load fields</AlertTitle>` (or `Could not load templates`) and a Retry button.
- **Error — save / delete (toast).** A `'destructive'`-variant toast renders bottom-right with the relevant copy. The form / dialog state is preserved.
- **Permission denied.** `<AccessDenied />` in `PaceMain` with TEAM-01 chrome (header, footer) visible.
- **Locked template.** Template name / Visibility / Description fields disabled; small caption "Only the template creator can edit or delete this template." rendered below them; Save and Delete buttons hidden in the builder card.
- **Truncation.** `<Alert variant="default">` with title "Result truncated" rendered above the results table.

### Interactions

- **Explore selector (single option)** — clicking opens the `<Select>` dropdown showing one option ("Participants — TEAM"). Selecting it is a no-op; no state changes.
- **Field checkbox** — toggles the field's membership in `selectedFieldKeys`. Adding a field reveals its row in Selected fields. Removing a field also removes it from any active filters / sorts that referenced it (auto-prune).
- **Selected fields — Remove** — clicking Remove on a Selected fields row removes that field; identical effect to unchecking the field's checkbox.
- **Filters — Add filter** — when field, operator, and value are populated, clicking Add appends the filter to the active filters list. The fieldset clears for the next entry.
- **Filters — Remove** — clicking Remove on an active filter removes it.
- **Sorts — Add sort** — when field and direction are populated, clicking Add appends the sort. The fieldset clears.
- **Sorts — Remove** — clicking Remove on an active sort removes it.
- **Template name / Visibility / Description** — typing or toggling updates the in-memory builder state; no autosave. Persistence happens on Save.
- **Load template — `<Select>`** — selecting a template invokes `templateStore.load(id)`; the form fields and explore key are restored. Results are not re-run automatically.
- **Templates panel — row click** — calls `templateStore.load(row.id)` and restores the builder state from the saved template; the results table is not auto-run.
- **Templates panel — kebab → Load / Run / Delete** — Load: calls `templateStore.load(row.id)` and restores the builder state from the saved template; the results table is not auto-run. Run: invokes the same load, then immediately invokes Run. Delete: opens the delete confirmation dialog.
- **Run report** — disabled state ignores clicks. Enabled: spinner appears, button disabled until results return or error renders.
- **Save** — disabled state ignores clicks. Enabled: spinner appears, button disabled until the INSERT / UPDATE resolves; on success, toast renders and Templates panel refreshes; on failure, destructive toast renders.
- **Delete** — opens the delete confirmation dialog; the dialog's Confirm triggers the DELETE.
- **Delete confirmation dialog — Confirm** — invokes the DELETE; on success: dialog closes, success toast renders, Templates panel and Load `<Select>` refresh, the active template clears in the builder, the results panel resets to empty.
- **Delete confirmation dialog — Cancel / outside click / Escape** — dialog closes; no DELETE issued.
- **Results — Export** — clicking Export downloads `export.csv` with the rendered rows in their visible-column order.
- **Results — Search** — typing filters the rendered rows by case-insensitive substring across visible columns.
- **Results — Column visibility** — toggling a column shows / hides it in the rendered table; the export reflects the current visibility.
- **Results — Sort / Pagination** — DataTable defaults.
- **Org switch** — when `selectedOrganisation` changes, the metadata, templates, and active template state reset against the new org; results clear; no toast.

### Permission-conditional rendering

| Condition | Page entry | Builder card | Templates panel | Save | Delete | Export |
|---|---|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a | n/a | n/a |
| Authenticated, org, `read:page.reports` denied | `<AccessDenied />` | Hidden | Hidden | Hidden | Hidden | Hidden |
| Authenticated, org, `read:page.reports` allowed, `canCreate=false` AND `canUpdate=false` | Page visible | Visible | Visible | Hidden | Hidden if `canDelete=false` | Per `canExport` |
| Authenticated, org, all five operations allowed, ad-hoc (no active template) | Page visible | Visible | Visible | Visible | Hidden (no active template) | Visible (per `canExport`) |
| Authenticated, org, all five operations allowed, active template loaded, user is creator | Page visible | Visible | Visible | Visible | Visible | Visible (per `canExport`) |
| Authenticated, org, all five operations allowed, active template loaded, user is **not** creator | Page visible | Visible (locked state) | Visible | **Hidden** | **Hidden** | Visible (per `canExport`) |

---

## §6 Business rules

**BR-FIELD-CATALOG — Field metadata source.**
- Input: an active explore key (`team.participant` in v1).
- Output: `metadataProvider.getFields('team.participant')` reads `core_field_list` via `useSecureSupabase()` filtered by `report_availability = true` AND `'participant' = ANY(report_domains)` (the bare domain id, matching `getReportingExplore('team.participant').domainId`). Each row maps to `ReportingFieldMeta` as: `tableName ← table_name`, `label ← friendly_field_name (fallback field_name)`, `reportAvailability ← report_availability`, `reportDomains ← report_domains`, `aggregateStrategy ← aggregate_strategy`, `aggregateConfig ← aggregate_config`. `fieldKey` is composed as `${table_name}.${field_name}`.
- Edge: rows with `report_availability = false` or whose `report_domains` does not contain `'participant'` are excluded. Catalogue ownership is the data platform's; the slice does not insert / update / delete `core_field_list`.

**BR-EXPLORE — Single explore declared.**
- Input: builder mounting.
- Output: TEAM v1 exposes exactly one explore — `team.participant` (`{ appId: 'team', domainId: 'participant', baseTable: 'core_member', scopeColumn: 'organisation_id' }` and the registered joins `core_person`, `medi_profile`, `medi_condition`).
- Edge: the explore selector renders one option; any future explore is a separate slice.

**BR-SCOPE — Organisation scope.**
- Input: any Run, any Save, any list query.
- Output: `scopeValue = selectedOrganisation.id` (uuid string). The execution adapter emits `WHERE core_member.organisation_id = $scopeValue` (via the planner's `scopeClause`). Save writes `organisation_id = selectedOrganisation.id` on every INSERT / UPDATE. Scope is **never** persisted in the saved template's payload — `serializeReportTemplateConfig` throws if any of `scope`, `scopeValue`, `event_id`, `organisation_id` keys appears in the serialised blob.
- Edge: cross-org access is impossible at the application layer (defensive filter) AND at the database layer (RLS).

**BR-VALIDATION — Selection validation.**
- Input: the current builder state on Run.
- Output: `validateReportingSelection({ exploreKey, selectedFieldKeys, filters, sorts, fields })` returns `{ valid, explore, errors }`. Six error codes are surfaced: `unknown_explore`, `unknown_field`, `field_unavailable`, `domain_mismatch`, `unreachable_table`, `missing_aggregate_strategy`. Run is disabled when `selectedFieldKeys.length === 0` or when `errors.length > 0`.

**BR-EXECUTION — Execution adapter contract.**
- Input: `request: ReportingExecutionRequest = { plan: ReportingQueryPlan }`.
- Output: the adapter assembles a Supabase query: `FROM plan.explore.baseTable`, joins from `plan.requiredJoins`, `WHERE` clauses from `plan.scopeClause` and `plan.filters`, `ORDER BY` from `plan.sorts`, GROUP BY from `plan.groupByFieldKeys` and aggregations from `plan.aggregations` when present. The adapter applies `LIMIT 10000` to every executed query. It returns `ApiResult<{ rows: ReportingExecutionRow[]; totalCount?: number; truncated?: boolean }>` shaped per `ReportingExecutionData`.
- Edge: `truncated` is `true` when the returned row count equals the cap (10,000).

**BR-ROW-CAP — Row cap and truncation banner.**
- Input: a successful Run.
- Output: every executed query carries `LIMIT 10000`. When the returned row count equals 10,000, the slice renders a `<Alert variant="default">` above the results table with title "Result truncated" and description "Result truncated at 10,000 rows. Add filters to narrow results." The banner persists for the lifetime of that result set; it clears on the next Run or on org switch.
- Rationale: protects the browser from unbounded result rendering and prompts the user to narrow filters rather than scroll endlessly.

**BR-OWNERSHIP — Creator-only edit / delete at the UI.**
- Input: an `activeTemplate` is loaded; `currentUserId = useUnifiedAuth().user.id`.
- Output: `templateManagementLocked = activeTemplate.created_by !== currentUserId`. When locked: the Save and Delete buttons in the builder card are hidden; the Template name / Visibility / Description fields are disabled; the Templates panel's Delete row action is hidden for that row. Non-creators may load and run a non-private template but cannot save over it or delete it from the UI.
- Edge: RLS (`rbac_update_core_report_template` and `rbac_delete_core_report_template`) would permit org-admin overrides at the database layer. This UI deliberately suppresses that path in v1 (org-admin override deferred to §17). On a race where `created_by` changes between the lock check and the Save / Delete click, the database rejects the mutation and the slice surfaces the literal toast "Only the template creator can edit this template."

**BR-VISIBILITY — Private vs org-shared visibility.**
- Input: the visibility checkbox value on Save.
- Output: `is_private = true` (checkbox checked) → private to creator only; `is_private = false` (checkbox unchecked) → "Org-shared": all users with `read:page.reports` and access to the same `organisation_id` can list and load it. Default on a new template is `is_private = true`.
- Edge: TEAM is org-scoped, not event-scoped, so the visible label rendered by pace-core2's `ReportBuilder` checkbox ("Event-shared template" when unchecked) is cosmetically incorrect in v1 — accepted with a §17 capability item to add a `visibilityLabels` prop. The Templates panel's badge column uses TEAM's correct wording ("Org-shared" / "Private").

**BR-TEMPLATE-LIST — Templates list query and defensive null handling.**
- Input: page entry; org switch; a successful Save; a successful Delete.
- Output: `templateStore.list('team.participant')` reads `core_report_template` via `useSecureSupabase()` filtered by `organisation_id = selectedOrganisation.id` AND `app_id = 'team'` AND `domain_id = 'participant'`. Rows where `domain_id IS NULL` OR `app_id IS NULL` are skipped (defensive — orphan rows). Returned rows are joined to `core_person` for the Owner column display name.
- Edge: an empty result is not an error; the panel renders its empty state.

**BR-EXPORT — CSV export contract.**
- Input: the user clicks Export in the results panel toolbar.
- Output: `<DataTable>` (rendered inside `<ReportResultsTable>`) downloads `export.csv` containing the currently rendered rows in their currently visible-column order. No separate query is issued — the export uses the in-memory rendered rows. The action is RBAC-gated by `useResourcePermissions('reports').canExport` (DataTable performs this lookup internally because `rbac.pageName` is `'reports'`).
- Edge: when `canExport === false`, the Export toolbar action is hidden.

**BR-SAVE — Save semantics.**
- Input: the user clicks Save with `selectedFieldKeys.length >= 1`.
- Output: the slice serialises the builder state via `serializeReportTemplateConfig({ exploreKey: 'team.participant', selectedFields, filters, sortConfig, columnConfig })` (which splits `exploreKey` into `app_id = 'team'`, `domain_id = 'participant'` and stamps the four payload columns). If `activeTemplateId == null`, the slice INSERTs a row with `app_id = 'team'`, `domain_id = 'participant'`, `organisation_id = selectedOrganisation.id`, `created_by = currentUserId`, `is_private` from the checkbox, `name` (or `'team.participant template'` when blank), `description`, `selected_fields`, `filters`, `sort_config`, `column_config`. If `activeTemplateId != null` AND `activeTemplate.created_by === currentUserId`, the slice UPDATEs that row (same payload columns minus the immutable ones). On success, the slice emits a `'success'`-variant toast "Template saved." and the Templates panel and the builder's Load `<Select>` refresh.
- Edge: when `selectedFieldKeys.length === 0`, Save fails fast with an error rendered by `ReportBuilder`; the slice surfaces a `'destructive'`-variant toast "Could not save template. Please try again." (no INSERT / UPDATE issued).

**BR-DELETE — Delete semantics.**
- Input: the user confirms the delete dialog for a creator-owned template.
- Output: the slice DELETEs `core_report_template` by `id`. On success, the slice emits a `'success'`-variant toast "Template deleted." The Templates panel and the builder's Load `<Select>` refresh; `activeTemplateId` is cleared; the builder's form fields reset to their defaults (no fields, no filters, no sorts, blank name, `is_private = true`, blank description); the results panel resets to its pre-Run empty state.
- Edge: when the DELETE rejects (e.g. RLS denies), the slice surfaces a `'destructive'`-variant toast "Could not delete template. Please try again."; the dialog has already closed.

**BR-EMPTY-CATALOG — Empty catalogue handling.**
- Input: the metadata query returns zero rows.
- Output: the Fields section shows the copy "No fields available for this explore. Contact your administrator." Run is disabled. Save without fields fails fast (BR-SAVE edge).
- Rationale: catalogue ownership is the data platform's; the slice surfaces the data state without inventing fallback fields.

**BR-NO-LEGACY-RPC — No legacy field-discovery RPC.**
- Input: any field discovery in this slice.
- Output: the metadata provider reads `core_field_list` directly via `useSecureSupabase()`. No legacy RPC is invoked.

**BR-ORG-SWITCH — Org switch behaviour.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output: the metadata query, the templates list query, and the active template state are reset against the new org. The current results table is cleared (returns to its pre-Run empty state). `activeTemplateId` is cleared. The slice does not emit a toast on org switch in this surface.

**BR-PAGE-GUARD — Page guard.**
- Input: route entry to `/reports`.
- Output: `<PagePermissionGuard pageName="reports" operation="read">` evaluates with org scope resolved internally. On deny, `<AccessDenied />` is rendered. On allow, the page body renders.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. The reporting UX lives behind `/reports`.

### Read contracts

- **Field metadata query.** PostgREST shape:
  ```
  useSecureSupabase()
    .from('core_field_list')
    .select('table_name, field_name, field_type, friendly_field_name, field_description, report_availability, report_domains, aggregate_strategy, aggregate_config')
    .eq('report_availability', true)
    .contains('report_domains', ['participant'])
    .order('table_name', { ascending: true })
    .order('field_name', { ascending: true })
  ```

- **Templates list query.** PostgREST shape (Owner column resolved in a follow-up read):
  ```
  useSecureSupabase()
    .from('core_report_template')
    .select('id, name, description, is_private, organisation_id, created_by, created_at, updated_at, app_id, domain_id, selected_fields, filters, sort_config, column_config')
    .eq('organisation_id', selectedOrganisation.id)
    .eq('app_id', 'team')
    .eq('domain_id', 'participant')
    .order('updated_at', { ascending: false, nullsFirst: false })
  ```
  Owner display names: `created_by` references `auth.users`; batch-load `core_person` rows with `.in('user_id', [...unique created_by values...])` and map `preferred_name` / `first_name` / `last_name` for the Owner column.
  After the query resolves, the slice client-filters out any row where `domain_id IS NULL` OR `app_id IS NULL` as a defensive null-skip (BR-TEMPLATE-LIST).

- **Single template load.** PostgREST shape: `select('*').eq('id', templateId).single()` against `core_report_template`. The slice then calls `deserializeReportTemplateConfig` to rebuild `exploreKey`, `selected_fields`, `filters`, `sort_config`, `column_config` for the builder.

- **Execution query.** Adapter-driven; the planner produces the query plan, the adapter translates it to a Supabase select with `.limit(10000)`. The exact shape varies per selected fields, filters, and sorts.

### Query-key contract

- Field metadata: `['reports', 'field-metadata', 'participant']`.
- Templates list: `['reports', 'templates', 'team', 'participant', selectedOrganisation.id]`.
- Single template: `['reports', 'template', templateId]`.
- Execution result: not cached; ephemeral per Run.
- Org switch invalidates the templates-list key against the new org.

### Write contracts

- **Save (insert).** `useSecureSupabase().from('core_report_template').insert({ app_id: 'team', domain_id: 'participant', organisation_id: selectedOrganisation.id, created_by: currentUserId, is_private, name, description, selected_fields, filters, sort_config, column_config }).select().single()`. Success: returns the inserted row; the slice updates `activeTemplateId`, refreshes the templates list, emits `'success'`-variant toast "Template saved." Failure: emits `'destructive'`-variant toast "Could not save template. Please try again."
- **Save (update).** `useSecureSupabase().from('core_report_template').update({ is_private, name, description, selected_fields, filters, sort_config, column_config }).eq('id', activeTemplateId).select().single()`. Success: refreshes the templates list, emits `'success'`-variant toast "Template saved." Failure (including RLS rejection): emits `'destructive'`-variant toast "Could not save template. Please try again." (or the literal "Only the template creator can edit this template." on the RLS race path — see BR-OWNERSHIP).
- **Delete.** `useSecureSupabase().from('core_report_template').delete().eq('id', templateId)`. Success: emits `'success'`-variant toast "Template deleted." Failure: emits `'destructive'`-variant toast "Could not delete template. Please try again."

### RLS / permission contracts

- **`core_field_list` SELECT** is open to authenticated users via `rbac_select_core_field_list` (no org filter — catalogue is shared).
- **`core_report_template` SELECT** is permitted by `rbac_select_core_report_template`: super-admin OR creator OR `(NOT is_private AND ((event_id IS NULL AND check_user_organisation_access(organisation_id)) OR (event_id IS NOT NULL AND check_user_event_access(event_id))))`.
- **`core_report_template` INSERT** is permitted by `rbac_insert_core_report_template`: super-admin OR `check_user_organisation_access(organisation_id)`. Tighter UI gating on `canCreate` per Q-D3 narrows this to org-admin and super-admin in TEAM v1.
- **`core_report_template` UPDATE** is permitted by `rbac_update_core_report_template`: super-admin OR creator OR `check_user_is_org_admin(organisation_id)`. The UI suppresses the org-admin-override path in v1 (BR-OWNERSHIP).
- **`core_report_template` DELETE** is permitted by `rbac_delete_core_report_template`: super-admin OR creator OR `check_user_is_org_admin(organisation_id)`. The UI suppresses the org-admin-override path in v1 (BR-OWNERSHIP).
- The page guard uses canonical `pageName = 'reports'` (lower-case) and `operation = 'read'`. The post-build seeding pass renames the capitalised `Reports` row in `rbac_app_pages` to `reports` AND adds role-grant rows for `read | create | update | delete | export:page.reports` for super-admin (all five), org-admin (all five), and staff (read + export only). See §15.

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-11 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Reports"), and the `PaceAppLayout` chrome. TEAM-11 renders inside that chrome.
- No outbound handoffs to other TEAM slices in v1.

### ID contracts

- `core_report_template.id` (uuid) — used internally for load / save / delete; not exposed in URLs.
- `core_field_list` rows — keyed by `(table_name, field_name)`; the slice composes `fieldKey = '${table_name}.${field_name}'` when constructing `ReportingFieldMeta`.
- `selectedOrganisation.id` (uuid) — supplied to `ReportBuilder` as `scopeValue`; written to `core_report_template.organisation_id` on Save.
- `currentUserId` (auth.user.id) — supplied to `ReportBuilder` as `currentUserId`; written to `core_report_template.created_by` on INSERT.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_field_list` | SELECT | `useSecureSupabase()` (metadata adapter) |
| `core_report_template` | SELECT, INSERT, UPDATE, DELETE | `useSecureSupabase()` (template store adapter) |
| `core_member` | SELECT | `useSecureSupabase()` (execution adapter; explore base table) |
| `core_person` | SELECT (joined) | `useSecureSupabase()` (execution adapter; explore join + Templates panel Owner column) |
| `medi_profile` | SELECT (joined) | `useSecureSupabase()` (execution adapter; explore join, when selected fields require it) |
| `medi_condition` | SELECT (joined) | `useSecureSupabase()` (execution adapter; explore join, when selected fields require it) |

### `core_field_list` columns (live dev-db)

`table_name (text)`, `field_name (text)`, `field_type (text)`, `friendly_field_name (text)`, `field_description (text)`, `core_form_availability (boolean)`, `pump_merge_availability (boolean)`, `report_availability (boolean)`, `report_domains (text[])`, `aggregate_strategy (text)`, `aggregate_config (jsonb)`. All DB-319 columns are live on dev.

### `core_report_template` columns (live dev-db)

`id (uuid PK)`, `name (text)`, `description (text)`, `event_id (uuid, nullable)`, `organisation_id (uuid NOT NULL)`, `created_by (uuid NOT NULL)`, `is_private (boolean NOT NULL)`, `selected_fields (jsonb NOT NULL)`, `filters (jsonb NOT NULL)`, `created_at (timestamptz NOT NULL)`, `updated_at (timestamptz NOT NULL)`, `updated_by (uuid)`, `domain_id (text, nullable)`, `app_id (text, nullable)`, `sort_config (jsonb NOT NULL)`, `column_config (jsonb NOT NULL)`. All DB-319 additions are live on dev.

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `core_field_list` has rows where `report_availability = true` AND `report_domains @> ARRAY['participant']` (bare domain id). **HARD PREREQUISITE:** until the seed correction in §15 lands, this query returns zero rows on dev today (rows are tagged with explore-key strings — `'team.participant'` / `'base.participant'` — and not the bare `'participant'`). Without the re-seed, zero fields render in TEAM-11.
- Confirm `core_report_template` has `domain_id (text)` and `app_id (text)` columns and the `sort_config` / `column_config` jsonb columns.
- Confirm `core_report_template` RLS policies match the §7 RLS contract (super-admin / creator / `check_user_is_org_admin(organisation_id)` for UPDATE / DELETE; super-admin / `check_user_organisation_access(organisation_id)` for INSERT).
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Confirm an `rbac_app_pages` row exists for `page_name = 'reports'` (lower-case), `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` after the post-build seeding pass (§15).

### Domain / decision references

- `pace-core2/packages/core/docs/requirements/CR22-shared-reporting-foundations.md` — `ReportingMetadataProvider`, `ReportingExecutionAdapter`, `ReportingTemplateStore` interfaces; `ReportingExecutionRequest` / `ReportingQueryPlan` shapes; explore registration; `serializeReportTemplateConfig` / `deserializeReportTemplateConfig` semantics.
- `pace-core2/packages/core/docs/requirements/BA15-reporting_requirements.md` — BASE consumer pattern; visibility-checkbox label decision; FI-05 metadata loading expectation.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — `useResourcePermissions`; `PagePermissionGuard`; `useSecureSupabase`; canonical `pageName` / `operation` strings; `check_user_is_org_admin`; `check_user_organisation_access`.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `ReportBuilder` | `@solvera/pace-core/reporting` | Combined report-authoring surface (explore selector, fields, filters, sorts, template controls) |
| `ReportResultsTable` | `@solvera/pace-core/reporting` | Results card rendering DataTable with built-in CSV export, search, sort, pagination, column visibility |
| `getReportingExplore` | `@solvera/pace-core/reporting` | Resolve `team.participant` explore (used by metadata adapter to derive `domainId = 'participant'`) |
| `serializeReportTemplateConfig` | `@solvera/pace-core/reporting` | Split `exploreKey` into `app_id` / `domain_id` and stamp payload columns on Save |
| `deserializeReportTemplateConfig` | `@solvera/pace-core/reporting` | Rebuild `exploreKey` and payload state on Load |
| `validateReportingSelection` | `@solvera/pace-core/reporting` | Rendered internally by `ReportBuilder`; listed because the slice reasons about its six error codes in BR-VALIDATION |
| `ReportingMetadataProvider` (type) | `@solvera/pace-core/reporting` | Interface for the metadata adapter |
| `ReportingExecutionAdapter` (type) | `@solvera/pace-core/reporting` | Interface for the execution adapter |
| `ReportingTemplateStore` (type) | `@solvera/pace-core/reporting` | Interface for the template store adapter |
| `ReportingFieldMeta` (type) | `@solvera/pace-core/reporting` | Field row shape returned by metadata adapter |
| `ReportingExecutionRequest` (type) | `@solvera/pace-core/reporting` | Input shape for execution adapter |
| `ReportingExecutionData` (type) | `@solvera/pace-core/reporting` | Output shape from execution adapter (rows + totalCount + truncated) |
| `ReportingTemplateRecord` (type) | `@solvera/pace-core/reporting` | Row shape for the template store |
| `ReportingTemplateSaveInput` (type) | `@solvera/pace-core/reporting` | Save payload shape for the template store |
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client used inside all three adapters |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="reports"` `operation="read"` |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Returns `canRead | canCreate | canUpdate | canDelete | canExport | isLoading` for the `reports` resource |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useUnifiedAuth` | `@solvera/pace-core/hooks` | `user.id` for `currentUserId` and creator stamp |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for `scopeValue` and templates-list filter |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle="Reports"` on page mount |
| `Card` | `@solvera/pace-core/components` | Templates panel container |
| `CardHeader` | `@solvera/pace-core/components` | Templates panel header |
| `CardTitle` | `@solvera/pace-core/components` | Templates panel title |
| `CardContent` | `@solvera/pace-core/components` | Templates panel body |
| `DataTable` | `@solvera/pace-core/components` | Templates panel list (also used internally by `ReportResultsTable`) |
| `Alert` | `@solvera/pace-core/components` | Truncation banner; metadata / templates query error |
| `AlertTitle` | `@solvera/pace-core/components` | Title slot inside `Alert` |
| `AlertDescription` | `@solvera/pace-core/components` | Description slot inside `Alert` |
| `Button` | `@solvera/pace-core/components` | Retry button on error states |
| `LoadingSpinner` | `@solvera/pace-core/components` | Templates panel loading spinner; used by `DataTable` internally |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Delete-template confirmation |
| `toast` | `@solvera/pace-core/components` | Module-level toast for Save / Delete success / failure and the RLS-race literal copy |

### §9.2 Slice-specific caveats

- **`ReportBuilder` template UI auto-mounts when `templateStore` is provided.** Passing a `templateStore` is the only switch — there is no separate prop. Omitting `templateStore` hides the entire template control block. The slice always provides the store in v1.
- **`ReportBuilder` visibility checkbox label.** The label flips between "Private template" (when `is_private === true`) and "Event-shared template" (when `is_private === false`). TEAM is org-scoped, so the "Event-shared" label is cosmetically incorrect; it is accepted in v1 (see §17 capability item to add a `visibilityLabels` prop). The Templates panel's badge column renders TEAM's correct wording ("Org-shared" / "Private").
- **Locked-template behaviour is rendered by `ReportBuilder` itself.** When `activeTemplate.created_by !== currentUserId`, the component disables the template fields and renders the literal copy "Only the template creator can edit or delete this template." The slice does not duplicate this rendering; it does suppress the Save and Delete footer buttons via the `canCreate` / `canUpdate` / `canDelete` permission flags and the lock check.
- **`DataTable` inside `ReportResultsTable` hard-wires `rbac.pageName: 'reports'` (lower-case).** The export action's RBAC lookup runs against the `reports` page row. The post-build seeding pass MUST rename the capitalised `Reports` row in `rbac_app_pages` to `reports` lower-case AND add the role-grant rows; otherwise the export action is denied. See §15.
- **`useResourcePermissions('reports')` and `DataTable` internal RBAC lookup must agree.** Both rely on the same `pageName: 'reports'` row. The slice does not override DataTable's internal RBAC.
- **Truncation detection.** The execution adapter sets `result.truncated = (rows.length === 10000)`. The slice reads `result.truncated` to decide whether to render the truncation banner. Do not infer truncation from `result.totalCount` alone — when the adapter applies `LIMIT 10000`, no separate count query runs in v1.
- **`ConfirmationDialog` has no body slot.** The description is the entire body. Do not pass `children` — pass `title` and `description` (and `confirmLabel="Delete"`, `cancelLabel="Cancel"`, `destructive` flag) only.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **`Loader2` is not in the icons barrel.** Use `LoadingSpinner` for any spinner UI in this slice.
- **Subpath imports.** Use the published subpaths (`@solvera/pace-core/reporting`, `@solvera/pace-core/rbac`, `@solvera/pace-core/components`, `@solvera/pace-core/providers`, `@solvera/pace-core/hooks`). Do not import from internal `packages/core/src/*` paths.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/reports` | `reports` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read reports page | `read:page.reports` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Save new template | `create:page.reports` | `useResourcePermissions('reports').canCreate` | Save button hidden |
| Save update to existing template | `update:page.reports` | `useResourcePermissions('reports').canUpdate` AND creator-only lock | Save button hidden |
| Delete template (builder card) | `delete:page.reports` | `useResourcePermissions('reports').canDelete` AND creator-only lock | Delete button hidden |
| Delete template (Templates panel row action) | `delete:page.reports` | Same — plus row's `created_by === currentUserId` | Row's Delete kebab item hidden |
| CSV export from results | `export:page.reports` | `useResourcePermissions('reports').canExport` (DataTable internal lookup) | Export toolbar action hidden |

### Role × operation matrix (Q-D3)

| Role | read | create | update | delete | export |
|---|---|---|---|---|---|
| super-admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| org-admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| staff | ✓ | — | — | — | ✓ |

(Staff can read and export reports; they cannot save, update, or delete templates. Org-admins have full access. Super-admins inherit full access via the standard super-admin override.)

### Server-side enforcement

- **`core_field_list` SELECT** is enforced by RLS `rbac_select_core_field_list` (open to authenticated users via the scoped client; catalogue is shared, no org filter on the policy).
- **`core_report_template` SELECT / INSERT / UPDATE / DELETE** are enforced by the four `rbac_*_core_report_template` policies described in §7.
- The base tables read by the execution adapter (`core_member`, `core_person`, `medi_profile`, `medi_condition`) carry their own RLS policies enforced by the standard helper attributes; the adapter relies on these as the authoritative isolation layer.

### Creator-only override (deferred)

In v1, the UI is creator-only for edit / delete (BR-OWNERSHIP). RLS would permit org-admin overrides at the database layer, but the application layer suppresses that path. Org-admin UI override is captured as a §17 follow-up.

---

## §11 Acceptance criteria

- [x] **AC-01 — Page entry, authenticated, has org, has read permission.**
Given a user is authenticated, has an org, and has `read:page.reports`, when they navigate to `/reports`, then the page renders the title "Reports", the Report builder card is visible with the explore selector defaulting to "Participants — TEAM", the Templates panel is visible, and the Report results panel shows its empty state. (Traces F-01, F-03, F-04, F-32.)

- [x] **AC-02 — Field list populated from `core_field_list`.**
Given the catalogue has at least three rows tagged `report_availability = true` AND `report_domains @> ARRAY['participant']`, when the page loads, then the Fields section lists those rows in `(table_name, field_name)` order. (Traces F-24, BR-FIELD-CATALOG.)

- [ ] **AC-03 — Run report with selected fields.**
Given the user has selected at least one field and the org has at least one matching `core_member` row, when they click Run report, then the results panel shows the rows in the selected order with one column per selected field. (Traces F-33, F-41, BR-EXECUTION.)

- [x] **AC-04 — Validation alert with no fields.**
Given the user has not selected any fields, when they look at the page, then the Run report button is disabled and an `<Alert variant="default">` reads "Select at least one field — Pick fields from the list above to run a report." (Traces F-13, BR-VALIDATION.)

- [x] **AC-05 — Execution failure surfaces inline.**
Given the execution adapter rejects on Run, when the error returns, then an `<Alert variant="destructive">` appears above the results table with the normalised error message and Run re-enables. (Traces F-16, BR-EXECUTION.)

- [x] **AC-06 — Truncation banner at row cap.**
Given a Run that returns exactly 10,000 rows (the cap), when the results render, then a `<Alert variant="default">` appears above the results table with title "Result truncated" and description "Result truncated at 10,000 rows. Add filters to narrow results." (Traces F-34, F-59, BR-ROW-CAP.)

- [ ] **AC-07 — Save new template (creator).**
Given the user has selected fields and entered a template name, when they click Save, then a `'success'`-variant toast renders "Template saved.", the Templates panel includes the new row at the top of the Modified-desc list, and the builder's Load template `<Select>` includes the new row. (Traces F-42, BR-SAVE.)

- [x] **AC-08 — Save creates `app_id = 'team'` and `domain_id = 'participant'`.**
Given the user saves a new template, when the INSERT lands, then the persisted row carries `app_id = 'team'`, `domain_id = 'participant'`, `organisation_id = selectedOrganisation.id`, and `created_by = currentUserId`. (Traces F-42, BR-SAVE.)

- [ ] **AC-09 — Load template restores builder state.**
Given a saved template with three selected fields, two filters, one sort, and a description, when the user picks it from the Load template `<Select>`, then the builder's fields, filters, sorts, name, visibility, and description match the saved state. (Traces F-44, BR-SAVE.)

- [x] **AC-10 — Delete confirmation dialog copy.**
Given the user clicks Delete on a creator-owned template named "My report", when the dialog opens, then the title reads "Delete template?", the description reads "This permanently deletes the template 'My report'. This cannot be undone.", the confirm button reads "Delete" (destructive), and the cancel button reads "Cancel". (Traces F-49.)

- [x] **AC-11 — Delete success.**
Given the user confirms the delete dialog for a creator-owned template, when the DELETE succeeds, then a `'success'`-variant toast renders "Template deleted.", the Templates panel and Load `<Select>` no longer include the deleted row, the active template is cleared, and the results panel resets to its empty state. (Traces F-43, BR-DELETE.)

- [x] **AC-12 — Non-creator cannot edit (locked state).**
Given a non-private template was saved by user A, when user B (a different org-admin in the same org) loads that template, then the Template name / Visibility / Description fields are disabled, the literal caption "Only the template creator can edit or delete this template." renders, and the Save and Delete buttons in the builder card are hidden. (Traces F-29, F-55, BR-OWNERSHIP.)

- [x] **AC-13 — RLS race on edit emits literal toast.**
Given a non-creator somehow triggers a Save (e.g. a race), when the database rejects the UPDATE, then a `'destructive'`-variant toast renders with the literal copy "Only the template creator can edit this template." (Traces F-19, F-63, BR-OWNERSHIP.)

- [x] **AC-14 — Org-shared visibility badge wording.**
Given a saved template with `is_private = false`, when the Templates panel renders, then the row's Name cell shows the inline badge "Org-shared". When `is_private = true`, the badge shows "Private". (Traces F-36, BR-VISIBILITY.)

- [x] **AC-15 — Builder visibility checkbox label.**
Given the builder is in a clean state with `is_private = true`, when the user looks at the Visibility checkbox, then the label reads "Private template". When the user unchecks it, the label flips to "Event-shared template" (the pace-core2 literal label, accepted in v1). (Traces F-28, BR-VISIBILITY, §17 capability item.)

- [ ] **AC-16 — CSV export downloads `export.csv`.**
Given the user has run a report and `canExport === true`, when they click Export in the results toolbar, then a file named `export.csv` downloads containing the visible rows in their visible-column order. (Traces F-45, BR-EXPORT.)

- [ ] **AC-17 — Export hidden when `canExport === false`.**
Given the user has `canExport === false`, when they look at the results toolbar, then the Export action is not visible. (Traces F-54, BR-EXPORT.)

- [x] **AC-18 — Save hidden when `canCreate === false` AND `canUpdate === false`.**
Given the user has `canCreate === false` AND `canUpdate === false`, when they look at the builder card footer, then the Save button is not visible. (Traces F-52.)

- [x] **AC-19 — Delete hidden when `canDelete === false`.**
Given the user has `canDelete === false`, when they load any template, then the Delete button in the builder card is hidden and the Templates panel kebab menu does not show Delete on any row. (Traces F-53.)

- [x] **AC-20 — Empty catalogue empty state.**
Given the metadata query returns zero rows, when the page renders, then the Fields section shows "No fields available for this explore. Contact your administrator." and Run is disabled. (Traces F-11, F-60, BR-EMPTY-CATALOG.)

- [x] **AC-21 — Empty templates list empty state.**
Given the org has zero templates, when the page renders, then the Templates panel body shows "No saved templates yet." and the Load template `<Select>` shows only the placeholder "Select template…". (Traces F-12.)

- [ ] **AC-22 — Permission denied (read).**
Given a user is authenticated and has org context but lacks `read:page.reports`, when they navigate to `/reports`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside the `AuthenticatedShell` chrome and no builder, results, or templates panel renders. (Traces F-20, F-51.)

- [ ] **AC-23 — Org switch resets builder, templates, and results.**
Given the user is on `/reports` for org A with selected fields and a result set, when they switch the org context to org B, then the metadata refetches against org B, the templates list refetches against org B, the active template clears, and the results panel returns to its pre-Run empty state. (Traces F-58, BR-ORG-SWITCH.)

- [x] **AC-24 — Defensive null skip in templates list.**
Given a row exists in `core_report_template` for the current org with `app_id = NULL` (orphan), when the Templates panel renders, then that row does not appear in the list. (Traces F-40, BR-TEMPLATE-LIST.)

- [x] **AC-25 — Cross-org template invisibility.**
Given templates exist for org B but the user is signed in with org A selected, when the Templates panel queries, then no org-B template row is returned regardless of search input. (Traces F-64, BR-SCOPE.)

---

## §12 Verification

- **MCP test — `core_field_list` re-seed.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), confirm at least one row exists with `report_availability = true` AND `report_domains @> ARRAY['participant']` (bare domain id). If zero rows match, the §15 prerequisite has not landed and the slice cannot render fields.
- **MCP test — `core_report_template` columns.** Confirm `domain_id`, `app_id`, `sort_config`, `column_config` are present.
- **MCP test — RLS authority.** As a user with org-admin access on org A, run a SELECT on `core_report_template` without an `organisation_id` filter; confirm only org A rows return. Repeat with the slice's defensive `organisation_id = :orgA` filter and confirm the same row set.
- **MCP test — `rbac_app_pages` lower-case row.** Confirm a row exists for `page_name = 'reports'` (lower-case), `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` after the post-build seeding pass.
- **MCP test — role-grant rows.** Confirm `rbac_page_permissions` rows exist for super-admin (read|create|update|delete|export), org-admin (read|create|update|delete|export), and staff (read|export only) on the `reports` page for the TEAM app.
- **In-app demo flow — happy path.** Sign in as a TEAM org-admin. Visit `/reports`. Pick three fields. Click Run report. Confirm the results table shows rows. Save the configuration as "Demo report", visibility "Private". Confirm the Templates panel shows the row with Owner "You" and badge "Private".
- **In-app demo flow — load and update.** Reload the page. From the Templates panel, click the "Demo report" row. Confirm the builder restores fields. Modify the description. Click Save. Confirm a `'success'`-variant toast and the Modified column updates.
- **In-app demo flow — non-creator lock.** Sign in as a different org-admin in the same org. Load "Demo report" (assuming it was saved as `is_private = false`). Confirm the locked caption renders, Save and Delete are hidden, and the form fields are disabled.
- **In-app demo flow — delete.** Sign in as the creator. Load "Demo report". Click Delete. Confirm the dialog title "Delete template?" and description "This permanently deletes the template 'Demo report'. This cannot be undone." Click Delete. Confirm `'success'`-variant toast and the row disappears from the Templates panel.
- **In-app demo flow — CSV export.** Run a report. Click Export. Confirm `export.csv` downloads with the visible columns.
- **In-app demo flow — truncation banner.** Stage a fixture with > 10,000 matching rows. Run a report with a wide selection. Confirm the truncation banner renders with the exact copy.
- **In-app demo flow — empty catalogue.** Temporarily filter the metadata adapter to return zero rows. Confirm the "No fields available" copy and disabled Run.
- **In-app demo flow — permission denied.** Sign in as a user without `read:page.reports`. Visit `/reports`. Confirm `<AccessDenied />` renders.

---

## §13 Testing requirements

- Unit / integration tests covering the metadata adapter's `report_domains @> ARRAY['participant']` filter against fixture rows.
- Unit / integration tests covering the execution adapter's `LIMIT 10000` application and the `truncated` flag propagation.
- Component test that asserts the Templates panel skips rows with `domain_id IS NULL` or `app_id IS NULL`.
- Component test that asserts the locked state hides Save / Delete in the builder card and the Templates panel kebab Delete row action when `created_by !== currentUserId`.
- Component test that asserts the truncation banner copy renders verbatim when `result.truncated === true`.
- Component test that asserts the delete confirmation dialog uses the literal title / description / button labels per §5 and F-49.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads and writes go via `useSecureSupabase()`. Do not call `createClient` directly. Do not bypass scoped RBAC.
- The metadata adapter filter MUST use the bare domain id (`'participant'`), resolved via `getReportingExplore('team.participant').domainId`. Do not filter on the explore key string.
- The execution adapter MUST apply `LIMIT 10000` to every query and set `result.truncated = (rows.length === 10000)`.
- Do not author the `core_field_list` re-seed or any `BASE` patch from inside this slice — those are upstream platform / data-curation work (§15).
- Do not author the post-build `rbac_app_pages` rename or role-grant seeding from inside this slice — that is the post-build seeding pass (§15).
- Do not introduce a TEAM-local CSV export wrapper — DataTable's built-in `features.export = true` is the entire export path.
- Do not introduce a TEAM-side PII / sensitive-column allowlist — catalogue ownership is the data platform's.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published subpaths only.
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.

---

## §15 Done criteria

- All 25 acceptance criteria (AC-01 through AC-25) verified via the slice's QA pack.
- **Implementation blocked until:**
  - **(a)** `core_field_list.report_domains` rows are re-seeded to use bare domain values only (`['participant']`, etc.) — explore-key tagging (`'team.participant'` / `'base.participant'`) is removed. **HARD PREREQUISITE; without this, zero fields render in TEAM-11.**
  - **(b)** BA15 (BASE) is verified to still work end-to-end after the re-seed (BASE may need patching if it has any explore-key-specific filtering).
  - **(c)** The canonical TEAM `metadataProvider` filters on `explore.domainId` (bare `'participant'`), matching the validator.
  The v6 slice does not author the data fix or the BASE patch. The data fix is platform-DB / data-curation work.
- **Post-build seeding pass:** the capitalised `rbac_app_pages.Reports` row for the TEAM app is renamed to lower-case `reports`, AND role-grant rows are added on `rbac_page_permissions` for `read | create | update | delete | export:page.reports` for the org-admin role template (all five) and the staff role template (`read + export` only). Super-admin inherits via the standard super-admin override.
- **Verification:** the metadata adapter returns at least one `ReportingFieldMeta` row for `team.participant` against dev-db; a Save / Load / Delete cycle round-trips a creator-owned template; CSV export downloads `export.csv` for a creator with `canExport === true`; the truncation banner renders verbatim when the cap is hit; the locked state hides Save / Delete for a non-creator viewing a shared template.

---

## §16 Do not

- Do not author a TEAM-local allowlist of fields for PII / sensitive-column gating. Catalogue ownership lies with the data platform; gating decisions live there. (Q-D6.)
- Do not author an org-admin UI override of creator-only edit / delete in v1. The application layer is creator-only; org-admin override is deferred. (Q-D5; §17.)
- Do not introduce a TEAM-local CSV export wrapper. DataTable's built-in `features.export = true` is the whole export surface; the filename is `export.csv`. (Q-PC2.)
- Do not fork shared `ReportBuilder` to override the visibility checkbox label. TEAM passes `visibilityLabels` (`Private template` / `Event-shared template`) and `sharedTemplateBadgeLabel` (`Org-shared`) per AC-14 / AC-15. (Q-V1 delivered in v1.)
- Do not invent a "successor explore id" pattern. v6 declares `team.participant` exclusively. (Q-DEF-1.)
- Do not present report results BASE-table-first. Results are member-anchored via the `team.participant` explore on `core_member`.
- Do not use the `team_unit` legacy construct anywhere in this slice.
- Do not author the `core_field_list` re-seed from inside this slice. It is platform-DB / data-curation work (§15).
- Do not author the post-build `rbac_app_pages` rename or role-grant seeding from inside this slice. It is the post-build seeding pass (§15).
- Do not introduce other explores (BASE, MEDI, PUMP) — TEAM v1 exposes only `team.participant`.
- Do not introduce XLSX or async export. v1 is browser-side CSV only.
- Do not introduce a TEAM-local row-count query or an async total-count check. The execution adapter sets `truncated` from `rows.length === 10000`.
- Do not introduce sticky toolbars, sticky banners, or drawers in this slice.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; reporting scope boundaries.
- `/rebuild/architecture.md` — slice ownership, route registry (`/reports`), canonical `pageName` map (`reports`), provider stack, dependency table.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Reports entry), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`** so any descendant route (including this slice) can call `toast(...)`. TEAM-11 depends on this mount; without it, `toast(...)` throws.
- `pace-core2/packages/core/docs/requirements/CR22-shared-reporting-foundations.md` — `ReportingMetadataProvider`, `ReportingExecutionAdapter`, `ReportingTemplateStore` interfaces; `ReportingExecutionRequest` / `ReportingQueryPlan` shapes; explore registration (`team.participant`); `serializeReportTemplateConfig` / `deserializeReportTemplateConfig` semantics.
- `pace-core2/packages/core/docs/requirements/BA15-reporting_requirements.md` — BASE consumer pattern; the TEAM slice mirrors this with `organisation_id` scope and the org-shared wording delta in the Templates panel badge column.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API; `pageName` + `operation`; no `scope` prop at page level.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `useResourcePermissions`; `useSecureSupabase`; `check_user_is_org_admin`; `check_user_organisation_access`.

### Platform / capability items captured during authoring

1. **`core_field_list.report_domains` re-seed (HARD PREREQUISITE).** Re-seed report-eligible rows to tag by bare domain id (`['participant']`, `['organisation']`, etc.), removing explore-key tagging (`'team.participant'`, `'base.participant'`). Verify BA15 (BASE) end-to-end after the re-seed and patch BASE if any explore-key-specific filtering exists. Without this, zero fields render in TEAM-11. Tracked via §15.
2. **Post-build `rbac_app_pages` rename + role-grant seeding.** Rename the capitalised `Reports` row for the TEAM app in `rbac_app_pages` to lower-case `reports`. Add `rbac_page_permissions` rows on `read | create | update | delete | export:page.reports` for org-admin (all five) and staff (`read + export` only). Super-admin inherits. Tracked via §15.
3. **pace-core2 `ReportBuilder` `visibilityLabels` prop (capability item, non-blocking).** Add a `visibilityLabels?: { private: string; shared: string }` prop to `ReportBuilder` so consumer apps can override the visibility checkbox label. TEAM would pass `{ private: 'Private template', shared: 'Org-shared template' }`. Until the prop ships, TEAM accepts the literal "Event-shared template" string in the builder card while the Templates panel badge column displays TEAM's correct wording.
4. **Org-admin UI override of creator-only edit / delete (capability item, non-blocking).** v1 is creator-only at the application layer (matches BA15). A follow-up slice could surface an org-admin UI override path that respects the live RLS policy. Until then, org-admins who need to edit / delete a non-owned template can do so via the database layer; the UI does not surface that path.
