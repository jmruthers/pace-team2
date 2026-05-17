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
| TEAM-09 — Org form authoring | TEAM-01 |  |  |
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

### TEAM-06 — Membership types

- authority: `docs/requirements/TM06-membership-types-requirements.md`
- backend freeze: TM06 PASS per backend-ready report
- validate: pass `202605171351`
- tests: `121` pass; editor/validation coverage `MembershipTypesPage.test.tsx`, `membershipTypes.validation.test.ts`
- note: requirement contract matches DataTable create-flow behavior per TM06
- AC (§11 checkboxes): `11` / `19` complete — remainder tracked in TM06 §11 + QA pack (`docs/test-packs/TM06-qa-pack.md`)
- MCP: run membership-type invariant checks from [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md) supplementary list (extend per TM06 §15)

### TEAM-07 — Sub-organisations

- authority: `docs/requirements/TM07-sub-organisations-requirements.md`
- backend freeze: TM07 PASS per backend-ready report
- validate: pass `202605171404`
- tests (`123` Vitest suite): slice `src/pages/settings/SubOrganisationsPage.test.tsx` (8), `src/lib/settings/subOrganisations.validation.test.ts` (5)
- implementation: `src/pages/settings/SubOrganisationsPage.tsx` (dialogs; duplicate-name `methods.setError('name')` + destructive `Alert`; Status column filters on `isActive` via select values `'true'`/`'false'` — filters `is_active` semantics; pace-core `DataTable` has no `boolean` filterType), `src/hooks/useSubOrganisationsData.ts`, `src/lib/settings/subOrganisations.validation.ts`, route `settings/organisations` + nav in `src/App.tsx`
- AC (§11 checkboxes): `10` / `16` complete — remainder in TM07 §11 + `docs/test-packs/TM07-qa-pack.md`
- MCP (**`yihzsfcceciimdoiibif`**, 2026-05-17): `information_schema.triggers` on `public.core_organisations` includes **`trg_core_organisations_inherit_app_access`** (`AFTER` `INSERT`) plus `trg_core_organisations_org_ancestors` (`AFTER` `INSERT`/`UPDATE`) — TM07 propagation trigger satisfied on verified-contract target (`get_project_url` → `https://yihzsfcceciimdoiibif.supabase.co`)
- MCP checklist: `pg_policies` on `core_organisations` remains in [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md); consumer preview dev may diverge — audits use verification project only
- `rbac_app_pages`: canonical `organisations` row comes from TEAM-01 seed script (verify post-seed)

### TEAM-08 — Organisation settings (Financial)

- authority: `docs/requirements/TM08-organisation-settings-financial-requirements.md`
- backend freeze: TM08 PASS per backend-ready report
- validate: pass `202605171404`
- tests (`123` Vitest suite): slice `src/pages/settings/OrganisationSettingsPage.test.tsx` (12), `src/lib/settings/organisationSettings.validation.test.ts` (6) — Cancel revert + generic save-failure destructive toast (`AC-09` / `AC-14` UX paths)
- implementation: `/settings/org`, `src/pages/settings/OrganisationSettingsPage.tsx`, `src/hooks/useOrganisationSettingsData.ts`, `src/lib/settings/organisationSettings.validation.ts`; Save gating (dirty+valid), save-success rehydrate from upsert, Other-currency uppercasing on blur
- AC (§11 checkboxes): `14` / `17` complete — residual checks in TM08 §11 + QA pack (`docs/test-packs/TM08-qa-pack.md`; includes AC-17 NULL persistence evidence)
- MCP: `rbac_*_core_org_settings` policies + confirm `rbac_app_pages.page_name='org-settings'` exists for TEAM **after** running [`sql/seed-team-canonical-rbac-app-pages.sql`](sql/seed-team-canonical-rbac-app-pages.sql)

### TEAM-09 — Org form authoring

- authority: `docs/requirements/TM09-org-form-authoring-requirements.md`
- backend freeze: TM09 PASS per backend-ready report (`team_batch3_org_signup_forms_foundation` + related tracks); unresolved contract blockers **0** at report date 2026-05-17
- §15 Done (runtime): manual QA `docs/test-packs/TM09-qa-pack.md` (AC-01–AC-33) + MCP confirmation on **active** dev project for Q-DB-2, Q-DB-4, Q-DB-5, Q-DB-6, Q-RBAC-1; Q-UX-4 maps to pace-core `WorkflowFieldCataloguePicker` / `useWorkflowFieldCatalogue` (`@solvera/pace-core/forms`) — verify wiring in slice implementation when executing row

### TEAM-11 — Report builder

