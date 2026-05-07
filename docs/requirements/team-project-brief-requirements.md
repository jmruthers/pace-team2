# TEAM module — Project brief

## Document purpose

This document is the **product and scope authority** for rebuilding the **TEAM** organisation administration app. The legacy repository in this workspace (`pace-team`) is **observational input only**—it was at best a POC and much of it was never properly tested.

Implementation must trace requirements to this brief, `architecture.md`, and the **authoritative redesign sources** listed below—not to legacy behaviour.

---

## Authoritative redesign sources (override legacy code)

| Document | Role |
|----------|------|
| `CR21-workflow-forms-runtime.md` — under `pace-core2/packages/core/docs/requirements/` | **Forms platform**: `workflow_type`, `field_key`, shared authoring contract, `core_forms` / responses, and workflow orchestration boundaries. |
| `CR22-shared-reporting-foundations.md` — under `pace-core2/packages/core/docs/requirements/` | **Shared reporting engine**: `team.participant` explore, field validation, query-planning, template config shape. |
| `BA15-reporting_requirements.md` — under `pace-core2/docs/requirements/base/` | **Consumer reporting semantics** already resolved in another app: template ownership, export behaviour, field-catalog usage. |
| `DB-change-decisions-p3.md` — under `pace-core2/docs/database/decisions/` | Phase 3 **DB batch** (DB-301+): forms rescope, contacts, events, reporting columns, and related shared-table changes TEAM depends on. |
| `DB-change-decisions-p4.md` — under `pace-core2/docs/database/decisions/` | Current upstream gate for **member requests**, **`member_validation_config`**, **Portal delegated org-admin access**, **PUMP target schema**, and **`core_form_availability`** rename. TEAM slices that depend on these contracts are blocked until the relevant DB-p4 cards land on dev. |
| `CR23-comms-platform.md` — under `pace-core2/packages/core/docs/requirements/` | **Shared comms / PUMP integration** — `CommComposer`, adapter contract, Edge functions, **`RecipientPoolDescriptor`**; **TEAM-13** consuming-app spec. |
| `CR24-cross-app-member-profile-launch.md` — under `pace-core2/packages/core/docs/requirements/` | Shared cross-app launcher/build contract for TEAM → Portal member-profile handoff. |
| `PR08-proxy-delegated-editing.md` — under `pace-core2/docs/requirements/portal/` | **Portal delegated profile contract** used by TEAM Member 360 hand-off. |

If legacy code conflicts with these documents, **the documents win**. The historical `TEAM_rebuild_prompt.md` is **not authoritative** for the rebuild and should not be used as implementation input.

Member-request and operational-settings behaviour that previously lived in an external temporary brief is now captured directly in the TEAM rebuild docs and the database decision docs above.

---

## Product identity

**TEAM** is the **organisation administration** app for **org admins and staff** in the PACE suite. **Members and participants do not use TEAM**—they use **Portal** (and other member-facing apps). TEAM may link out to Portal for **view-as-proxy** / guardian-style flows where deep editing or sensitive domains are better handled there.

**pace-core2** (consumed as **`@solvera/pace-core`**) provides auth, RBAC, layout, org context, secure data access, and shared UI. TEAM must use the pace-core2 RBAC contract (`setupRBAC`, `PagePermissionGuard`, RBAC hooks, `useSecureSupabase`, and Edge-side `isPermitted`) and must not implement custom permission engines, custom page-permission namespaces, or raw Supabase bypasses. **Supabase** is the system of record; TEAM does not author migrations in isolation.

---

## Rebuild framing: baseline, target, exclusions, redesign

This section keeps **planning artefacts aligned**: what the old repo was, what we are building, what we are not building, and what is intentionally different from legacy.

### Current legacy baseline (`pace-team` repo — observational only)

- **Stack:** Vite, React 19, **`@jmruthers/pace-core`** (legacy published package), TanStack Query, react-router-dom v6.  
- **Audience mix:** **Participant** and **admin** routes in one app (`accessLevel === 'participant'` vs team routes).  
- **IA:** Paths under **`/team/*`** (e.g. `/team/members`, `/team-crm`, `/team/sub-organisations`); some features **unrouted** (`TeamUnitsPage`, `TeamMemberRolesPage` using **`team_unit`**).  
- **Data / quality:** POC **stubs** (e.g. CRM hook), **console/debug** patterns, **incomplete** flows; **not** a reliable behavioural spec.  
- **Branding:** Org theming via pace-core patterns; **inherited** in rebuild only where brief requires.

