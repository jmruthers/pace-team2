# TEAM-03 — Member 360

## §1 Slice metadata

```
Slice ID:        TEAM-03
Name:            Member 360
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navItems), TEAM-02 (directory entry; supplies stable core_member.id navigation)
Backend impact:  Read contract only (mutations on core_person, core_member, core_member_card use the live check_user_is_org_admin(organisation_id) RLS gate already in place on dev — no migration required for v1; Portal CTA wiring depends on the CR24 helper landing in pace-core2 — see §15)
Frontend impact: UI
Routes owned:    /members/:memberId
QA pack:         docs/test-packs/TEAM-03-qa-pack.md
```

---

## §2 Overview

TEAM-03 delivers the Member 360 detail surface for org-admin staff at `/members/:memberId`, where `:memberId` is `core_member.id` (uuid). The page renders a single scrollable layout with five sections — Member details (Identity), Additional contacts, Member cards, Applications, and a Standing roles cross-slice link — sourced from `core_person`, `core_member`, `core_contact`, `core_member_card`, `base_application` joined to `core_events`, `core_phone`, and `core_address`. Identity supports a strict scalar editing allowlist via an Unlock/Edit pattern with `Save` and `Cancel` controls; Member cards expose Deactivate / Reactivate row actions; Additional contacts and Applications are read-only. A Portal handoff CTA renders inline on the Identity card header — "Edit in Portal" or "View in Portal" — gated by `useResourcePermissions('member-profile')` and hidden when the acting user is the target member. The page is wrapped by `<PagePermissionGuard pageName="members" operation="read">`.

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single surface where they can see every fact recorded for a member of their currently selected organisation, edit a strict allowlist of identity scalars without navigating away, deactivate or reactivate the member's physical cards, and hand off to Portal for the deeper editing surfaces (photo upload, medical, billing, event-registration detail) that this slice intentionally does not own. TEAM-03 produces that surface. It does not own membership creation, the directory list, role assignment, member-request review, or any Portal-proxy form authoring.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Member 360 — single scrollable page | `/members/:memberId` | Sections in order: Member details (Identity, Portal CTA inline header-right), Additional contacts, Member cards, Applications, Standing roles cross-slice link |
| Identity edit mode | (in-page state on `/members/:memberId`) | Allowlisted scalars only; Save / Cancel controls render in edit mode; `ConfirmationDialog` "Discard unsaved changes?" on Cancel when dirty |
| Card deactivate confirmation | (overlay on `/members/:memberId`) | `ConfirmationDialog` with destructive variant |
| Contact details modal | (overlay on `/members/:memberId`) | Read-only `Dialog` with the contact's name, type, tier, phones, email, address |
| Member-not-found page | (in-page replacement at `/members/:memberId`) | Single safe UX whether the id is unknown, deleted, or in another org |
| Org-mismatch alert | (in-page replacement at `/members/:memberId`) | Destructive `Alert` with "Back to members" button |

### Boundaries

TEAM-03 does **not** own:
- The member directory list at `/members` — that is TEAM-02.
- Standing roles add / end / history at `/members/:memberId/roles` — that is TEAM-04. TEAM-03 renders only a section heading "Standing roles" with a "View roles ›" link.
- Member-request review, join, transfer, or status transitions — that is TEAM-05.
- Photo upload, medical info, billing info, event-registration detail editing — all routed through the Portal handoff CTA.
- Card issuance, reissue, credential generation, new-card creation — the cards section exposes Deactivate / Reactivate only; no insert / delete / identifier mutation.
- Add / edit / remove of additional contacts. The contacts section is read-only list + read-only modal in v1; full CRUD is deferred to a follow-up slice (TEAM-03.x) or routed through Portal handoff.
- BASE-table-first presentation of events / applications. The applications section is member-first: the member is the row anchor, applications are columns of that view, and there is no `base_event_registration` table involved.
- Self-service editing by the target member. When the acting user is the target member, all Portal CTAs are hidden; self-service editing is via Portal directly, not TEAM.
- The CR24 helper subpath `@solvera/pace-core/member-profile-launch`. This slice consumes the helper when it lands; it does not author it.

### Architectural posture

**Mutation contract — live `check_user_is_org_admin(organisation_id)` RLS gate.** All reads and writes go via `useSecureSupabase().from(...)`. Authorisation on the four mutated tables (`core_person`, `core_member`, `core_member_card`) is enforced at the database layer by RLS policies that gate on whether the acting user is an `org_admin` for the target `organisation_id`. These policies already exist on dev and work today; this slice authors against them. No upstream RLS migration is required to ship TEAM-03 v1. (`core_contact` mutations are not in v1 scope — see §16.) Future cross-app convergence to RBAC-checked RLS for these tables is informational only and captured in §17.

**Page guard.** `/members/:memberId` is wrapped by `<PagePermissionGuard pageName="members" operation="read">`. Same `pageName` as TEAM-02 (Member 360 is the detail surface for the directory). The guard resolves scope internally from `OrganisationServiceProvider` — no `scope` prop is passed.

**Action gating.** Visibility of the Identity Unlock button and the card row actions (Deactivate / Reactivate) is gated by `useResourcePermissions('members')`: hidden when `canUpdate === false`. Visibility of the Portal CTAs is gated by `useResourcePermissions('member-profile')` (singular resource key matching the dev `rbac_app_pages` row under PACE app): "Edit in Portal" when `canUpdate === true`; "View in Portal" when `canRead === true` AND `canUpdate === false`; neither when neither.

**Single scrollable layout.** No tabs. Sections render top-to-bottom in this order: Member details, Additional contacts, Member cards, Applications, Standing roles cross-slice link.

