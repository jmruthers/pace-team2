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
| TEAM-11 — Report builder | TEAM-01 | Built | |
| TEAM-12 — Profile photo moderation | TEAM-01 | Built | TM12 §15 — run docs/test-packs/TM12-qa-pack.md (S-01–S-15); seed dev profile photos (public + private); manual Remove E2E on dev |
| TEAM-03 — Member 360 | TEAM-01, TEAM-02 | Built | |
| TEAM-13 — Communications via PUMP | TEAM-01, TEAM-02 | Built | PUMP Edge smoke-send + TM13 §15 residual checks on active dev |
| TEAM-04 — Standing roles | TEAM-01, TEAM-03 | Built | |
| TEAM-10 — Events & attendees | TEAM-01, TEAM-03 | Built | TM10 §15: manual QA pack S-01–S-24 on dev; RPC-scoped AC-15–17, AC-24 (BR-I); AC-09 search in-app |

## Evidence

### TEAM-01 — App shell, auth, layout

- authority: `docs/requirements/TM01-app-shell-auth-layout-requirements.md`
- backend freeze: TM01 PASS per [`../pace-core2/docs/delivery/team-backend-ready-report.md`](../pace-core2/docs/delivery/team-backend-ready-report.md) (contract verification by slice)
- validate: pass (`202605080905`)
- implementation: TM01 shell, auth, layout baseline (`src/main.tsx`, `src/App.tsx`, `src/components/layout/AuthenticatedShell.tsx`); bootstrap contract fixes (`src/app.css`, entry import, Tailwind v4 Vite config)
- AC (§11 checkboxes): 12 / 18 complete in requirements; pending TM01 QA pack scenarios (idle modal, passwords, toast)
- RBAC seeds: canonical pages — [`docs/delivery/sql/seed-team-canonical-rbac-app-pages.sql`](sql/seed-team-canonical-rbac-app-pages.sql); see [`docs/delivery/sql/README-teambuild-sql.md`](sql/README-teambuild-sql.md)
- MCP (`yihzsfcceciimdoiibif`, `2026-05-17`): **`rbac_apps.name='TEAM'`** present; all 11 canonical TEAM **`rbac_app_pages`** rows present with **`scope_type='organisation'`** (`home`, `members`, `member-roles`, `approvals`, `membership-types`, `organisations`, `org-settings`, `forms`, `events`, `reports`, `moderation-photos`); comms uses PUMP-owned **`comms-log`** (not seeded under TEAM); legacy **`page_name`** values from the seed **`DELETE`** block absent under that app
- **New environments / deploy targets:** run the same seed against each Supabase project the app will use (`SUPABASE_PROJECT_REF`); MCP evidence above is the verified-contract baseline only
- tests (shell smoke): `src/components/layout/AuthenticatedShell.test.tsx` (3 pass)

### TEAM-02 — Member directory

