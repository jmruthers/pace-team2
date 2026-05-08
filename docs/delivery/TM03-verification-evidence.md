# TM03 Verification Evidence

## Scope

- Slice: `TEAM-03` / `TM03 Member 360`
- Requirement source: `docs/requirements/TM03-member-360-requirements.md`
- QA pack: `docs/test-packs/TM03-qa-pack.md`
- App code:
  - `src/pages/members/Member360Page.tsx`
  - `src/hooks/useMember360Data.ts`
  - `src/lib/members/member360.validation.ts`
  - `src/lib/members/member360.display.ts`

## Automated checks

- `npm run test`: pass (`34` tests)
  - includes `src/pages/members/Member360Page.test.tsx`
  - includes `src/hooks/useMember360Data.test.ts`
  - includes `src/lib/members/member360.validation.test.ts`
- `npm run validate`: pass (authority wiring, type-check, lint, build, tests, pace-core audit)

## TM03 §12/§15 database checks (dev-db)

Environment: Supabase MCP `project-0-pace-team2-supabase` via `execute_sql`.

1. `pace_membership_status` enum values
   - Query: `pg_type` + `pg_enum` lookup
   - Result: `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked`
   - Status: Pass

2. `core_contact.permission_type` shape
   - Query: `pg_constraint` for `core_contact_permission_type_check`
   - Result: `CHECK ((permission_type = ANY (ARRAY['full','notify','none'])))`
   - Query: `information_schema.columns` for `core_contact.permission_type`
   - Result: `data_type=text`, `is_nullable=NO`
   - Status: Pass

3. `core_contact_type` seed
   - Query: `select id, name, sort_order from core_contact_type order by id`
   - Result rows:
     - `1 Parent / Guardian`
     - `2 Carer`
     - `3 Spouse/Partner`
     - `4 Family`
     - `5 Friend`
     - `6 Other`
   - Status: Pass

4. Delegated member-access helper and policy usage
   - Query: `pg_proc` for `check_user_pace_member_access_via_member_id`
   - Result: function exists
   - Query: `pg_policies` for `rbac_select_core_member_delegated`
   - Result qualifier includes `check_user_pace_member_access_via_member_id(id)`
   - Status: Pass

5. `base_application` to `core_events` join viability
   - Query: `select b.id, e.event_name from base_application b join core_events e on b.event_id = e.event_id limit 1`
   - Result: joined row returned
   - Status: Pass

6. Avatar source verification
   - Query: `information_schema.columns` for `core_person.photo_url`, `core_person.photo_id`
   - Result: no rows
   - Query: `information_schema.columns` for person/photo linkage fields in `core_file_references` (`person_id`, `core_person_id`, `photo_id`)
   - Result: no rows
   - Status: Pass (`Avatar` remains initials-only)

## Portal helper readiness (CR24 gate)

- `@solvera/pace-core` export map contains `./member-profile-launch` in `node_modules/@solvera/pace-core/package.json`
- `node_modules/@solvera/pace-core/dist/member-profile-launch/index.d.ts` exports:
  - `buildMemberProfileLaunchUrl`
  - `launchMemberProfile`
  - `MemberProfileLaunchMode`
- Status: Pass

## AC evidence

- AC-01 through AC-25 status recorded in `docs/test-packs/TM03-qa-pack.md`
- Overall result: Pass
