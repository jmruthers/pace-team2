# TEAM-12 — Profile photo moderation

## §1 Slice metadata

```
Slice ID:        TEAM-12
Name:            Profile photo moderation
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems, no-org empty state); upstream platform work (RBAC-checked SELECT and DELETE policies on core_file_references; recommended data_moderation_photo_list(p_organisation_id uuid) RPC) — see §15
Backend impact:  Schema changes (upstream platform: RBAC-checked SELECT + DELETE RLS policies on core_file_references; recommended data_moderation_photo_list RPC). The slice does not author the migration.
Frontend impact: UI
Routes owned:    /moderation/photos
QA pack:         docs/test-packs/TM12-qa-pack.md
```

---

## §2 Overview

TEAM-12 delivers the profile-photo moderation surface at `/moderation/photos` for the TEAM app. Authenticated moderators see a paginated DataTable of profile photos already attached to `core_person` rows of members in the currently selected organisation, can preview a larger version of a photo in a dialog, and can permanently remove a photo (file plus metadata) via a destructive row action with confirmation. Moderation is **reactive** — photos are reviewed after they are live in the platform; this slice does not own profile-photo upload, member display surfaces, or any approval queue. Removal goes through the canonical pace-core2 helper `deleteAttachment`, which atomically deletes the storage object and the metadata row. The slice depends on TEAM-01 for the app shell and the toast context, and on upstream platform work for RBAC-checked SELECT and DELETE policies on `core_file_references` plus a recommended read-side RPC (see §15).

- **Prototype reference:** **None** — the pace-team prototype kit has no photo-moderation screen. Layout for pass 2 is derived from this requirement prose and the existing DataTable spec in §5 only.

---

## §3 What this slice delivers

### Purpose

TEAM-12 lets moderators in an organisation review profile photos already in use by members of that organisation and permanently remove any photo that should not be displayed. The outcome is that organisation moderators have a single dedicated screen where they can triage and remove inappropriate or out-of-date profile photos without touching the member directory or the upload pathway.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Photo moderation list page | `/moderation/photos` | DataTable of profile photos for `core_person` rows of members in the current organisation, with a thumbnail column, row metadata, and a row-level Remove action |
| Photo preview dialog | *(modal overlay on the list page)* | `Dialog` showing a larger preview of a selected photo, member name, uploaded date / by, file size / type, public flag, and category |
| Confirm Remove dialog | *(modal overlay on the list page)* | `ConfirmationDialog` with a destructive Confirm button gating the permanent delete |

### Boundaries

TEAM-12 does **not** own:
- Profile-photo upload — uploads happen via Portal (or another consumer app); the moderation surface is read + delete only.
- Profile-photo display in member directories or member 360 — those surfaces consume `core_file_references` independently.
- An approval queue or pre-publication state — moderation is reactive only.
- Hide / soft-deactivate / Reactivate verbs — Remove is the sole destructive verb in v1.
- Internal moderator notes, moderation audit history visible in TEAM, member or guardian email notifications, re-upload prompts, appeals workflow — all deferred.
- Authoring the RLS policies or the read-side RPC — both are upstream platform work and gate Done (see §15).
- Storage-bucket policy authoring — buckets `files` and `public-files` are platform-managed.
- The "no organisation selected" empty state — handled at the shell level by TEAM-01.

### Architectural posture

**Read contract.** The list is loaded by calling `data_moderation_photo_list(p_organisation_id uuid)` via `useSecureSupabase().rpc(...)`. The RPC encapsulates the join (`core_file_references.table_name = 'core_person'` → `core_person.id` → `core_member.organisation_id`) and the read-permission check. There is no `app_id` filter in v1 — all profile photos for `core_person`-pointed members of the current organisation are in scope regardless of which app uploaded them.

**Authority enforcement (server-side).** Reads are gated by an RBAC-checked SELECT policy on `core_file_references` for `read:page.moderation-photos`; deletes are gated by an RBAC-checked DELETE policy for `delete:page.moderation-photos`. Both policies match the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` and use `data_check_rbac_permission_with_context(<op>, 'moderation-photos', <organisation_id resolved from the target person's org>, NULL, data_get_app_id('TEAM'))`. The slice never authors these policies; they are upstream platform work and gate Done.

**Mutation contract.** The Remove action calls `deleteAttachment` from `@solvera/pace-core/crud` with `secureClient: useSecureSupabase()`, `metadataId: row.id`, `filePath: row.file_path`, and an adapter `{ metadataTable: 'core_file_references', storageBucket: row.is_public ? 'public-files' : 'files' }`. The helper removes the storage object first, then deletes the metadata row. The slice uses the helper's default `continueOnStorageFailure` semantics — if the storage delete fails, the metadata row is preserved and a destructive toast surfaces.

**Storage URL discipline.** Thumbnails and preview images are resolved via `useFileDisplay` from `@solvera/pace-core/hooks`, which signs URLs for `is_public = false` rows (1 hour TTL, cached for 50 minutes by `id`) and uses public URLs for `is_public = true` rows. The slice never constructs storage URLs by hand and never exposes `file_path` to the user.

**Route read access.**

> **Route read access:** Enforced by the app authenticated shell / PaceAppLayout `routeAccessDenied` and [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts). The page component must not wrap content in an outer `PagePermissionGuard operation="read"` unless this slice explicitly requires a **scoped read** override (`scope={{ organisationId, eventId, appId }}`).


**RBAC visibility gating.** The row Remove action is conditioned on `useResourcePermissions('moderation-photos').canDelete`. When the permission is `false`, the action is hidden — the slice never renders an affordance that would always fail authorisation.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget success and network-failure notifications. `ToastProvider` is mounted by TEAM-01 in `AuthenticatedShell`; this slice does not mount it.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere.

### Page-level guards and evaluation ordering

The route `/moderation/photos` sits inside `AuthenticatedShell` (TEAM-01) registers read access in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts); shell `routeAccessDenied` enforces entry. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires before any guard. An unauthenticated user is redirected to `/login` and never reaches the org check or the guard.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; no feature content or guard is shown.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state. shell route read is not evaluated; no RBAC query fires.
4. **Route read access** — Once org context is resolved, shell `routeAccessDenied` (via [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts)) evaluates the route's registered `pageName` / `read` permission. Scope resolves internally from `OrganisationServiceProvider`; no page-level read guard wraps the component tree. While the shell RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable. On deny, `<AccessDenied />` renders in the shell main region. On allow, the page body renders.

If `selectedOrganisation` becomes null after the guard would otherwise evaluate (race condition), the RBAC engine evaluates with `organisationId: undefined`; the check returns pending and the guard returns `null`. In practice, the no-org check at step 3 prevents this path under normal conditions. With partially-undefined scope (e.g. event id absent — not applicable to TEAM but stated for completeness), the guard treats the missing field as "not required" and evaluates the page-level `pageName` + `operation` against the `organisationId` only.

---

## §4 Functional specification

### Page entry / surface entry

- **Route:** `/moderation/photos`. Reachable from the top-level Moderation nav item defined by TEAM-01 (`Moderation → /moderation/photos`).
- **Initial fetch:** the page calls `data_moderation_photo_list(p_organisation_id: selectedOrganisation.id)` and renders the returned list of profile-photo rows.
- **Page title:** "Photo moderation" (sentence case). Print title set to "Photo moderation" via `usePaceMain({ printTitle: 'Photo moderation' })`.
- **No breadcrumb.** The page renders inside the standard authenticated shell chrome (header, PaceMain, footer).

### Loading states

- **List loading** — while the RPC is in flight, the DataTable shows its built-in loading state: a Card → Table → TableCaption (with title "Profile photos") → a single full-width row containing `<LoadingSpinner label="Loading photos" />`. No row actions render during loading.
- **Permission check in flight** — `PagePermissionGuard` returns `null`; a brief blank inside PaceMain is acceptable.
- **Thumbnail resolving** — each row's thumbnail cell shows `<LoadingSpinner label="Loading thumbnail" />` (size `sm`) until `useFileDisplay` resolves a URL. Once resolved, the spinner is replaced by an `<img>` constrained to a 48 × 48 px square with `object-fit: cover`. If `useFileDisplay` returns `error`, the cell falls back to a small `Badge` with text "Image unavailable" (variant `destructive` outline).
- **Remove in flight** — the confirm dialog's Remove button shows a spinner and is disabled. The Cancel button remains enabled.