- authority: `docs/requirements/TM02-member-directory-requirements.md`
- backend freeze: TM02 PASS per backend-ready report (member-request RPCs / enums covered on verified target)
- validate: pass `202605081054`; tests: `16` pass
- remediation: Members row interaction triggers primary action from row cells in both modes; membership-type filtering server-side only (page-level select); search covers F-31 / BR-05 fields (`last`, `first`, `preferred`, `email`, `membership #`) via hidden searchable columns
- Supabase MCP evidence (verified-contract **`yihzsfcceciimdoiibif`** via [`npm run mcp:verification`](../../package.json); see [`docs/delivery/mcp-verification-preflight-queries.md`](mcp-verification-preflight-queries.md)): §15/§12 gates — enums `team_member_request_type={member_profile_access,join,transfer}`, `team_member_request_status={pending,approved,rejected,withdrawn,on_hold}`; RPCs `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request`; schema guards `core_member.organisation_id NOT NULL`, `core_membership_type.is_active NOT NULL DEFAULT true`, `rbac_app_pages.members scope_type=organisation`. Preview **`SUPABASE_PROJECT_REF`** may differ for consumer app `.env`; do not confuse app runtime targets with MCP audit target.
- **TEAM-DB-018 Option A MCP (post-migration `20260611140000_team_db018_member_request_option_a.sql`):** hierarchical fixture — root org R, child C; `app_submit_member_request` join to C → `core_member.organisation_id = R`, `team_member_request.organisation_id = C`, return payload includes `issuing_org_id = R`. Second placement: Active member at R with placement at C1; submit join to C2 → `core_member.membership_status` stays `Active`. Approve join at C with `p_placement_role_id` → `core_member_role` at C. Reject brand-new join → Provisional row deleted; reject second-placement request → issuing `core_member` survives. Transfer approve → source `core_member_role.end_date` set; issuing membership stays `Active`. `pace_private.resolve_issuing_organisation_id` present.
- **Option A TEAM follow-up MCP (UI):** (1) Hierarchical join approve at sub-org C with `p_placement_role_id=null` → review panel shows issuing-org copy; member not in C Members tab until admin **Add role** at `/members/:id/roles` → then appears in C directory. (2) Approved request review panel shows **View placements →** link. (3) Transfer pending request shows source-org closure copy. (4) Member 360 at sub-org shows **Issued by** + **Placement** when applicable. (5) Flat-org smoke: directory unchanged; issuing-org field hidden when issuing = selected.
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
- implementation: [`src/pages/reports/ReportsPage.tsx`](../../src/pages/reports/ReportsPage.tsx) (truncation banner, `alwaysShowResults` + `suppressInlineSavedTemplates`, `canDeleteTemplates`, `visibilityLabels` parity with TM11 §11 AC-15, `onTemplatesPersisted` orchestration); [`src/components/reports/TeamReportTemplatesTable.tsx`](../../src/components/reports/TeamReportTemplatesTable.tsx); [`src/lib/reports/`](../../src/lib/reports/), [`src/hooks/useTeamReportingAdapters.ts`](../../src/hooks/useTeamReportingAdapters.ts); [`src/hooks/useTeamReportTemplatesPanel.ts`](../../src/hooks/useTeamReportTemplatesPanel.ts); `/reports` route in [`src/App.tsx`](../../src/App.tsx); consumer depends on **`@solvera/pace-core/reporting`** `ReportBuilder` / `ReportBuilderHandle` wired from the linked **`pace-core2`** checkout (`package.json` `file:` path)
- tests: Vitest slice — [`src/pages/reports/ReportsPage.test.tsx`](../../src/pages/reports/ReportsPage.test.tsx), [`src/lib/reports/teamReporting.*.test.ts`](../../src/lib/reports/), panel null-skip in [`teamReporting.templatesPanel.test.ts`](../../src/lib/reports/teamReporting.templatesPanel.test.ts)
- validate: pass `202605171618` (consumer `npm run validate` incl. Vitest suite + pace-core audit)
- AC (§11 checkboxes): **`18` / `25`** complete — residual **QA pack** [`TM11-qa-pack.md`](../test-packs/TM11-qa-pack.md) (happy-path run/export, denial, org-switch) plus AC-07/AC-09 save/load integration
- §15 Done (runtime): TM11 §15 post-build seeding / rename reminders + BA15 cross-check if consumer DB differs from verified target
- MCP (`yihzsfcceciimdoiibif`, **2026-05-19**): `COUNT(*) = 33` rows with `report_availability=true` AND `report_domains @> '{participant}'`; `core_report_template` exposes `domain_id`, `app_id`, `sort_config`, `column_config`; **`reports`** lowercase `rbac_app_pages` row; `rbac_page_permissions` grants for **super_admin** / **org_admin** (create/read/update/delete/export) and **staff** (read/export). `core_report_template.created_by` FK targets `auth.users` (not `core_person`); owner column resolves via batch `core_person.user_id` lookup in [`teamReporting.templatesPanel.ts`](../../src/lib/reports/teamReporting.templatesPanel.ts). **Residual:** TM11 MCP RLS row as JWT org-admin without filter; manual QA pack for open ACs (03, 07, 09, 16, 17, 22, 23).

### TEAM-12 — Profile photo moderation

