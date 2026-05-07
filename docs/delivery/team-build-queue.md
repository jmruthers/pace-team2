# TEAM Build Queue

## Run Readiness Summary

- Backend-ready report: [`/Users/jess/Documents/Solvera/pace-core2/docs/delivery/team-backend-ready-report.md`](/Users/jess/Documents/Solvera/pace-core2/docs/delivery/team-backend-ready-report.md)
- Backend freeze status: `Frozen` (`Gate status: PASS`, `Frontend queue execution: GO`)
- Unresolved blockers: `0` (`None`)
- Execution mode: `Full run`

## Queue

| slice_id | depends_on | status | blocker_reason | evidence |
|---|---|---|---|---|
| TEAM-01 | - |  |  | `TM01 App shell, auth, layout`; authority: `docs/requirements/TM01-app-shell-auth-layout-requirements.md`; queue schema: `pace-core2/docs/XX00-template-build-queue.md`; backend gate PASS/Frozen in backend-ready report |
| TEAM-02 | TEAM-01 |  |  | `TM02 Member directory`; authority: `docs/requirements/TM02-member-directory-requirements.md` and TM14 orchestration table |
| TEAM-03 | TEAM-01, TEAM-02 |  |  | `TM03 Member 360`; authority: `docs/requirements/TM03-member-360-requirements.md` and TM14 orchestration table |
| TEAM-04 | TEAM-01, TEAM-03 |  |  | `TM04 Standing roles`; authority: `docs/requirements/TM04-standing-roles-requirements.md` and TM14 orchestration table |
| TEAM-05 | TEAM-01 |  |  | `TM05 Member requests queue and review`; authority: `docs/requirements/TM05-member-requests-review-requirements.md`; TM14 notes TEAM-03 recommended and DB-p4 DB-418 gate context |
| TEAM-06 | TEAM-01 |  |  | `TM06 Membership types`; authority: `docs/requirements/TM06-membership-types-requirements.md`; TM14 notes platform mutation-path gate context |
| TEAM-07 | TEAM-01 |  |  | `TM07 Sub-organisations`; authority: `docs/requirements/TM07-sub-organisations-requirements.md`; TM14 notes org hierarchy RLS/mutation validation context |
| TEAM-08 | TEAM-01 |  |  | `TM08 Organisation settings (financial and operational)`; authority: `docs/requirements/TM08-organisation-settings-financial-requirements.md`; TM14 notes DB-p4 DB-419 operational gate context |
| TEAM-09 | TEAM-01 |  |  | `TM09 Org form authoring`; authority: `docs/requirements/TM09-org-form-authoring-requirements.md`; TM14 notes CR21 and DB-414 gate context |
| TEAM-10 | TEAM-01 |  |  | `TM10 Events and attendees`; authority: `docs/requirements/TM10-events-attendees-requirements.md`; TM14 notes dev-db event/application join verification context |
| TEAM-11 | TEAM-01 |  |  | `TM11 Report builder`; authority: `docs/requirements/TM11-report-builder-requirements.md`; TM14 notes CR22 reporting package gate context |
| TEAM-12 | TEAM-01 |  |  | `TM12 Profile photo moderation`; authority: `docs/requirements/TM12-photo-moderation-requirements.md`; TM14 notes platform file deactivation contract context |
| TEAM-13 | TEAM-01 |  |  | `TM13 Communications (PUMP)`; authority: `docs/requirements/TM13-communications-pump-requirements.md`; TM14 notes CR23 export and DB-p4 PUMP rollout gate context |
