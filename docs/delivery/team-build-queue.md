# TEAM Build Queue

## Run Readiness Summary

- Backend-ready report: [`../pace-core2/docs/delivery/team-backend-ready-report.md`](../pace-core2/docs/delivery/team-backend-ready-report.md) (`Gate status: PASS`; verification target project `yihzsfcceciimdoiibif`)
- Backend freeze status: `Frozen for this run` (Phase 1 complete; frontend queue execution **GO** per backend-ready report)
- Platform DDL / contract blockers: `none`
- Operational gates still in **`blocker_reason`** (below): TEAM-13 PUMP Edge smoke — clear once executed and noted in Evidence (`TEAM-01` canonical RBAC seed verified on contract target; still re-run [`sql/seed-team-canonical-rbac-app-pages.sql`](sql/seed-team-canonical-rbac-app-pages.sql) on **new** deploy DBs per [`README-teambuild-sql.md`](sql/README-teambuild-sql.md))
- Execution mode: `full run`

**Preflight caveat:** MCP §12 / §15 **`execute_sql` evidence** MUST run against the backend-ready **verified-contract** project **`yihzsfcceciimdoiibif`** (see [`team-backend-ready-report.md`](../pace-core2/docs/delivery/team-backend-ready-report.md)). `.env` / `SUPABASE_PROJECT_REF` can still point at consumer preview dev for local runs — MCP is rewired independently: run [`npm run mcp:verification`](../../package.json) whenever [`npm run env:dev`](../../package.json) overwrote [.cursor/mcp.json](/.cursor/mcp.json), then rerun MCP queries. Bundle: [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md).

**Done promotion (manual QA):** **Done** still requires TMxx §11 checks and **`docs/test-packs/TMxx-qa-pack.md`** runs. Manual QA stays out of **`blocker_reason`** (reserved for seeds, DDL/RPC gaps, platform triggers, residual PUMP infra).

## Dependency handling for this run

- Source authority for slice identity, title, and dependencies: `docs/requirements/*.md`
- `.contract` dependencies are treated as backend-pre-satisfied for runtime sequencing when the backend-ready report is `PASS` and backend is frozen for this run
- Runtime `depends_on` values in the queue table include executable build-order prerequisites only; authority `.contract` edges are preserved in **Evidence** below

## Queue

| slice_id | depends_on | status | blocker_reason |
| --- | --- | --- | --- |
| TEAM-01 — App shell, auth, layout | - | Built | |
| TEAM-02 — Member directory | TEAM-01 | Built | |
| TEAM-05 — Member requests queue & review | TEAM-01 | Built | |
| TEAM-06 — Membership types | TEAM-01 | Built | |
| TEAM-07 — Sub-organisations | TEAM-01 | Built | |
| TEAM-08 — Organisation settings (Financial) | TEAM-01 | Built | |
| TEAM-09 — Org form authoring | TEAM-01 | Built | TM09 §15 Done: QA pack + §12 RLS MCP + Q-UX-4 pace-core picker |
| TEAM-11 — Report builder | TEAM-01 |  |  |
| TEAM-12 — Profile photo moderation | TEAM-01 |  |  |
| TEAM-03 — Member 360 | TEAM-01, TEAM-02 | Built | |
| TEAM-13 — Communications via PUMP | TEAM-01, TEAM-02 | Built | PUMP Edge smoke-send + TM13 §15 residual checks on active dev |
| TEAM-04 — Standing roles | TEAM-01, TEAM-03 | Built | |
| TEAM-10 — Events & attendees | TEAM-01, TEAM-03 |  |  |

## Evidence

### TEAM-01 — App shell, auth, layout