### Empty states

- **No photos to review** — when the RPC returns zero rows: the DataTable body shows an empty placeholder with title "No profile photos to review." and description "New photos appear here as members upload them through Portal." No CTA is rendered. The toolbar search and filters remain visible (DataTable default).

### Error states

- **List load failure** — on RPC error, the DataTable body renders an inline `Alert` (variant `destructive`) replacing the table rows, with title "Could not load profile photos." and description set to the normalised error message via `NormalizeSupabaseError`. A "Retry" button (outline variant) re-runs the RPC.
- **Thumbnail / preview URL failure** — see Loading states (Thumbnail resolving) for the cell-level fallback. The preview dialog shows the same `Alert` (variant `destructive`) inside the dialog body when `useFileDisplay` returns `error` for the preview-size URL: title "Could not load preview." description matches the error message; the Remove action remains enabled (Removal does not depend on a resolved URL).
- **Remove failure (storage delete failed)** — caught by the confirm-dialog's submit handler when `deleteAttachment` returns `{ ok: false, error: { code: 'ATTACHMENT_STORAGE_DELETE_FAILED', message } }`. Surfaced as a destructive `toast({ variant: 'destructive', title: 'Could not remove photo', description: <message> })`. The confirm dialog stays open. The list is not modified.
- **Remove failure (metadata delete failed)** — same handler, same toast pattern, when the helper returns `ATTACHMENT_METADATA_DELETE_FAILED`. The dialog stays open. Because the storage object has already been removed by the helper, the row will fail any future preview attempts; a manual retry of Remove is the operator action — the helper will return `ATTACHMENT_METADATA_DELETE_FAILED` again until the metadata row is deleted, at which point the row leaves the list.
- **Remove failure (other helper error)** — same toast pattern for codes `ATTACHMENT_DELETE_ERROR`, `ATTACHMENT_STORAGE_UNAVAILABLE`, or `ATTACHMENT_METADATA_DELETE_UNAVAILABLE`. The dialog stays open.
- **Permission denied on page entry** — `PagePermissionGuard` renders `<AccessDenied />` ("You do not have permission to view this page.") inside PaceMain. Header and footer remain visible.

### Primary content

The list is rendered as a DataTable wrapped in a `Card`. Columns, in this order:

1. **Thumbnail** — narrow column. Renders a 48 × 48 px square `<img>` with the resolved thumbnail URL (signed when `is_public = false`, public when `is_public = true`). Cell click opens the Preview dialog for that row. Not sortable. Not filterable.
2. **Member** — `core_person.display_name` (resolved server-side by the read RPC). When TEAM-03 Member 360 is available, the cell renders as a `Link` to `/members/<core_person.id>` (or the canonical TEAM-03 route at the time of build); otherwise the cell renders as plain text. Sortable, filterable (text). Default sort: ascending.
3. **Uploaded** — `created_at`, formatted as `dd MMM yyyy` (e.g. "04 May 2026"). Sortable, filterable (date range).
4. **Uploaded by** — `created_by` resolved to a user display name (returned by the read RPC). Plain text. Sortable, filterable (text). When `created_by` is null, render an em dash ("—").
5. **File size** — `file_metadata.fileSize` formatted as a human-readable size (`123 KB`, `4.5 MB`); when absent, render an em dash. Sortable.
6. **File type** — `file_metadata.fileType` (e.g. "image/jpeg"). Plain text. Sortable, filterable (text).
7. **Public** — derived from `is_public`. Renders a `Badge` with variant `success` and text "Public" when `is_public === true`, or variant `secondary` and text "Private" when `false`. Sortable, filterable (boolean filter mapping `Public → true`, `Private → false`).
8. **Category** — `file_metadata.category` (e.g. "profile_photo"). Plain text; em dash when absent. Sortable, filterable (text).
9. **Actions** — row-action column rendered by the DataTable on the right of each row, containing the Remove action (subject to `canDelete`).

The toolbar contains:
- A search input (DataTable default), filtering across the **Member**, **Uploaded by**, and **File type** text columns.
- A Filters toggle (DataTable default), exposing the per-column filter row.
- A Columns settings affordance (DataTable default).

The DataTable's built-in Create / Edit / Delete / Import / Export affordances are not used (`features.creation: false`, `features.deletion: false`, `features.import: false`, `features.export: false`).

### Primary actions

**Row "Remove" action**
- Visible only when `useResourcePermissions('moderation-photos').canDelete === true`.
- Click opens the Confirm Remove dialog. Dialog title: "Remove this photo?". Dialog body: "This will permanently delete the photo and the underlying file. This cannot be undone." Dialog buttons: Cancel (outline) on the left, Remove (destructive variant) on the right.
- On confirm: the slice calls `deleteAttachment({ secureClient: useSecureSupabase(), adapter: { metadataTable: 'core_file_references', storageBucket: row.is_public ? 'public-files' : 'files' }, metadataId: row.id, filePath: row.file_path })`.
- On `{ ok: true }`: the dialog closes, the row is removed from the in-memory list (no re-fetch required for v1), and `toast({ variant: 'success', title: 'Photo removed.' })` fires.
- On `{ ok: false, error }`: the dialog stays open; the destructive toast described in §4 Error states fires.

**Thumbnail click (cell)**
- Opens the Preview dialog for that row. The preview dialog shows the same image at a larger size (max-width 80% of the viewport, max-height 80% of the viewport, preserving aspect ratio), the member display name as the dialog title, and a metadata block listing Uploaded date, Uploaded by, File size, File type, Public flag, and Category. The dialog also exposes the Remove action when `canDelete === true` — the same destructive button described above, opening the Confirm Remove dialog over the Preview dialog. Cancel (outline) closes the Preview dialog without changing the list.

### Secondary actions

- **Search** — DataTable global search input filters rows by substring match against the **Member**, **Uploaded by**, and **File type** columns (case-insensitive).
- **Per-column filters** — Filters toggle reveals per-column filter row. Member and Uploaded by expose text filters; Uploaded exposes a date-range filter; File type and Category expose text filters; Public exposes a boolean filter (Public / Private).
- **Sort** — Member, Uploaded, Uploaded by, File size, File type, Public, and Category columns are sortable. Default sort: Member ascending.
- **Pagination** — DataTable footer renders Chevron pagination + a page-size Select. `initialPageSize: 25`; page-size options `[10, 25, 50]`.
- **Columns settings** — DataTable's Columns affordance allows the user to hide / show columns and reorder them. State is local to the page.

### Permission-conditional rendering

| Capability | Permission | When `false` |
|------------|-----------|--------------|
| Page entry | `read:page.moderation-photos` | `<AccessDenied />` is rendered inside PaceMain |
| Row "Remove" action | `delete:page.moderation-photos` | Action is hidden from the row's action menu and from the Preview dialog footer |
| Preview dialog open | (always available to readers) | n/a — the Preview dialog is read-only and opens whenever the user has page read |

### Navigation

- The page is reachable from the Moderation top-level nav item defined in TEAM-01 (`Moderation`, `href: /moderation/photos`, icon `Shield`).
- The slice does not navigate anywhere on Remove success — the URL stays at `/moderation/photos` and the list updates in place.
- The Member column may navigate to `/members/<core_person.id>` (TEAM-03 Member 360) when that route is in service. This is the only outbound navigation from the page.
- The slice does not call `switchOrganisation()`; removing a photo never moves the user out of the current org context.
- An unmatched route under `/moderation/<anything>` falls through to the TEAM-01 `*` NotFound page.

### Edge cases and constraints