- authority: `docs/requirements/TM12-photo-moderation-requirements.md`
- backend freeze: TM12 PASS per backend-ready report (moderation RPC + RLS + fixture)
- validate: pass `202605191828` (201 Vitest tests; pace-core audit pass)
- implementation: [`src/pages/moderation/PhotoModerationPage.tsx`](../../src/pages/moderation/PhotoModerationPage.tsx), [`src/hooks/usePhotoModerationData.ts`](../../src/hooks/usePhotoModerationData.ts), [`src/lib/moderation/photoModeration.display.ts`](../../src/lib/moderation/photoModeration.display.ts), [`src/components/moderation/PhotoThumbnailCell.tsx`](../../src/components/moderation/PhotoThumbnailCell.tsx), [`src/components/moderation/PhotoPreviewDialog.tsx`](../../src/components/moderation/PhotoPreviewDialog.tsx), route in [`src/App.tsx`](../../src/App.tsx)
- tests: `photoModeration.display.test.ts`, `usePhotoModerationData.test.tsx`, `PhotoModerationPage.test.tsx`
- AC (§11 checkboxes): **9 / 15** Vitest-verified; **15 / 15** implementation-complete — remainder manual QA in [`TM12-qa-pack.md`](../test-packs/TM12-qa-pack.md) (AC-06, AC-09–AC-10, AC-12–AC-15)
- verification log: [`docs/delivery/TM12-verification-evidence.md`](TM12-verification-evidence.md)
- §15 Done (runtime): TM12 §12 test-data prerequisite (≥1 public + 1 private `core_person` profile photo on dev); manual Remove verification; QA pack S-01–S-15
- list-load error UX: destructive `Alert` + Retry **replaces** DataTable when RPC fails (same pattern as TM06/TM07/TM08/Forms; TM12 §4 inline-in-table wording deferred to team convention)
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`data_moderation_photo_list(p_organisation_id uuid)`** SECURITY DEFINER; `pg_policies` on **`core_file_references`** incl. `rbac_restrict_team_moderation_profile_photo_select|delete`, standard rbac CRUD/service policies; **`moderation-photos`** in canonical `rbac_app_pages` seed

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
- validate: pass `202605191949` (253 tests); TM13 §13 unit/component coverage in `src/lib/communications/*` + `CommunicationsPage.test.tsx`
- implementation: [`src/pages/communications/CommunicationsPage.tsx`](../../src/pages/communications/CommunicationsPage.tsx) mounts `CommComposer` (`blockSendOnUnresolvedTokens`, `blockSendWhenPoolEmpty`) via [`createTeamCommSendAdapter`](../../src/lib/communications/teamCommSendAdapter.ts); manual-pick [`commsManualPick.ts`](../../src/lib/communications/commsManualPick.ts); RBAC [`useCommsLogRbac`](../../src/hooks/useCommsLogRbac.ts); sender pre-fill [`usePumpEffectiveSenderIdentity`](../../src/hooks/usePumpEffectiveSenderIdentity.ts); route in [`src/App.tsx`](../../src/App.tsx)
- MCP (`yihzsfcceciimdoiibif`, **2026-05-17**): **`pump_get_effective_sender_identity`** on `public` (SECURITY DEFINER; identity args match PUMP integration contract surface).
- **Residual before Done**: TM13 §15 PUMP smoke (send / schedule / send-test); verify PUMP `rbac_app_pages.comms-log` row + org-admin grants after platform migration (`docs/test-packs/TM13-qa-pack.md`)

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
- validate: pass `202605191928` (231 Vitest tests; pace-core audit pass)
- implementation: [`src/pages/events/EventsListPage.tsx`](../../src/pages/events/EventsListPage.tsx), [`src/pages/events/EventDetailPage.tsx`](../../src/pages/events/EventDetailPage.tsx), [`src/hooks/useOrgEventsData.ts`](../../src/hooks/useOrgEventsData.ts), [`src/hooks/useEventAttendeesData.ts`](../../src/hooks/useEventAttendeesData.ts), [`src/lib/events/`](../../src/lib/events/); routes `/events`, `/events/:eventId` in [`src/App.tsx`](../../src/App.tsx); NULLS LAST via hidden `event_date_sort_key` column
- tests: [`events.display.test.ts`](../../src/lib/events/events.display.test.ts), [`useOrgEventsData.test.tsx`](../../src/hooks/useOrgEventsData.test.tsx) (incl. org refetch), [`useEventAttendeesData.test.tsx`](../../src/hooks/useEventAttendeesData.test.tsx), [`EventsListPage.test.tsx`](../../src/pages/events/EventsListPage.test.tsx), [`EventDetailPage.test.tsx`](../../src/pages/events/EventDetailPage.test.tsx) (incl. detail RPC error + Retry)
- verification log: [`docs/delivery/TM10-verification-evidence.md`](TM10-verification-evidence.md)
- AC (§11 checkboxes): **20 / 24** complete in requirements — open: AC-09, AC-15–17, AC-24 (RPC/manual QA)
- QA pack: **0 / 24** manual Pass/Fail — [`docs/test-packs/TM10-qa-pack.md`](../test-packs/TM10-qa-pack.md); Vitest subset documented in verification log
- known deviations (documented): DataTable search placeholder is generic `"Search…"` (spec: `"Search events"` / `"Search attendees"`); pace-core has no `searchPlaceholder` prop yet
- MCP (**2026-05-19**, verified-contract): **`app_org_event_summaries`**, **`app_org_event_attendees`**, both **`SECURITY DEFINER`**; **`rbac_app_pages.events`** `scope_type=organisation`. **Residual:** BR-I cross-org read + draft/member exclusion proofs on dev fixtures (S-15–S-17, S-24).
