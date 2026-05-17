# TM03 — Verification evidence log

Companion to [`TM03-member-360-requirements.md`](../requirements/TM03-member-360-requirements.md) and [`team-build-queue.md`](team-build-queue.md). Record MCP and in-app verification **against the Supabase project in the consuming app’s active `.env`**, not only historical dev project ids named in §12.

## Slice summary

| Item | Notes |
| --- | --- |
| Implementation | [`src/pages/members/Member360Page.tsx`](../../src/pages/members/Member360Page.tsx), [`src/hooks/useMember360Data.ts`](../../src/hooks/useMember360Data.ts); Portal CTA uses `launchMemberProfile` from `@solvera/pace-core/member-profile-launch`. |
| AC checkboxes | All ACs tracked in TM03 §11 with `[ ]` / `[x]`. |
| Tests | Aggregate `34` Vitest cases across Member 360 + hook + libs (see Evidence in build queue). |

## §15 — Done prerequisite (applications embed)

| Step | Expected | Result | Date / initials |
| --- | --- | --- | --- |
| PostgREST embed | `.from('base_application').select('id, core_events!inner(event_name)').limit(1)` resolves (no FK type mismatch) | **Catalogue pass** FK `base_application.event_id → core_events.event_id` verified on MCP target (`yihzsfcceciimdoiibif`). Client/embed smoke via signed app still Pending. | 2026-05-17 |
| If embed fails | Author RPC `app_member_applications(...)` per TM03 §15 and swap §7 contract | — |  |

## §15 — Avatar / schema note

| Step | Expected | Result | Date |
| --- | --- | --- | --- |
| Person photo columns | No `core_person.photo_url` / `photo_id` linkage required for v1 | Pending |  |

## §15 — Portal CR24 gate (consumer app)

| Step | Expected | Result | Date |
| --- | --- | --- | --- |
| Package exports | `./member-profile-launch` resolves; `launchMemberProfile` callable | Wired in repo |  |
| Manual new-tab URLs | `{VITE_PORTAL_ORIGIN}/profile/edit/{memberId}` or `/profile/view/{memberId}`; no query params | Pending browser |  |

## MCP preflight bundle (copy/paste SQL)

Shared queries live in [`mcp-verification-preflight-queries.md`](./mcp-verification-preflight-queries.md). Run via Supabase MCP after [`npm run mcp:verification`](../../package.json) so `.cursor/mcp.json` targets **`yihzsfcceciimdoiibif`** (not necessarily `SUPABASE_PROJECT_REF`).

## §12 — MCP checklist (TM03-specific)

Execute via Supabase MCP or SQL editor on **active dev project**. Catalogue checks below executed on verified-contract **`yihzsfcceciimdoiibif`** (`npm run mcp:verification`; tool `execute_sql`; 2026-05-17). **JWT / session** proofs remain manual.

| MCP test | Evidence to capture | Result | Date |
| --- | --- | --- | --- |
| RLS `core_member` UPDATE | Privileged UPDATE succeeds for org admin; denies without role | Pending — requires authenticated org-admin session |  |
| `core_contact.permission_type` | CHECK allows `full`, `notify`, `none` only; `text NOT NULL` | **Pass** — `core_contact_permission_type_check` restricts to `full` / `notify` / `none` | 2026-05-17 |
| `pace_membership_status` | Six enum labels per requirement | **Pass** — `Provisional`, `Active`, `Suspended`, `Lapsed`, `Resigned`, `Revoked` | 2026-05-17 |
| `core_contact_type` seed | Six type rows present | **Pass** — `COUNT(*) = 6` | 2026-05-17 |
| `check_user_pace_member_access_via_member_id` | Function exists; `rbac_select_core_member_delegated` references it | **Pass** — function present (SECURITY DEFINER); policy `rbac_select_core_member_delegated` **USING** calls `check_user_pace_member_access_via_member_id(id)` | 2026-05-17 |
| `base_application` ↔ `core_events` | FK / embed viability (duplicate of §15 table above) | **Pass** — FK `event_id → core_events.event_id` (`information_schema` query) | 2026-05-17 |

## TM02 §12 overlap (cross-org / enums)

Reuse or re-run alongside TM02 Evidence; confirms AC-24 (TM02) / AC-25 (TM03) when done on active project.

| Check | Result | Date |
| --- | --- | --- |
| RLS isolation on `core_member` without manual org filter | Pending — requires JWT session proof |  |
| `team_member_request` enums + RPCs per TM02 §15 | **Pass on MCP target** per [`team-build-queue.md`](team-build-queue.md) TEAM-02 Evidence (aligned enums + trio RPCs) | 2026-05-17 |

## Manual QA — TM01 / TM02 / TM03

QA pack files (`docs/test-packs/TM01-qa-pack.md`, `TM02-qa-pack.md`, `TM03-qa-pack.md`) are authoritative scenario lists; **§11 checkboxes** in each requirement mirror completion. Unchecked `[ ]` AC rows correspond to scenarios that still require a human pass (idle timers, passwords, toast demo, directory DataTable paging, **MCP JWT/RLS** rows above, Portal tab URLs, §15 PostgREST embed smoke).

| Requirement | Pending AC themes (manual / browser) |
| --- | --- |
| TM01 | AC-08–10 inactivity; AC-15–16 password; AC-18 toast mounting |
| TM02 | Listing UX, paging, errors, picker entry chrome, AC-24 RLS demo |
| TM03 | Identity save/cancel/clean, contacts, cards, apps badges, loaders, navigation, AC-12 AccessDenied |

**Execution:** complete the rows above during a signed-in browser session on a seeded org; optionally record Pass/Fail in a spreadsheet or CI attachment (do not mutate QA pack tables unless programme policy requires it).

## TM02 §15 — Communications hand-off — implementation status

| Gate | Detail |
| --- | --- |
| Picker payload | TEAM-02 writes `sessionStorage['pace:team:comms:manual-pick']` with `{ organisationId, memberIds }`. |
| Consumer | TEAM-13 [`CommunicationsPage`](../../src/pages/communications/CommunicationsPage.tsx) reads-and-clears the key when the keyed inner pane mounts (`key={organisationId}`); route wired from [`../../src/App.tsx`](../../src/App.tsx). |
| **Residual** | Browser E2E (picker → recipients → PUMP send) remains **manual QA** per TM13 / TM02 packs — tracked outside queue `blocker_reason` ([`team-build-queue.md`](team-build-queue.md) Done promotion note). |


## MCP session log (active project)

| Attempt | Tool | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-17 | `list_tables` (Cursor MCP → Supabase project) | **Failed**: connection timeout | Superseded by successful `execute_sql` catalogue pass same day once networking OK. |
| 2026-05-17 | `mcp:verification` | MCP host param `project_ref=yihzsfcceciimdoiibif` (verified-contract baseline) | Re-run after every `npm run env:dev`; see Preflight |
| 2026-05-17 | Supabase MCP `execute_sql` (verified-contract **`yihzsfcceciimdoiibif`**) | **Pass** catalogue checks | TM03 §12 rows populated; FK/embed catalogue; overlaps TEAM-05/06/07/08/09/10/11/12/13 batch per [`team-build-queue.md`](team-build-queue.md). One statement per `execute_sql` call when capturing multiple result sets. |