- authority: `docs/requirements/TM01-app-shell-auth-layout-requirements.md`
- backend freeze: TM01 PASS per [`../pace-core2/docs/delivery/team-backend-ready-report.md`](../pace-core2/docs/delivery/team-backend-ready-report.md) (contract verification by slice)
- validate: pass (`202605080905`)
- implementation: TM01 shell, auth, layout baseline (`src/main.tsx`, `src/App.tsx`, `src/components/layout/AuthenticatedShell.tsx`); bootstrap contract fixes (`src/app.css`, entry import, Tailwind v4 Vite config)
- AC (§11 checkboxes): 12 / 18 complete in requirements; pending TM01 QA pack scenarios (idle modal, passwords, toast)
- RBAC seeds: canonical pages — [`docs/delivery/sql/seed-team-canonical-rbac-app-pages.sql`](sql/seed-team-canonical-rbac-app-pages.sql); see [`docs/delivery/sql/README-teambuild-sql.md`](sql/README-teambuild-sql.md)
- MCP (`yihzsfcceciimdoiibif`, `2026-05-17`): **`rbac_apps.name='TEAM'`** present; all 12 canonical **`rbac_app_pages`** rows present with **`scope_type='organisation'`** (`home`, `members`, `member-roles`, `approvals`, `membership-types`, `organisations`, `org-settings`, `forms`, `events`, `reports`, `moderation-photos`, `CommsLog`); legacy **`page_name`** values from the seed **`DELETE`** block absent under that app
- **New environments / deploy targets:** run the same seed against each Supabase project the app will use (`SUPABASE_PROJECT_REF`); MCP evidence above is the verified-contract baseline only
- tests (shell smoke): `src/components/layout/AuthenticatedShell.test.tsx` (3 pass)

### TEAM-02 — Member directory