- authority: `docs/requirements/TM11-report-builder-requirements.md`
- backend freeze: TM11 PASS per backend-ready report (`core_field_list` + `export` + grants; spot-check 33 rows `report_domains @> '{participant}'`)
- §15 Done (runtime): TM11 §15 post-build seeding / rename reminders + BA15 cross-check if consumer DB differs from verified target; manual QA `docs/test-packs/TM11-qa-pack.md` (AC-01–AC-25); `@solvera/pace-core/reporting` (`ReportBuilder`) integration per TM11 / CR22

### TEAM-12 — Profile photo moderation

- authority: `docs/requirements/TM12-photo-moderation-requirements.md`
- backend freeze: TM12 PASS per backend-ready report (moderation RPC + RLS + fixture)
- §15 Done (runtime): TM12 §15 — RBAC policies + `data_moderation_photo_list`; §12 test-data prerequisite (profile photos seeded on dev); manual Remove verification; `docs/test-packs/TM12-qa-pack.md` / `npm run validate` per slice

### TEAM-03 — Member 360

- authority: `docs/requirements/TM03-member-360-requirements.md`
- backend freeze: TM03 PASS per backend-ready report
- authority dependency (not runtime): architecture lists CR24 + DB-p4/PR08 for Portal CTA gating — preserve when executing Portal handoff acceptance paths
- validate: pass `202605081137`; tests: `37` pass
- evidence docs: `docs/delivery/TM03-verification-evidence.md`, `docs/test-packs/TM03-qa-pack.md`
- implementation: `src/pages/members/Member360Page.tsx`, `src/hooks/useMember360Data.ts`, route in `src/App.tsx`
- AC (§11 checkboxes): 12 / 25 complete — MCP rows in [`TM03-verification-evidence.md`](TM03-verification-evidence.md) + QA pack (`docs/test-packs/TM03-qa-pack.md`)

### TEAM-13 — Communications via PUMP

- authority: `docs/requirements/TM13-communications-pump-requirements.md`
- backend freeze: TM13 PASS per backend-ready report (PUMP Edge slugs ACTIVE; seeds + sender RPC); TM13 §15 **(a–c)** backend prerequisites cleared on verified target
- authority dependency (not runtime): TEAM-02 owns `/members` picker persistence — TEAM-13 consumes [`sessionStorage['pace:team:comms:manual-pick']`](../../src/lib/members/memberDirectory.picker.ts) on `/communications`
- validate: passes with monorepo `npm run validate` (Vitest baseline)
- implementation: [`src/pages/communications/CommunicationsPage.tsx`](../../src/pages/communications/CommunicationsPage.tsx) mounts `CommComposer` from `@solvera/pace-core/comms`; sender pre-fill [`usePumpEffectiveSenderIdentity`](../../src/hooks/usePumpEffectiveSenderIdentity.ts); membership-type chips use [`useActiveOrganisationMembershipTypes`](../../src/hooks/useActiveOrganisationMembershipTypes.ts); route in [`src/App.tsx`](../../src/App.tsx); `PagePermissionGuard pageName="CommsLog"` wraps content in the page export (parity with `MemberDirectoryPage` pattern).
- **Residual before Done**: TM13 §15 PUMP smoke (send / schedule / send-test); grants + `rbac_app_pages.CommsLog` row via TEAM seed (`docs/test-packs/TM13-qa-pack.md`)

### TEAM-04 — Standing roles

- authority: `docs/requirements/TM04-standing-roles-requirements.md`
- backend freeze: TM04 PASS per backend-ready report
- validate: pass `202605171351`
- tests: `121` pass; slice tests `MemberRolesPage.test.tsx`, `useMemberRolesData.test.ts`, `memberRoles.display.test.ts`
- AC (§11 checkboxes): `6` / `20` complete — tracked in TM04 §11 + `docs/test-packs/TM04-qa-pack.md`
- implementation: `src/pages/members/MemberRolesPage.tsx`, `src/hooks/useMemberRolesData.ts`, route `/members/:memberId/roles` in `src/App.tsx`
- remediation: End-role hidden for ended rows; End-role dialog closes on failure; role-history DataTable search/sort/pagination/column controls
- MCP: subset of [`mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md); verify `member-roles` row post-seed

### TEAM-10 — Events & attendees

- authority: `docs/requirements/TM10-events-attendees-requirements.md`
- backend freeze: TM10 PASS per backend-ready report (`app_org_event_summaries`, `app_org_event_attendees`)
- authority dependency (not runtime): TM10 §1 — attendee row navigation targets Member 360 (`TEAM-03`)
- §15 Done (runtime): TM10 §15 — MCP confirmation of both SECURITY DEFINER RPCs on active dev project; cross-org read scenario per TM10 BR-I; manual QA `docs/test-packs/TM10-qa-pack.md` (AC-01–AC-24)