### Intended rebuild target

- **Product:** **TEAM** — **admin/staff only**; **no** participant self-service surfaces (Portal handles members).  
- **Stack:** **`@solvera/pace-core`** (pace-core2), **`OrganisationServiceProvider`**, RBAC app name **`TEAM`**, `useSecureSupabase`, standards from pace-core2.  
- **Scope:** Sixteen capability areas in [In scope](#scope-boundaries-in-scope), implemented across **thirteen slices** (`TEAM-01`–`TEAM-13`) — see `architecture.md` (directory **TEAM-02** and Member 360 **TEAM-03** are split for manageable slice docs).
- **Data:** **`core_*`**, **`base_application`** (and other BASE facts **only** as join sources), forms/reporting per **CR21** / **CR22**. Schema truth comes from the database docs and live dev introspection; TEAM docs keep only the product implications and explicit future-state dependencies from **`DB-change-decisions-p4.md`**. **TEAM UI is member-centric:** no raw BASE table admin surfaces.
- **Quality:** Production-ready UX (no debug RBAC panels by default); **Edge** mutations where RLS requires; **`npm run validate`** (or successor) green.

### Known exclusions (v1 TEAM — not in scope)

| Category | Exclusion |
|----------|-----------|
| **Audience** | Member/participant dashboards, profile completion, or any **member-facing** TEAM UI — use **Portal**. |
| **Legacy carry-forward** | `team_unit`, **Team CRM** as a separate app route, legacy **`/team/*`** IA, debug permissions UI, stub-driven behaviour “because it existed”. |
| **Deferred product scope** | Full **RBAC grant UI**, **form field configuration** (distinct from **org form authoring**), **audit log viewer**, **bulk member actions**. |
| **Infrastructure** | TEAM **does not own** DDL; migrations live in platform/pace-core2 pipelines. |
| **PUMP** | Full campaign/comms **management product** in TEAM — only **send integration** per **TEAM-13** / **pace-core2 CR23** (composer + Edge); operators use **PUMP app** for templates/settings/analytics as needed. |

### Known redesign areas (intentional change vs legacy POC)

| Area | Legacy (POC) | Redesign target |
|------|----------------|-----------------|
| **Audience** | Participant + admin in one app | **Admin-only** TEAM; members use Portal. |
| **IA / routes** | `/team/*`, ad hoc | **TEAM routes** in Architecture (e.g. `/members`, **`/approvals`**, `/settings/*`, `/events`); URLs may evolve. |
| **Member context** | Scattered list/detail/CRM | **Member 360** single page + directory; **Portal proxy** for deep/sensitive edits. |
| **Org structure** | `team_unit` (invalid) | **`core_organisations.parent_id`**; no `team_unit`. |
| **Signups & approvals** | Separate mental model | **Member requests** at **`/approvals`**; **org signup / all org forms** at **`/forms`** (**TEAM-09**). |
| **Forms** | Legacy `core_forms` coupling | **CR21** (`workflow_type`, `field_key`, orchestrators); **DB301 live on dev**; **DB-414** still pending for `core_form_availability`. |
| **Reporting** | Templates only | **CR22** + shared reporting package. |
| **Events in TEAM** | N/A / minimal | **Events list + attendees** via **`base_application`** + **`core_events`**. |
| **Schema** | Mixed dev state | **p3 batch** + **dev MCP** as authoritative for implementation (see Architecture). |

---

## Purpose

Deliver a **documentation-first** rebuild of TEAM so AI-assisted implementation matches agreed scope and platform architecture—without preserving legacy POC quirks.

---

## Goals

1. Implement the **feature set** in [Scope — in scope](#scope-boundaries-in-scope) with **`@solvera/pace-core`**, **`useSecureSupabase`**, RBAC, and Edge-backed writes where RLS requires it.
2. Align with **pace-core2** standards (providers, theming, `OrganisationServiceProvider`, validation pipeline).
3. Integrate **org forms** per **CR21** and **reporting** per **CR22** where those features apply—not ad-hoc copies of legacy code.
4. **URLs** may differ from both legacy `pace-team` and earlier planning examples whenever a clearer IA is agreed.
5. **Branding**: preserve **current branding** and **colour inheritance from the org selector**; align with pace-core2 visual standards.
6. Validate assumptions against **Supabase dev-db** (MCP), not production.

---

## Non-goals

- **Fixing or refactoring** the legacy `pace-team` repo during documentation phases.
- **Automatic parity** with legacy routes, stubs, or debug UX.
- **Participant self-service** inside TEAM (dashboards, member-facing flows)—those belong in **Portal**.
- **Owning schema migrations** in this brief (platform process owns DDL).
- **Full PUMP management app** inside TEAM — TEAM ships **one comms page** (`CommComposer` + PUMP Edge: send + schedule) per **Architecture** and **TEAM-13**; **no** TEAM-local drafts v1.

### Deferred From Earlier Planning (Unless Pulled Into A Later Phase)

Deferred: **RBAC/access management UI**, **form field configuration UI** (distinct from **authoring org forms** per the shared forms/runtime contract), **full audit log viewer**, **bulk member actions**.

---

## Legacy functionality inventory (for exclusion review)

The legacy app was a POC; **nothing below is mandatory carry-forward**.

| Area | Legacy observation | Disposition |
|------|--------------------|-------------|
| Participant vs admin split | Participant routes when `accessLevel === 'participant'`. | **Out of TEAM.** Portal / member apps only. |
| Participant dashboard / complete profile | POC hooks, stub CRM. | **Out of TEAM.** |
| `/team/*` routes | Old IA. | **Superseded** by TEAM IA in Architecture. |
| Team CRM route | Mixed data. | **Not carried forward** as a separate “CRM” app surface; capabilities distributed across Member 360, contacts, directory. |
| `team_unit` | Legacy construct. | **Not used** — platform uses `core_organisations.parent_id` for org hierarchy; event groupings live in BASE. |
| Debug permissions UI | Dev panel. | **Do not ship** unless explicitly approved. |

---

## Scope boundaries

### In scope (agreed TEAM capabilities)

**Audience:** **Org admins / staff only** (not members).

#### Members & people

1. **Member directory** — Searchable, filterable directory in the current organisation: **Members** (default) shows **`Active`** and **`Suspended`**; **Pending** shows **`Provisional`** rows tied to an **open** **`team_member_request`**. **Resigned**, **Lapsed**, and **Revoked** are excluded from default views (optional staff filters may surface them). **Request outcomes** (**rejected**, **withdrawn**) live on **`team_member_request`**, not on **`core_member`** — there is **no** `Declined` membership status (see **TEAM-02** and **TEAM-05**).
2. **Member 360 (one-page member view)** — From the directory, a **page-level** (preferred over modal) **single place** to see what admins need for that member, including:
   - Identity: name, **photo**, key membership/person fields  
   - **Contact** details  
   - **Events**: which events they have a **registration / application** for and **application status** (see Data note below)  
   - **Standing roles**, **member cards**, and other summary blocks as specified in slice requirements  
   - **Additional contacts** on the account: **list with contact type**; ability to **open a modal** with contact details (phone, email, etc.)  
   - **Portal handoff**: open **pace-portal** using the shared **CR24** launch helper once exported: **Edit in Portal** → **`/profile/edit/:memberId`** for staff with `update:member-profiles`; **View in Portal** → **`/profile/view/:memberId`** for staff with `read:member-profiles` but not update. Both use **`core_member.id`**, open in a **new tab**, and add **no `returnUrl`** and **no organisation query param**. Portal sets active org from the target member (**`core_member.organisation_id`**) with delegated access validation. If the admin **is** the target member, hide all Portal handoff CTAs on Member 360. CR24 owns URL-building consistency; **DB-p4 DB-417** + PR08 own making delegated org-admin access allowed.
3. **Member 360 — editing rules** — **Basic editing** allowed on TEAM for fields attached to the **person** record, **member** record, and **additional contacts**, as specified in slice requirements. **Not** in TEAM for Member 360 v1: **photo upload**, **medical**, **billing** (when it exists), **event registration** detail—use **view/edit via Portal proxy** if needed.
4. **Member card management** — View member credential/card state and **deactivate / reactivate existing cards** via **`core_member_card`** (validated on **dev-db** — see Architecture snapshot). **Issuance / reissue / credential generation** is a separate design and **not** part of TEAM v1.
5. **Standing roles** — Dedicated experience for role history and add/end role (`end_date`, no delete-for-history) per validated schema and rebuild slice requirements.

#### Member join / transfer requests (admin queue)

6. **Member requests** — On **`/approvals`**, authorised org admins **review and resolve** **join** and **transfer** requests: queue is **`team_member_request` only** (Open = `pending` / `on_hold`; Closed = `approved` / `rejected` / **`withdrawn`**). **`withdrawn`** is **participant-initiated** only. **Reject** sets request to **`rejected`** and **deletes** the provisional **`core_member`** row. **Review** is the dedicated intake UX; **Member 360** applies when a **`core_member`** row exists (**TEAM-03**). This slice is blocked until upstream **DB-p4 DB-418** lands on dev.

#### Forms

7. **Org form authoring** — Ability to **create and manage org-scoped forms** per **`CR21-workflow-forms-runtime.md`** (`core_forms`, `workflow_type`, `field_key`, shared authoring contract, access mode, orchestration boundaries—not legacy direct-to-column writes), including the org’s **`org_signup`** / registration form when configured and other supported **organisation-scoped workflow types**. TEAM owns the authoring surface at **`/forms`**, with create/edit routes under that area, and does **not** duplicate form authoring on **`/approvals`**. Access mode for TEAM org forms is **`authenticated_member`** in v1; publish uses a **strict validation gate**; forms may support a **minimal no-fields submission** path where the workflow contract allows it. Participant render/share for org-scoped forms is **Portal-owned** at **`/forms/:formSlug`**; primary **`org_signup`** remains the canonical join/transfer entrypoint while other org forms resolve by explicit slug. **DB301 is already verified on dev**; the remaining upstream schema gate for TEAM-09 is **DB-414**.

#### Events (read-focused in TEAM)

8. **Events overview** — A page listing **past and upcoming events where the current organisation already has at least one member application / registration**, using **`base_application`** + **`core_events`** joins under current-org scope. This is a **registered-member-only** view, not a general event catalogue.  
9. **Event attendees** — From an event, **drill through** to a list of **members of the org who have an application for that event**, with **application status** from **`base_application.status`** (validated on dev-db; there is **no** `base_event_registration` table).

#### Communications (send via PUMP)

10. **Org member communications** — On **`/communications`**, authorised users **send or schedule email or SMS** using **`OrgMembersPool`** (**inline org filters** on the comms page) and/or **`ManualPool`** (**hand-picked** **`member_ids`** via **`/members`** picker hand-off — **TEAM-02** + **TEAM-13**). TEAM consumes the shared **CR23** composer surface and wires a **`CommSendAdapter`** to **PUMP Edge** (`pump-resolve-pool`, `pump-send`, `pump-schedule`). **Template dropdown** (org templates only — **authoring** in **PUMP app**). **No persisted drafts** and **no scheduled-message management surface** in TEAM v1. Recipient UX is resolved for v1 as **B1 inline filters + B2 directory picker**; remaining blockers are **CR23 `@solvera/pace-core/comms` package export** and **`DB-change-decisions-p4.md`** PUMP rollout landing on dev.

#### Settings, Reporting, Moderation

11. **Membership types** — Via Edge where client JWT cannot write directly.  
12. **Sub-organisations** — Child orgs under current org (`parent_id`).  
13. **Org settings** — `core_org_settings` upsert: **Financial** fields (fees, bank, tax, etc.) and **Operational** fields (external member validation config from **DB-p4 DB-419**) on **one** settings route — **TEAM-08**.
14. **Report builder** — Org-level templates per **CR22 shared reporting foundations** and TEAM-specific consumer requirements.  
15. **Profile photo moderation** — **Reactive** moderation of already-uploaded profile photos: review recent/current photos and **hide / remove** when needed. No approval queue in TEAM v1.

#### Platform

16. **App shell** — Login, providers, layout, RBAC app name `TEAM`, navigation reflecting the above.

---

### Out of scope unless added later

- Native mobile apps, offline-first.  
- **Full** PUMP product **surface** inside TEAM (template library CRUD, org comms settings UI, delivery analytics, **standalone** scheduled-message / campaign tooling **beyond** **`CommComposer`**) — **thin** **`/communications`** integration as specified; broader management in **PUMP app**.  
- **Deep** medical, billing, or registration **management** inside TEAM where explicitly excluded above—**Portal via proxy** instead.

---

## Assumptions

1. **pace-core2** is available **locally**; package **`@solvera/pace-core`** for the app.  
2. **`npm run validate`** (or successor) passes before merge.  
3. **Legacy behaviour is not automatically preserved.**  
4. **Implementation should not start with known blocking ambiguities** without a waiver in the relevant slice doc.  
5. **Database truth** comes from the database docs plus live dev introspection only. TEAM docs must not duplicate full schema snapshots; keep only product implications and explicit future-state deltas defined in **`DB-change-decisions-p4.md`**. Do **not** use production when validating TEAM documentation assumptions; use the active dev project from the repo root **`.env`** (`SUPABASE_PROJECT_REF_DEV` / `VITE_SUPABASE_URL_DEV`).
6. **Planning resolutions** (member requests vs forms split, portal proxy from portal docs, RBAC page names after build, dependency gates; **PUMP / TEAM comms** resolved — see Architecture) are captured in `architecture.md` — [Planning resolutions](architecture.md#planning-resolutions).

---

## Constraints

| Type | Constraint |
|------|------------|
| Dependency | **pace-core2** via **`@solvera/pace-core`**. |
| Branding | Current branding + org selector colours + pace-core2 theming. |
| Data verification | **dev-db only** for schema documentation. |
| Authority | `project-brief.md`, `architecture.md`, and `*.md` supersede legacy repo. |

---

## Quality gates (rebuild readiness)

1. Brief and architecture agree on features, routes, slice ownership, and **baseline vs target vs exclusions** framing.  
2. Slice requirements exist per slice; each route in exactly one slice.  
3. No undocumented blocking ambiguity—or it is under **Open questions** in the slice.  
4. RBAC and Edge-only rules respect **pace-core2** standards; route/page entries in `rbac_app_pages` may be added **after the TEAM build**, but implementation must still use the canonical `PagePermissionGuard` page names and must not add local permission substitutes.  
5. PUMP / communications integration traces to **pace-core2 CR23** and **`TM13-communications-pump-requirements.md`** (Edge + composer contract); recipient UX is resolved as **B1 inline filters + B2 directory picker**.
6. **Testing inheritance:** every slice requirements doc includes at least **one happy path**, **one validation/domain failure**, and **one auth/permission denial** (see `architecture.md` — Testing expectations).

---

## Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-04-18 | Initial brief from legacy observation |
| 0.2 | 2026-04-18 | Early planning baseline + platform architecture docs |
| 0.3 | 2026-04-18 | Admin-only; Member 360; signups hub; org forms; events; cards; PUMP draft; editing rules |
| 0.4 | 2026-04-18 | Dev-db validation note (later corrected—see 0.5) |
| 0.5 | 2026-04-18 | Historical dev project ref removed from authority; use the current repo root `.env` dev project for verification. `core_member_card` present on dev; prod snapshot error noted |
| 0.6 | 2026-04-21 | **DB-change-decisions-p3** referenced; assumed deployed for TEAM; p3 vs live-schema reconciliation |
| 0.7 | 2026-04-21 | **Rebuild framing** section: legacy baseline, target, exclusions, redesign matrix; quality gates + testing pointer |
| 0.8 | 2026-04-21 | **Thirteen slices** (`TEAM-01`–`TEAM-13`); assumption **6** → Architecture **Planning resolutions**; quality gate **5** earlier PUMP wording |
| 0.9 | 2026-04-20 | **Communications** — CR23 + **TEAM-13** send-only v1 (no drafts/schedule in TEAM); brief item 10 + exclusions + quality gate 5; authoritative sources + **CR23** row |
| 0.10 | 2026-04-20 | **Communications** — **send + schedule** via **`CommComposer`** / PUMP Edge; brief item 10 updated |
| 0.11 | 2026-04-20 | Item 10 — **B1** inline org filters + **B2** directory **`ManualPool`** hand-off |
| 0.12 | 2026-04-21 | **Member requests** **`/approvals`**; **forms** only **TEAM-09**; directory default filter; **TEAM-08** financial + operational |
| 0.13 | 2026-04-21 | **Membership vs requests** — six **`core_member`** statuses only; outcomes on **`team_member_request`**; directory **Members** vs **Pending**; reject/withdraw delete provisional member |
| 0.14 | 2026-04-22 | Historical prompt demoted from authority; events fixed to **registered-member-only**; cards narrowed to **view + deactivate/reactivate**; TEAM comms **cancel** dropped; moderation clarified as **reactive hide/remove** |
| 0.15 | 2026-04-23 | External temporary-brief authority removed; routes/references normalised; schema truth pushed back to DB docs/live introspection; CR24 and DB-p4 dependency gates added |
| 0.16 | 2026-04-25 | Revision history reordered (**0.14** before **0.15**); membership vs requests canonical text lives in **`TM05-member-requests-review-requirements.md`** |
