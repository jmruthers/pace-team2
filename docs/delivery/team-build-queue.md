# TEAM Build Queue

## Run Readiness Summary

- Backend-ready report: [`/Users/jess/Documents/Solvera/pace-core2/docs/delivery/team-backend-ready-report.md`](/Users/jess/Documents/Solvera/pace-core2/docs/delivery/team-backend-ready-report.md)
- Backend freeze status: `Frozen` (`Gate status: PASS`, `Frontend queue execution: GO`)
- Unresolved blockers: `4` (`TEAM-05`, `TEAM-09`, `TEAM-11`, `TEAM-13`)
- Execution mode: `Full run`

## Queue

| slice_id | depends_on | status | blocker_reason | evidence |
|---|---|---|---|---|
| TEAM-01 | - | Built |  | validate: pass (`202605080905`); implemented TM01 shell/auth/layout baseline (`src/main.tsx`, `src/App.tsx`, `src/components/layout/AuthenticatedShell.tsx`) plus bootstrap contract fixes (`src/app.css`, entry import, Tailwind v4 vite config) |
| TEAM-02 | TEAM-01 | Built |  | TM02 final remediation implemented and validated (`npm run validate`: pass `202605081054`; tests: `15` pass). Members row interaction now triggers primary action from row cells in both modes, membership-type filtering is server-side only (page-level select), and search coverage includes required F-31/BR-05 fields (`last`, `first`, `preferred`, `email`, `membership #`) via hidden searchable columns. Supabase MCP (`project_id=rkytnffgmwnnmewevqgp`) confirms §15/§12 gates: enums `team_member_request_type={member_profile_access,join,transfer}` and `team_member_request_status={pending,approved,rejected,withdrawn,on_hold}`; RPCs present `app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request`; schema guards `core_member.organisation_id NOT NULL`, `core_membership_type.is_active NOT NULL DEFAULT true`, and `rbac_app_pages.members scope_type=organisation` |
| TEAM-03 | TEAM-01, TEAM-02 | Built |  | TM03 remediation complete. Validate pass (`202605081137`), tests pass (`34`). Evidence: `docs/delivery/TM03-verification-evidence.md`, QA outcomes: `docs/test-packs/TM03-qa-pack.md`. Member 360 delivered at `src/pages/members/Member360Page.tsx` with data contract `src/hooks/useMember360Data.ts` and route wired in `src/App.tsx`. |
| TEAM-04 | TEAM-01, TEAM-03 |  |  | `TM04 Standing roles`; authority: `docs/requirements/TM04-standing-roles-requirements.md` and TM14 orchestration table |
| TEAM-05 | TEAM-01 | Blocked | `TM05 §15 gate still fails in live dev DB: required status-update RPC contract is incomplete` | Supabase MCP confirms required columns exist on `team_member_request` (`target_organisation_id`, `source_organisation_id`, `membership_type_id`, `applicant_member_number`, `review_notes`) and `app_submit_member_request` includes new args, but `public.app_update_member_request_status` is missing from `pg_proc`; keep blocked until RPC is deployed |
| TEAM-06 | TEAM-01 |  |  | Supabase MCP verified TM06 §15 gate in `project_id=rkytnffgmwnnmewevqgp`: `pg_policies` contains `rbac_insert_core_membership_type` and `rbac_update_core_membership_type` with `check_rbac_permission_with_context(... 'membership-types' ...)`; blocker removed (build candidate) |
| TEAM-07 | TEAM-01 |  |  | Supabase MCP verified TM07 §15 gate: `pg_policies` contains `rbac_insert_core_organisations` + `rbac_update_core_organisations` for `page.organisations`, and `pg_trigger` contains `trg_core_organisations_inherit_app_access` (`AFTER INSERT`); blocker removed (build candidate) |
| TEAM-08 | TEAM-01 |  |  | Supabase MCP verified TM08 §15 gate: `pg_policies` contains `rbac_insert_core_org_settings` + `rbac_update_core_org_settings` with `check_rbac_permission_with_context(... 'org-settings' ...)`; blocker removed (build candidate) |
| TEAM-09 | TEAM-01 | Blocked | `TM09 §15 gate still fails in live dev DB due to incomplete seed prerequisites` | Supabase MCP verifies `core_forms_workflow_type_check` includes `org_signup` and index `core_forms_primary_org_signup_per_org_unique` exists, but `core_field_list` seed check for `core_person.member_number` returns `0`; keep blocked until required field seed is present |
| TEAM-10 | TEAM-01 |  |  | Supabase MCP verified TM10 §15 gate: `public.app_org_event_summaries(p_organisation_id uuid)` and `public.app_org_event_attendees(p_organisation_id uuid, p_event_id uuid)` both exist with `SECURITY DEFINER`; blocker removed (build candidate) |
| TEAM-11 | TEAM-01 | Blocked | `TM11 §15 gate still fails in live dev DB: report-domain reseed incomplete` | Supabase MCP shows `core_field_list` has `report_availability=true` rows with empty/null `report_domains` (`73` rows), so post-reseed contract is not complete; keep blocked until domains are fully repopulated per gate |
| TEAM-12 | TEAM-01 |  |  | Supabase MCP verified TM12 §15 gate: `core_file_references` has moderation policies `rbac_restrict_team_moderation_profile_photo_select/delete` and RPC `public.data_moderation_photo_list(p_organisation_id uuid)` exists (`SECURITY DEFINER`); blocker removed (build candidate) |
| TEAM-13 | TEAM-01 | Blocked | `TM13 §15 evidence remains incomplete for this queue run` | Supabase MCP verifies deployment/seed prerequisites (`pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-*` edge functions present; `pump_gateway_config` has active `email/resend` + `sms/twilio`; `pump_organisation_templates` seeded), but required queue-run smoke-send execution evidence is still missing; keep blocked |

## Run stop evidence

- Strict Supabase MCP unblock pass complete. Remaining blocked slices are now evidence-specific: `TEAM-05` (`app_update_member_request_status` missing), `TEAM-09` (`core_field_list` `member_number` seed missing), `TEAM-11` (report-domain reseed incomplete), `TEAM-13` (smoke-send evidence missing).
- TM02 remediation rerun completed and all TM02 §15/§12 gates re-verified; blocker wording was corrected to match TM02 requirements (`app_submit_member_request`, `app_resolve_member_request`, `app_withdraw_member_request`), and `TEAM-02` moved to built.
- Newly unblocked build candidates (status cleared): `TEAM-06`, `TEAM-07`, `TEAM-08`, `TEAM-10`, `TEAM-12`.