- **Org-context switch while a dialog is open** — switching the current organisation (via the header org selector) refreshes the list against the new org and silently closes any open Preview or Confirm Remove dialog. A `toast({ variant: 'default', title: 'Editing cancelled — organisation changed.' })` is fired.
- **Concurrent removals** — if two moderators in the same org attempt to remove the same photo, the second `deleteAttachment` call returns `ATTACHMENT_METADATA_DELETE_FAILED` (or `ATTACHMENT_STORAGE_DELETE_FAILED` if the storage object is already gone). The destructive toast surfaces; refreshing the list (next org-switch or page revisit) drops the row.
- **`is_public` flip after page load** — the slice resolves the bucket per row at Remove time using the row's `is_public` value as it was loaded into the table. If the underlying record was changed in another tab between load and Remove, the helper may surface a storage-not-found error; the destructive toast handles this.
- **Audit columns** — `created_at`, `created_by`, `updated_at`, `updated_by` on `core_file_references` are populated server-side. The UI never patches them.
- **No app_id filter in v1** — every profile-photo row pointed at a member of the current org appears in the table regardless of which app uploaded it. There is no filter affordance to scope by uploading app.

---

## §5 Visual specification

### Layout

The page renders inside the standard authenticated shell chrome (header, PaceMain content area, footer) provided by TEAM-01. Within PaceMain:

- **Page title row** — "Photo moderation" rendered as the page heading at the top of the PaceMain content area. No subtitle, no breadcrumb.
- **Content card** — a single `Card` containing the DataTable. The Card header (`CardHeader`) holds the DataTable's title row ("Profile photos").
- **DataTable** — fills the Card body. Footer pagination renders below the table.
- **Preview dialog** — overlay `Dialog` portalled to `document.body`. Modal centred. Dim background behind. Focus trapped inside the dialog; native escape closes it. Max-width 80% of viewport, max-height 80% of viewport.
- **Confirm Remove dialog** — overlay `Dialog` (rendered by `ConfirmationDialog`) portalled to `document.body`. Centred, smaller fixed width (~ 28 rem). Stacks above the Preview dialog when both are open.

Breakpoints:
- Desktop (≥ 1024px): full Card width within PaceMain's `max-w-(--app-width)`.
- Tablet (768–1023px): same Card; DataTable's horizontal scroll handles narrow columns; the Preview dialog continues to honour the 80% / 80% viewport caps.
- Mobile (< 768px): the Card spans full available width; the DataTable's body scrolls horizontally inside the Card; the Preview dialog scales to 95% / 95% of viewport.

Sticky elements: the shell header and footer are sticky per TEAM-01's `PaceAppLayout` defaults. The DataTable's header row is not separately sticky beyond DataTable defaults.

### Components

> **Badge variants (pace-core):** §5 tables use illustrative labels (`success`, `secondary`, `destructive` outline). In TEAM, use pace-core `Badge` tokens only — e.g. `soft-main-normal` / `soft-sec-normal` for Public / Private, `outline-acc-normal` for thumbnail errors.

**Card (page content wrapper)**
- `Card` from `@solvera/pace-core/components`, rendering `<article>` with rounded border + shadow per pace-core2 visual standards.
- `CardHeader` contains `CardTitle` "Profile photos". No description.
- `CardContent` contains the DataTable body.

**DataTable**
- Source: `@solvera/pace-core/components`.
- `rbac={{ pageName: 'moderation-photos' }}`.
- `title="Profile photos"`. `description` not set.
- `data` — array of row objects returned by `data_moderation_photo_list`.
- `columns` (in render order):
  | id | header | accessorKey | sortable | filterable | filterType | width hint | cell |
  |----|--------|-------------|----------|------------|------------|-----------|------|
  | `thumbnail` | `"Photo"` | (n/a — derived) | no | no | n/a | narrow (~ 60 px) | renders a 48 × 48 px `<img>` with `object-fit: cover` and `border-radius: 6px`; URL resolved by `useFileDisplay`; cell click opens the Preview dialog. While the URL is resolving, renders `<LoadingSpinner label="Loading thumbnail" size="sm" />`. On error, renders a `Badge` with variant `destructive` outline and text "Image unavailable". |
  | `member_display_name` | `"Member"` | `member_display_name` | yes (default sort asc) | text | text | flexible (wide) | renders a `Link` to `/members/<core_person_id>` when the TEAM-03 route is in service, with the display name as the visible text; otherwise renders the display name as plain text |
  | `created_at` | `"Uploaded"` | `created_at` | yes | yes | date-range | mid | renders the date as `dd MMM yyyy` (e.g. "04 May 2026") |
  | `created_by_display_name` | `"Uploaded by"` | `created_by_display_name` | yes | yes | text | mid | renders the display name as plain text; renders an em dash ("—") when null |
  | `file_size` | `"File size"` | `file_metadata.fileSize` | yes | no | n/a | narrow | renders the size in human-readable form (`123 KB`, `4.5 MB`); renders an em dash when absent |
  | `file_type` | `"File type"` | `file_metadata.fileType` | yes | yes | text | narrow | renders the MIME type as plain text |
  | `is_public` | `"Public"` | `is_public` | yes | yes | boolean | narrow | renders a `Badge` with variant `success` and text "Public" when true; variant `secondary` and text "Private" when false |
  | `category` | `"Category"` | `file_metadata.category` | yes | yes | text | narrow | renders the category as plain text; renders an em dash when absent |
  | (actions column — DataTable injected) | (n/a — DataTable label) | n/a | n/a | n/a | n/a | narrow, right-aligned | row-action menu containing the Remove action when `canDelete === true` |
- `features={{ creation: false, deletion: false, import: false, export: false }}`. `editing` is left at its default (`true`) so that the row-action menu is shown; `onEditRow` is NOT supplied (the slice uses the `actions` array instead).
- `actions` — single entry: Remove. Each row's Remove click opens the Confirm Remove dialog for that row.
- `initialPageSize: 25`; page-size options `[10, 25, 50]` (DataTable default).
- `initialSorting: [{ id: 'member_display_name', desc: false }]`.
- `emptyState: { title: 'No profile photos to review.', description: 'New photos appear here as members upload them through Portal.' }`.
- `isLoading` — bound to the RPC's loading state.
- `getRowId: row => row.id`.

**Thumbnail cell (visual detail)**
- 48 × 48 px square, 6 px border-radius, 1 px subtle border (`border` token). `object-fit: cover` ensures the image fills the square without distortion.
- Cursor `pointer` on hover; on hover the cell shows a subtle outline (`ring-2 ring-(--ring)`).
- Click target is the entire cell, not just the image.

**Preview dialog**
- `Dialog` + `DialogPortal` + `DialogContent` + `DialogHeader` + `DialogTitle` (member display name) + `DialogBody` + `DialogFooter`.
- `DialogContent` sized to `max-w-[80vw] max-h-[80vh]`; body is scrollable when content overflows.
- Body layout: a centred `<img>` at the top constrained to `max-w-full max-h-[60vh]` with `object-fit: contain`, rendered with the resolved preview URL from `useFileDisplay` (signed for `is_public = false`, public for `is_public = true`). Below the image, a definition list (`dl`) shows:
  - "Uploaded" → `created_at` formatted as `dd MMM yyyy HH:mm` (e.g. "04 May 2026 14:32").
  - "Uploaded by" → `created_by_display_name` or em dash.
  - "File size" → human-readable size or em dash.
  - "File type" → MIME type.
  - "Public" → "Public" or "Private" (matching the column badge text but rendered as plain text inside the dialog body).
  - "Category" → category text or em dash.
  - "Storage path id" → `id` of the file_reference row, rendered as small monospace text. (`file_path` itself is never shown.)
- An `Alert` (variant `destructive`) at the top of the body, rendered only when `useFileDisplay` returns an error. Title: "Could not load preview." Description: the error message.
- Footer: a right-aligned button group: Close (outline variant) on the left, "Remove" (destructive variant) on the right. The Remove button is rendered only when `useResourcePermissions('moderation-photos').canDelete === true`. Clicking Remove opens the Confirm Remove dialog above the Preview dialog (the Preview dialog stays open behind it).
- Close behaviour: native escape closes the dialog (DialogContent default). Close button closes the dialog. The Preview dialog also closes when the org context changes (BR-13).
- Focus management: DialogContent auto-focuses the Close button on open (the safest target — no destructive default focus).