- authority: `docs/requirements/TM02-member-directory-requirements.md`
- backend freeze: TM02 PASS per backend-ready report (member-request RPCs / enums covered on verified target)
- validate: pass `202605081054`; tests: `16` pass
- remediation: Members row interaction triggers primary action from row cells in both modes; membership-type filtering server-side only (page-level select); search covers F-31 / BR-05 fields (`last`, `first`, `preferred`, `email`, `membership #`) via hidden searchable columns
- Supabase MCP evidence (verified-contract **`yihzsfcceciimdoiibif`** via [`npm run mcp:verification`](../../package.json); see [`docs/delivery/mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md)): §15/§12 gates — enums `team_member_request_type={member_profile_access,join,transfer}`, `team_member_request_status={pending,approved,rejected,withdrawn,on_hold}`; RPCs `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request`; schema guards `core_member.organisation_id NOT NULL`, `core_membership_type.is_active NOT NULL DEFAULT true`, `rbac_app_pages.members scope_type=organisation`. Preview **`SUPABASE_PROJECT_REF`** may differ for consumer app `.env`; do not confuse app runtime targets with MCP audit target.
- queue note: TM02 remediation rerun completed; §15/§12 gates re-verified; `TEAM-02` blocker wording aligned to TM02 RPC names
- AC (§11 checkboxes): 14 / 24 complete in requirements (remainder: TM02 QA pack + §11 unchecked rows)
- communications hand-off: TEAM-13 [`CommunicationsPage`](../../src/pages/communications/CommunicationsPage.tsx) consumes `sessionStorage['pace:team:comms:manual-pick']` on `/communications`; see [`TM03-verification-evidence.md`](TM03-verification-evidence.md) table

### TEAM-05 — Member requests queue & review

- authority: `docs/requirements/TM05-member-requests-review-requirements.md`
- backend freeze: TM05 PASS per backend-ready report
- authority dependency (not runtime): architecture recommends TEAM-03 before heavy approvals UX; TM05 §1 lists TEAM-01 only for executable deps
- validate: pass `202605171351`
- tests: `121` pass (monorepo Vitest); approvals: `ApprovalsPage.test.tsx`, `ApprovalReviewPanel.test.tsx`, `resolveDialogs.test.tsx`, `useApprovalsData.test.ts`, `useResolveMemberRequest.test.ts`
- implementation: `src/pages/approvals/ApprovalsPage.tsx` (open empty-state CTA → `/forms`, closed sort `resolved_at` desc, row `onRowActivate`, error title "Could not load requests"), `src/pages/approvals/ApprovalReviewPanel.tsx` (Applicant + Request groups, target org, formatted submitted/resolved copy, form empty state + `/forms` link), `src/components/approvals/resolveDialogs.tsx`, `src/hooks/useResolveMemberRequest.ts` (approve toast with applicant name), `src/hooks/useApprovalsData.ts` (`useApprovalsOpenCount`, `target_org` join), `src/components/layout/AuthenticatedShell.tsx` (nav `Approvals (n)` from open-count query)
- AC (§11 checkboxes): `8` / `30` complete in requirements — remainder in TM05 §11 + [`TM05-qa-pack.md`](../test-packs/TM05-qa-pack.md)
- Supabase: `public.app_resolve_member_request` present and used
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): `team_member_request` has planned columns (`target_organisation_id`, `source_organisation_id`, `membership_type_id`, `applicant_member_number`, `review_notes`); enums include `join` / `transfer` and `on_hold`; `rbac_app_pages.page_name='approvals'` (`scope_type=organisation`). **Residual:** TM05 §12 RPC smoke, RLS/JWT proofs, fixtures — not SQL-catalogue-only.

### TEAM-06 — Membership types

- authority: `docs/requirements/TM06-membership-types-requirements.md`
- backend freeze: TM06 PASS per backend-ready report
- validate: pass `202605171351`
- tests: `121` pass; editor/validation coverage `MembershipTypesPage.test.tsx`, `membershipTypes.validation.test.ts`
- note: requirement contract matches DataTable create-flow behavior per TM06
- AC (§11 checkboxes): `11` / `19` complete — remainder tracked in TM06 §11 + QA pack (`docs/test-packs/TM06-qa-pack.md`)
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): `core_membership_type.is_active` **NOT NULL** default **true**; policies `rbac_insert_core_membership_type`, `rbac_update_core_membership_type`, `read_team_membership_types` on `public.core_membership_type`. **Residual:** MCP §12 denial tests without privileged roles.

### TEAM-07 — Sub-organisations

- authority: `docs/requirements/TM07-sub-organisations-requirements.md`
- backend freeze: TM07 PASS per backend-ready report
- validate: pass `202605171404`
- tests (`123` Vitest suite): slice `src/pages/settings/SubOrganisationsPage.test.tsx` (8), `src/lib/settings/subOrganisations.validation.test.ts` (5)
- implementation: `src/pages/settings/SubOrganisationsPage.tsx` (dialogs; duplicate-name `methods.setError('name')` + destructive `Alert`; Status column filters on `isActive` via select values `'true'`/`'false'` — filters `is_active` semantics; pace-core `DataTable` has no `boolean` filterType), `src/hooks/useSubOrganisationsData.ts`, `src/lib/settings/subOrganisations.validation.ts`, route `settings/organisations` + nav in `src/App.tsx`
- AC (§11 checkboxes): `10` / `16` complete — remainder in TM07 §11 + `docs/test-packs/TM07-qa-pack.md`
- MCP (**`yihzsfcceciimdoiibif`**, 2026-05-17): `information_schema.triggers` on `public.core_organisations` includes **`trg_core_organisations_inherit_app_access`** (`AFTER` `INSERT`) plus `trg_core_organisations_org_ancestors` (`AFTER` `INSERT`/`UPDATE`) — TM07 propagation trigger satisfied on verified-contract target (`get_project_url` → `https://yihzsfcceciimdoiibif.supabase.co`)
- MCP (`pg_policies` same target, **2026-05-17**): `rbac_insert|select|update|delete_core_organisations` on `core_organisations`. Consumer preview dev may diverge — audits use verification project only [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md)
- `rbac_app_pages`: canonical `organisations` row comes from TEAM-01 seed script (verify post-seed)

### TEAM-08 — Organisation settings (Financial)

- authority: `docs/requirements/TM08-organisation-settings-financial-requirements.md`
- backend freeze: TM08 PASS per backend-ready report
- validate: pass `202605171404`
- tests (`123` Vitest suite): slice `src/pages/settings/OrganisationSettingsPage.test.tsx` (12), `src/lib/settings/organisationSettings.validation.test.ts` (6) — Cancel revert + generic save-failure destructive toast (`AC-09` / `AC-14` UX paths)
- implementation: `/settings/org`, `src/pages/settings/OrganisationSettingsPage.tsx`, `src/hooks/useOrganisationSettingsData.ts`, `src/lib/settings/organisationSettings.validation.ts`; Save gating (dirty+valid), save-success rehydrate from upsert, Other-currency uppercasing on blur
- AC (§11 checkboxes): `14` / `17` complete — residual checks in TM08 §11 + QA pack (`docs/test-packs/TM08-qa-pack.md`; includes AC-17 NULL persistence evidence)
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): `rbac_insert|select|update|delete_core_org_settings` + `service_role_can_manage_all_core_org_settings`; `rbac_app_pages.page_name='org-settings'`, **`scope_type=organisation`** (TEAM seed alignment).

### TEAM-09 — Org form authoring

- authority: `docs/requirements/TM09-org-form-authoring-requirements.md`
- backend freeze: TM09 PASS per backend-ready report (`team_batch3_org_signup_forms_foundation` + related tracks); unresolved contract blockers **0** at report date 2026-05-17
- validate: pass `202605171518` (monorepo `npm run validate` incl. Vitest suite)
- implementation: `/forms`, `/forms/new`, `/forms/:formId` in [`src/App.tsx`](../../src/App.tsx); [`src/pages/forms/FormsListPage.tsx`](../../src/pages/forms/FormsListPage.tsx), [`src/pages/forms/FormAuthoringPage.tsx`](../../src/pages/forms/FormAuthoringPage.tsx), [`src/components/org-forms/ScheduleLimitsCard.tsx`](../../src/components/org-forms/ScheduleLimitsCard.tsx); data [`src/hooks/useOrgFormsData.ts`](../../src/hooks/useOrgFormsData.ts), [`src/lib/forms/`](../../src/lib/forms/) (types, mappers, display, portal URL, persistence, scoped detail `formAuthoringScopedDetail.ts`); **`/forms/new`** disables `WorkflowFormAuthoringShell` when `canCreate === false` (F-49 / §9 action table)
- tests: Vitest slice coverage — `src/lib/forms/orgForms.portalAndValidation.test.ts`, `src/hooks/useOrgFormsData.test.ts` (incl. list-query `organisation_id` + `event_id IS NULL`), `src/pages/forms/FormsListPage.test.tsx` (AccessDenied, list error + Retry, delete cancel/Escape + success toast), `src/pages/forms/FormAuthoringPage.test.tsx` (incl. create + `!canCreate`); full suite at validate
- AC (§11 checkboxes): **`23` / `33`** complete in [`TM09-org-form-authoring-requirements.md`](../requirements/TM09-org-form-authoring-requirements.md); **`0` / `33`** QA pack ([`TM09-qa-pack.md`](../test-packs/TM09-qa-pack.md)); residual unchecked ACs: manual/portal/shell QA (01, 05–08, 17–19, 28, 33) and §12 RLS
- AC (§11) / §15 **Done**: requirements **Done** = all 33 ACs via QA pack + §15 MCP / platform (Q-DB-2, Q-DB-4, Q-DB-5, Q-DB-6, Q-RBAC-1, **Q-UX-4**). Catalogue MCP logged below; **Q-UX-4** shared **`FieldCatalogPicker`** in pace-core still gates full Done. Frontend slice **Built**.
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **Q-DB-2** `core_forms_workflow_type_check` includes `org_signup`; **Q-DB-4** partial unique index `core_forms_primary_org_signup_per_org_unique`; **Q-DB-5** `app_submit_member_request` RETURNS `jsonb` (signature on contract DB includes extended args — consumer code must track actual `pg_catalog` identity); **Q-DB-6** `core_field_list` org_signup person + address catalogue rows (`core_form_availability=true`); **Q-RBAC-1** `forms` row; **`data_core_field_list_core_form`** present. **Q-UX-4** catalogue/RPC wiring only — shared **`FieldCatalogPicker`** in pace-core still required for full Done per TM09.

### TEAM-11 — Report builder

- authority: `docs/requirements/TM11-report-builder-requirements.md`
- backend freeze: TM11 PASS per backend-ready report (`core_field_list` + `export` + grants; spot-check 33 rows `report_domains @> '{participant}'`)
- §15 Done (runtime): TM11 §15 post-build seeding / rename reminders + BA15 cross-check if consumer DB differs from verified target; manual QA `docs/test-packs/TM11-qa-pack.md` (AC-01–AC-25); `@solvera/pace-core/reporting` (`ReportBuilder`) integration per TM11 / CR22
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): `COUNT(*) = 33` rows with `report_availability=true` AND `report_domains @> '{participant}'`; `core_report_template` exposes `domain_id`, `app_id`, `sort_config`, `column_config`; **`reports`** lowercase `rbac_app_pages` row; `rbac_page_permissions` grants for **super_admin** / **org_admin** (create/read/update/delete/export) and **staff** (read/export) against that page (many org-scoped grant rows observed). **Residual:** TM11 MCP RLS row as JWT org-admin without filter.

