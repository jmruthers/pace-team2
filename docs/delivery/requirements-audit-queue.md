# TEAM requirements audit queue (pass 1)

**Pass 1 complete (2026-06-18):** All 13 slices audited — 12 **Done**, 1 **N/A** (TM12 photo moderation — no prototype screen). Requirement docs updated for prototype layout; pass 2 implementation deferred per [team-build-queue.md](./team-build-queue.md).

Pass 1 updates **requirement slices only** so layout matches the functional prototype. Do **not** change `src/` in this pass. Pass 2 (implementation) is deferred.

**Orchestration rule:** `.cursor/rules/team-requirements-audit-pass1.mdc`

## How to kick off

Open the **pace-team2** workspace (with **pace-prototype** and **pace-core2** siblings available for `@` references).

In **Plan** or **Agent** mode, send:

```text
Continue TEAM requirements pass 1 from docs/delivery/requirements-audit-queue.md
```

Optional modifiers: `— one slice only` · `— dry run` · `— from TM05`

## Status values

| Value | Meaning |
|-------|---------|
| `Pending` | Not yet audited |
| `In progress` | Agent is working this slice |
| `Done` | Requirement slice updated for prototype layout |
| `N/A` | No prototype screen — document layout from requirements only |

## Queue

Process in **`audit_order`** sequence.

| audit_order | slice_id | requirement_doc | prototype_refs | impl_hints | audit_status |
|---:|---|---|---|---|---|
| 1 | TM01 | [TM01-app-shell-auth-layout-requirements.md](../requirements/TM01-app-shell-auth-layout-requirements.md) | `pace-prototype/apps/pace-team/app.jsx` (routing, `NAV_ITEMS`, org landing/overview, shell) | `src/App.tsx`, `AuthenticatedShell.tsx` | Done |
| 2 | TM02 | [TM02-member-directory-requirements.md](../requirements/TM02-member-directory-requirements.md) | `pages/MemberPages.jsx` (`MembersPage`, `MemberInvitePage`) | `src/pages/members/` | Done |
| 3 | TM05 | [TM05-member-requests-review-requirements.md](../requirements/TM05-member-requests-review-requirements.md) | `pages/ApprovalsEventsPages.jsx` (`ApprovalsPage`) | `src/pages/approvals/` | Done |
| 4 | TM06 | [TM06-membership-types-requirements.md](../requirements/TM06-membership-types-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsMembershipTypes`) | membership types settings | Done |
| 5 | TM07 | [TM07-sub-organisations-requirements.md](../requirements/TM07-sub-organisations-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsSubOrgs`) | sub-org settings | Done |
| 6 | TM08 | [TM08-organisation-settings-financial-requirements.md](../requirements/TM08-organisation-settings-financial-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsOrganisation`, `SettingsPeople`) | org settings | Done |
| 7 | TM09 | [TM09-org-form-authoring-requirements.md](../requirements/TM09-org-form-authoring-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`FormsPage`, `FormAuthoringPage`) | `src/pages/forms/` | Done |
| 8 | TM11 | [TM11-report-builder-requirements.md](../requirements/TM11-report-builder-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`ReportsPage`) | `src/pages/reports/` | Done |
| 9 | TM03 | [TM03-member-360-requirements.md](../requirements/TM03-member-360-requirements.md) | `pages/MemberPages.jsx` (`Member360Page`) | member 360 page | Done |
| 10 | TM04 | [TM04-standing-roles-requirements.md](../requirements/TM04-standing-roles-requirements.md) | `pages/MemberPages.jsx` (`MemberRolesPage`) | member roles | Done |
| 11 | TM10 | [TM10-events-attendees-requirements.md](../requirements/TM10-events-attendees-requirements.md) | `pages/ApprovalsEventsPages.jsx` (`EventsPage`, `NewEventPage`); `pages/EventDetailCommsPages.jsx` (`EventDetailPage`) | events pages | Done |
| 12 | TM13 | [TM13-communications-pump-requirements.md](../requirements/TM13-communications-pump-requirements.md) | `pages/EventDetailCommsPages.jsx` (`CommunicationsPage`); `app.jsx` (`CommunicationsLogPage` at `/communications/log`) | `src/pages/communications/` | Done |
| 13 | TM12 | [TM12-photo-moderation-requirements.md](../requirements/TM12-photo-moderation-requirements.md) | No prototype screen — audit requirement prose only; note gap in **Implementation delta (pass 2)** | photo moderation | N/A |

## Prototype kit index

Surfaces and routes: `pace-prototype/apps/pace-team/README.md` and `pace-prototype/apps/pace-team/app.jsx`.

Shared shell: `pace-prototype/apps/_pace-core/` (team kit loads `_shared` per README).

## Pass 2

Implementation uplift against updated requirements: [requirements-build-queue.md](./requirements-build-queue.md). Orchestration rule: `.cursor/rules/team-requirements-build-pass2.mdc`.

Kickoff (Agent mode):

```text
Continue TEAM requirements pass 2 from docs/delivery/requirements-build-queue.md
```

Historical Evidence remains in [team-build-queue.md](./team-build-queue.md). Do not flip pass 2 rows during pass 1.
