# TEAM module — Architecture

## Document purpose

This document is the **technical and orchestration authority** for rebuilding **TEAM**. It defines bounded contexts, contracts, verification, testing expectations, **pace-core2** consumption, and the **canonical implementation plan** (slices, dependencies, route ownership).

**Legacy `pace-team`**: POC only—not authoritative. `project-brief.md`, slice requirements, **pace-core2** requirement docs, and the database decision docs override legacy code where they differ.

**Distinctions** (legacy vs target vs exclusions vs redesign): see `project-brief.md` — *Rebuild framing: baseline, target, exclusions, redesign*. This document adds **technical** bounded contexts and **orchestration** (slices, routes, risks).

---

## Authoritative sources

| Source | Use |
|--------|-----|
| `project-brief.md` | **Expanded scope** (Member 360, member requests **`/approvals`**, org forms, events, cards, PUMP send via **TEAM-13** / **CR23**). |
| **`pace-core2` `CR21-workflow-forms-runtime.md`** | Shared forms runtime, authoring, and workflow contracts; canonical `core_forms` / `field_key` semantics, including `org_signup` and member-facing org-form route resolution. |
| **`pace-core2` `CR22-shared-reporting-foundations.md`** | Shared reporting engine contract; canonical explore/query/template model. |
| **`pace-core2` `BA15-reporting_requirements.md`** | Consumer reporting semantics already resolved in BASE; use to keep TEAM behaviour consistent where CR22 is shared. |
| **`pace-core2` `CR23-comms-platform.md`** | Shared **`CommComposer`**, **`CommSendAdapter`**, PUMP Edge contracts — **TEAM-13** integration authority. |
| **`pace-core2` `CR24-cross-app-member-profile-launch.md`** | Shared cross-app launcher/build contract for TEAM → Portal member-profile handoff. |
| **`pace-core2` `PR08-proxy-delegated-editing.md`** | Portal delegated profile contract used by TEAM Member 360 hand-off. |
| **`pace-core2/docs/database/decisions/DB-change-decisions-p3.md`** | Phase 3 **forward schema batch** (DB-301+): forms, contacts, events, reporting, and related shared-table changes TEAM depends on. |
| **`pace-core2/docs/database/decisions/DB-change-decisions-p4.md`** | Current upstream gate for **member requests**, **`member_validation_config`**, **Portal delegated org-admin access**, **PUMP target schema**, and **`core_form_availability`** rename. |

---

## System overview

### Legacy baseline (observational only)

Legacy `pace-team` used Vite, `@jmruthers/pace-core`, participant routes, `/team/*`, POC CRM, and **`team_unit`**. **Not the rebuild target.**

### Intended rebuild target

- **`@solvera/pace-core`** (pace-core2), **`setupRBAC`**, **`OrganisationServiceProvider`**, **`PaceAppLayout`**, **`usePaceMain`**, and **`useSecureSupabase`** for feature data. TEAM must consume pace-core2 RBAC only: `PagePermissionGuard`, RBAC hooks, secure clients, and Edge-side `isPermitted`; no app-local permission engine or custom namespace.
- **Admin-only** app: **no** participant/member-facing TEAM surfaces (see brief).
- **No `team_unit`** for org structure — use **`core_organisations.parent_id`**. Event groupings use BASE tables (e.g. `base_units`) where relevant—not TEAM standing-state.
- **Event registration / “events attending”** in Member 360 and Events features: use **`base_application`**. There is **no** `base_event_registration` table.

---

## Schema validation stance

TEAM does **not** maintain its own authoritative schema snapshot. Database truth comes from:

- `docs/database/*` decision and domain docs
- live dev introspection against the linked dev database
- explicit future-state exceptions documented in **`DB-change-decisions-p4.md`**

Use production only for pre-release verification, never as the source for rebuild documentation.

### Current implementation implications (validated against live dev and shared docs)

1. **Events and attendee joins** use **`base_application`** as the registration/application source. There is **no** `base_event_registration` table.
2. **Member cards** use the current live **`core_member_card`** shape. TEAM v1 manages existing-card activation state only; it does not assume issuance metadata or credential-type flows.
3. **Forms** follow **CR21** and the **live dev DB301 shape**. TEAM docs should not restate `core_forms` / `core_form_fields` column snapshots; validate live shape at implementation time and follow the shared contract. The remaining TEAM-09 schema gate is **DB-414** (`core_form_availability` rename), not DB301.
4. **Reporting** follows **CR22**. The live dev database already exposes the CR22-style reporting columns TEAM needs, so the blocker is the shared reporting package delivery, not speculative DB-319 work.
5. **Member requests**, **`member_validation_config`**, and **Portal delegated org-admin profile access** are blocked on their **`DB-change-decisions-p4.md`** cards landing on dev. Until then, TEAM must not implement against guessed local tables/RPCs.
6. **PUMP target schema** is also blocked on **`DB-change-decisions-p4.md`**. TEAM-13 must not build against the current legacy `pump_comms_*` schema.
7. **Contacts and membership tables** still inherit the p3 database decisions TEAM relies on: DB-307, DB-308, DB-309, DB-314, DB-315, and DB-317 remain the relevant shared-table constraints for TEAM.