### TEAM-12 — Profile photo moderation

- authority: `docs/requirements/TM12-photo-moderation-requirements.md`
- backend freeze: TM12 PASS per backend-ready report (moderation RPC + RLS + fixture)
- §15 Done (runtime): TM12 §15 — RBAC policies + `data_moderation_photo_list`; §12 test-data prerequisite (profile photos seeded on dev); manual Remove verification; `docs/test-packs/TM12-qa-pack.md` / `npm run validate` per slice
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`data_moderation_photo_list(p_organisation_id uuid)`** SECURITY DEFINER; `pg_policies` on **`core_file_references`** incl. `rbac_restrict_team_moderation_profile_photo_select|delete`, standard rbac CRUD/service policies.

### TEAM-03 — Member 360

- authority: `docs/requirements/TM03-member-360-requirements.md`
- backend freeze: TM03 PASS per backend-ready report
- authority dependency (not runtime): architecture lists CR24 + DB-p4/PR08 for Portal CTA gating — preserve when executing Portal handoff acceptance paths
- validate: pass `202605081137`; tests: `37` pass
- evidence docs: `docs/delivery/TM03-verification-evidence.md`, `docs/test-packs/TM03-qa-pack.md`
- implementation: `src/pages/members/Member360Page.tsx`, `src/hooks/useMember360Data.ts`, route in `src/App.tsx`
- AC (§11 checkboxes): 12 / 25 complete — TM03 §12 **catalogue** MCP logged in [`TM03-verification-evidence.md`](TM03-verification-evidence.md) (**2026-05-17**); JWT/RLS rows + PostgREST embed smoke still Pending there + QA pack (`docs/test-packs/TM03-qa-pack.md`)