**Confirm Remove dialog**
- `ConfirmationDialog` from `@solvera/pace-core/components`.
- Title: "Remove this photo?".
- Body: "This will permanently delete the photo and the underlying file. This cannot be undone."
- Cancel button (outline variant): label "Cancel".
- Confirm button (destructive variant): label "Remove". When the mutation is in flight the button shows a spinner and is disabled; Cancel remains enabled.
- Close behaviour: native escape closes the dialog. Cancel button closes. Successful confirm closes. Failed confirm leaves the dialog open with a destructive toast.
- Focus management: the dialog auto-focuses the Cancel button on open (safer default than Confirm for destructive actions).

**Toast notifications**
- Surfaced via `toast()` from `@solvera/pace-core/components`. The provider (`ToastProvider`) is mounted by TEAM-01 in `AuthenticatedShell` and renders `<Toaster />` internally.
- Notifications appear as an `aside[role="region"][aria-label="Notifications"]` overlay anchored to the bottom-right of the viewport. Default duration 5000 ms.
- TEAM-12 emits:
  - `toast({ variant: 'success', title: 'Photo removed.' })` after a successful Remove.
  - `toast({ variant: 'destructive', title: 'Could not remove photo', description: <error message> })` on Remove failure (any non-OK `ApiResult` from `deleteAttachment`).
  - `toast({ variant: 'default', title: 'Editing cancelled — organisation changed.' })` when the org context changes while a dialog is open.

### States

- **Loading (list)** — DataTable renders Card + Table + TableCaption + single full-width row with `<LoadingSpinner label="Loading photos" />`.
- **Loading (RBAC check)** — `PagePermissionGuard` returns `null`; PaceMain content area is briefly blank.
- **Loading (thumbnail)** — thumbnail cell shows `<LoadingSpinner label="Loading thumbnail" size="sm" />` until the URL resolves.
- **Loading (preview)** — preview dialog body shows the centred `<LoadingSpinner label="Loading preview" />` until the URL resolves.
- **Empty (no photos)** — DataTable renders the empty placeholder with title "No profile photos to review." and description "New photos appear here as members upload them through Portal."
- **List load failure** — DataTable body replaced by inline `Alert` (variant `destructive`) with title "Could not load profile photos." description set to the normalised error message; a "Retry" button (outline variant) re-runs the RPC.
- **Permission denied (page)** — `<AccessDenied />` block (`<section role="alert" aria-live="polite"><p>You do not have permission to view this page.</p></section>`) inside PaceMain. Header and footer remain visible.
- **Permission denied (action)** — Remove action hidden (no copy shown in its place).
- **Mutation in flight (Remove)** — Confirm Remove dialog's Remove button shows spinner, is disabled; Cancel remains enabled.
- **Remove success** — Confirm Remove dialog closes; if the Preview dialog was open, it closes too; success toast "Photo removed." is shown; the row leaves the list immediately.
- **Remove failure** — destructive toast (copy from §4 Error states) plus the Confirm Remove dialog stays open.
- **Org-context change with dialog open** — open dialogs close silently; default-variant toast "Editing cancelled — organisation changed." fires.

### Interactions

- **Thumbnail cell** — default state: `<img>` in a 48 × 48 square with subtle border. Hover: outline ring around the cell. Click: opens the Preview dialog. Disabled-equivalent state: while the thumbnail URL is resolving, the spinner replaces the image and click is a no-op.
- **Row Remove action** — default state: action menu icon (DataTable default). Hover: standard hover treatment. Click: opens the Confirm Remove dialog. Hidden when `canDelete === false`.
- **Search input** — default state: empty input with magnifier icon. Focus: standard focus ring. Typing: debounced filter applied to the table (Member, Uploaded by, File type columns).
- **Per-column filters** — Filters toggle reveals the row. Boolean filter for Public; date-range filter for Uploaded; text filters for Member, Uploaded by, File type, Category.
- **Sort** — column header click toggles asc → desc → unsorted (DataTable default).
- **Pagination** — chevrons advance the page; page-size Select changes rows-per-page.
- **Preview dialog** — open: dim background, modal centred, focus trapped, Close button autofocuses. Close: escape, Close button, or org-context change. Remove button (footer) opens the Confirm Remove dialog above this one.
- **Confirm Remove dialog** — open: dim background, smaller modal stacked above any open Preview dialog, focus trapped, Cancel button autofocuses. Close: escape, Cancel button, successful confirm, or org-context change. Confirm: triggers the mutation; on success closes both dialogs; on failure stays open with a destructive toast.

### Permission-conditional rendering

| Condition | Page body | Row Remove action | Preview dialog Remove button |
|-----------|-----------|------------------|------------------------------|
| Authenticated, has org, lacks `read:page.moderation-photos` | `<AccessDenied />` | n/a | n/a |
| Authenticated, has org, has `read` only | DataTable | hidden | hidden |
| Authenticated, has org, has `read` + `delete` | DataTable | shown | shown |

### Implementation delta (pass 2)

**No prototype screen.** The pace-team prototype kit does not include photo moderation. Pass 2 implementation must follow this requirement prose and the existing DataTable spec in §5 only — there is no layout reference in `pace-prototype/apps/pace-team/`.

Current `pace-team2/src/` may have no `/moderation/photos` route yet; when built, align to §5 Layout and Components (single Card-wrapped DataTable, Preview dialog, Confirm Remove dialog) without inventing prototype-only patterns.

---

## §6 Business rules

**BR-01 — List scope (org members only)**
- Input: `selectedOrganisation.id` from `useOrganisations()`.
- Output: the slice calls `data_moderation_photo_list(p_organisation_id: selectedOrganisation.id)`. The RPC returns one row per `core_file_references` row where `table_name = 'core_person'` and the referenced person is an org member of the supplied organisation. Rows are returned with the joined `member_display_name` and `created_by_display_name`. Both active and inactive members' photos are returned.
- Edge: only direct members — additional contacts are excluded in v1.

**BR-02 — No app_id filter in v1**
- Input: a profile-photo row pointed at a `core_person` member of the current org.
- Output: the row appears in the table regardless of which `app_id` was set on insert. The RPC does NOT filter by `app_id`.

**BR-03 — Storage URL discipline**
- Input: a row with `is_public` and `file_path`.
- Output: thumbnail and preview URLs are resolved via `useFileDisplay` from `@solvera/pace-core/hooks`, which signs URLs (TTL 3600 seconds, cached for 50 minutes by `id`) for `is_public = false` rows and uses `getPublicUrl` for `is_public = true` rows.
- The slice never builds storage URLs by hand and never displays `file_path` to the user (the Preview dialog shows the row `id` only).

**BR-04 — Bucket selection per row**
- Input: a row's `is_public` flag.
- Output: when `is_public === true`, the row's storage object is read from and removed from the `public-files` bucket. When `is_public === false`, from / from the `files` bucket. The same bucket is supplied to both `useFileDisplay` (read) and `deleteAttachment` (mutation).

**BR-05 — Thumbnail vs preview rendering**
- Input: same resolved URL.
- Output: thumbnail renders at 48 × 48 px with `object-fit: cover`. Preview renders at `max-w-full max-h-[60vh]` with `object-fit: contain`. Both use a single resolved URL per row (no separate sizes are signed).

**BR-06 — Per-row metadata source**
- Input: a row from the read RPC.
- Output: the table renders `member_display_name`, `created_at`, `created_by_display_name`, `file_metadata.fileSize`, `file_metadata.fileType`, `is_public`, `file_metadata.category`. Missing optional fields render as em dashes.

**BR-07 — Pagination contract**
- Input: row count.
- Output: DataTable footer renders chevron pagination + a page-size Select. `initialPageSize: 25`; options `[10, 25, 50]`.

**BR-08 — Remove confirmation gating**
- Input: a Remove click on a row or in the Preview dialog footer.
- Output: a `ConfirmationDialog` renders with title "Remove this photo?", body "This will permanently delete the photo and the underlying file. This cannot be undone.", Cancel (outline) + Remove (destructive) buttons. The mutation only fires when the user clicks Remove inside the confirmation dialog.