---

## Bounded contexts

| Context | Legacy baseline (observational) | Rebuild target |
|---------|----------------------------------|----------------|
| **Identity & session** | `UnifiedAuthProvider`, `/login`, legacy **`@jmruthers/pace-core`**. | **`@solvera/pace-core`**, `setupRBAC`, `PaceLoginPage`, `PaceAppLayout`, and the current providers/hooks before any guarded route renders. |
| **Organisation scope** | `selectedOrganisationId`; inconsistent `OrganisationServiceProvider` usage in POC. | **`OrganisationServiceProvider`** mandatory; **all** feature queries scoped to current org. |
| **Member directory** | `/team/members`, thin list. | **`/members`** — **Members** (default: **`Active` + `Suspended`**) + **Pending** (**`Provisional`** + open request) — **TEAM-02**; queue remains **`/approvals`** (**TEAM-05**). |
| **Member 360** | CRM elsewhere, mixed detail. | **`/members/:memberId`** — one-page summary: **basic edit**, contacts + modal, **cards**, **`base_application`** rows, **Portal proxy** (**TEAM-03**). |
| **Standing roles** | Detail page + unrouted roles page; mixed patterns. | **`/members/:memberId/roles`** only (**TEAM-04**); `core_member_role`; **end_date** history; RBAC per validated page contract. |
| **Member requests (join / transfer)** | N/A unified in legacy POC. | **`/approvals`** (**TEAM-05**): org-scoped **queue** + **review** for **`team_member_request`** once **`DB-change-decisions-p4.md`** lands. **Org signup / all org forms** are authored only under **`/forms`** (**TEAM-09**). **External member validation config** on **`core_org_settings`** is edited under **`/settings/org`** (**TEAM-08** — operational section) once the same upstream decision lands. |
| **Org forms** | Legacy `core_forms` / `table_name` column coupling. | **CR21** + **live dev DB301 shape**: `workflow_type`, `field_key`, shared authoring contract, and orchestrators; **`/forms`**, **`/forms/new`**, **`/forms/:formId`**. **DB-414** remains the pending field-availability rename. |
| **Events (TEAM)** | Not a first-class TEAM POC surface. | **`/events`**, **`/events/:eventId`**: **registered-member events only** for current org (event appears only if at least one org member has a `base_application` row for it, across all statuses in v1); attendees via **`base_application`**. |
| **Communications (PUMP)** | N/A. | **`/communications`** — **send / schedule** page; shared **CR23** composer surface + PUMP Edge once **CR23** and **`DB-change-decisions-p4.md`** land; **email/SMS**, **no TEAM drafts v1**; recipients: **inline org filters** + **`/members` picker hand-off** for **manual** list (**TEAM-13** frozen **B1+B2**). |
| **Settings** | Partial sub-org + settings routes. | **`/settings/membership-types`**, **`/settings/organisations`**, **`/settings/org`**: Edge for membership types; upsert org settings. |
| **Reporting** | N/A in legacy POC. | **`/reports`**: **CR22** + shared reporting package + `team.participant` explore. |
| **Moderation** | N/A. | **`/moderation/photos`**: **reactive** review of profile photos already live in the platform; hide/remove only, no approval queue. |

**Excluded from TEAM v1** (see brief): participant-facing app surfaces, legacy `team_unit`, standalone **Team CRM** route, **RBAC UI**, **bulk actions**, full **PUMP** product.

---

## Design principles

1. **Brief + slice requirements + pace-core2 docs + DB decisions** over legacy code.  
2. **pace-core2** for shared UI, auth, RBAC, DataTable, dialogs, toasts.  
3. **Member 360** is the hub; **Portal proxy** for excluded edit domains (photo upload, medical, billing, event registration detail).  
4. **RLS and Edge rules** from pace-core2 docs, validated schema, and named RPC / Edge contracts — not from historical prompt text.  
5. **Branding** from org selector + pace-core2 theming.  
6. **Member-centric surfacing:** TEAM **never** ships admin UI that presents **raw BASE tables** or BASE-pivoted “row browsers.” Implementation may **read** BASE facts (e.g. **`base_application`**) **only** as join sources to show **members** (or org-scoped lists **of members**) with attributes such as registration status. Copy, columns, and navigation stay **people/member-first**, not table-name-first.

---

## Contracts (refine in slice requirements)