### TEAM-13 — Communications via PUMP

- authority: `docs/requirements/TM13-communications-pump-requirements.md`
- backend freeze: TM13 PASS per backend-ready report (PUMP Edge slugs ACTIVE; seeds + sender RPC); TM13 §15 **(a–c)** backend prerequisites cleared on verified target
- authority dependency (not runtime): TEAM-02 owns `/members` picker persistence — TEAM-13 consumes [`sessionStorage['pace:team:comms:manual-pick']`](../../src/lib/members/memberDirectory.picker.ts) on `/communications`
- validate: passes with monorepo `npm run validate` (Vitest baseline)
- implementation: [`src/pages/communications/CommunicationsPage.tsx`](../../src/pages/communications/CommunicationsPage.tsx) mounts `CommComposer` from `@solvera/pace-core/comms`; sender pre-fill [`usePumpEffectiveSenderIdentity`](../../src/hooks/usePumpEffectiveSenderIdentity.ts); membership-type chips use [`useActiveOrganisationMembershipTypes`](../../src/hooks/useActiveOrganisationMembershipTypes.ts); route in [`src/App.tsx`](../../src/App.tsx); `PagePermissionGuard pageName="CommsLog"` wraps content in the page export (parity with `MemberDirectoryPage` pattern).
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`pump_get_effective_sender_identity`** on `public` (SECURITY DEFINER; identity args match PUMP integration contract surface).
- **Residual before Done**: TM13 §15 PUMP smoke (send / schedule / send-test); grants + `rbac_app_pages.CommsLog` row via TEAM seed (`docs/test-packs/TM13-qa-pack.md`)

### TEAM-04 — Standing roles

- authority: `docs/requirements/TM04-standing-roles-requirements.md`
- backend freeze: TM04 PASS per backend-ready report
- validate: pass `202605171351`
- tests: `121` pass; slice tests `MemberRolesPage.test.tsx`, `useMemberRolesData.test.ts`, `memberRoles.display.test.ts`
- AC (§11 checkboxes): `6` / `20` complete — tracked in TM04 §11 + `docs/test-packs/TM04-qa-pack.md`
- implementation: `src/pages/members/MemberRolesPage.tsx`, `src/hooks/useMemberRolesData.ts`, route `/members/:memberId/roles` in `src/App.tsx`
- remediation: End-role hidden for ended rows; End-role dialog closes on failure; role-history DataTable search/sort/pagination/column controls
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`rbac_app_pages.page_name='member-roles'`**, `scope_type=organisation`. Further checks: [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md).

### TEAM-10 — Events & attendees

- authority: `docs/requirements/TM10-events-attendees-requirements.md`
- backend freeze: TM10 PASS per backend-ready report (`app_org_event_summaries`, `app_org_event_attendees`)
- authority dependency (not runtime): TM10 §1 — attendee row navigation targets Member 360 (`TEAM-03`)
- §15 Done (runtime): TM10 §15 — MCP confirmation of both SECURITY DEFINER RPCs on active dev project; cross-org read scenario per TM10 BR-I; manual QA `docs/test-packs/TM10-qa-pack.md` (AC-01–AC-24)
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`app_org_event_summaries(p_organisation_id uuid)`** and **`app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)`**, both **`SECURITY DEFINER`** (`pg_proc.prosecdef=true`). **Residual:** TM10 BR-I cross-org read behaviour exercised in QA / fixture runs.