**BR-09 — Remove path uses pace-core2 helper**
- Input: a confirmed Remove for row `R`.
- Output: the slice calls `deleteAttachment({ secureClient: useSecureSupabase(), adapter: { metadataTable: 'core_file_references', storageBucket: R.is_public ? 'public-files' : 'files' }, metadataId: R.id, filePath: R.file_path })`. The helper removes the storage object first, then deletes the metadata row. The slice does NOT call the legacy `app_file_reference_delete` RPC. The slice does NOT issue a direct `from('core_file_references').delete()`.
- Edge: the slice does not pass `continueOnStorageFailure`; the default behaviour applies — a storage failure aborts the mutation and the metadata row is preserved.

**BR-10 — Remove success outcome**
- Input: `{ ok: true }` from `deleteAttachment`.
- Output: the row is removed from the in-memory list, the Confirm Remove dialog closes, the Preview dialog (if open) closes, and a success toast "Photo removed." fires.

**BR-11 — Remove failure outcome**
- Input: `{ ok: false, error: { code, message } }` from `deleteAttachment` for any of the codes `ATTACHMENT_STORAGE_DELETE_FAILED`, `ATTACHMENT_METADATA_DELETE_FAILED`, `ATTACHMENT_DELETE_ERROR`, `ATTACHMENT_STORAGE_UNAVAILABLE`, `ATTACHMENT_METADATA_DELETE_UNAVAILABLE`.
- Output: the destructive toast `{ variant: 'destructive', title: 'Could not remove photo', description: message }` fires, the Confirm Remove dialog stays open, and the row stays in the list. The user can retry or Cancel.

**BR-12 — RBAC visibility gating**
- Input: `useResourcePermissions('moderation-photos')` return values.
- Output:
  - When `canRead === false`, `<AccessDenied />` is rendered (handled by `PagePermissionGuard`).
  - When `canDelete === false`, the row Remove action and the Preview dialog Remove button are hidden.
  - `canCreate` and `canUpdate` are not consumed by this slice (no create / update affordances exist in v1).

**BR-13 — Org-context change closes any open dialog**
- Input: `selectedOrganisation.id` changes while a Preview or Confirm Remove dialog is open.
- Output: the dialog closes silently, the in-flight Remove (if any) is allowed to complete in the background but its result toast is suppressed, and a default-variant toast fires with title "Editing cancelled — organisation changed." The list refetches against the new organisation.

**BR-14 — Page guard ordering (restated for completeness; full evaluation in §3)**
- Input: TEAM-01 shell context (`isLoading`, `selectedOrganisation`).
- Output: auth check → org loading → no-org empty state (TEAM-01) → `PagePermissionGuard` evaluation. The guard is not reached when `selectedOrganisation === null`.

**BR-15 — pageName + scope_type contract**
- Input: any RBAC check for this surface.
- Output: `pageName: 'moderation-photos'`; `scope_type = 'organisation'`; ops `read` and `delete` map to `read:page.moderation-photos` and `delete:page.moderation-photos`.

**BR-16 — Audit columns**
- Input: any row in the list.
- Output: `created_at`, `created_by`, `updated_at`, `updated_by` on `core_file_references` are populated server-side. The UI never patches them. `created_at` and `created_by` are surfaced to the user via the Uploaded and Uploaded by columns; `updated_at` / `updated_by` are not displayed in v1.