### Provider stack

`QueryClientProvider` → `BrowserRouter` → `UnifiedAuthProvider` → **`OrganisationServiceProvider`** → app. Query defaults: pace-core2 retry/error handlers where provided.

### RBAC

`PagePermissionGuard` on every route; page names aligned with **`rbac_apps`** / **`rbac_app_pages`** and operations follow pace-core2 RBAC standards (`read`, `create`, `update`, `delete` mapped to `{operation}:page.{PageName}`). TEAM must not introduce custom RBAC implementations or alternate permission strings.

**Canonical TEAM route → page mapping (use these pageName strings in implementation; add/verify the corresponding `rbac_app_pages` rows after the build and before release):**

| Route pattern | `PagePermissionGuard` pageName |
|---------------|-------------------------------|
| `/` | `HomePage` |
| `/members` | `MembersPage` |
| `/members/:memberId` | `MembersPage` |
| `/members/:memberId/roles` | `MemberRolesPage` |
| `/approvals`; `/approvals/:requestId` | `ApprovalsPage` |
| `/settings/membership-types` | `MembershipTypesPage` |
| `/settings/organisations` | `OrganisationsPage` |
| `/settings/org` | `OrgSettingsPage` |
| `/forms` | `FormsPage` |
| `/forms/new` | `FormsPage` |
| `/forms/:formId` | `FormsPage` |
| `/events`; `/events/:eventId` | `EventsPage` |
| `/reports` | `ReportsPage` |
| `/moderation/photos` | `ModerationPhotosPage` |
| `/communications` | `CommsLogPage` (PUMP-owned; do not seed under TEAM) |

Actions on a loaded page use the same page row with operation-specific checks and any tighter resource checks required by the slice. If a registry row is absent during early build, keep the same pageName and allow the post-build RBAC seeding pass to add it; do **not** substitute local permission logic. External contracts already fixed in other apps remain fixed here: **Portal** uses **`MemberProfilePage`** and **PUMP/TEAM comms** use **`CommsLogPage`** (registered under the PUMP `rbac_apps` row). Implementation imports canonical strings from `src/lib/rbac/pageNames.ts`.

Implementation must follow pace-core2 RBAC standards: call `setupRBAC` before guarded routes render, use `PagePermissionGuard` directly rather than wrapper guards, use `useSecureSupabase()` without passing a base client, use canonical DB page-name strings for `useResourcePermissions`, and use Edge-side `isPermitted()` rather than custom helper functions.

### Portal proxy: TEAM to pace-portal

**TEAM** deep-links **org admins** into **pace-portal** using the delegated member-profile route set. URL construction and launch behaviour live in **CR24**; delegated authorisation, RLS/RPC behaviour, role-template grants, and Portal route handling live in **DB-change-decisions-p4.md** + **PR08**. In short: **CR24 makes the link consistent; DB/Portal work makes delegation allowed.** TEAM owns **when** to show the CTA and which launch mode to request, but it must rely on pace-core2 RBAC hooks and Portal/server checks for authority.