**Loading split.** Initial member fetch blocks the page with a full-page `<LoadingSpinner />`. Once the member resolves, secondary section queries (contacts / cards / applications) render their own section-level `<LoadingSpinner />` while the surrounding page remains interactive (Portal CTA, Back button, Standing roles link).

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (Save success, Save failure, card mutation success / failure, org-switch via Alert is non-toast). `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it.

**Page metadata.** `usePaceMain({ printTitle: <member's full name> })` is called on member load. Until the member resolves, `printTitle` is `'Member 360'`.

**Org-scoped reads and writes.** Every read filters or stamps `organisation_id = selectedOrganisation.id` (defensive belt-and-braces over RLS). Every UPDATE includes the row's existing `organisation_id` implicitly via the WHERE clause on `id`; no payload mutates `organisation_id`.

**No event scope.** TEAM is not event-scoped. The slice does not consume `EventServiceProvider` or pass an `eventId` anywhere except as a passive read (`base_application.event_id` for the join — never as scope).

### Page-level guards and evaluation ordering

The route `/members/:memberId` sits inside `AuthenticatedShell` (TEAM-01) and is wrapped by `<PagePermissionGuard pageName="members" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the page guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state from TEAM-01; the page guard does not evaluate.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the no-org empty state from TEAM-01. The page guard is not reached.
4. **Page permission guard** — Once org context is resolved, `<PagePermissionGuard pageName="members" operation="read">` evaluates. Scope is resolved internally; no `scope` prop is passed. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside the `PaceMain` content area is acceptable). On `can === false`, `<AccessDenied />` renders. On `can === true`, the page body renders.
5. **Member fetch** — Inside the page body, the slice fetches `core_member` joined to `core_person` for `core_member.id = :memberId AND organisation_id = selectedOrganisation.id`. While the query is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area. On a zero-row result (unknown id, deleted member, cross-org member), the "Member not found" page renders. On a non-zero result, the five sections render with their own section-level loading states.

If `selectedOrganisation` resolves to `null` mid-render (for example a race during org switch), the RBAC engine evaluates with `organisationId: undefined` and the page guard returns `null` (pending). The no-org check at step 3 prevents this path under normal conditions. If the loaded member's `organisation_id` no longer matches `selectedOrganisation.id` after an org switch, the page replaces its content with the org-mismatch alert (BR-W).

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/members/:memberId` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.members` permission, where `:memberId` is interpreted as `core_member.id` (uuid).
- **F-02** On entry, the page fetches the member: `core_member` joined to `core_person`, filtered by `core_member.id = :memberId AND organisation_id = selectedOrganisation.id AND deleted_at IS NULL`.
- **F-03** On member resolve, the page sets `printTitle` to the member's full name (BR-AA) via `usePaceMain`. Until resolve, `printTitle` is `'Member 360'`.
- **F-04** The page renders five sections in this order: **Member details**, **Additional contacts**, **Member cards**, **Applications**, **Standing roles** (cross-slice link).
- **F-05** A `<Button variant="outline">← Back to members</Button>` renders at top-left of the `PaceMain` content area, navigating to `/members` on click.
- **F-06** Switching the currently selected organisation refetches the member against the new org. If the member's `organisation_id` matches, the page silently rebinds. If it does not match, the page replaces its content with the org-mismatch alert (BR-W).

### Loading states

- **F-07** While the initial member query is in flight, a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; no section content renders.
- **F-08** Once the member resolves, each of the Additional contacts, Member cards, and Applications sections renders its own section-level `<LoadingSpinner />` until that section's query completes.
- **F-09** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).

### Empty states

- **F-10** **Member not found.** When the member query returns zero rows (unknown id, deleted member, cross-org member), the page replaces its content with a "Member not found" page: heading "Member not found", description "We couldn't find this member in your current organisation.", and a `<Button variant="outline">← Back to members</Button>` linking to `/members`.
- **F-11** **No additional contacts.** When the contacts query returns zero rows for the member, the Additional contacts section renders the empty-state copy "No additional contacts recorded." inside the section card. No CTA.
- **F-12** **No member cards.** When the cards query returns zero rows for the member, the Member cards section renders the empty-state copy "No cards recorded." inside the section card. No CTA.
- **F-13** **No applications.** When the applications query returns zero rows for the member (after the `status != 'draft'` filter and the org filter), the Applications section renders the empty-state copy "No applications recorded." inside the section card. The same copy renders whether the cause is no data or no BASE permission — see BR-Q.

### Error states

- **F-14** **Member fetch error.** When the initial member query fails, the page replaces its content with `<Alert variant="destructive">` titled "Could not load member", description from the normalised `HandleSupabaseError(error, { context: 'core_member' })` message, and a `<Button>Retry</Button>` that re-runs the query.
- **F-15** **Section fetch error.** When a contacts / cards / applications section query fails, that section is replaced inline by `<Alert variant="destructive">` with title "Could not load {section name}" (e.g. "Could not load contacts"), description from the normalised error, and a `<Button>Retry</Button>` that re-runs the section query. Other sections continue to render.
- **F-16** **Save error.** Failures on the Identity Save mutation are normalised through `HandleSupabaseError(error, { context: 'core_person' })` or `'core_member'` and surfaced as a `destructive` toast with the normalised message. The form remains open and editable; the dirty state remains set.
- **F-17** **Card mutation error.** Failures on Deactivate / Reactivate are normalised through `HandleSupabaseError(error, { context: 'core_member_card' })` and surfaced as a `destructive` toast. The row's `is_active` reverts to its prior value on failure (no optimistic update committed).
- **F-18** **Permission denied (read).** A user without `read:page.members` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).
- **F-19** **Org-mismatch.** When `selectedOrganisation` changes mid-render and the loaded member's `organisation_id` no longer matches, the page replaces its content with `<Alert variant="destructive">` titled "This member is not in the current organisation", description "Switch back, or return to the members directory.", and a `<Button variant="outline">Back to members</Button>` that navigates to `/members`.

### Primary content — Member details (Identity)

- **F-20** The Identity card header shows the member's full name as a heading (composed per BR-AA), an `Avatar` rendering the member's initials (no `imgsrc` in v1), the membership status badge (per BR-D2), and — inline header-right — the Portal CTA (Edit in Portal / View in Portal / none, per BR-R).
- **F-21** The Identity card body shows read-only labelled fields in this order: Preferred name, First name, Last name, Email, Date of birth, Gender, Pronoun, Membership type, Membership number, Membership status, Valid from, Valid to.
- **F-22** Below the labelled fields, the Identity card body renders three read-only contact-detail rows: **Phones** (one line per `core_phone` row for the member's `person_id`, formatted as `"{phone_type.name}: {phone_number}"` separated by commas; em-dash "—" when no phones), **Email** (the member's `core_person.email`; em-dash when null), **Residential address** (`core_address.full_address` resolved from `core_person.residential_address_id`; em-dash when no `residential_address_id`), **Postal address** (`core_address.full_address` resolved from `core_person.postal_address_id`; em-dash when no `postal_address_id`).
- **F-23** Gender / Pronoun / Membership type display the resolved `name` from their respective lookup tables (`core_gender_type`, `core_pronoun_type`, `core_membership_type`); em-dash when the FK id is null.
- **F-24** Membership status badge variants: `Active` → success tone; `Provisional` → default tone; `Suspended` → muted tone; `Lapsed` → muted tone; `Resigned` → muted tone; `Revoked` → destructive tone.
- **F-25** Date fields (Date of birth, Valid from, Valid to) render in localised short date format (e.g. "5 May 2026"). `null` renders as em-dash.
- **F-26** Audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) are not displayed on the Identity card.

### Primary actions — Identity edit

- **F-27** **Unlock.** A `<Button variant="outline">Unlock</Button>` renders in the Identity card body header on the right edge when not editing and `canUpdate === true` for `useResourcePermissions('members')`. Click switches the card from read-only to edit mode. Hidden when `canUpdate === false`.
- **F-28** **Edit mode form fields.** In edit mode, the labelled-fields region is replaced by a form rendering the editable allowlist (BR-C):
  - From `core_person`: First name (text, required), Last name (text, required), Preferred name (text, optional), Email (email, optional), Date of birth (date, optional, ≤ today), Gender (select sourced from `core_gender_type`, optional), Pronoun (select sourced from `core_pronoun_type`, optional).
  - From `core_member`: Membership type (select sourced from `core_membership_type` for the current org, optional), Membership number (text, optional), Valid from (date, optional), Valid to (date, optional; if both Valid from and Valid to present, `Valid from ≤ Valid to`).
  - The contact-detail rows (Phones, Email, Residential address, Postal address) and the Membership status badge remain read-only and visible above the form.
- **F-29** **Save.** A `SaveActions` footer at the bottom of the edit-mode card renders `Cancel` (left) and `Save` (right). Click Save: validates the form against the Zod schema (BR-E); if valid, runs two UPDATEs in sequence — `core_person` (the seven editable scalars) WHERE `core_person.id = core_member.person_id`, then `core_member` (the four editable scalars) WHERE `core_member.id = :memberId`; on both succeeding, refreshes the member query, exits edit mode, and renders a `success` toast "Member saved." On any failure, the destructive toast surfaces the normalised error and the form stays open and dirty.
- **F-30** **Cancel — clean.** Click Cancel when the form is clean (no field has changed from its initial value) silently exits edit mode.
- **F-31** **Cancel — dirty.** Click Cancel when the form is dirty opens a `ConfirmationDialog` titled "Discard unsaved changes?", description "Your edits will not be saved.", confirm "Discard" (destructive variant), cancel "Continue editing". Confirm exits edit mode and resets fields to canonical data; Cancel leaves the form in edit mode.
- **F-32** **Org switch — edit mode.** When `selectedOrganisation` changes while edit mode is active, the form discards in-flight unsaved edits, exits edit mode, and the page renders either the silent rebind (member's org matches new org) or the org-mismatch alert (BR-W).

### Primary content — Additional contacts

- **F-33** The Additional contacts section renders a `DataTable` of `core_contact` rows WHERE `core_contact.person_id = core_member.person_id` (BR-I), in the columns and order: **Name**, **Type**, **Tier**, **Actions**.
- **F-34** The **Name** column shows the contact's full name composed from the contact's own `core_person` record (`core_contact.contact_person_id` → `core_person`): `preferred_name` followed by `last_name` when `preferred_name` is non-empty, otherwise `first_name` followed by `last_name`. Em-dash when `contact_person_id` is null.
- **F-35** The **Type** column shows `core_contact_type.name` resolved via `core_contact.contact_type_id`. Em-dash when `contact_type_id` is null. Title-case as seeded.
- **F-36** The **Tier** column shows a badge: "Full" (default tone) when `permission_type === 'full'`; "Notify" (muted tone) when `permission_type === 'notify'`; "None" (muted tone) when `permission_type === 'none'`.
- **F-37** The **Actions** column shows a single `View details` row trigger that opens the read-only contact details modal.
- **F-38** No add / edit / remove affordances render on the Additional contacts section in v1. The toolbar's pace-core2 default features for Create / Edit / Delete / Import / Export / hierarchical / grouping are all disabled.

### Primary actions — Additional contacts modal

- **F-39** **View details.** Click on a row's `View details` action (or click on the row itself when no other action handler is wired) opens a read-only `Dialog` showing the contact's name + type badge in the header, and in the body: Tier (badge), Phones (one line per `core_phone` row for the contact's `contact_person_id`, formatted as `"{phone_type.name}: {phone_number}"`; em-dash when none), Email (the contact's `core_person.email`; em-dash when null), Residential address (`core_address.full_address` resolved from the contact's `core_person.residential_address_id`; em-dash when none), Postal address (`core_address.full_address` resolved from the contact's `core_person.postal_address_id`; em-dash when none). Footer: a single `Close` button.
- **F-40** **Close modal.** Click Close, native escape key (DialogContent uses `dialog.showModal()`), or click outside the modal closes the dialog. The contact list does not refetch on close (the modal is read-only).

### Primary content — Member cards

- **F-41** The Member cards section renders a `DataTable` of `core_member_card` rows WHERE `core_member_card.member_id = :memberId` (regardless of `is_active`), in the columns and order: **Identifier**, **Active**, **Created at**, **Actions**.
- **F-42** The **Identifier** column shows `card_identifier` as plain text. The column is sortable; default sort is **Created at** descending.
- **F-43** The **Active** column shows a badge: "Active" (success tone) when `is_active === true`; "Inactive" (muted tone) when `is_active === false`. Sortable; sorting groups Active rows together and Inactive rows together.
- **F-44** The **Created at** column shows `created_at` formatted as a localised short date (e.g. "5 May 2026"). Default sort key, descending.
- **F-45** The **Actions** column shows a `Deactivate` row trigger when `is_active === true` and `canUpdate === true`; or a `Reactivate` row trigger when `is_active === false` and `canUpdate === true`. Hidden when `canUpdate === false`.

### Primary actions — Member cards

- **F-46** **Deactivate.** Click `Deactivate` opens a `ConfirmationDialog` titled "Deactivate card?", description "{card_identifier} will no longer scan as an active card. You can reactivate it later." (with the row's `card_identifier` interpolated), confirm "Deactivate" (destructive variant), cancel "Cancel". Confirm runs `UPDATE core_member_card SET is_active = false WHERE id = row.id`; on success: closes the dialog, refreshes the cards section, renders a `success` toast `"{card_identifier} deactivated."`. On failure: dialog closes, destructive toast surfaces the normalised error, no row mutation is committed.
- **F-47** **Reactivate.** Click `Reactivate` runs `UPDATE core_member_card SET is_active = true WHERE id = row.id` directly (no confirmation). On success: refreshes the cards section, renders a `success` toast `"{card_identifier} reactivated."`. On failure: destructive toast with the normalised error, no row mutation committed.
- **F-48** No card insert / delete / identifier mutation affordances render on the Member cards section in v1. The toolbar's pace-core2 default features for Create / Edit / Delete / Import / Export / hierarchical / grouping are all disabled.

### Primary content — Applications

- **F-49** The Applications section renders a `DataTable` of `base_application` rows joined to `core_events`, filtered by `base_application.person_id = core_member.person_id AND base_application.organisation_id = core_member.organisation_id AND base_application.status != 'draft'` (BR-O, BR-P), in the columns and order: **Event name**, **Event date**, **Status**.
- **F-50** The **Event name** column shows `core_events.event_name` as plain text. Default sort: **Event date** descending.
- **F-51** The **Event date** column shows `core_events.event_date` formatted as a localised short date (e.g. "5 May 2026"); em-dash when null.
- **F-52** The **Status** column shows a badge with `base_application.status` rendered title-case ("Submitted", "Under review", "Approved", "Rejected", "Withdrawn"). Tone: Approved → success; Rejected → destructive; Withdrawn → muted; others → default.
- **F-53** No row actions, no application detail navigation, no edits render on the Applications section. Click on a row does nothing (read-only summary).

### Primary content — Standing roles cross-slice link

- **F-54** Below the Applications section, the page renders a section heading "Standing roles" with a single `<Button variant="outline">View roles ›</Button>` underneath, navigating to `/members/:memberId/roles` (TEAM-04) on click. No in-line role list renders on Member 360 in v1.

### Primary actions — Portal handoff

- **F-55** **Edit in Portal.** A `<Button>Edit in Portal</Button>` renders inline header-right on the Identity card when (a) the acting user is NOT the target member AND (b) `useResourcePermissions('member-profile').canUpdate === true`. Click runs `launchMemberProfile({ portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN, mode: 'edit', memberId: core_member.id })`. The Portal opens in a new tab; no `returnUrl`; no `organisation_id` query param.
- **F-56** **View in Portal.** A `<Button variant="outline">View in Portal</Button>` renders inline header-right on the Identity card when (a) the acting user is NOT the target member AND (b) `useResourcePermissions('member-profile').canUpdate === false` AND (c) `useResourcePermissions('member-profile').canRead === true`. Click runs `launchMemberProfile({ portalOrigin, mode: 'view', memberId: core_member.id })`. Same new-tab / no-return-url / no-org-param contract.
- **F-57** **No Portal CTA.** When the acting user IS the target member (the target's `core_person.user_id === current user.id`), no Portal CTA renders regardless of permission. When the acting user is not the target but has neither `read:member-profile` nor `update:member-profile`, no Portal CTA renders.

### Secondary actions

- **F-58** **Search — Additional contacts.** The Additional contacts `DataTable` toolbar offers a text-search input (placeholder "Search contacts") that filters the in-memory rows by case-insensitive substring across the contact's first name, last name, preferred name, and contact type name. Clearing restores the unfiltered list.
- **F-59** **Search — Member cards.** The Member cards `DataTable` toolbar offers a text-search input (placeholder "Search cards") that filters the in-memory rows by case-insensitive substring against `card_identifier`.
- **F-60** **Search — Applications.** The Applications `DataTable` toolbar offers a text-search input (placeholder "Search applications") that filters the in-memory rows by case-insensitive substring across `core_events.event_name`.
- **F-61** **Sort.** Each `DataTable` column is sortable. Default sorts: Additional contacts → Name asc; Member cards → Created at desc; Applications → Event date desc.
- **F-62** **Pagination.** Each `DataTable` uses `initialPageSize = 25` with page size options `[10, 25, 50]`.

### Permission-conditional rendering

- **F-63** When `read:page.members` is denied at the page level, `<AccessDenied />` renders and no section content renders.
- **F-64** When `useResourcePermissions('members').canUpdate === false`, the Identity card's Unlock button is hidden and the Member cards' Deactivate / Reactivate row actions are hidden. All other content remains visible.
- **F-65** When the acting user IS the target member, all Portal CTAs are hidden regardless of `useResourcePermissions('member-profile')` values.
- **F-66** When the acting user is NOT the target member and `useResourcePermissions('member-profile').canUpdate === true`, the "Edit in Portal" CTA renders (no "View in Portal" CTA renders).
- **F-67** When the acting user is NOT the target member and `useResourcePermissions('member-profile').canUpdate === false` AND `canRead === true`, the "View in Portal" CTA renders.
- **F-68** When the acting user is NOT the target member and `useResourcePermissions('member-profile').canRead === false` AND `canUpdate === false`, no Portal CTA renders.

### Navigation

- **F-69** The page is reachable from TEAM-02 via row click on `/members` (TEAM-02 owns that navigation; TEAM-03 receives the entry).
- **F-70** The Back button at top-left of `PaceMain` navigates to `/members`.
- **F-71** The "View roles ›" button under the Standing roles heading navigates to `/members/:memberId/roles` (TEAM-04).
- **F-72** Portal CTAs open Portal `/profile/edit/:memberId` or `/profile/view/:memberId` in a new tab.

### Edge cases and constraints

- **F-73** **Concurrency.** Edits use last-write-wins. No optimistic locking; no `updated_at` watermark check. If a second admin saves between the page's initial member fetch and Save, the second-save values overwrite the first; the next refetch reflects the second-save state.
- **F-74** **Cross-org leakage prevention.** Every list query carries a defensive belt-and-braces filter: member fetch on `organisation_id = selectedOrganisation.id`; contacts query on `core_contact.organisation_id = selectedOrganisation.id`; cards query on `core_member_card.organisation_id = selectedOrganisation.id`; applications query on `base_application.organisation_id = core_member.organisation_id`. RLS would still enforce per-org isolation if the filter were absent.
- **F-75** **Stale member id.** A user navigating directly to `/members/:memberId` for a `core_member.id` they cannot read (RLS denies) sees the "Member not found" page (F-10).
- **F-76** **Deleted member.** A user navigating to a `core_member.id` whose row has `deleted_at` set sees the "Member not found" page (the member fetch filter excludes `deleted_at IS NOT NULL`).
- **F-77** **Provisional member without contacts / cards / applications.** Empty states render per F-11 / F-12 / F-13. Identity edit, Portal CTA, and Standing-roles link remain functional.
- **F-78** **Audit attribution.** Every UPDATE relies on column defaults (`auth.uid()` for `updated_by`, `now()` for `updated_at`) on the four mutated tables; the slice does not patch these columns from the client.

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`:

- **Back row** — At top-left of the `PaceMain` content area, a `<Button variant="outline">← Back to members</Button>` renders with a `ChevronLeft` icon glyph preceding the label.
- **Content stack** — Below the Back row, a single vertical stack of section cards in this order: Member details, Additional contacts, Member cards, Applications, Standing roles. Each section is a `Card` container with its own `CardHeader` (heading + optional inline header-right slot for actions) and `CardContent`. There is no top-level page heading; the member's name is rendered as the heading inside the Member details `CardHeader`.

Breakpoints: standard pace-core2 responsive behaviour applies. Each `DataTable` shows horizontal scroll on narrow viewports rather than collapsing to a card list. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Components

**Back button** (`Button` from `@solvera/pace-core/components`)
- Variant: `outline`.
- Label: `← Back to members` (the arrow glyph is rendered by the `ChevronLeft` icon from `@solvera/pace-core/icons`, preceding the text label).
- Click: navigates to `/members`.

**Member details card** (`Card`, `CardHeader`, `CardTitle`, `CardContent` from `@solvera/pace-core/components`)
- Purpose: read-only and edit-mode surface for the Identity allowlist plus inline read-only contact-detail rows.
- Heading: the member's full name (BR-AA), rendered inside `CardTitle` as a heading.
- Header-right slot: an `Avatar` (rendering the member's initials, no `imgsrc` in v1), the membership status badge (BR-D2), and the Portal CTA (BR-R).
- Body — read-only mode: a labelled-fields region with the twelve fields listed in F-21 in the order shown there (Preferred name, First name, Last name, Email, Date of birth, Gender, Pronoun, Membership type, Membership number, Membership status, Valid from, Valid to). Below that, the four contact-detail rows (Phones, Email, Residential address, Postal address) per F-22. To the right of the labelled-fields region, an `Unlock` `<Button variant="outline">Unlock</Button>` button when `canUpdate === true`.
- Body — edit mode: the labelled-fields region is replaced by a `<Form>` rendering the editable allowlist (F-28). The four contact-detail rows and the membership status badge remain visible, read-only. The form renders fields in the same order as the read-only labelled fields. A `SaveActions` footer at the bottom-right of the card renders Cancel (left) and Save (right).

**`Avatar`** (`@solvera/pace-core/components`)
- Purpose: visual person identifier in the Member details card header.
- Props: `name` set to the member's full name (BR-AA); `imgsrc` is omitted in v1; `Avatar` falls back to initials.

**Membership status badge** (`Badge` from `@solvera/pace-core/components`)
- Variant tones per F-24: Active → success; Provisional → default; Suspended → muted; Lapsed → muted; Resigned → muted; Revoked → destructive.
- Label: the enum value verbatim ("Active", "Provisional", "Suspended", "Lapsed", "Resigned", "Revoked").

**Portal CTA** (`Button` from `@solvera/pace-core/components`)
- Edit mode: `<Button>Edit in Portal</Button>` (default / primary visual).
- View mode: `<Button variant="outline">View in Portal</Button>`.
- Hidden when the conditions in F-57 hold.
- Click: invokes `launchMemberProfile(...)` per BR-S.

**Identity edit form** (`Form` + `FormField` from `@solvera/pace-core/components`)
- Validation: Zod schema authored inline within the slice; passed to `<Form schema={...}>` so `zodResolver` is applied implicitly.
- Field 1 — **First name** (`core_person.first_name`): text input via default `FormField`. Required. Trimmed length 1–100. Placeholder "First name". Helper text: omitted. Error copy: required → "First name is required."; out-of-range → "First name must be 1 to 100 characters."
- Field 2 — **Last name** (`core_person.last_name`): text input via default `FormField`. Required. Trimmed length 1–100. Placeholder "Last name". Error copy: required → "Last name is required."; out-of-range → "Last name must be 1 to 100 characters."
- Field 3 — **Preferred name** (`core_person.preferred_name`): text input via default `FormField`. Optional. Trimmed length 0–100. Placeholder "Preferred name". Error copy: out-of-range → "Preferred name must be at most 100 characters."
- Field 4 — **Email** (`core_person.email`): email input via default `FormField` with `type="email"`. Optional. Valid email format when supplied. Trimmed length 0–254. Placeholder "name@example.com". Error copy: format → "Email must be a valid email address."; out-of-range → "Email must be at most 254 characters."
- Field 5 — **Date of birth** (`core_person.date_of_birth`): date input rendered via `FormField` with the `DatePickerWithTimezone` (or `Calendar`-backed) input. Optional. Must be ≤ today's date when supplied. Error copy: future → "Date of birth cannot be in the future."
- Field 6 — **Gender** (`core_person.gender_id`): select rendered via `FormField` with `Select` / `SelectTrigger` / `SelectContent` / `SelectItem`. Optional. Options sourced from `core_gender_type` (smallint id, text name). Placeholder option labelled "Select gender" with empty value.
- Field 7 — **Pronoun** (`core_person.pronoun_id`): select rendered via `FormField` with `Select`. Optional. Options sourced from `core_pronoun_type`. Placeholder option labelled "Select pronoun".
- Field 8 — **Membership type** (`core_member.membership_type_id`): select rendered via `FormField` with `Select`. Optional. Options sourced from `core_membership_type` for `selectedOrganisation.id` (integer id, text name). Placeholder "Select membership type".
- Field 9 — **Membership number** (`core_member.membership_number`): text input via default `FormField`. Optional. Trimmed length 0–50. Placeholder "Membership number". Error copy: out-of-range → "Membership number must be at most 50 characters."
- Field 10 — **Valid from** (`core_member.valid_from`): date input via `FormField` + `DatePickerWithTimezone` (or `Calendar`). Optional.
- Field 11 — **Valid to** (`core_member.valid_to`): date input via `FormField` + `DatePickerWithTimezone` (or `Calendar`). Optional. When both Valid from and Valid to are supplied, `valid_from <= valid_to`. Error copy: range → "Valid to must be on or after Valid from."
- Submit footer: `SaveActions` with default labels "Cancel" and "Save". `saveType` is `'submit'`. `saveDisabled` is bound to `formState.isSubmitting`.

**Contact-detail rows (read-only on Identity)**
- Layout: a vertical stack of four rows, each rendered as `<dt>` + `<dd>` pairs (or a flex row with the field label on the left and the value on the right).
- Phones row: label "Phones", value composed as `"{phone_type.name}: {phone_number}"` segments separated by commas. Em-dash "—" when no phones.
- Email row: label "Email", value `core_person.email`. Em-dash when null. (Same value as Field 4 in read-only mode; both render to give the user a contact-detail summary alongside the editable field.)
- Residential address row: label "Residential address", value `core_address.full_address` resolved from `residential_address_id`. Em-dash when no `residential_address_id`.
- Postal address row: label "Postal address", value `core_address.full_address` resolved from `postal_address_id`. Em-dash when no `postal_address_id`.

**Additional contacts card** (`Card` + `DataTable`)
- Header: `CardHeader` with title "Additional contacts".
- Content: a `DataTable` rendered inside `CardContent`.
- `DataTable` props summary:
  - `data`: array of joined rows (`core_contact` + `core_person` for `contact_person_id` + `core_contact_type` for `contact_type_id`) returned by the contacts query, after the in-memory search filter is applied.
  - `rbac.pageName`: `'members'`.
  - `title`: omitted (the `CardHeader` title sits above).
  - `description`: `"{count} contacts"` where `{count}` is the unfiltered server-result count for this member.
  - `isLoading`: bound to the contacts query's loading state.
  - `emptyState`: `{ title: "No additional contacts recorded.", description: "" }`.
  - `getRowId`: `(row) => row.id`.
  - `initialPageSize`: `25`.
  - `initialSorting`: `[{ id: 'name', desc: false }]`.
  - `actions`: a single `View details` row action that opens the contact details modal.
  - `onCreateRow`, `onEditRow`, `onDeleteRow`: not used (no CRUD in v1).
  - `features`: `{ import: false, export: false, hierarchical: false, grouping: false, creation: false, editing: false, deletion: false, deleteSelected: false, selection: false, search: true, pagination: true, sorting: true, filtering: true, columnVisibility: true, columnReordering: true }`.

Additional contacts columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Name | composed from contact's `core_person` (preferred_name or first_name + last_name) | flexible | Sortable; default sort asc. Plain text. Em-dash when `contact_person_id` is null. |
| Type | `core_contact_type.name` resolved via `contact_type_id` | narrow-medium | Plain text; em-dash when `contact_type_id` is null. |
| Tier | `core_contact.permission_type` | narrow | Badge: "Full" (default tone), "Notify" (muted tone), "None" (muted tone). |
| Actions | n/a | narrow | A single `View details` trigger per row. |

Toolbar (rendered by `DataTable` inside the table caption):
- Search input — placeholder "Search contacts". Filters across the contact's first name, last name, preferred name, and contact type name.
- The toolbar does not show Create / Import / Export / Edit / Delete — features are off.

Pagination controls (rendered below the table by `DataTable`): page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Contact details modal** (`Dialog` family from `@solvera/pace-core/components`)
- Trigger: the row's `View details` action.
- Container: `<Dialog open onOpenChange><DialogPortal><DialogContent><DialogHeader><DialogTitle>{contact's full name}</DialogTitle><DialogDescription>{type badge}</DialogDescription></DialogHeader><DialogBody>{rows}</DialogBody><DialogFooter><Button variant="outline">Close</Button></DialogFooter></DialogContent></DialogPortal></Dialog>`.
- Header title: the contact's full name composed per F-34. The header sub-row renders the contact type as a `Badge` next to or below the title.
- Body: a vertical stack of four read-only rows:
  - **Tier** — `Badge` matching the same tone mapping as the table column.
  - **Phones** — one line per `core_phone` row for the contact's `contact_person_id`, formatted `"{phone_type.name}: {phone_number}"`. Em-dash when none.
  - **Email** — the contact's `core_person.email`. Em-dash when null.
  - **Residential address** — `core_address.full_address` resolved from the contact's `core_person.residential_address_id`. Em-dash when none.
  - **Postal address** — `core_address.full_address` resolved from the contact's `core_person.postal_address_id`. Em-dash when none.
- Footer: a single `<Button variant="outline">Close</Button>`.
- Close behaviour: native escape key (DialogContent uses `dialog.showModal()`), Close button, click outside.
- Focus management: focus moves to Close button on open; returns to the row's `View details` trigger on close.

**Member cards card** (`Card` + `DataTable`)
- Header: `CardHeader` with title "Member cards".
- Content: a `DataTable` rendered inside `CardContent`.
- `DataTable` props summary:
  - `data`: array of `core_member_card` rows for the member, after the in-memory search filter is applied.
  - `rbac.pageName`: `'members'`.
  - `description`: `"{count} cards"`.
  - `isLoading`: bound to the cards query's loading state.
  - `emptyState`: `{ title: "No cards recorded.", description: "" }`.
  - `getRowId`: `(row) => row.id`.
  - `initialPageSize`: `25`.
  - `initialSorting`: `[{ id: 'created_at', desc: true }]`.
  - `actions`: row-action descriptors for `Deactivate` (visible when `is_active === true && canUpdate === true`) and `Reactivate` (visible when `is_active === false && canUpdate === true`).
  - `onCreateRow`, `onEditRow`, `onDeleteRow`: not used.
  - `features`: same as the contacts card (all CRUD off; search / sort / pagination / filtering on; selection off).

Member cards columns:

| Header copy | Field | Width hint | Notes |
|---|---|---|---|
| Identifier | `card_identifier` | flexible | Plain text. Sortable. |
| Active | `is_active` | narrow | Badge: "Active" (success tone) or "Inactive" (muted tone). Sortable. |
| Created at | `created_at` | narrow | Localised short date (e.g. "5 May 2026"). Default sort desc. |
| Actions | n/a | narrow | Deactivate (when active) or Reactivate (when inactive); both gated by `canUpdate`. |

Toolbar: Search input — placeholder "Search cards"; filters by `card_identifier` substring (case-insensitive).

Pagination controls: page size dropdown (10 / 25 / 50), current page indicator, prev / next.

**Deactivate `ConfirmationDialog`** (`@solvera/pace-core/components`)
- Trigger: the `Deactivate` row action on the cards `DataTable`.
- `title`: "Deactivate card?".
- `description`: "{card_identifier} will no longer scan as an active card. You can reactivate it later." (with `card_identifier` interpolated).
- `confirmLabel`: "Deactivate".
- `cancelLabel`: "Cancel".
- `variant`: `'destructive'`.
- `onConfirm`: awaits the `is_active = false` update; closes on resolution. `isPending` reflects the in-flight mutation.

**Reactivate row action** — direct, no confirmation; uses the row's action trigger to perform the `is_active = true` update.

**Applications card** (`Card` + `DataTable`)
- Header: `CardHeader` with title "Applications".
- Content: a `DataTable` rendered inside `CardContent`.
- `DataTable` props summary:
  - `data`: array of joined rows (`base_application` + `core_events`) returned by the applications query, after the in-memory search filter is applied.
  - `rbac.pageName`: `'members'`.
  - `description`: `"{count} applications"`.
  - `isLoading`: bound to the applications query's loading state.
  - `emptyState`: `{ title: "No applications recorded.", description: "" }`.
  - `getRowId`: `(row) => row.id`.
  - `initialPageSize`: `25`.
  - `initialSorting`: `[{ id: 'event_date', desc: true }]`.
  - `actions`: empty.
  - `onCreateRow`, `onEditRow`, `onDeleteRow`: not used.
  - `features`: same as the contacts card (all CRUD off; search / sort / pagination / filtering on; selection off).

Applications columns:

| Header copy | Field / source | Width hint | Notes |
|---|---|---|---|
| Event name | `core_events.event_name` | flexible | Plain text. Sortable. |
| Event date | `core_events.event_date` | narrow | Localised short date; em-dash when null. Default sort desc. |
| Status | `base_application.status` (title-case) | narrow | Badge: tone mapping per F-52. |

Toolbar: Search input — placeholder "Search applications"; filters by `core_events.event_name` substring (case-insensitive).

**Standing roles cross-slice link section**
- A bare section under the Applications card containing:
  - A heading "Standing roles" rendered inside its own `Card` + `CardHeader` + `CardTitle`.
  - In the `CardContent`, a single `<Button variant="outline">View roles ›</Button>` (with the `ChevronRight` icon glyph after the label, sourced from `@solvera/pace-core/icons`). Click navigates to `/members/:memberId/roles`.

**Member-not-found page**
- Replaces the entire `PaceMain` content area when the member fetch returns zero rows.
- Layout: a centred vertical stack containing:
  - A heading "Member not found" (rendered as a `CardTitle`-equivalent heading or a top-level page heading inside the empty page).
  - A description paragraph "We couldn't find this member in your current organisation."
  - A `<Button variant="outline">← Back to members</Button>` linking to `/members`.

**Org-mismatch alert**
- Replaces the entire `PaceMain` content area when the loaded member's `organisation_id` differs from the new `selectedOrganisation.id` after an org switch.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>This member is not in the current organisation</AlertTitle>` and `<AlertDescription>Switch back, or return to the members directory.</AlertDescription>`. Below the alert, a `<Button variant="outline">Back to members</Button>` that navigates to `/members`.

**Member fetch error state**
- Replaces the entire `PaceMain` content area when the initial member query fails.
- Layout: an `<Alert variant="destructive">` with `<AlertTitle>Could not load member</AlertTitle>` and `<AlertDescription>` populated from the normalised `HandleSupabaseError` message. Below the alert, a `<Button>Retry</Button>` that re-runs the member query.

**Section fetch error state**
- Replaces the failing section's `DataTable` with an `<Alert variant="destructive">` containing `<AlertTitle>Could not load {section name}</AlertTitle>` (e.g. "Could not load contacts") and `<AlertDescription>` populated from the normalised error. Below the alert, a `<Button>Retry</Button>` that re-runs the section's query. Other sections continue to render.

**Toasts** — surfaced via the module-level `toast({ title, description?, variant })` from `@solvera/pace-core/components`. Variant vocabulary used by this slice: `'success'` (Save success, card mutation success), `'destructive'` (Save failure, card mutation failure). Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport, auto-dismissing after the default duration (5000 ms). The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### States

- **Loading — initial page** — Full-page `<LoadingSpinner />` centred inside the `PaceMain` content area; no section content renders. Back button does not render yet.
- **Loading — section** — Once the member resolves, each of the contacts / cards / applications sections renders its own `<LoadingSpinner />` inside its `Card` body until that section's query completes. The Member details card and the Standing roles section are unaffected.
- **Empty — Additional contacts** — The contacts `DataTable` empty state inside the section card with heading "No additional contacts recorded." No CTA. The toolbar (search) remains visible above the empty area.
- **Empty — Member cards** — The cards `DataTable` empty state with heading "No cards recorded." No CTA.
- **Empty — Applications** — The applications `DataTable` empty state with heading "No applications recorded." No CTA.
- **Member-not-found** — Replaces the page; layout per the Member-not-found component above.
- **Org-mismatch** — Replaces the page; layout per the Org-mismatch alert component above.
- **Member fetch error** — Replaces the page; layout per the Member fetch error state above.
- **Section fetch error** — Replaces only the failing section's `DataTable`; other sections unaffected.
- **Permission denied** — `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page."
- **Identity — read-only** — Card body shows the labelled-fields region with read-only values, the four contact-detail rows, the Unlock button (when `canUpdate === true`), and the inline header-right Portal CTA (when applicable).
- **Identity — edit mode (clean)** — Card body shows the form, contact-detail rows still read-only, `SaveActions` footer with Cancel and Save (Save disabled until any field changes or always available — see BR-D); membership status badge and Portal CTA remain in the header.
- **Identity — edit mode (dirty)** — Same as edit mode (clean) but the form's internal dirty-state flag is set; clicking Cancel triggers the `ConfirmationDialog` "Discard unsaved changes?".
- **Identity — saving** — Save button enters disabled / pending state; form fields remain visible; the rest of the page is unaffected.
- **Identity — save success** — Form closes, edit mode exits; `success` toast: "Member saved."; the Member details card refreshes with the new values.
- **Identity — save failure** — Form remains open and dirty; `destructive` toast surfaces the normalised error message.
- **Cards — Deactivate confirm dialog open** — Modal overlay; focus on the destructive Deactivate button; `isPending` flips on confirm.
- **Cards — mutation success** — Dialog closes (deactivate) or no dialog (reactivate); `success` toast: `"{card_identifier} {deactivated|reactivated}."`; cards section refreshes.
- **Cards — mutation failure** — Dialog closes (deactivate) or no dialog (reactivate); `destructive` toast surfaces the normalised error; row's `is_active` reverts to its prior value.
- **Contact details modal open** — Modal overlay; focus on Close button; the contact's name / type / tier / phones / email / addresses render read-only.

### Interactions

- **Back button** — Hover: pace-core2 default outline-button hover. Click: navigates to `/members`. Default / focused / disabled visuals follow pace-core2 `Button` defaults.
- **Unlock button** — Visible when `canUpdate === true` and not in edit mode. Hover: outline-button hover. Click: switches the Identity card to edit mode and moves focus to the first form input.
- **Save button** (inside `SaveActions`) — Visible only in edit mode. Click: validates form; on valid, fires the two UPDATEs; pending state shows during the in-flight mutation. On success: form closes, `success` toast renders. On failure: form stays open, `destructive` toast renders.
- **Cancel button** (inside `SaveActions`) — Visible only in edit mode. Click: when the form is clean, exits edit mode silently. When the form is dirty, opens the `ConfirmationDialog` "Discard unsaved changes?".
- **Discard ConfirmationDialog** — Modal overlay. Focus on Discard button (destructive variant). Confirm: exits edit mode, resets fields. Cancel: leaves the form in edit mode.
- **Portal CTA buttons** — Hover / focus / disabled follow pace-core2 `Button` defaults. Click: invokes `launchMemberProfile(...)`. The destination opens in a new tab.
- **Standing roles "View roles ›" button** — Hover: outline-button hover. Click: navigates to `/members/:memberId/roles`.
- **Contacts row click / "View details" action** — Hover: pace-core2 row-hover treatment. Click: opens the read-only contact details modal.
- **Cards Deactivate row action** — Visible when `is_active === true && canUpdate === true`. Click: opens the deactivate `ConfirmationDialog` with focus on the destructive button. Confirm: awaits the update, button shows pending state; on resolve the dialog closes, toast renders.
- **Cards Reactivate row action** — Visible when `is_active === false && canUpdate === true`. Click: directly performs the `is_active = true` update with no intermediate dialog. The row action shows brief pending state while the mutation is in flight.
- **Search inputs (contacts / cards / applications)** — Typing filters in-memory rows of that section in real time with no submit step. Clearing the input restores the unfiltered list. Searches are independent per section.
- **Sort headers (any DataTable)** — Click toggles asc / desc / none on that column.
- **Pagination controls (any DataTable)** — Page size dropdown changes rows per page; prev / next change page index; current page indicator updates immediately.
- **Modal Close (contact details)** — Click Close, native escape, or click outside closes the dialog. Focus returns to the row's `View details` trigger.
- **Toast** — On Save success / failure, card mutation success / failure: toast renders bottom-right and auto-dismisses after 5000 ms.

### Permission-conditional rendering

| Condition | Page entry | Identity Unlock | Card Deactivate / Reactivate | Portal "Edit in Portal" | Portal "View in Portal" |
|---|---|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a | n/a | n/a |
| Authenticated, org, `read:page.members` denied | `<AccessDenied />` | Hidden | Hidden | Hidden | Hidden |
| Authenticated, org, `read:page.members` allowed, `useResourcePermissions('members').canUpdate === false`, NOT target, no `member-profile` perms | Page visible | Hidden | Hidden | Hidden | Hidden |
| Authenticated, org, `read:page.members` allowed, `canUpdate === true` (`members`), NOT target, no `member-profile` perms | Page visible | Visible | Visible (per `is_active`) | Hidden | Hidden |
| Authenticated, org, `read:page.members` allowed, `canUpdate === true` (`members`), NOT target, `update:member-profile` allowed | Page visible | Visible | Visible (per `is_active`) | Visible | Hidden |
| Authenticated, org, `read:page.members` allowed, `canUpdate === true` (`members`), NOT target, `read:member-profile` allowed only | Page visible | Visible | Visible (per `is_active`) | Hidden | Visible |
| Authenticated, org, `read:page.members` allowed, IS target | Page visible | Visible iff `canUpdate` (`members`) | Visible (per `is_active`) iff `canUpdate` (`members`) | Hidden | Hidden |

---

## §6 Business rules

**BR-A — Identifier in path.**
- Input: a navigation to `/members/:memberId`.
- Output: `:memberId` is interpreted as `core_member.id` (uuid). Never `core_person.id`. The member fetch query filters `core_member.id = :memberId AND organisation_id = selectedOrganisation.id AND deleted_at IS NULL`.
- Edge: a member-not-found UX renders when the query returns zero rows for any reason (unknown id, deleted member, cross-org member).

**BR-B — Org-scoped reads.**
- Input: any list query in this slice.
- Output: every query filters by `selectedOrganisation.id` defensively. Member fetch on `core_member.organisation_id = selectedOrganisation.id`; contacts query on `core_contact.organisation_id = selectedOrganisation.id`; cards query on `core_member_card.organisation_id = selectedOrganisation.id`; applications query on `base_application.organisation_id = core_member.organisation_id`. RLS enforces the same isolation server-side.

**BR-C — Editing allowlist.**
- `core_person` editable scalars: `first_name`, `last_name`, `preferred_name`, `email`, `date_of_birth`, `gender_id`, `pronoun_id`. NO other `core_person` fields are editable from this slice.
- `core_member` editable scalars: `membership_type_id`, `membership_number`, `valid_from`, `valid_to`. NO other `core_member` fields are editable from this slice.
- NOT editable in v1: PK / FK linkage, `organisation_id`, `person_id`, `user_id`, `membership_status`, audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`), generated fields, file refs, medical info, billing info, event-registration detail, photo, phones, addresses.

**BR-D — Edit pattern.**
- Input: a click on the Identity card's Unlock button, or on Cancel / Save in edit mode.
- Output:
  - Unlock: switches the card to edit mode, replacing the labelled-fields region with the form. The contact-detail rows and membership status badge remain read-only. Save and Cancel render in `SaveActions` footer.
  - Cancel — clean: exits edit mode silently and rebinds form values to canonical data.
  - Cancel — dirty: opens a `ConfirmationDialog` titled "Discard unsaved changes?", description "Your edits will not be saved.", confirm "Discard" (destructive variant), cancel "Continue editing". Confirm exits edit mode and resets fields. Cancel leaves the form in edit mode.
  - Save: validates the form; on valid, runs the two UPDATEs; on success, exits edit mode and renders the success toast; on failure, stays in edit mode with the dirty state still set.

**BR-D2 — Membership status badge tones.**
- Input: `core_member.membership_status` enum value.
- Output: badge tone — Active → success; Provisional → default; Suspended → muted; Lapsed → muted; Resigned → muted; Revoked → destructive. Label is the enum value verbatim.

**BR-E — Field validation (Identity edit).**
- `first_name` (required): trimmed length 1–100. Required → "First name is required."; out-of-range → "First name must be 1 to 100 characters."
- `last_name` (required): trimmed length 1–100. Required → "Last name is required."; out-of-range → "Last name must be 1 to 100 characters."
- `preferred_name` (optional): trimmed length 0–100. Out-of-range → "Preferred name must be at most 100 characters."
- `email` (optional): when supplied, valid email format; trimmed length 0–254. Format → "Email must be a valid email address."; out-of-range → "Email must be at most 254 characters."
- `date_of_birth` (optional): date; when supplied, `<= today`. Future → "Date of birth cannot be in the future."
- `gender_id` (optional): smallint FK to `core_gender_type.id`. Validation: if supplied, must match a row id from the lookup query.
- `pronoun_id` (optional): smallint FK to `core_pronoun_type.id`. Same lookup-existence validation.
- `membership_type_id` (optional): integer FK to `core_membership_type.id` for `selectedOrganisation.id`. Same lookup-existence validation.
- `membership_number` (optional): trimmed length 0–50. Out-of-range → "Membership number must be at most 50 characters."
- `valid_from` (optional): date.
- `valid_to` (optional): date. When both `valid_from` and `valid_to` are supplied, `valid_from <= valid_to`. Range → "Valid to must be on or after Valid from."

**BR-F — Save error handling.**
- Input: Save mutation failure.
- Output: Failure normalised through `HandleSupabaseError(error, { context })` (`context` is `'core_person'` for the person UPDATE failure; `'core_member'` for the member UPDATE failure). A `destructive` toast surfaces the normalised message. The form remains open and dirty.
- Edge: when the person UPDATE succeeds but the member UPDATE fails, the slice still surfaces the `destructive` toast for the member failure; the person changes have already committed (no transaction). The form stays open; the user can re-attempt Save (which will re-run both UPDATEs idempotently).

**BR-G — Save success.**
- Input: both UPDATEs (`core_person` and `core_member`) succeed.
- Output: refresh the member query; close edit mode; render `success` toast "Member saved."

**BR-H — Mutation contract.**
- Input: any UPDATE on `core_person`, `core_member`, or `core_member_card` originated by this slice.
- Output: The mutation goes via `useSecureSupabase().from(...)`. Server-side authorisation is enforced by RLS policies that gate on `check_user_is_org_admin(organisation_id)` (already in place on dev). The slice does not author these RLS policies; they exist today and work for org-admin staff. The future cross-app convergence to RBAC-checked RLS for these tables is informational only — see §17 References.
- Edge: a non-org-admin staff member with `read:page.members` (page guard satisfied) but no `org_admin` role still cannot mutate the row — RLS denies. The destructive toast surfaces the normalised RLS deny message.

**BR-I — Contacts ownership.**
- Input: the contacts list query.
- Output: rows where `core_contact.person_id = core_member.person_id` (the additional contacts the member has registered). `core_contact.contact_person_id` resolves to the contact's own `core_person` record (used for name, phones, email, address display).

**BR-J — Contacts CRUD scope.**
- Input: any user attempt to add / edit / remove a contact.
- Output: the surface offers no add / edit / remove affordance in v1. The Additional contacts `DataTable` has `features.creation: false`, `features.editing: false`, `features.deletion: false`. Modal is read-only with a single Close button. Adding / editing / removing contacts is deferred to a follow-up slice (TEAM-03.x) or routed through Portal handoff.

**BR-K — Contact permission tier.**
- Input: `core_contact.permission_type` value.
- Output: live shape is `TEXT NOT NULL` with `CHECK (permission_type = ANY (ARRAY['full', 'notify', 'none']))`. Display copy: "Full" (default tone), "Notify" (muted tone), "None" (muted tone), all title-case.

**BR-L — Contact type display.**
- Input: `core_contact.contact_type_id` value.
- Output: display the seeded `core_contact_type.name` verbatim. Six rows on dev: "Parent / Guardian", "Carer", "Spouse/Partner", "Family", "Friend", "Other" (sort_order skips 2; do not invent a row at that sort order).

**BR-M — Cards lifecycle.**
- Input: a click on Deactivate or Reactivate row action.
- Output:
  - Deactivate: opens the deactivate `ConfirmationDialog`. On Confirm: `UPDATE core_member_card SET is_active = false WHERE id = row.id`; on success: refresh cards, success toast; on failure: destructive toast, no row mutation committed.
  - Reactivate: directly runs `UPDATE core_member_card SET is_active = true WHERE id = row.id` (no confirmation); on success: refresh cards, success toast; on failure: destructive toast, no row mutation committed.
- Edge: NO insert / delete / identifier mutation in v1. `card_identifier` is immutable from this slice; `core_member_card_card_identifier_key` UNIQUE remains a global constraint and the slice never inserts a new row.

**BR-N — Cards confirmation pattern.**
- Deactivate: `ConfirmationDialog` with `variant="destructive"`, `title="Deactivate card?"`, `description="{card_identifier} will no longer scan as an active card. You can reactivate it later."`, `confirmLabel="Deactivate"`, `cancelLabel="Cancel"`.
- Reactivate: no confirmation. The row action performs the update directly.

**BR-O — Applications join and org filter.**
- Input: the applications list query.
- Output: rows from `base_application` joined to `core_events` WHERE `base_application.person_id = core_member.person_id AND base_application.organisation_id = core_member.organisation_id`. Join `core_events` on `base_application.event_id = core_events.event_id`.
- Edge: the FK type relationship between `base_application.event_id` (uuid per `information_schema`) and `core_events.event_id` (text per `information_schema`) is re-verified via MCP at §15. If the embedded PostgREST select fails, the build agent swaps to a manual JOIN via RPC. The slice ships against the embedded select as the default; the §15 verification confirms or overrides.

**BR-P — Applications status display.**
- Input: `base_application.status` text values.
- Output: filter `status != 'draft'`. Render the remaining values as title-case in a `Badge`: "Submitted" (default tone), "Under review" (default tone), "Approved" (success tone), "Rejected" (destructive tone), "Withdrawn" (muted tone).

**BR-Q — Applications cross-app permission.**
- Input: a SELECT on `base_application` from the TEAM app.
- Output: server-side RLS on `base_application` requires `data_check_rbac_permission_with_context('read:page.applications', 'applications', organisation_id, event_id, data_get_app_id('BASE'))` OR `is_super_admin`. Staff are assumed to hold BASE `read:page.applications`. When they do not, the query returns zero rows (RLS deny) and the Applications section renders the empty state ("No applications recorded.") — same UX as the no-data case. The cross-app dependency is documented in §10.

**BR-R — Portal CTA display.**
- Input: the acting user's identity, the target member's `core_person.user_id`, and `useResourcePermissions('member-profile')` results.
- Output: decision tree:
  1. If `current user.id === target's core_person.user_id` (acting user IS target member), render no Portal CTA.
  2. Else if `useResourcePermissions('member-profile').canUpdate === true`, render `<Button>Edit in Portal</Button>`.
  3. Else if `useResourcePermissions('member-profile').canRead === true`, render `<Button variant="outline">View in Portal</Button>`.
  4. Else, render no Portal CTA.

**BR-S — Portal CTA URL.**
- Input: a click on the Edit-in-Portal or View-in-Portal CTA.
- Output: invoke `launchMemberProfile({ portalOrigin, mode, memberId: core_member.id })` from `@solvera/pace-core/member-profile-launch`. `mode` is `'edit'` for the Edit CTA and `'view'` for the View CTA. `portalOrigin` is `import.meta.env.VITE_PORTAL_ORIGIN`. The Portal opens in a new tab via the helper's default `window.open` behaviour. NO `returnUrl`. NO `organisation_id` query param. URL shapes are `{portalOrigin}/profile/edit/{memberId}` and `{portalOrigin}/profile/view/{memberId}`.

**BR-T — Portal CTA gate.**
- Input: a build attempt to wire the Portal CTA.
- Output: until `@solvera/pace-core/member-profile-launch` exports `buildMemberProfileLaunchUrl` and `launchMemberProfile`, the Portal CTA section cannot render. Implementation gate captured in §15. Everything else in TEAM-03 (Identity edit, contacts read, cards, applications, Standing-roles link) builds without this gate; only the Portal CTA section is feature-gated.

**BR-U — Portal env config.**
- Input: the slice's read of the Portal origin.
- Output: read from `import.meta.env.VITE_PORTAL_ORIGIN` (a string, expected to be an absolute origin like `https://portal.example.com`). Pass into `buildMemberProfileLaunchUrl({ portalOrigin, ... })`. Not hardcoded in slice code. The slice does not invent any other env-var name.

**BR-V — Cross-slice link to roles.**
- Input: page render after the member resolves.
- Output: the Standing roles section renders a heading "Standing roles" and a `<Button variant="outline">View roles ›</Button>` underneath. Click navigates to `/members/:memberId/roles` (TEAM-04). No in-line role list renders on Member 360 in v1.

**BR-W — Org switch.**
- Input: `selectedOrganisation` changes while the page is mounted.
- Output: the slice refetches the member against the new org. If the member's `organisation_id === selectedOrganisation.id` after the refetch, the page silently rebinds (form discards in-flight unsaved edits and exits edit mode if open; existing modals close). If the member's `organisation_id !== selectedOrganisation.id`, the page replaces its content with the org-mismatch alert (§5 component above) plus a "Back to members" button.

**BR-X — Concurrency.**
- Input: any UPDATE originated by this slice.
- Output: last-write-wins. No optimistic locking; no `updated_at` watermark check; no `If-Match` header or version column. Concurrent edits resolve to the second-save state on the next refetch.
- Edge: if a second admin saves between this user's read and Save, the second admin's values are overwritten by this Save. The slice does not warn the user.

**BR-Y — Action permission gating.**
- Input: `useResourcePermissions('members')` results and the `useResourcePermissions('member-profile')` results, plus the acting-user-is-target check.
- Output:
  - Identity Unlock button: hidden when `useResourcePermissions('members').canUpdate === false`.
  - Cards Deactivate / Reactivate row actions: hidden when `useResourcePermissions('members').canUpdate === false`.
  - Portal CTAs: per BR-R.
- Edge: page entry remains gated by `<PagePermissionGuard pageName="members" operation="read">` regardless of any of the above.

**BR-Z — Self-as-target exclusion.**
- Input: comparison of acting user's `id` against the target member's `core_person.user_id`.
- Output: when equal, all Portal CTAs are hidden regardless of `useResourcePermissions('member-profile')` values. Self-edit by the target member is via Portal self-service, not via TEAM.

**BR-AA — Member name composition.**
- Input: `core_person.first_name`, `last_name`, `preferred_name`.
- Output: when `preferred_name` is non-empty (after trim), full name is `"{preferred_name} {last_name}"`. Otherwise full name is `"{first_name} {last_name}"`. Used for the Identity card heading, `usePaceMain({ printTitle })`, and the contact details modal heading (with the contact's own person record).

**BR-BB — Audit attribution.**
- Input: any UPDATE originated by this slice.
- Output: payload omits `created_at`, `updated_at`, `created_by`, `updated_by`. These columns are populated server-side via column defaults (`now()`, `auth.uid()`) and database triggers that refresh `updated_at` / `updated_by` on UPDATE. The slice never patches these columns from the client.

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. Member 360 lives behind `/members/:memberId`.

### Read contracts

- **Member fetch.** `useSecureSupabase().from('core_member').select('id, person_id, organisation_id, membership_type_id, membership_number, membership_status, valid_from, valid_to, joined_at, deleted_at, core_person!inner(id, first_name, last_name, preferred_name, email, date_of_birth, gender_id, pronoun_id, user_id, residential_address_id, postal_address_id), core_membership_type(id, name), core_gender_type(id, name), core_pronoun_type(id, name), residential_address:core_address!core_person_residential_address_id_fkey(id, full_address), postal_address:core_address!core_person_postal_address_id_fkey(id, full_address)').eq('id', :memberId).eq('organisation_id', selectedOrganisation.id).is('deleted_at', null).maybeSingle()`. Returns one row or `null`. The build agent confirms the FK alias names against dev-db; if the alias names differ, the slice substitutes the verified alias.
- **Phones (member's own).** `useSecureSupabase().from('core_phone').select('id, phone_number, phone_type_id, person_id, core_phone_type(id, name)').eq('person_id', core_member.person_id)`.
- **Contacts list.** `useSecureSupabase().from('core_contact').select('id, person_id, contact_person_id, contact_type_id, permission_type, organisation_id, contact_person:core_person!core_contact_contact_person_id_fkey(id, first_name, last_name, preferred_name, email, residential_address_id, postal_address_id), core_contact_type(id, name)').eq('person_id', core_member.person_id).eq('organisation_id', selectedOrganisation.id)`.
- **Contacts modal — phones for a contact.** On modal open: `useSecureSupabase().from('core_phone').select('id, phone_number, phone_type_id, person_id, core_phone_type(id, name)').eq('person_id', contact.contact_person_id)`.
- **Contacts modal — addresses for a contact.** On modal open, addresses are resolved via two `core_address` reads keyed on the contact's `core_person.residential_address_id` and `postal_address_id` respectively (or pre-joined if PostgREST FK alias is supported in the same shape as the member fetch).
- **Cards list.** `useSecureSupabase().from('core_member_card').select('id, member_id, organisation_id, card_identifier, is_active, created_at').eq('member_id', :memberId).eq('organisation_id', selectedOrganisation.id)`.
- **Applications list.** `useSecureSupabase().from('base_application').select('id, person_id, event_id, organisation_id, status, submitted_at, status_updated_at, core_events!inner(event_id, event_name, event_date)').eq('person_id', core_member.person_id).eq('organisation_id', core_member.organisation_id).neq('status', 'draft')`. Note the `event_id` FK type re-verification step in §15.
- **Lookup — `core_gender_type`.** `useSecureSupabase().from('core_gender_type').select('id, name').order('sort_order', { ascending: true })` for the Gender select. Fetched on demand when edit mode opens.
- **Lookup — `core_pronoun_type`.** `useSecureSupabase().from('core_pronoun_type').select('id, name').order('sort_order', { ascending: true })` for the Pronoun select.
- **Lookup — `core_membership_type`.** `useSecureSupabase().from('core_membership_type').select('id, name').eq('organisation_id', selectedOrganisation.id).eq('is_active', true).order('name', { ascending: true })` for the Membership type select.

### Query-key contract

- Member fetch: `['member', :memberId, selectedOrganisation.id]`.
- Phones (member): `['member', :memberId, 'phones']`.
- Contacts list: `['member', :memberId, 'contacts', selectedOrganisation.id]`.
- Contact phones / addresses (per contact): `['contact', contact.id, 'phones']`, `['contact', contact.id, 'addresses']`.
- Cards list: `['member', :memberId, 'cards', selectedOrganisation.id]`.
- Applications list: `['member', :memberId, 'applications', selectedOrganisation.id]`.
- Lookups: `['lookup', 'gender-types']`, `['lookup', 'pronoun-types']`, `['lookup', 'membership-types', selectedOrganisation.id]`.
- Save success invalidates the member fetch and Save-related lookups. Card mutation success invalidates the cards list. Org switch invalidates all of the above against the new org.

### Write contracts

All writes go via `useSecureSupabase().from(...)` against the live `check_user_is_org_admin(organisation_id)` RLS gate.

- **Identity Save — `core_person` UPDATE.** `.from('core_person').update({ first_name, last_name, preferred_name, email, date_of_birth, gender_id, pronoun_id }).eq('id', core_member.person_id).select().single()`. Success: continue to the `core_member` UPDATE. Failure: normalised `HandleSupabaseError(error, { context: 'core_person' })` and `destructive` toast; form remains open.
- **Identity Save — `core_member` UPDATE.** `.from('core_member').update({ membership_type_id, membership_number, valid_from, valid_to }).eq('id', :memberId).select().single()`. Success: refetch member, close edit mode, success toast. Failure: normalised `HandleSupabaseError(error, { context: 'core_member' })` and `destructive` toast; form remains open. Payload omits `organisation_id`, `person_id`, `user_id`, `membership_status`, audit fields.
- **Card Deactivate UPDATE.** `.from('core_member_card').update({ is_active: false }).eq('id', card.id).select().single()`. Success: refetch cards, success toast. Failure: normalised `HandleSupabaseError(error, { context: 'core_member_card' })` and `destructive` toast.
- **Card Reactivate UPDATE.** `.from('core_member_card').update({ is_active: true }).eq('id', card.id).select().single()`. Same success / failure pattern.

### RLS / permission contracts

- **SELECT** on `core_member` is permitted on dev by `rbac_select_core_member` (super-admin OR own person OR org access via `core_member_role`) and `rbac_select_core_member_delegated` (uses `check_user_pace_member_access_via_member_id(id)`).
- **SELECT** on `core_person` is permitted by `rbac_select_core_person` (super-admin OR own user OR via `check_user_person_access_via_member_roles(id)`).
- **SELECT** on `core_phone` is permitted by `rbac_select_core_phone` (super-admin OR own person OR org access via `core_member_role`).
- **SELECT** on `core_address` is permitted by `rbac_select_core_address` and chained policies.
- **SELECT** on `core_contact` is permitted by `rbac_select_core_contact` (org-admin chain via `core_member_role` plus owner-person path).
- **SELECT** on `core_member_card` is permitted by `rbac_select_core_member_card` via `core_member_card_visible_to_user(id, safe_get_user_id_for_rls())`.
- **SELECT** on `base_application` is permitted by `rbac_select_base_application` via `data_check_rbac_permission_with_context('read:page.applications', 'applications', organisation_id, event_id, data_get_app_id('BASE'))` OR `is_super_admin`. **Cross-app permission dependency** — TEAM staff must hold BASE `read:page.applications` to read application rows. When they do not, the query returns zero rows (RLS deny) and the Applications section renders the empty state.
- **SELECT** on `core_events` is permitted by `rbac_select_core_events` via `check_user_event_access(event_id)` OR org-public visibility paths.
- **SELECT** on `core_membership_type` is permitted on dev by `read_team_membership_types` (`USING is_authenticated_user()`).
- **SELECT** on `core_gender_type`, `core_pronoun_type`, `core_contact_type` is permitted by their `_type` lookup-table SELECT policies (`USING is_authenticated_user()`).
- **UPDATE** on `core_person` requires `check_user_is_org_admin(organisation_id)` chained via `core_member_role`. The slice authors against this live gate.
- **UPDATE** on `core_member` requires `check_user_is_org_admin(organisation_id)` directly. The slice authors against this live gate.
- **UPDATE** on `core_member_card` requires `is_super_admin OR check_user_is_org_admin(organisation_id)`. The slice authors against this live gate.
- **DELETE** is not used; no DELETE policy is required. **INSERT** is not used.

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-03 calls the module-level `toast(...)` and relies on this mount; without it, `toast(...)` throws.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu, and the `PaceAppLayout` chrome. TEAM-03 renders inside that chrome.
- **TEAM-02** owns the directory list at `/members`. TEAM-02 navigates to TEAM-03 via row click using `core_member.id`. TEAM-03's Back button navigates back to `/members`.
- **TEAM-04** owns `/members/:memberId/roles`. TEAM-03's Standing-roles section renders a "View roles ›" button that navigates to `/members/:memberId/roles`.
- **TEAM-05** owns `/approvals` and member-request review. TEAM-03 reads `core_member` rows the same way TEAM-05 does; TEAM-03 does not modify `team_member_request`.
- **TEAM-06** owns `core_membership_type` mutations; TEAM-03 reads `core_membership_type.id` and `name` for the Membership type select.
- **PORTAL** owns `/profile/view/:memberId` and `/profile/edit/:memberId`. TEAM-03 hands off to PORTAL via `launchMemberProfile({ portalOrigin, mode, memberId: core_member.id })` from `@solvera/pace-core/member-profile-launch`. The hand-off opens in a new tab. Portal resolves organisation context from `core_member.id` via the delegated access gate (`check_user_pace_member_access_via_member_id`).

### ID contracts

- `core_member.id` (uuid) — primary identifier in the route path and in the Portal launch URL. Consumed by TEAM-04 (for the roles route) and PORTAL (for the profile route).
- `core_member.person_id` (uuid) — used internally for the contacts query (`core_contact.person_id = core_member.person_id`), the applications query (`base_application.person_id = core_member.person_id`), the phones query, and the `core_person` UPDATE.
- `core_member.organisation_id` (uuid) — used internally for org-scoped read filters and as the WHERE clause anchor on the member fetch.
- `core_contact.contact_person_id` (uuid) — resolves to the contact's own `core_person` record for name / phones / email / address display in the modal.

---

## §8 Data and schema references

### Tables accessed

| Table | Access | Via |
|---|---|---|
| `core_member` | SELECT, UPDATE | `useSecureSupabase()` |
| `core_person` | SELECT (joined), UPDATE | `useSecureSupabase()` |
| `core_phone` | SELECT (joined for member; SELECT for contact's phones on modal open) | `useSecureSupabase()` |
| `core_phone_type` | SELECT (joined) | `useSecureSupabase()` |
| `core_address` | SELECT (joined for member; SELECT for contact's addresses on modal open) | `useSecureSupabase()` |
| `core_contact` | SELECT | `useSecureSupabase()` |
| `core_contact_type` | SELECT (joined) | `useSecureSupabase()` |
| `core_member_card` | SELECT, UPDATE | `useSecureSupabase()` |
| `base_application` | SELECT (joined to `core_events`) | `useSecureSupabase()` |
| `core_events` | SELECT (joined) | `useSecureSupabase()` |
| `core_membership_type` | SELECT (lookup for select; joined for display) | `useSecureSupabase()` |
| `core_gender_type` | SELECT (lookup; joined for display) | `useSecureSupabase()` |
| `core_pronoun_type` | SELECT (lookup; joined for display) | `useSecureSupabase()` |
| `core_member_role` | (indirect — RLS-only) | RLS chain for `org_admin` resolution |

### `core_member` — relevant columns (live dev-db)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `person_id` | uuid | NO | — |
| `organisation_id` | uuid | NO | — |
| `membership_status` | `pace_membership_status` enum | YES | `'Provisional'` |
| `membership_type_id` | integer | YES | — |
| `membership_number` | text | YES | — |
| `valid_from` | date | YES | — |
| `valid_to` | date | YES | — |
| `joined_at` | timestamptz | NO | `now()` |
| `deleted_at` | timestamptz | YES | — |
| `created_at`, `updated_at`, `created_by`, `updated_by` | per dev schema | — | server-side defaults / triggers |

`pace_membership_status` enum (live): `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked`.

### `core_person` — relevant columns

| Column | Type | Nullable | FK target |
|---|---|---|---|
| `id` | uuid | NO | — |
| `first_name` | text | NO | — |
| `last_name` | text | NO | — |
| `preferred_name` | text | YES | — |
| `email` | text | YES | — |
| `date_of_birth` | date | YES | — |
| `gender_id` | smallint | YES | `core_gender_type.id` |
| `pronoun_id` | smallint | YES | `core_pronoun_type.id` |
| `user_id` | uuid | YES | `auth.users.id` |
| `residential_address_id` | uuid | YES | `core_address.id` |
| `postal_address_id` | uuid | YES | `core_address.id` |

### `core_contact` — relevant columns

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | — |
| `person_id` | uuid | NO | FK → `core_person`; the owner of the contact record |
| `contact_person_id` | uuid | YES | FK → `core_person`; the contact themselves |
| `user_id` | uuid | NO | FK → `auth.users` |
| `organisation_id` | uuid | NO | FK → `core_organisations` |
| `contact_type_id` | smallint | YES | FK → `core_contact_type`, ON DELETE RESTRICT |
| `permission_type` | text | NO | `CHECK (permission_type = ANY (ARRAY['full', 'notify', 'none']))` |

`core_contact_type` seed (six rows, dev): "Parent / Guardian" (id 1, sort_order 1), "Carer" (id 2, sort_order 3), "Spouse/Partner" (id 3, sort_order 4), "Family" (id 4, sort_order 5), "Friend" (id 5, sort_order 6), "Other" (id 6, sort_order 7). `sort_order` skips 2.

### `core_member_card` — relevant columns

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NO |
| `member_id` | uuid | NO (FK → `core_member`, ON DELETE CASCADE) |
| `organisation_id` | uuid | NO |
| `card_identifier` | text | NO (UNIQUE — global) |
| `is_active` | boolean | NO |
| `created_at`, `updated_at`, `created_by`, `updated_by` | per dev schema | server-side |

### `base_application` — relevant columns and constraints

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | — |
| `event_id` | uuid | NO | FK → `core_events.event_id` (re-verify type at §15) |
| `person_id` | uuid | NO | FK → `core_person.id` |
| `organisation_id` | uuid | NO | — |
| `status` | text | NO | `CHECK (status = ANY (ARRAY['draft','submitted','under_review','approved','rejected','withdrawn']))` |
| `submitted_at` | timestamptz | YES | — |
| `status_updated_at` | timestamptz | YES | — |

UNIQUE constraint: `(event_id, person_id)` — one application per person per event.

### `core_events` — relevant columns

| Column | Type | Nullable |
|---|---|---|
| `event_id` | text | NO (PK; verified type per `information_schema`) |
| `event_name` | varchar | NO |
| `event_date` | date | YES |
| `organisation_id` | uuid | NO |

### Dev-db verification (project: `rkytnffgmwnnmewevqgp`)

Every verification step here targets dev-db only.

- Confirm `core_member` UPDATE RLS uses `check_user_is_org_admin(organisation_id)` (or chained via `core_member_role`) — the live gate this slice authors against.
- Confirm `core_person` UPDATE RLS uses `check_user_is_org_admin(...)` chained via `core_member_role` for the target person.
- Confirm `core_member_card` UPDATE RLS includes `is_super_admin OR check_user_is_org_admin(organisation_id)`.
- Confirm `core_contact.permission_type` is `text NOT NULL` with `CHECK ((permission_type = ANY (ARRAY['full', 'notify', 'none'])))`. The cross-app decisions log mentions a Postgres enum `core_contact_access_level`; the live shape is the TEXT + CHECK pair, not an enum.
- Confirm `core_contact_type` seed contains the six rows listed above with "Parent / Guardian" at id 1.
- Confirm `pace_membership_status` enum values match the six listed: `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked`.
- Confirm `rbac_apps` row `name = 'TEAM'`, `is_active = true`.
- Confirm `rbac_app_pages` row for `page_name = 'members'`, `app_id = data_get_app_id('TEAM')`, `scope_type = 'organisation'` is in place (post-TEAM-01 seeding; same row TEAM-02 uses).
- Confirm `rbac_app_pages` row for `page_name = 'member-profile'` (singular) under the PACE app (`app_id = data_get_app_id('PACE')`) exists for the Portal CTA's resource permission resolution.
- Confirm `check_user_pace_member_access_via_member_id(p_member_id uuid) RETURNS boolean` exists (DB-417 implemented).
- Confirm `core_member_card_card_identifier_key UNIQUE (card_identifier)` is global on dev.
- **§15 verification step for the `base_application.event_id` ↔ `core_events.event_id` FK type relationship** — see §15.

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `data_check_rbac_permission_with_context` helper; `data_get_app_id`. Future cross-app convergence to RBAC-checked RLS for `core_person`, `core_member`, `core_contact`, `core_member_card` is informational only — see §17 References.
- `pace-core2/packages/core/docs/requirements/CR24-cross-app-member-profile-launch.md` — Portal handoff URL contract, helper surface (`buildMemberProfileLaunchUrl`, `launchMemberProfile`, `MemberProfileLaunchMode`), env config. Implementation gate captured in §15.
- `pace-core2/packages/core/docs/database/domains/team.md` — `core_member`, `core_person`, `core_contact`, `core_member_card`, `core_phone`, `core_address` shapes.

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for every read and UPDATE |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="members"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useResourcePermissions` | `@solvera/pace-core/rbac` | (a) `'members'` for Unlock + card row actions; (b) `'member-profile'` (singular) for Portal CTA branching |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for org filters and org-switch detection |
| `useUnifiedAuth` | `@solvera/pace-core/hooks` | Read the acting user's id for the acting-user-IS-target-member check |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set dynamic `printTitle` to the member's full name on member resolve |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `@solvera/pace-core/components` | Section panel containers (Identity, Additional contacts, Member cards, Applications, Standing roles) |
| `Button` | `@solvera/pace-core/components` | Back, Unlock, View roles ›, Edit / View in Portal, Retry, Close (modal) |
| `SaveActions` | `@solvera/pace-core/components` | Cancel + Save footer for Identity edit form |
| `Form`, `FormField` | `@solvera/pace-core/components` | Identity edit form root and labelled fields |
| `Input` | `@solvera/pace-core/components` | Underlying text / email / number input rendered by `FormField` |
| `Label` | `@solvera/pace-core/components` | Label primitive used by `FormField` |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | `@solvera/pace-core/components` | Gender / Pronoun / Membership type selects |
| `DatePickerWithTimezone` | `@solvera/pace-core/components` | Date inputs (Date of birth, Valid from, Valid to) |
| `Avatar` | `@solvera/pace-core/components` | Initials-only person identifier on the Identity card header |
| `Dialog`, `DialogPortal`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose` | `@solvera/pace-core/components` | Read-only contact details modal |
| `ConfirmationDialog` | `@solvera/pace-core/components` | Discard-unsaved-changes confirm and Card deactivate confirm |
| `DataTable` | `@solvera/pace-core/components` | Additional contacts, Member cards, Applications tables |
| `Alert`, `AlertTitle`, `AlertDescription` | `@solvera/pace-core/components` | Member fetch error, section fetch error, org-mismatch alert |
| `Badge` | `@solvera/pace-core/components` | Membership status, contact tier, card Active, application status |
| `LoadingSpinner` | `@solvera/pace-core/components` | Full-page initial loading; section-level loading after member resolves |
| `toast` | `@solvera/pace-core/components` | Module-level toast for Save / card mutation success and failure |
| `HandleSupabaseError` | `@solvera/pace-core/utils` | Normalise Supabase errors for inline `Alert` description and toast copy |
| `ChevronLeft`, `ChevronRight` | `@solvera/pace-core/icons` | Back-button glyph and View-roles glyph |
| `buildMemberProfileLaunchUrl`, `launchMemberProfile`, `MemberProfileLaunchMode` | `@solvera/pace-core/member-profile-launch` | Portal handoff URL builder and launcher (gated by §15 — see CR24) |

### §9.2 Slice-specific caveats

- **`useSecureSupabase` returns the base client when no organisation is resolved.** TEAM-01's `AuthenticatedShell` no-org empty state prevents this slice from rendering with `selectedOrganisation === null`, but defensive checks in query handlers must abort the SELECT / UPDATE when `selectedOrganisation` is null mid-render (for example during an org switch). Do not issue cross-org reads.
- **`useResourcePermissions` resource keys are different for the two consumption sites.** Use `'members'` (plural, matches `rbac_app_pages` row under TEAM app) for the Unlock and card row actions. Use `'member-profile'` (singular, matches `rbac_app_pages` row under PACE app) for the Portal CTA branching. The architecture text uses plural `'member-profiles'` in the Portal-handoff section; the slice authors against the singular live row per global operating rules.
- **`DataTable` features for read-only sections.** Additional contacts, Member cards, and Applications all set `features.import: false`, `features.export: false`, `features.hierarchical: false`, `features.grouping: false`, `features.creation: false`, `features.editing: false`, `features.deletion: false`, `features.deleteSelected: false`, `features.selection: false`, `features.search: true`, `features.pagination: true`, `features.sorting: true`, `features.filtering: true`, `features.columnVisibility: true`, `features.columnReordering: true`. Do not pass `onCreateRow`, `onEditRow`, or `onDeleteRow`. Member cards exposes `Deactivate` / `Reactivate` via the `actions` prop only.
- **`DatePickerWithTimezone` for date-only fields.** When the field is a pure date with no time component (`date_of_birth`, `valid_from`, `valid_to`), pass the date in the input format the picker accepts and persist back to the column as a date (no time, no tz). The picker is sufficient for date-only fields; the slice does not introduce a separate date-only component.
- **`launchMemberProfile` opens a new tab via `window.open`.** Browser pop-up blockers may suppress the tab if the helper is invoked outside a direct user-click handler. Wire the CTA's `onClick` to call the helper synchronously; do not defer through a promise resolution.
- **`HandleSupabaseError` context strings.** Pass `{ context: 'core_person' }` for the person UPDATE failure, `{ context: 'core_member' }` for the member UPDATE failure, `{ context: 'core_member_card' }` for card mutation failures, and `{ context: 'core_contact' }` for the contacts list-query failure (and `'core_member'` for the member fetch failure).
- **No `Toaster` mount.** TEAM-01's `<ToastProvider>` mount is the ancestor; calling `toast(...)` without the provider mounted will throw.
- **Implementation gate — Portal CTA only.** Until `@solvera/pace-core/member-profile-launch` ships, the Portal CTA buttons cannot wire. The rest of the slice builds independently. See §15.
- **`base_application.event_id` ↔ `core_events.event_id` FK shape.** PostgREST embedded-select is the default in the §7 contract; if the FK does not resolve due to type mismatch, swap to a manual JOIN via RPC. See §15 verification step.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/members/:memberId` | `members` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read Member 360 | `read:page.members` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Identity Unlock / Save | `update:page.members` | `useResourcePermissions('members').canUpdate` | Unlock button hidden; Save button never reached |
| Card Deactivate / Reactivate | `update:page.members` | `useResourcePermissions('members').canUpdate` | Deactivate / Reactivate row actions hidden |
| Portal CTA — Edit in Portal | `update:page.member-profile` AND NOT (acting user IS target) | `useResourcePermissions('member-profile').canUpdate` | "Edit in Portal" CTA hidden |
| Portal CTA — View in Portal | `read:page.member-profile` AND NOT `update:page.member-profile` AND NOT (acting user IS target) | `useResourcePermissions('member-profile').canRead` and `.canUpdate` | "View in Portal" CTA hidden |
| Portal CTA — any | NOT (acting user IS target) | acting-user-id check against `core_person.user_id` | All Portal CTAs hidden when acting user IS target |
| Read Applications | `read:page.applications` on BASE app (cross-app dependency) | server-side RLS only | Section returns zero rows; empty-state copy renders |

### Server-side enforcement

- **`core_member` UPDATE** is enforced by `rbac_update_core_member` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **`core_person` UPDATE** is enforced by `rbac_update_core_person` (super-admin OR `check_user_is_org_admin(...)` chained via `core_member_role` for the target person).
- **`core_member_card` UPDATE** is enforced by `rbac_update_core_member_card` (super-admin OR `check_user_is_org_admin(organisation_id)`).
- **All SELECTs** are enforced by their respective RLS policies — see §7 RLS / permission contracts.
- **`base_application` SELECT** requires the cross-app BASE permission `read:page.applications` per `data_check_rbac_permission_with_context(...)`. This is a cross-app dependency the slice does not author — TEAM staff are seeded with the BASE permission in production; on dev the seeding may be partial.

---

## §11 Acceptance criteria

**AC-01 — Page entry, authenticated, has org, has read permission, member resolves.**
Given a user is authenticated, has an org, has `read:page.members`, and navigates to `/members/:memberId` for a member of the current org, when the page loads, then the Member details card renders with the member's name as the heading, the membership status badge, the inline header-right Portal CTA region, the labelled-fields region with the twelve fields and the four contact-detail rows, followed by the Additional contacts section, Member cards section, Applications section, and Standing roles section in that order. (Traces F-01, F-02, F-04, F-20, F-21, F-22, F-54.)

**AC-02 — Identity read-only.**
Given the page has loaded for a member, when the user inspects the Member details card, then no field is editable; the Unlock button renders only when `useResourcePermissions('members').canUpdate === true`. (Traces F-21, F-27, F-64.)

**AC-03 — Identity Unlock and Save happy path.**
Given the user has `useResourcePermissions('members').canUpdate === true` and clicks Unlock, when they change First name to "Jane", change Last name to "Doe", and click Save, then the slice runs `UPDATE core_person SET first_name='Jane', last_name='Doe', ... WHERE id = core_member.person_id` followed by `UPDATE core_member SET ... WHERE id = :memberId`, both succeed, the form closes, the Member details card refreshes with the new values, and a `success` toast renders with copy "Member saved." (Traces F-27, F-28, F-29, BR-G.)

**AC-04 — Identity Cancel — clean.**
Given the user has clicked Unlock and made no changes, when they click Cancel, then edit mode exits silently (no confirmation dialog). (Traces F-30, BR-D.)

**AC-05 — Identity Cancel — dirty triggers Discard confirm.**
Given the user has clicked Unlock and changed at least one field, when they click Cancel, then a `ConfirmationDialog` opens with title "Discard unsaved changes?", description "Your edits will not be saved.", confirm "Discard" (destructive variant), cancel "Continue editing". Clicking Discard exits edit mode and resets fields; clicking "Continue editing" leaves the form in edit mode. (Traces F-31, BR-D.)

**AC-06 — Identity field validation — required.**
Given the user is in edit mode, when they clear First name and click Save, then the form blocks submission and renders the error "First name is required." (Traces F-29, BR-E.)

**AC-07 — Identity field validation — date_of_birth in future.**
Given the user is in edit mode, when they enter a Date of birth one day in the future and click Save, then the form blocks submission and renders the error "Date of birth cannot be in the future." (Traces BR-E.)

**AC-08 — Identity field validation — valid_to before valid_from.**
Given the user is in edit mode and has entered Valid from = "2026-05-01", when they enter Valid to = "2026-04-30" and click Save, then the form blocks submission and renders the error "Valid to must be on or after Valid from." (Traces BR-E.)

**AC-09 — Identity Save error.**
Given the user is in edit mode and clicks Save, when the `core_person` UPDATE fails (for example RLS deny), then a `destructive` toast renders with the normalised `HandleSupabaseError` message, the form remains open and dirty, and no `core_member` UPDATE is attempted. (Traces F-16, BR-F.)

**AC-10 — Member-not-found UX.**
Given a user navigates to `/members/:memberId` for an id that does not exist, is deleted, or belongs to another organisation, when the page renders, then the page replaces its content with the heading "Member not found", description "We couldn't find this member in your current organisation.", and a "← Back to members" button that navigates to `/members`. (Traces F-10, BR-A.)

**AC-11 — Org-mismatch on org switch.**
Given the user is on `/members/:memberId` for a member of org A, when they switch the org context to org B, then the page replaces its content with a destructive `Alert` titled "This member is not in the current organisation", description "Switch back, or return to the members directory.", and a "Back to members" button navigating to `/members`. (Traces F-19, BR-W.)

**AC-12 — Permission denied — read.**
Given a user is authenticated and has org context but lacks `read:page.members`, when they navigate to `/members/:memberId`, then `<AccessDenied />` renders inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (Traces F-18, F-63.)

**AC-13 — Additional contacts list and modal.**
Given the member has at least one `core_contact` row with `core_contact.person_id = core_member.person_id`, when the page loads, then the Additional contacts section renders a `DataTable` with columns Name, Type, Tier, Actions, and clicking the View details action on a row opens a read-only `Dialog` showing the contact's name + type badge in the header and Tier, Phones, Email, Residential address, Postal address rows in the body, with a single Close button. (Traces F-33, F-37, F-39, BR-I.)

**AC-14 — Additional contacts empty state.**
Given the member has zero `core_contact` rows, when the page loads, then the Additional contacts section renders the empty state with heading "No additional contacts recorded." and no CTA. (Traces F-11.)

**AC-15 — Member cards Deactivate happy path.**
Given the user has `useResourcePermissions('members').canUpdate === true` and the member has a card with `is_active === true` and `card_identifier = "PACE-12345"`, when the user clicks the Deactivate row action, the `ConfirmationDialog` opens with title "Deactivate card?", description "PACE-12345 will no longer scan as an active card. You can reactivate it later.", confirm "Deactivate" (destructive); when they click Confirm, the slice runs `UPDATE core_member_card SET is_active = false WHERE id = card.id`, the dialog closes, the cards section refreshes, and a `success` toast renders with copy "PACE-12345 deactivated." (Traces F-46, BR-N.)

**AC-16 — Member cards Reactivate is direct.**
Given the user has `canUpdate === true` and the member has a card with `is_active === false`, when the user clicks the Reactivate row action, then the slice runs `UPDATE core_member_card SET is_active = true WHERE id = card.id` directly with no confirmation dialog, and on success the cards section refreshes and a `success` toast renders with copy "{card_identifier} reactivated." (Traces F-47.)

**AC-17 — Applications list with status filter.**
Given the member has applications including one with `status = 'draft'` and three with `status IN ('submitted','approved','rejected')`, when the page loads, then the Applications section renders three rows (the draft excluded) in the columns Event name, Event date, Status, with status badges showing "Submitted" (default tone), "Approved" (success tone), "Rejected" (destructive tone). (Traces F-49, F-50, F-51, F-52, BR-O, BR-P.)

**AC-18 — Applications empty state when no rows or no BASE permission.**
Given either the member has zero non-draft applications in the current org, or the staff lacks BASE `read:page.applications` (so RLS returns zero rows), when the page loads, then the Applications section renders the empty state with heading "No applications recorded." (Traces F-13, BR-Q.)

**AC-19 — Standing roles cross-slice link.**
Given the page has loaded, when the user looks at the bottom of the page, then a section heading "Standing roles" renders with a "View roles ›" outline button beneath; clicking the button navigates to `/members/:memberId/roles`. (Traces F-54, BR-V.)

**AC-20 — Portal CTA — Edit in Portal.**
Given the acting user is NOT the target member, has `useResourcePermissions('member-profile').canUpdate === true`, and the CR24 helper is available, when the user clicks "Edit in Portal" on the Identity card, then the slice invokes `launchMemberProfile({ portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN, mode: 'edit', memberId: core_member.id })`, which opens `{portalOrigin}/profile/edit/{memberId}` in a new tab with no `returnUrl` and no `organisation_id` query param. (Traces F-55, BR-R, BR-S, BR-U.)

**AC-21 — Portal CTA — View in Portal.**
Given the acting user is NOT the target member, has `useResourcePermissions('member-profile').canRead === true` AND `canUpdate === false`, and the CR24 helper is available, when the user clicks "View in Portal", then the slice invokes `launchMemberProfile({ ..., mode: 'view', memberId: core_member.id })`, which opens `{portalOrigin}/profile/view/{memberId}` in a new tab. (Traces F-56, BR-R.)

**AC-22 — Portal CTA hidden when acting user IS target.**
Given the acting user's id equals the target member's `core_person.user_id`, when the page loads, then no Portal CTA renders regardless of `useResourcePermissions('member-profile')` values. (Traces F-57, F-65, BR-Z.)

**AC-23 — Back to members button.**
Given the page has loaded, when the user clicks the "← Back to members" button at top-left of the `PaceMain` content area, then the app navigates to `/members`. (Traces F-05.)

**AC-24 — Initial loading is full-page; section loading is per-section.**
Given the user navigates to `/members/:memberId`, when the initial member query is in flight, then a full-page `<LoadingSpinner />` renders inside the `PaceMain` content area; once the member resolves, the page renders with each of the contacts / cards / applications sections showing its own section-level `<LoadingSpinner />` until that section's query completes. (Traces F-07, F-08.)

**AC-25 — Cross-org leakage prevention.**
Given a member exists in org B but not in org A, when the user is signed in with org A selected and navigates to `/members/<orgB-member-id>`, then the member fetch returns zero rows (RLS deny + defensive filter) and the page renders the "Member not found" UX. (Traces F-74, F-75.)

---

## §12 Verification

- **MCP test — RLS authority on `core_member` UPDATE.** Against dev-db (`rkytnffgmwnnmewevqgp`), as a user with `org_admin` on org A, run `UPDATE core_member SET membership_number = 'TEST-001' WHERE id = <orgA-member-id>` and confirm success; repeat as a user without `org_admin` and confirm the row count is zero (RLS deny).
- **MCP test — `core_contact.permission_type` shape.** Confirm via `pg_constraint` that `core_contact_permission_type_check` is `CHECK ((permission_type = ANY (ARRAY['full', 'notify', 'none'])))` and that the column is `text NOT NULL`. Confirm there is no Postgres enum named `core_contact_access_level` on dev.
- **MCP test — `pace_membership_status` enum.** Confirm the enum has exactly six values: `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked`.
- **MCP test — `core_contact_type` seed.** Confirm six rows: Parent / Guardian, Carer, Spouse/Partner, Family, Friend, Other.
- **MCP test — `check_user_pace_member_access_via_member_id`.** Confirm the function exists and `rbac_select_core_member_delegated` policy uses it.
- **MCP test — Portal CTA gate readiness.** Search `pace-core2/packages/core/src/` for `buildMemberProfileLaunchUrl` and `launchMemberProfile`. If absent, the Portal CTA section is implementation-blocked per §15. If present, confirm the export is re-exported from `@solvera/pace-core/member-profile-launch` per CR24.
- **MCP test — `base_application` ↔ `core_events` FK type relationship.** Run a query of the form `useSecureSupabase().from('base_application').select('id, core_events!inner(event_name)').limit(1)` and confirm the embedded select resolves. If it fails with a type-mismatch error, swap the slice's applications query to a manual JOIN via RPC (see §15).
- **In-app demo — Identity edit happy path.** Navigate to `/members/<known-member-id>` as an org admin. Click Unlock, change First name and Last name, click Save. Verify the Member details card refreshes with the new values and a success toast renders.
- **In-app demo — Card deactivate.** Navigate to the same member. In the Member cards section, find an active card. Click Deactivate. Verify the confirmation dialog title, description, and confirm-button copy match BR-N. Click Deactivate. Verify the cards section refreshes (the Active badge flips to "Inactive") and a success toast renders.
- **In-app demo — Portal CTA happy path (gate-dependent).** When the CR24 helper has shipped: navigate to a member who is NOT the acting user. Verify either "Edit in Portal" or "View in Portal" renders per BR-R. Click. Confirm a new tab opens at `{VITE_PORTAL_ORIGIN}/profile/edit/{memberId}` or `/profile/view/{memberId}` with no query params and no return URL.
- **In-app demo — Acting-user-IS-target.** Sign in as a user whose own `core_person.user_id` matches the target. Navigate to that member's Member 360. Verify no Portal CTA renders regardless of permission.
- **In-app demo — Cross-org navigation.** Navigate directly to `/members/<some-other-org-member-id>`. Verify the "Member not found" page renders.

---

## §13 Testing requirements

- **Concurrency test (Identity Save).** Two concurrent saves on the same member: simulate User A saving with First name "Alpha" while User B saves with First name "Beta" with both reading the same starting state. Verify the second-completing save's value is the one persisted and that the next refetch on either client shows the second-save value. No optimistic locking is expected.
- **Optimistic-rollback test (card mutation failure).** When a card Deactivate UPDATE fails (simulate RLS deny), verify the row's `is_active` is unchanged (no optimistic update committed) and that a `destructive` toast surfaces the normalised error.
- **CR24-gate negative test (Portal CTA hidden when helper missing).** Until the CR24 helper ships, verify the Portal CTA never renders even when permissions allow — the build's gate should produce a build-time error or a run-time fallback that hides the CTA. (Choose one mode and document it in §15.)
- **`base_application` empty-state test (no BASE permission).** As a user with `read:page.members` but without BASE `read:page.applications`, navigate to a member who has applications. Verify the Applications section renders the empty state ("No applications recorded.") rather than an error.

Otherwise, n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads and UPDATEs go via `useSecureSupabase().from(...)`. Do not call `createClient` directly. Do not reach for any client that bypasses RBAC scope resolution.
- The slice does not author any RLS migration. The four tables (`core_person`, `core_member`, `core_member_card`, plus `core_contact` for read-only) already have working policies on dev.
- Do not implement contacts CRUD. The Additional contacts surface is read-only list + read-only modal in v1.
- Do not implement card insert / delete / identifier mutation. The Member cards surface is Deactivate / Reactivate only.
- Do not implement event-registration detail editing or `base_event_registration` reads. Member 360 reads `base_application` only.
- Do not implement self-service editing for the target member. When the acting user IS the target, all Portal CTAs are hidden; the target edits via Portal directly.
- Do not query production database during build or test. All MCP verification targets dev-db only (`rkytnffgmwnnmewevqgp`).
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.
- Do not introduce a custom Portal URL builder. Use `buildMemberProfileLaunchUrl` / `launchMemberProfile` from `@solvera/pace-core/member-profile-launch`. If the helper has not shipped, gate the Portal CTA per §15 — do not roll a local equivalent.

---

## §15 Done criteria

- All 25 acceptance criteria (AC-01 through AC-25) verified via the slice's QA pack.
- **Verification step — `base_application.event_id` ↔ `core_events.event_id` FK relationship.** Re-run the MCP query in §12 against dev-db. Confirm that a PostgREST embedded select of the form `.from('base_application').select('id, core_events!inner(event_name)').limit(1)` resolves successfully. If it fails with a type-mismatch error, replace the §7 applications read contract with a manual JOIN via RPC (the build agent authors a small RPC `app_member_applications(p_person_id uuid, p_organisation_id uuid)` that returns the joined shape). Confirm the swap before marking the slice Done.
- **Verification step — Avatar source.** Confirm via dev-db introspection that no `core_person.photo_url`, `core_person.photo_id`, or `core_file_references` linkage exists for person photos. The v1 `Avatar` is initials-only (no `imgsrc`). When a person photo column lands in a future schema migration, this section can be enriched — the §5 Member details card header is the integration point.
- **Implementation gate — Portal CTA only.** Portal CTA wiring (the Edit-in-Portal and View-in-Portal buttons in the Identity card header) is blocked until pace-core2 ships the CR24 launch helper: `buildMemberProfileLaunchUrl`, `launchMemberProfile`, `MemberProfileLaunchMode` (and `isMemberProfileLaunchMode` if exported) all exported from `@solvera/pace-core/member-profile-launch` per `pace-core2/packages/core/docs/requirements/CR24-cross-app-member-profile-launch.md`. Until those exports exist on the local pace-core2 working tree at `~/Documents/GitHub/pace-core2/packages/core/src/` and `package.json` `exports` map includes the `./member-profile-launch` subpath, the Portal CTA section cannot be marked Done. **Everything else in TEAM-03** (Identity edit, contacts read + modal, cards Deactivate/Reactivate, applications read, Standing-roles cross-slice link) **builds without this gate**; only the Portal CTA section is feature-gated.
- Post-build RBAC seeding reminder: `rbac_app_pages` must include the row for `page_name = 'members'` under TEAM app (shared with TEAM-02; seeded post-TEAM-01) and the row for `page_name = 'member-profile'` (singular) under PACE app (for the Portal CTA's resource permission resolution).

---

## §16 Do not

- **Do not implement contacts CRUD** (add / edit / remove). The Additional contacts surface is read-only list + read-only modal in v1 only. Add / edit / remove is deferred to a follow-up slice (TEAM-03.x) or routed through Portal handoff.
- **Do not implement photo upload, medical info, billing info, or event-registration detail editing** on Member 360. All routed through the Portal handoff CTA.
- **Do not implement card issuance, reissue, credential generation, or new-card creation.** The Member cards surface is Deactivate / Reactivate only; no insert / delete / identifier mutation.
- **Do not surface a BASE-table-first presentation of events / applications.** The Applications section is member-first: rows are applications by the target member, columns are event name / event date / status. There is no `base_event_registration` table involved.
- **Do not introduce a `team_unit` legacy construct** anywhere in this slice. TEAM-03 owns no unit / team / squad concept.
- **Do not implement custom RBAC checks.** Use only `<PagePermissionGuard pageName="members" operation="read">` and `useResourcePermissions(...)` per the resource keys in §10.
- **Do not invent a Portal URL builder.** Use the CR24 helper via `@solvera/pace-core/member-profile-launch`. If the helper has not shipped, gate the Portal CTA per §15 — do not roll a local equivalent.
- **Do not pass `returnUrl` or `organisation_id` query params** to the Portal launch URL. The CR24 contract is strict on the URL shape `{portalOrigin}/profile/{view|edit}/{memberId}` only.
- **Do not pass a `scope` prop to `PagePermissionGuard`.** Scope is resolved internally from `OrganisationServiceProvider`.
- **Do not patch audit columns** (`created_at`, `updated_at`, `created_by`, `updated_by`) from the client.
- **Do not import from internal `packages/core/src/*` paths.** Use published sub-paths only.
- **Do not run any verification or smoke test against production.** Dev-db only (`rkytnffgmwnnmewevqgp`).
- **Do not introduce optimistic locking or `updated_at` watermark checks.** Concurrency is last-write-wins for v1.
- **Do not show participant draft applications** (`base_application.status = 'draft'`) in the Applications section.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; org-scoped admin surfaces; Portal-proxy handoff for excluded edit domains.
- `/rebuild/architecture.md` — slice ownership, route registry, canonical `pageName` map (`members`), Portal handoff contract section. **Doc-drift note (informational, not blocking):** the architecture text uses plural `'member-profiles'` for the Portal handoff resource (lines 138–139, 246, 357 around the Portal handoff sections). The dev `rbac_app_pages` row under PACE app is **singular `member-profile`**. The slice authors against the singular live row per global operating rules. Architecture-text correction is informational and not made from this slice; raise as a separate platform-team ticket if formalised.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu, and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`**, so any descendant route (including this slice) can call `toast(...)`. TEAM-03 depends on this mount; without it, `toast(...)` throws.
- **TEAM-02** — owns the directory list at `/members` and supplies row-click navigation to `/members/:memberId`. TEAM-03's Back button returns to `/members`.
- **TEAM-04** — owns the standing roles surface at `/members/:memberId/roles`. TEAM-03's Standing roles section cross-links there.
- **TEAM-05** — owns `/approvals` and `team_member_request` review. TEAM-03 reads `core_member` and does not modify `team_member_request`.
- **TEAM-06** — owns `core_membership_type` mutations. TEAM-03 reads `core_membership_type.id` and `name` for the Membership type select.
- **PORTAL** — owns `/profile/view/:memberId` and `/profile/edit/:memberId`. TEAM-03 hands off via the CR24 helper.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC API conventions; `useResourcePermissions` semantics; `PagePermissionGuard` page-level gate; `data_check_rbac_permission_with_context` helper. **Future cross-app convergence note (informational, not blocking v1):** `core_person`, `core_member`, `core_contact`, `core_member_card` UPDATE/INSERT/DELETE RLS policies currently use `check_user_is_org_admin(...)` (legacy gate). Future migration candidate: extend these tables to RBAC-checked RLS template per this standards file, mirroring the TEAM-06 / TEAM-07 pattern. Not required for v1.
- `pace-core2/packages/core/docs/requirements/CR24-cross-app-member-profile-launch.md` — Portal handoff URL builder and launcher contract. **Implementation gate:** `buildMemberProfileLaunchUrl`, `launchMemberProfile`, `MemberProfileLaunchMode` exported from `@solvera/pace-core/member-profile-launch`. Until those exports exist on the local pace-core2 working tree, the Portal CTA section in TEAM-03 cannot be marked Done — see §15.
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage; `pageName` + `operation`; no `scope` prop at page level.
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and shell chrome (provided by TEAM-01).
- DB-412 — `core_contact.permission_type` migration to `('full', 'notify', 'none')`. Live shape on dev is TEXT + CHECK (not a Postgres enum despite the cross-app log's enum naming).
- DB-415 — `core_contact_type` seed including "Parent / Guardian".
- DB-417 — `check_user_pace_member_access_via_member_id` and `rbac_select_core_member_delegated` (server-ready for the Portal handoff).