**BR-17 — Mutation authority via RBAC-checked RLS**
- Input: a DELETE on `core_file_references` from the slice (via `deleteAttachment`'s metadata-delete step).
- Output: server-side RLS authorises the operation when either `is_super_admin(safe_get_user_id_for_rls())` is true OR `data_check_rbac_permission_with_context('delete:page.moderation-photos', 'moderation-photos', <organisation_id resolved from the target person's org>, NULL, data_get_app_id('TEAM'))` returns true. Reads are authorised by the parallel SELECT policy using `read:page.moderation-photos`.

---

## §7 API / Contract

### Public exports

This slice does not publish any types, hooks, or services for other slices to import.

### Read contracts

- **Profile-photo moderation list**
  - Call: `useSecureSupabase().rpc('data_moderation_photo_list', { p_organisation_id: selectedOrganisation.id })`.
  - Returns: array of rows, each with at least:
    - `id` (uuid) — `core_file_references.id`.
    - `record_id` (text) — the `core_person.id` the file is attached to.
    - `file_path` (text).
    - `is_public` (boolean).
    - `file_metadata` (jsonb) with `fileName`, `fileType`, `fileSize?`, `category?`.
    - `created_at` (timestamptz).
    - `created_by` (uuid, nullable).
    - `created_by_display_name` (text, nullable) — joined from the auth user / profile.
    - `member_display_name` (text) — joined from the `core_person`.
    - `app_id` (uuid).
  - Filtering: server-side; `table_name = 'core_person'` AND the person is an active or inactive `core_member` of `p_organisation_id`. No `app_id` filter.
  - Authority: the SELECT policy on `core_file_references` must permit the read; the RPC also calls the page-permission check internally (per pace-core2 standards' RBAC Permission-Based Policy template).

### Write contracts

- **Remove a profile-photo file_reference**
  - Call: `deleteAttachment({ secureClient: useSecureSupabase(), adapter: { metadataTable: 'core_file_references', storageBucket: row.is_public ? 'public-files' : 'files' }, metadataId: row.id, filePath: row.file_path })`.
  - Returns: `ApiResult<void>` from `@solvera/pace-core/types`.
  - Success: `{ ok: true, data: undefined }`. The slice removes the row from the in-memory list and fires the success toast.
  - Failure codes:
    - `ATTACHMENT_STORAGE_DELETE_FAILED` — storage object delete returned an error.
    - `ATTACHMENT_METADATA_DELETE_FAILED` — metadata `delete().eq('id', ...)` returned an error (typically RLS denial — `42501` or PostgREST equivalent).
    - `ATTACHMENT_STORAGE_UNAVAILABLE` — secure client did not expose storage delete operations.
    - `ATTACHMENT_METADATA_DELETE_UNAVAILABLE` — secure client did not expose metadata delete operations.
    - `ATTACHMENT_DELETE_ERROR` — unhandled exception during the operation.
  - Failure handling: destructive toast, dialog stays open, row stays in the list.

### RLS / permission contract

| Role | RPC `data_moderation_photo_list` (read) | DELETE on `core_file_references` (via `deleteAttachment`) |
|------|------------------------------------------|------------------------------------------------------------|
| Super-admin | allow | allow |
| Org moderator with `read:page.moderation-photos` and `delete:page.moderation-photos` on the current org | allow | allow |
| Org member without moderation permissions | denied (RPC + RLS deny) | denied |
| Anonymous | denied | denied |

The RBAC-checked SELECT and DELETE policies on `core_file_references` are upstream platform work; see §15.

### Cross-slice handoffs

- TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />`) as the outermost wrapper of `AuthenticatedShell`. TEAM-12 calls `toast(...)` and depends on TEAM-01 having mounted the provider.
- TEAM-01 owns the route mounting the navItem at `Moderation` with `href: /moderation/photos`. TEAM-12 owns the page component.
- The Member column links to `/members/<core_person.id>` when TEAM-03 (Member 360) is in service. The link contract is the canonical TEAM-03 route at build time; TEAM-12 does not own it.
- The architecture's canonical `pageName` for this slice is `moderation-photos`. Post-build RBAC seeding (planned in TEAM-01) will add the `rbac_app_pages` row.

### ID contracts

- `core_file_references.id` is a `uuid` (Postgres `gen_random_uuid()`).
- `record_id` on `core_file_references` is `text`. For `table_name = 'core_person'` rows, the value is the string form of the `core_person.id` UUID. The slice treats it as a string for navigation purposes.

---

## §8 Data and schema references

### Tables consumed

| Table | Access | Columns used |
|-------|--------|--------------|
| `public.core_file_references` | Read (via RPC) + DELETE (via `deleteAttachment` helper) | `id`, `record_id`, `table_name`, `file_path`, `is_public`, `file_metadata`, `created_at`, `created_by`, `app_id` |
| `public.core_person` | Read (server-side join in RPC) | `id`, `display_name` (or equivalent display field) |
| `public.core_member` | Read (server-side join in RPC) | `person_id`, `organisation_id`, `membership_status` |

### RPCs consumed

| RPC | Purpose |
|-----|---------|
| `data_moderation_photo_list(p_organisation_id uuid)` | Returns the joined list of profile-photo rows for `core_person` members of the supplied organisation, with a per-row page-permission check. |

### Storage buckets consumed

| Bucket | Privacy | Used for |
|--------|---------|---------|
| `files` | Private (5 MB limit) | `is_public = false` rows: signed URL via `useFileDisplay`; storage delete via `deleteAttachment`. |
| `public-files` | Public (10 MB limit) | `is_public = true` rows: public URL via `useFileDisplay`; storage delete via `deleteAttachment`. |

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

Verified 2026-05-04 via Supabase MCP:

- `public.core_file_references` columns: `id uuid NOT NULL DEFAULT gen_random_uuid()`, `table_name text NOT NULL`, `file_path text NOT NULL`, `file_metadata jsonb`, `is_public boolean DEFAULT false`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`, `record_id text NOT NULL`, `app_id uuid NOT NULL`, `created_by uuid`, `updated_by uuid`. There is no `organisation_id`, no `event_id`, no `is_active`, no `deactivated_at`, and no `moderation_status` column on this table.
- Storage buckets `files` (private, 5 MB) and `public-files` (public, 10 MB) are present.
- The dev DB has zero rows where `table_name = 'core_person'` at audit time (2026-05-04). Profile-photo seeding via Portal upload (or a dev-only seed) is required before §12 verification can be exercised end-to-end.

### Implementation gate (upstream platform work — required for Done)

The TEAM-12 v6 slice does NOT author migrations. Before TEAM-12 can be marked Done:

(a) **RBAC-checked SELECT policy** on `public.core_file_references` for `read:page.moderation-photos` must be added, matching the "RBAC Permission-Based Policy" template in `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md`. The policy resolves the target person's organisation via a SECURITY DEFINER helper (e.g. `core_person.id` → `core_member.organisation_id`) and calls `data_check_rbac_permission_with_context('read:page.moderation-photos', 'moderation-photos', <org_resolved>, NULL, data_get_app_id('TEAM'))`.

(b) **RBAC-checked DELETE policy** on `public.core_file_references` for `delete:page.moderation-photos`, structured the same way and calling `data_check_rbac_permission_with_context('delete:page.moderation-photos', 'moderation-photos', <org_resolved>, NULL, data_get_app_id('TEAM'))`.

(c) **(Recommended) `data_moderation_photo_list(p_organisation_id uuid)` RPC** encapsulating the join (`core_file_references.table_name = 'core_person'` → `core_person.id` → `core_member.organisation_id = p_organisation_id`) and the page-permission check, returning the row shape described in §7.

The v6 slice does not author the migration.

### Helpers referenced (must be present on dev)

- `data_check_rbac_permission_with_context(p_permission TEXT, p_page_name TEXT, p_organisation_id UUID, p_event_id TEXT, p_app_id UUID) RETURNS boolean` — STABLE SECURITY DEFINER wrapper; verified via dev MCP 2026-05-04.
- `is_super_admin(p_user_id UUID) RETURNS boolean` — verified.
- `safe_get_user_id_for_rls() RETURNS UUID` — verified.
- `data_get_app_id(p_app_name TEXT) RETURNS UUID` — verified; called as `data_get_app_id('TEAM')`.

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — shell chrome contract.
- `pace-core2/packages/core/src/types/fileStorage.ts` — `FileReference` shape and the documented absence of org / event columns on `core_file_references`.
- `pace-core2/packages/core/src/crud/attachmentLifecycle.ts` — `deleteAttachment` helper signature and behaviour.

### Post-build RBAC seeding reminder

A canonical `rbac_app_pages` row for `pageName = 'moderation-photos'` (with `scope_type = 'organisation'`, mapped to TEAM's `app_id`) must be seeded post-build per the TEAM-01 audit's seeding plan. Without it, RBAC checks for `read` and `delete` on this surface return false and the page renders `<AccessDenied />` for non-super-admin users.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|--------|-------------|--------------|
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Wraps the page on `read:page.moderation-photos` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Default fallback when the page guard denies access |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | Gates the row Remove action and the Preview dialog Remove button (`canDelete`) |
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for the `data_moderation_photo_list` RPC and as `secureClient` for `deleteAttachment` |
| `useOrganisations` | `@solvera/pace-core/hooks` | Reads `selectedOrganisation` for the RPC's `p_organisation_id` argument and to detect org-context changes |
| `usePaceMain` | `@solvera/pace-core/hooks` | Sets `printTitle: 'Photo moderation'` |
| `useFileDisplay` | `@solvera/pace-core/hooks` | Resolves thumbnail and preview URLs (signed for private rows, public for public rows); per-id signed-URL cache |
| `DataTable` | `@solvera/pace-core/components` | List rendering with sort / search / filter / pagination |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@solvera/pace-core/components` | Page content wrapper around the DataTable |
| `Dialog`, `DialogPortal`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogBody`, `DialogFooter` | `@solvera/pace-core/components` | Preview dialog primitives |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Confirm Remove dialog |
| `Button` | `@solvera/pace-core/components` | Preview dialog Close + Remove buttons; Retry button on list-load failure |
| `Badge` | `@solvera/pace-core/components` | Public / Private badge in the Public column; "Image unavailable" outline badge for thumbnail errors |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | Inline error blocks (list load failure, preview load failure) |
| `LoadingSpinner` | `@solvera/pace-core/components` | DataTable loading row, thumbnail loading state, preview loading state, confirm-button spinner |
| `Link` | `@solvera/pace-core/components` | Member-name link to TEAM-03 Member 360 (when in service) |
| `toast` | `@solvera/pace-core/components` | Success / removal-failure / org-switch notifications. `ToastProvider` is mounted by TEAM-01 |
| `deleteAttachment` | `@solvera/pace-core/crud` | Atomic storage + metadata delete for the Remove action |
| `AttachmentLifecycleAdapter` (type) | `@solvera/pace-core/crud` | Adapter shape supplied to `deleteAttachment` (typed only) |
| `FileReference` (type) | `@solvera/pace-core/types` | Row shape for `useFileDisplay` and for the read-RPC return |
| `ApiResult` (type) | `@solvera/pace-core/types` | Discriminated-union return type from `deleteAttachment` |
| `HandleSupabaseError`, `NormalizeSupabaseError` | `@solvera/pace-core/utils` | Error normalisation for the list-load `Alert` and the destructive Remove toast |

### §9.2 Slice-specific caveats

**`ToastProvider` mount.** This slice does NOT mount `<ToastProvider>` or `<Toaster />`. Both are mounted by TEAM-01 in `AuthenticatedShell`. Calling `toast(...)` from inside any TEAM-12 component will work because every authenticated route descends from `AuthenticatedShell`'s provider. Do not add a second mount in this slice.

**`DataTable` editor pattern.** The DataTable's built-in Create / Edit / Delete modals are not used. Set `features.creation: false`, `features.deletion: false`, `features.import: false`, `features.export: false`. Do NOT pass `onEditRow` or `onDeleteRow`. Use the `actions` array for the row Remove action and a slice-controlled `ConfirmationDialog` for the destructive confirmation.

**`useFileDisplay` bucket per row.** The bucket passed to `useFileDisplay` MUST be selected per row using `row.is_public ? 'public-files' : 'files'`. Do NOT rely on the default `'files'` bucket — public rows live in `public-files` and would 404 against `files`. The same per-row bucket selection MUST be used when constructing the `AttachmentLifecycleAdapter` for `deleteAttachment`.

**`useFileDisplay` cache invalidation on Remove.** `useFileDisplay` caches signed URLs in a module-level `Map` for 50 minutes by `fileReference.id`. After a successful Remove, the row leaves the list immediately (BR-10), so the cached URL is no longer reachable from the slice; do not attempt to clear the cache manually — the entry expires harmlessly.

**`deleteAttachment` `continueOnStorageFailure`.** Do NOT pass `continueOnStorageFailure: true` for v1. The default behaviour (storage failure aborts and the metadata row is preserved) is correct for moderation: a half-deleted row is preferable to an orphaned storage object only at the platform layer, where it can be cleaned up by maintenance. The slice surfaces both failure modes uniformly via the destructive toast.

**`useResourcePermissions` boolean gating.** Read `canDelete` from `useResourcePermissions('moderation-photos')`. Hide affordances when `false`; do not render disabled-but-visible buttons. Treat `isLoading: true` from the hook as "do not show the affordance yet" — the brief absence avoids flicker and prevents a request that would 403 on the server.

**`useSecureSupabase` selection.** Call with no arguments. Do not import `createClient` from `@supabase/supabase-js` for any reason. The client is wrapped server-side with the resolved `organisationId`; the slice does not need to thread `organisationId` through manually for the DELETE path. The RPC explicitly requires `p_organisation_id` and the slice passes `selectedOrganisation.id` for that argument.

**Mutation contract gate.** TEAM-12's read and DELETE paths depend on the upstream platform delivering the RBAC-checked SELECT and DELETE policies on `core_file_references` and the `data_moderation_photo_list` RPC described in §8 Implementation gate. Until those land on dev, every read and DELETE returns 401 / 403 for non-super-admin users; the v6 slice does not author the migration.

**Org-context change handling.** Subscribe to `selectedOrganisation.id` via `useOrganisations()` and close any open Preview / Confirm Remove dialog when it changes. The list refetch happens automatically because the RPC depends on the same value.

---

## §10 Permission and access rules

### Page-level guard

| Route | `pageName` | `operation` | Fallback |
|-------|-----------|------------|----------|
| `/moderation/photos` | `moderation-photos` | `read` | `<AccessDenied />` |

### Action-level access

| Action | Permission required | Mechanism |
|--------|---------------------|-----------|
| View page body | `read:page.moderation-photos` | `PagePermissionGuard` |
| Load the photo list | `read:page.moderation-photos` | RBAC-checked SELECT policy on `core_file_references` (server-side); page-permission check inside `data_moderation_photo_list` |
| Open the Preview dialog | (page read only — no separate permission) | implicit |
| Show the row Remove action | `delete:page.moderation-photos` | `useResourcePermissions('moderation-photos').canDelete` |
| Show the Preview-dialog Remove button | `delete:page.moderation-photos` | `useResourcePermissions('moderation-photos').canDelete` |
| Submit the Confirm Remove dialog | `delete:page.moderation-photos` | RBAC-checked DELETE policy on `core_file_references` (server-side, via `deleteAttachment`) |

### Row-level access

- A user can SELECT a `core_file_references` row whose `table_name = 'core_person'` and the referenced person is a member of an organisation where the user has `read:page.moderation-photos` permission. The recommended SELECT policy resolves the target person's organisation server-side and routes through `data_check_rbac_permission_with_context`.

### Proxy / impersonation

- None. The slice does not consult or expose proxy / impersonation state.

---

## §11 Acceptance criteria

**Progress (2026-05-19):** **9 / 15** Vitest-verified · **15 / 15** implementation-complete · **§15 Done** blocked on [`docs/test-packs/TM12-qa-pack.md`](../test-packs/TM12-qa-pack.md) (S-01–S-15) and dev profile-photo seed (≥1 public + 1 private). Evidence: [`docs/delivery/TM12-verification-evidence.md`](../delivery/TM12-verification-evidence.md).

- [x] **AC-01 — Page entry, authenticated moderator with `read`.**
Given a user is authenticated and has `read:page.moderation-photos` on their current organisation, when they navigate to `/moderation/photos`, then the page renders with title "Photo moderation" and a Card titled "Profile photos" containing a DataTable showing all profile photos for `core_person`-pointed members of the current organisation, sorted by Member ascending.

- [x] **AC-02 — Empty list.**
Given the current organisation has zero profile photos for its `core_person`-pointed members, when the page loads, then the DataTable shows the empty placeholder with title "No profile photos to review." and description "New photos appear here as members upload them through Portal."

- [x] **AC-03 — Remove — happy path.**
Given a moderator has `delete:page.moderation-photos` and clicks Remove on a row, when they confirm the destructive dialog, then `deleteAttachment` runs, the storage object is removed, the metadata row is deleted, the dialog closes, the row leaves the table, and a success toast "Photo removed." is shown.

- [x] **AC-04 — Remove — failure (storage delete failed).**
Given the user confirms a Remove and `deleteAttachment` returns `{ ok: false, error: { code: 'ATTACHMENT_STORAGE_DELETE_FAILED' } }`, when the failure is handled, then the Confirm Remove dialog stays open, a destructive toast "Could not remove photo" with the normalised error message is shown, and the row remains in the table.

- [x] **AC-05 — Remove — visibility hidden when `canDelete === false`.**
Given a user has `read` but not `delete`, when the page loads, then no row shows a Remove action in its row-action menu, and the Preview dialog (when opened) does not render the Remove button.

- [ ] **AC-06 — Preview dialog.**
Given a moderator clicks the thumbnail cell on any row, when the Preview dialog opens, then the dialog title is the member display name and the body shows a larger version of the photo plus a metadata block with Uploaded date / time, Uploaded by, File size, File type, Public flag, Category, and the row's Storage path id (file_path is NOT shown).

- [x] **AC-07 — Permission denied — page.**
Given a user is authenticated but lacks `read:page.moderation-photos`, when they navigate to `/moderation/photos`, then `<AccessDenied />` is shown inside PaceMain with copy "You do not have permission to view this page.", and the shell header and footer remain visible.

- [x] **AC-08 — List load failure with retry.**
Given the read RPC returns an error, when the failure is handled, then the DataTable body is replaced by an inline destructive `Alert` with title "Could not load profile photos." and the normalised error message; clicking Retry re-runs the RPC.

- [ ] **AC-09 — Search, sort, pagination.**
Given the table contains more than 25 rows, when the user uses the global search input, sort headers, and pagination controls, then search filters by Member, Uploaded by, and File type substring (case-insensitive), sorts apply per column, and pagination defaults to 25 rows per page with options [10, 25, 50].

- [ ] **AC-10 — Public / Private filter.**
Given the table contains both public and private photos, when the user reveals the column filter row and filters Public to Public, then only rows with `is_public === true` are shown; switching to Private shows only `is_public === false` rows.

- [x] **AC-11 — Org-context switch closes open dialog.**
Given the Preview or Confirm Remove dialog is open and a user switches the current organisation via the header org selector, when the org changes, then the dialog closes silently, a default-variant toast "Editing cancelled — organisation changed." appears, and the table refetches against the new organisation.

- [ ] **AC-12 — Thumbnail signed URL for private files.**
Given a private profile-photo row (`is_public === false`), when the page loads, then `useFileDisplay` resolves a signed URL from the `files` bucket and the thumbnail renders; `file_path` is never displayed to the user.

- [ ] **AC-13 — Thumbnail public URL for public files.**
Given a public profile-photo row (`is_public === true`), when the page loads, then `useFileDisplay` resolves a public URL from the `public-files` bucket and the thumbnail renders.

- [ ] **AC-14 — Member-name link.**
Given a row shows a member display name and TEAM-03 Member 360 is in service, when the user clicks the name, then the browser navigates to `/members/<core_person_id>`. When TEAM-03 is not in service, the cell renders as plain text and is not clickable.

- [ ] **AC-15 — Concurrent removal handling.**
Given two moderators click Remove on the same row at the same time, when the second `deleteAttachment` call runs after the first has succeeded, then the second call returns either `ATTACHMENT_STORAGE_DELETE_FAILED` (storage object already gone) or `ATTACHMENT_METADATA_DELETE_FAILED` (row already gone) and the destructive toast surfaces. The list does not duplicate or crash.

---

## §12 Verification

- Confirm route read is registered in [`team-route-registry.ts`](../../src/lib/navigation/team-route-registry.ts) and enforced by shell `routeAccessDenied` (no outer page read guard) and that no `scope` prop is passed.
- Confirm `useSecureSupabase()` is used for the `data_moderation_photo_list` RPC and as `secureClient` for `deleteAttachment`; confirm there is no direct `createClient` import from `@supabase/supabase-js`.
- Confirm the slice never calls the legacy `app_file_reference_delete` RPC and never issues a direct `from('core_file_references').delete()` — all deletes go through `deleteAttachment` from `@solvera/pace-core/crud`.
- Confirm the bucket passed to `useFileDisplay` and to the `AttachmentLifecycleAdapter` is selected per row by `row.is_public ? 'public-files' : 'files'`.
- Confirm the row Remove action and the Preview dialog Remove button are conditioned on `useResourcePermissions('moderation-photos').canDelete`.
- Confirm the Preview dialog never shows `file_path`; only the row `id`, member name, and metadata fields listed in AC-06.
- Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)):
  - Confirm the RBAC-checked SELECT policy on `public.core_file_references` for `read:page.moderation-photos` is present and uses `data_check_rbac_permission_with_context(... , data_get_app_id('TEAM'))`.
  - Confirm the RBAC-checked DELETE policy on `public.core_file_references` for `delete:page.moderation-photos` is present and uses the same helper.
  - Confirm the `data_moderation_photo_list(p_organisation_id uuid)` RPC exists and returns the joined row shape described in §7 (including `member_display_name`, `created_by_display_name`).
  - Confirm `rbac_app_pages` has a row for `pageName = 'moderation-photos'` with `scope_type = 'organisation'` and the TEAM `app_id` (post-build seeding may handle this; if absent, the page renders `<AccessDenied />` for non-super-admin users — note as a known seeding gap, not a code defect).
- **Test data prerequisite.** The dev DB has zero rows where `table_name = 'core_person'` at audit time. Seed N profile photos against `core_person` rows in a test org via Portal upload (or a dev-only seed) before validating AC-01 through AC-15. Ensure at least one seeded row has `is_public = true` (in `public-files`) and one with `is_public = false` (in `files`) to exercise both bucket paths.
- Manually verify in dev-db that a Remove by a moderator with `delete:page.moderation-photos` succeeds: the storage object is gone from the appropriate bucket and the `core_file_references` row is gone.
- Manually verify that a Remove attempt by an authenticated user without the delete permission returns an `ATTACHMENT_METADATA_DELETE_FAILED` (RLS denial) and the destructive toast surfaces.

---

## §13 Testing requirements

n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- The Confirm Remove dialog is a slice-controlled `ConfirmationDialog` opened from the DataTable `actions` array entry and from the Preview dialog footer. Do not wire Remove through `DataTable.onDeleteRow` — the built-in delete modal is not used.
- All reads go through `useSecureSupabase().rpc('data_moderation_photo_list', ...)`. Do not write a bespoke join in the client.
- All deletes go through `deleteAttachment` from `@solvera/pace-core/crud`. Do not call the legacy `app_file_reference_delete` RPC. Do not issue a direct `from('core_file_references').delete()`. Do not bypass the helper to call `bucket.remove([path])` separately.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths (`@solvera/pace-core/rbac`, `/hooks`, `/components`, `/crud`, `/types`, `/utils`) only.
- The slice does not author RLS policies or the read-side RPC. Both are upstream platform work and gate Done.

---

## §15 Done criteria

- All 15 acceptance criteria (AC-01 through AC-15) verified.
- Implementation blocked until: (a) RBAC-checked SELECT policy on `core_file_references` for `read:page.moderation-photos` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` template, scoped via the target person's org); (b) RBAC-checked DELETE policy on `core_file_references` for `delete:page.moderation-photos`; (c) (recommended) `data_moderation_photo_list(p_organisation_id uuid)` RPC encapsulating the join + permission check for the read path. The v6 slice does not author the migration.
- Post-build RBAC seeding reminder logged in the QA pack: `rbac_app_pages` row for `pageName = 'moderation-photos'` (`scope_type = 'organisation'`, TEAM `app_id`) added before release.
- `npm run validate` passes (lint + type-check + tests).
- Test data seeded on dev: at least one profile photo with `is_public = true` and one with `is_public = false`, both pointed at `core_person` rows of members in a test organisation, before manual verification of AC-01 through AC-15.
- Manual verification of the Remove path against dev: a confirmed Remove by a moderator with `delete:page.moderation-photos` results in both the storage object and the `core_file_references` row being deleted; the row leaves the in-memory list and the success toast is shown.

---

## §16 Do not

- Do not implement a Hide / soft-deactivate verb in v1. Hide is excluded; there is no UI affordance, no column on `core_file_references`, no `_deactivate` RPC, and no `deactivated_at` field. Hide is deferred to a follow-up platform card.
- Do not implement a Reactivate / Unhide verb in v1. Reactivate is excluded as a knock-on of Hide being dropped.
- Do not call the legacy `app_file_reference_delete` RPC. The Remove path goes through `deleteAttachment` from `@solvera/pace-core/crud`.
- Do not issue a direct `useSecureSupabase().from('core_file_references').delete().eq(...)`. The Remove path goes through `deleteAttachment`.
- Do not call `bucket.remove([file_path])` directly. The storage delete is handled by `deleteAttachment`.
- Do not pass `continueOnStorageFailure: true` to `deleteAttachment` in v1. Default behaviour is correct.
- Do not surface an internal moderator note field. Moderation notes are deferred to a follow-up.
- Do not surface a moderation audit trail / history pane in TEAM. Audit history is deferred to a follow-up.
- Do not send member or guardian email on Remove, prompt the affected member to re-upload, or expose an appeals workflow. All deferred.
- Do not write a bespoke client-side join over `core_file_references`, `core_person`, and `core_member`. Use the `data_moderation_photo_list` RPC.
- Do not filter the list by `app_id` in v1. All profile-photo rows for `core_person`-pointed members of the current organisation are in scope regardless of the uploading app.
- Do not display `file_path` to the user. The Preview dialog shows the row `id` only.
- Do not mount `<ToastProvider>` or `<Toaster />` — TEAM-01 owns that mount.
- Do not duplicate the "no organisation selected" empty state — it is handled at the shell level by TEAM-01.
- Do not navigate the user out of the current org context on Remove. The slice never calls `switchOrganisation()`.
- Do not author RLS policies, the read-side RPC, or any helper function in this slice. Those are upstream platform work and gate Done.
- Do not import from internal `packages/core/src/*` paths.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; reactive moderation; deferred notifications / appeals.
- `/rebuild/architecture.md` — route ownership of `/moderation/photos`; canonical `pageName` `moderation-photos`; nav entry `Moderation`.
- `/docs/requirements/team/TM01-app-shell-auth-layout-requirements.md` — app shell, `AuthenticatedShell` mounting `<ToastProvider>` (which renders `<Toaster />`), nav menu Moderation entry, `ProtectedRoute`, no-org empty state, post-build RBAC seeding plan.
- `/docs/requirements/team/TM06-membership-types-requirements.md` — sibling settings slice using the same RBAC-checked-RLS pattern; convention reference for DataTable bespoke-action pattern.
- `/docs/requirements/team/TM07-sub-organisations-requirements.md` — sibling settings slice using the same RBAC-checked-RLS pattern; convention reference for ConfirmationDialog destructive-action wiring.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC Permission-Based Policy template; helper function attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API; no `scope` prop at page level.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout`; nav menu dropdown contract.
- `pace-core2/packages/core/src/types/fileStorage.ts` — `FileReference` type; documented absence of org / event columns on `core_file_references`.
- `pace-core2/packages/core/src/crud/attachmentLifecycle.ts` — `deleteAttachment` helper signature and behaviour.
- `pace-core2/packages/core/src/hooks/useFileDisplay.ts` — `useFileDisplay` signature and signed-URL caching.

### Implementation gate (upstream platform work — repeated for traceability)

Implementation blocked until: (a) RBAC-checked SELECT policy on `core_file_references` for `read:page.moderation-photos` (matching `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` template, scoped via the target person's org); (b) RBAC-checked DELETE policy on `core_file_references` for `delete:page.moderation-photos`; (c) (recommended) `data_moderation_photo_list(p_organisation_id uuid)` RPC encapsulating the join + permission check for the read path. The v6 slice does not author the migration.