| Item | Contract (see **TEAM-03**) |
|------|----------------------------|
| **TEAM handoff (Member 360) — edit staff** | **`{PORTAL_ORIGIN}/profile/edit/{core_member.id}`** — used when acting staff holds **`update:member-profiles`**; **new tab**, **no `returnUrl`**. Portal **derives active org** from **`core_member.organisation_id`** with access gate ([TEAM-03](TM03-member-360-requirements.md#portal-handoff-contract)). Same **proxy-session** model as additional-contact delegation. CTA: **Edit in Portal**. |
| **TEAM handoff (Member 360) — read-only staff** | **`{PORTAL_ORIGIN}/profile/view/{core_member.id}`** — used when acting staff holds **`read:member-profiles`** but **not** `update:member-profiles`; **new tab**, **no `returnUrl`**. Portal renders read-only profile via RBAC page + resource permissions (no proxy session). CTA: **View in Portal**. |
| **Identifier in path** | **`core_member.id`** — never `person_id` |
| **Authorisation** | Server gate: RPC **`check_user_pace_member_access_via_member_id`** with `{ p_member_id: <core_member.id> }` must return **true** for allowed actors (including **org admins** for members in their org once platform RBAC/RPC work lands). Local/proxy state in Portal is **UX only**; **not** authority. |
| **Portal RBAC** | Delegated **`member-profile`** page + delegated resources **`read:member-profiles`** / **`update:member-profiles`** (pace-core2 delegated-resource contract); org admins must receive the same **page + resource** grants the platform assigns for these routes. |
| **Edit-path proxy hint** | Portal may persist target member id in **localStorage** key **`pace-portal:proxyTargetMemberId`** for continuity; TEAM deep links must still pass the **RPC** on every load. |
| **Cross-tab org context** | No org query param — **`memberId`** implies **`core_member.organisation_id`**; Portal **resolves org** with the delegated access gate — see **TEAM-03** [Portal handoff contract](TM03-member-360-requirements.md#portal-handoff-contract). |

**Environment:** **`PORTAL_ORIGIN`** (or successor env name agreed in pace-core2) — the shared helper accepts a normalised config value and does not read env directly from package code. TEAM should consume the CR24 public export once it exists in `@solvera/pace-core` package exports; until then, do not import internal `packages/core/src/*` files or duplicate URL builders in multiple places.

### Communications / PUMP

**TEAM v1:** one route **`/communications`** — mount the shared **CR23** composer/export surface with a TEAM **`CommSendAdapter`** calling **PUMP Edge** (`pump-resolve-pool`, `pump-send`, **`pump-schedule`**) once **CR23** and **`DB-change-decisions-p4.md`** are live on dev. CR23 targets a public `@solvera/pace-core/comms` entrypoint; the current package exports do not yet include `./comms`, so TEAM must not ship an app-local substitute or import `packages/core/src/*`. **No** persisted drafts; **no TEAM cancellation or scheduled-message management surface**; **template** choice via dropdown only; **full PUMP management app** (template CRUD, org comms settings, analytics) remains **out of TEAM**. Recipients are resolved per CR23: **`OrgMembersPool`** (inline filters) + **`ManualPool`** via **`/members`** picker (**TEAM-13** + **TEAM-02**). `member_type_ids` and `unit_ids` remain CR23/PUMP Edge fields; TEAM must use only filters the Edge resolver supports on dev, cast membership-type ids to strings if needed, hide unsupported unit filters, and must not revive `team_unit`. **RBAC:** **`comms-log`** (PUMP-owned) + CR23 strings — verify PUMP `rbac_app_pages` row after platform migration; do not seed under TEAM.

---

## Verification

- `npm run validate` per repo.  
- **Supabase MCP/live introspection on the linked dev database only** for tables, RLS, and event/attendee joins—**not** production. After each upstream DB batch lands, re-run validation against the live dev schema.
- Reporting: pace-core2 reporting package readiness per **CR22** rollout.

---

## Testing requirements (inherited by all slices)

Slice **requirements** authors must include enough detail that implementers can write **automated and/or manual** tests without guessing. Minimum for **every** slice:

| Expectation | What to specify in the slice requirements doc |
|-------------|-----------------------------------------------|
| **Happy path** | Primary user goal for the slice (e.g. open Member 360, save allowed fields, see updated data). |
| **Validation / domain failure** | Invalid input, missing entity, conflict, or business rule rejection (e.g. duplicate active card, role constraint). |
| **Auth / permission denial** | Unauthenticated redirect; RBAC **PagePermissionGuard** denial; org mismatch / cross-org read attempt where relevant. |

**Additional guidance (recommended per slice type):**

- **Data-heavy slices (TEAM-02, 03, 05, 09, 10, 11):** note **RLS** expectations and **Edge/RPC** error paths; reference **dev-db** tables and **p3** assumptions.  
- **Integration slices (TEAM-13):** contract tests / integration checks against **CR23** `CommSendRequest` + **`RecipientPoolDescriptor`** shapes and TEAM adapter → **PUMP Edge** (dev).  
- **All slices:** use the canonical **pageName** / resource keys from this document during build; add/verify final **`rbac_apps`** registry rows after build and before release.

**Format:** `[SLICE_ID]_requirements.md` — detailed slice contracts live alongside this document (see `TEAM-01` through `TEAM-13`).

---

## Do-not rules

- No **`team_unit`** for org hierarchy.
- No **production** DB for documentation truth.
- No **participant TEAM** surfaces.
- No **BASE-table** or BASE-centric screens (TEAM does not expose BASE as a product surface; see **Design principle 6**).
- No extra planning artefacts outside `docs/requirements/team/` unless Kusi asks.

---

## References

- `project-brief.md`
- `pace-core2/docs/database/decisions/DB-change-decisions-p3.md`  
- `pace-core2/docs/database/decisions/DB-change-decisions-p4.md`
- `pace-core2/packages/core/docs/requirements/CR21-workflow-forms-runtime.md`
- `pace-core2/packages/core/docs/requirements/CR22-shared-reporting-foundations.md`
- `pace-core2/packages/core/docs/requirements/CR23-comms-platform.md`
- `pace-core2/packages/core/docs/requirements/CR24-cross-app-member-profile-launch.md`
- `pace-core2/docs/requirements/portal/PR08-proxy-delegated-editing.md`

---

## pace-core2 migration and dependency assumptions

1. **`@solvera/pace-core`** from local workspace.  
2. **App name `TEAM`**.  
3. **Org forms** and **reporting** may depend on **pace-core2** feature packages landing in order (shared forms/reporting implementation sequence).  
4. **Communications / PUMP** send UI ships as **shared pace-core2** `CommComposer` (**CR23**); TEAM wires adapter + org scope only.

---

## Planning resolutions

These **close or park** open questions from planning so slice requirements can proceed without blocking on full product design.

| Topic | Resolution |
|-------|------------|
| **PUMP / communications** | **Frozen for TEAM v1 (2026-04-20; schedule confirmed):** Integration contract is **pace-core2 CR23** (`CommComposer`, `CommSendAdapter`, PUMP Edge **`pump-resolve-pool`**, **`pump-send`**, **`pump-schedule`**). TEAM: **`/communications`**, **send + schedule**, **no TEAM drafts**, **no TEAM scheduled-message management / cancel surface**, **email + SMS**, **template dropdown**, **`OrgMembersPool`** (inline filters) + **`ManualPool`** (directory picker **B2**). **PUMP app** owns template/settings/analytics UIs. **Blocked until CR23 `@solvera/pace-core/comms` package export and `DB-change-decisions-p4.md` PUMP rollout land on dev.** |
| **Portal view-as-proxy / staff delegation** | **pace-portal** owns RPC/RLS/Page guards; **TEAM-03** defines RBAC-conditional handoff — **`/profile/edit/:memberId`** for staff with `update:member-profiles`; **`/profile/view/:memberId`** for staff with `read:member-profiles` only (no proxy session, RBAC-only path). Both: **new tab**, **no `returnUrl`**. Portal **derives org from target `core_member`**. Additional contacts (with `Full` tier) continue to use `/profile/edit/:memberId` from their own `LinkedProfileCard`; the `view` additional-contact tier is removed (see CR23 + DB-412). CR24 owns URL building/launch consistency; DB-p4/PR08 owns making delegated org-admin access allowed. |
| **RBAC routes / `rbac_apps`** | **Resolved:** implementation uses canonical `PagePermissionGuard` pageName strings from this document. `rbac_app_pages` rows and role-template grants are added **after the build** and before release. Missing rows during early build are not a reason to invent local RBAC or change page names. |
| **Member requests vs org forms** | **Resolved (2026-04-21; Option A 2026-06):** **TEAM-05** owns **`/approvals`** (queue + review + resolve via platform RPCs). **TEAM-09** owns **all org form authoring** at **`/forms`**, including **`org_signup`**. **TEAM-08** — **Financial** + **Operational** on **`/settings/org`**. **Option A (membership at issuing org):** `app_submit_member_request` creates **`core_member` at the root/issuing org** (via `org_ancestors`); **`team_member_request.organisation_id`** stays at the selected sub-org for admin review; sub-org visibility uses **`core_member_role` placements** on approve. **Directory** (**TEAM-02**): **Members** = **`Active` + `Suspended`** via placement and/or flat-org `core_member.organisation_id`; **Pending** = open **`team_member_request`** at selected org joined to issuing-org **`core_member`**. **Exclude** **`Resigned`**, **`Lapsed`**, **`Revoked`** from default directory. **`core_member`** has **six** statuses only. **Platform convention:** **`withdrawn`** = participant-initiated; **`rejected`** = org-initiated on **`team_member_request`**; **`Revoked`** = org-initiated membership discipline on **`core_member`**. |
| **Communications URL** | **`/communications`** only for v1 (**TEAM-13**); sub-routes if added later must stay owned by this slice. |
| **Dependency gates** | **TEAM-01:** none. **TEAM-02:** none beyond TEAM-01; comms picker mode is activated when TEAM-13 exists. **TEAM-03 Portal CTA:** CR24 package export for URL launch plus DB-p4 DB-417/PR08 delegated org-admin access; core Member 360 can build with CTA gated. **TEAM-04:** none beyond TEAM-03 and dev-db role constraint/RLS validation. **TEAM-05:** DB-p4 DB-418 member-request schema/RPCs. **TEAM-06:** platform-approved membership-type mutation path. **TEAM-07:** dev-db org hierarchy RLS/mutation validation. **TEAM-08:** DB-p4 DB-419 `member_validation_config` for Operational settings; Financial can build earlier. **TEAM-09:** CR21 + DB-414 (`DB301` verified on dev). **TEAM-10:** dev-db event/application join and RLS verification. **TEAM-11:** CR22 public reporting package/export. **TEAM-12:** platform file-reference deactivation contract. **TEAM-13:** CR23 `@solvera/pace-core/comms` export + DB-p4 PUMP rollout. |
| **Prod vs dev schema** | **Target dev** for build and docs; **validate promotion** to prod before release — **do not** assume prod matches dev (see snapshot section). |

---

## Orchestration metadata

This section is the **canonical source** for: **slice IDs**, **route ownership**, **dependencies**, **implementation order**, **risk**, and **split guidance**. Each `[SLICE_ID]_requirements.md` must mirror the slice’s row here and the **testing** bar above.

---

## Implementation plan

### Slice overview

**Thirteen slices.** **TEAM-02** (directory) and **TEAM-03** (Member 360) split the former combined slice so each requirements doc stays manageable.

| Slice ID | Name | Bounded context(s) | Routes owned (canonical — adjust in slice reqs if IA changes) | Depends on | Summary |
|----------|------|---------------------|-------------------------------------------------------------------|--------------|---------|
| **TEAM-01** | App shell, auth, layout | Identity, shell | `/login`; `/`; `*`; default post-login redirect | — | Providers, RBAC `TEAM`, layout, nav scaffold for all areas below. |
| **TEAM-02** | Member directory | Members (list) | `/members` | TEAM-01 | **Members** view (**`Active` + `Suspended`**) + **Pending** (**`Provisional`** + open **`team_member_request`**); row actions link to **`/members/:memberId`** when a **`core_member`** row exists. |
| **TEAM-03** | Member 360 | Member 360 | `/members/:memberId` | TEAM-01, TEAM-02; CR24 + DB-p4/PR08 for Portal CTA | **Basic edit**, contacts + modal, **cards**, events/application summary. **Portal handoff** is RBAC-conditional once platform delegation is ready: **Edit in Portal** (`/profile/edit/:memberId`) for `update:member-profiles` staff; **View in Portal** (`/profile/view/:memberId`) for `read:member-profiles`-only staff; new tab; no return URL. |
| **TEAM-04** | Standing roles | Member roles | `/members/:memberId/roles` | TEAM-01, TEAM-03 | Role history; add/end role; DB constraints for active uniqueness. |
| **TEAM-05** | Member requests queue & review | Join/transfer approvals | **`/approvals`**; **`/approvals/:requestId`** | TEAM-01; TEAM-03 **recommended** before heavy review UX; DB-p4 DB-418 | Org-scoped **`team_member_request`** list (**Open** vs **Closed** filter), **review** on child route (layout + **`Outlet`** — hybrid routing), **`app_resolve_member_request`**. **No** org form authoring here — **TEAM-09** only. |
| **TEAM-06** | Membership types | Membership products | `/settings/membership-types` | TEAM-01 | Edge-backed writes via platform-approved mutation contract; handle current global-name uniqueness caveat explicitly. |
| **TEAM-07** | Sub-organisations | Org hierarchy | `/settings/organisations` | TEAM-01 | Child orgs via `parent_id`. |
| **TEAM-08** | Org settings | Org financial + operational config | `/settings/org` | TEAM-01; DB-p4 DB-419 for operational config | **`core_org_settings`**: **Financial** section (fees, bank, tax, etc.) + **Operational** section (`member_validation_config` once DB-419 lands). **One route / one slice**; two clear UI groupings. |
| **TEAM-09** | Org form authoring | Forms platform (org) | `/forms`; `/forms/new`; `/forms/:formId` | TEAM-01; CR21; DB-414 | Create/edit **org-scoped** `core_forms` per **CR21** and the **live dev DB301 shape**; authoring lives here for **`org_signup`**, **`information_collection`**, **`consent_capture`**, and **`generic`** org-scoped workflows, not **TEAM-05**. Authorable fields target **`core_field_list.core_form_availability`** once DB-414 lands. |
| **TEAM-10** | Events & attendees | Events × applications | `/events`; `/events/:eventId` (sub-routes same slice) | TEAM-01 | **Registered-member events only** list (current org must have >=1 registration/application across all statuses in v1); drill to members with **`base_application`** + status. |
| **TEAM-11** | Report builder | Reporting | `/reports` | TEAM-01; CR22 reporting package | Org templates; `team.participant` explore; shared reporting package gate. |
| **TEAM-12** | Profile photo moderation | File moderation | `/moderation/photos` | TEAM-01; platform file deactivation contract | **Reactive** profile-photo review; hide/remove live photos through the platform-approved file-reference mutation path, no approval queue. |
| **TEAM-13** | Communications (PUMP) | Comms via PUMP Edge | **`/communications`** (v1: single route) | TEAM-01; CR23 `@solvera/pace-core/comms` export; DB-p4 PUMP rollout | **Send + schedule** email/SMS; **CommComposer**; **no TEAM drafts**; **template dropdown**; **org + manual pools**; see **TEAM-13** + **Planning resolutions**. |

### Slices that may still need sub-split during requirements authoring

| Slice | Risk | Recommended split (requirements phase) |
|-------|------|----------------------------------------|
| **TEAM-05** | Queue + review + resolve; depends on **DB-p4 DB-418** member-request schema + RPCs landing on dev. | Optional milestones in one doc: **(5a)** list + Open/Closed filter; **(5b)** review panel + resolve + error paths. |
| **TEAM-09** | CR21 authoring/runtime coupling + DB-414 rename gate. | Separate **form list/settings** vs **field editor** vs **publish** if authoring discovers too many acceptance criteria in one file. |
| **TEAM-10** | Cross-app reads (`core_events`, `base_application`) + restrictive existence filtering; RLS correctness. | Optional: **events list** milestone vs **attendee drilldown** milestone in one or two docs. |
| **TEAM-11** | Depends on **reporting engine** + **field list** population. | **Gate** on pace-core2 reporting readiness; split **template CRUD** vs **run/export** if needed. |

**TEAM-01, 02, 04, 06, 07, 08, 12** are expected to stay **single-slice** unless requirements review proves otherwise.

### Dependency rationale

- **TEAM-01** blocks all.  
- **TEAM-02** before **TEAM-03** (Member 360 needs directory entry and stable **`memberId`** navigation).  
- **TEAM-03** before **TEAM-04** (roles slice assumes Member 360 context and navigation). Portal CTAs inside TEAM-03 can be feature-gated until CR24 and DB-p4/PR08 delegation are ready.  
- **TEAM-05** can follow **TEAM-03** or parallelise after **TEAM-01** once **DB-p4 DB-418** lands; **approvals** UX may benefit from **TEAM-03** existing first (member context, status vocabulary).  
- **TEAM-06–08** parallel after **TEAM-01** (settings cluster).  
- **TEAM-09** depends on **CR21** and **DB-414**. The DB301 forms reshape is already verified on the live dev database.
- **TEAM-10** depends on **dev-db** clarity for `core_events` ↔ **`base_application`** joins and RLS.  
- **TEAM-11** depends on the reporting package in core.
- **TEAM-12** depends on a validated platform file-reference deactivation path; do not invent a local lifecycle flag.
- **TEAM-13** is blocked on **CR23** `@solvera/pace-core/comms` package delivery/export and **`DB-change-decisions-p4.md`** PUMP rollout on dev until integration passes.

### Implementation order (recommended starting point)

1. TEAM-01  
2. TEAM-02  
3. TEAM-03 (core Member 360 first; Portal CTA only after CR24 + DB-p4/PR08 readiness)  
4. TEAM-04  
5. TEAM-05 (after DB-p4 DB-418 lands)  
6. TEAM-07 → TEAM-08 → TEAM-06 (settings cluster — same relative order as before)  
7. TEAM-10 (events)  
8. TEAM-09 (org forms — **DB301 verified on dev**; start once **CR21** authoring/runtime work is ready and **DB-414** lands)  
9. TEAM-11 (reports — when **CR22** package is ready)
10. TEAM-12  
11. TEAM-13 (last or parallel once **CR23** package + **DB-change-decisions-p4.md** PUMP rollout are live on dev)

*Reorder 5/8/9/10/11 based on dependency readiness and product priority.*

### High-risk slices

| Slice | Risk |
|-------|------|
| **TEAM-03** | Member 360: RLS across person, member, contacts, cards, applications; largest **single** surface after splitting directory (**TEAM-02**). |
| **TEAM-05** | RPC-only mutations, concurrency on resolve, external validation display; schema/RPCs are upstream-gated by DB-p4 DB-418. |
| **TEAM-09** | CR21 schema + orchestration; must not bypass server-side form submission rules. Remaining schema risk is the **DB-414** field-availability rename, not DB301. |
| **TEAM-10** | Cross-domain **reads** (`base_application` as join source, `core_events`); **member-centric** UI only; RLS and restrictive inclusion query semantics. |
| **TEAM-11** | Shared reporting package readiness and integration correctness. |
| **TEAM-13** | PUMP Edge + **CR23** availability; org-filter support and RBAC page keys must match Edge checks. |

### Route ownership

Each route pattern **one slice**.

| Route pattern | Owner |
|---------------|--------|
| `/login` | TEAM-01 |
| `/` (layout, guards, redirect) | TEAM-01 |
| `/members` | TEAM-02 |
| `/members/:memberId` | TEAM-03 |
| `/members/:memberId/roles` | TEAM-04 |
| `/approvals` | TEAM-05 |
| `/approvals/:requestId` | TEAM-05 |
| `/settings/membership-types` | TEAM-06 |
| `/settings/organisations` | TEAM-07 |
| `/settings/org` | TEAM-08 |
| `/forms` | TEAM-09 |
| `/forms/new` | TEAM-09 |
| `/forms/:formId` | TEAM-09 |
| `/events` | TEAM-10 |
| `/events/:eventId` | TEAM-10 |
| `/reports` | TEAM-11 |
| `/moderation/photos` | TEAM-12 |
| `/communications` | TEAM-13 |
| `*` | TEAM-01 |

---

## Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-04-18 | Initial |
| 0.2 | 2026-04-18 | Early planning baseline |
| 0.3 | 2026-04-18 | Expanded scope: Member 360, signups hub, forms, events, cards, PUMP; twelve slices; `base_application` note |
| 0.4 | 2026-04-18 | First DB snapshot used the wrong environment; superseded by v0.5 |
| 0.5 | 2026-04-18 | **Dev-db** validation note retained without a hardcoded project ref; use the current repo root `.env` dev project. `core_member_card` present; `base_application` has uuid `event_id`, `registration_type_id`, `carer_person_id`; prod/dev drift noted |
| 0.6 | 2026-04-21 | **Phase 3 (`DB-change-decisions-p3.md`)** assumed deployed for TEAM build; summarised TEAM-relevant DB-301/307–309/314–315/319 (+ lookup refs); MCP re-verify after migrations |
| 0.7 | 2026-04-21 | **Bounded contexts** legacy vs target; **slice table** + bounded context column; **split recommendations**; expanded **testing** for slice authors; orchestration cross-refs |
| 0.8 | 2026-04-21 | **TEAM-02 / TEAM-03 split** (directory vs Member 360); **thirteen slices** (TEAM-04–TEAM-13 renumbered); **`/communications`** base; **[Planning resolutions](#planning-resolutions)** (PUMP, signups, portal, RBAC, gates, prod/dev); slice **DB-301/315/319** cross-refs updated |
| 0.9 | 2026-04-21 | **Slice requirements authored** — `TM01-app-shell-auth-layout-requirements.md` … `TM13-communications-pump-requirements.md` (implementation contracts; mirror orchestration table + testing bar) |
| 0.10 | 2026-04-20 | **Portal delegated profile contract** — TEAM → pace-portal URLs (`/profile/view|edit/:memberId`), RPC/RBAC expectations, proxy localStorage key; **TEAM-03** + Contracts section |
| 0.11 | 2026-04-20 | **Portal handoff product decisions** — TEAM admin **edit-only** deep link, **new tab**, **no returnUrl**; **hide** Portal CTAs when admin **is** target |
| 0.12 | 2026-04-20 | **PUMP / TEAM-13** — **CR23** as integration contract; **`/communications`** send-only v1; no drafts/schedule in TEAM; planning resolution row updated; orchestration + routes |
| 0.13 | 2026-04-20 | **TEAM-13** — **send + schedule** included via **`CommComposer`** / **`pump-schedule`**; docs aligned |
| 0.14 | 2026-04-20 | **Comms recipients** — frozen **B1** + **B2**; **`TEAM-02`** picker + bounded context. **Portal org handoff** — final: **no** org query param; **`core_member.id`** → org in Portal with access gate (**`TEAM-03`** contract; supersedes passing `organisation_id` on **`/profile/edit/...`**). |
| 0.15 | 2026-04-20 | **Contracts / planning** — removed stale “manual UX unresolved” wording; aligned **PUMP** planning row with **B2**. |
| 0.16 | 2026-04-21 | **Member-centric TEAM UI** — no raw BASE table surfaces; BASE rows (**e.g. `base_application`**) are join sources for member-scoped UX only (design principle + do-not rule) |
| 0.17 | 2026-04-21 | **RBAC-conditional Portal CTAs** — **`TEAM-03`**: **Edit in Portal** / **View in Portal**; contract table + planning resolutions; additional-contact `view` tier removed (DB-412 + PR08) |
| 0.18 | 2026-04-21 | **`TEAM-10`** registered-member-only list rule. **Routing / settings** — dev-db wording; **`TEAM-05`** → **`/approvals`**; **`TEAM-08`** financial + operational; directory default filter (**`TEAM-02`**); signups vs member-requests planning resolution. |
| 0.19 | 2026-04-22 | **`TEAM-05`** routing: **`/approvals`** + **`/approvals/:requestId`** (hybrid list + detail, same slice) |
| 0.20 | 2026-04-21 | **Membership vs requests** — no **`Declined`** on **`core_member`**; outcomes on **`team_member_request`**; reject/withdraw **DELETE** provisional member; directory **Members** vs **Pending** (canonical detail in `TM05-member-requests-review-requirements.md`) |
| 0.21 | 2026-04-22 | Historical prompt removed from authority; canonical TEAM RBAC page map; moderation **reactive**; TEAM comms **cancel** removed; settings/card constraints tightened |
| 0.22 | 2026-04-25 | Revision history **deduped** (merged duplicate `0.14` / `0.15` / `0.18` rows); **0.20** note points at in-repo canonical slice |
