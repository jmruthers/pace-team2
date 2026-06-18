# TEAM requirements build queue (pass 2)

Pass 2 **uplifts implementation** in `src/` (and tests) against pass-1-updated requirement slices, prototype layout, and pace-core standards. **`npm run validate` must exit 0** before marking a slice **Built**.

**Pass 1 gate:** [requirements-audit-queue.md](./requirements-audit-queue.md) — row `audit_status` must be `Done` or `N/A` before starting that slice.

**Orchestration rule:** `.cursor/rules/team-requirements-build-pass2.mdc`

## How to kick off

Open the **pace-team2** workspace (with **pace-prototype** and **pace-core2** siblings available for `@` references).

In **Agent** mode (Plan-only is insufficient — validate must run), send:

```text
Continue TEAM requirements pass 2 from docs/delivery/requirements-build-queue.md
```

Optional modifiers: `— one slice only` · `— plan only` · `— from TM05` · `— dry run`

## Status values

| Column | Values | Meaning |
|--------|--------|---------|
| `build_status` | `Pending` · `In progress` · `Built` · `Skipped` · `Blocked` | Orchestration state |
| `validate_status` | `—` · `Pass` · `Fail` | Last validate result for this slice |
| `uplift_summary` | free text | e.g. `No changes`, `ApprovalsPage grid alignment` |

## N/A slices (no prototype screen)

**TM12** — photo moderation; no prototype layout — implement from requirement prose; mark `Built` or `Skipped` with note per gap audit; run validate before advancing.

## Queue

Process in **`audit_order`** sequence.

| audit_order | slice_id | requirement_doc | prototype_refs | impl_hints | build_status | validate_status | uplift_summary |
|---:|---|---|---|---|---|---|---|
| 1 | TM01 | [TM01-app-shell-auth-layout-requirements.md](../requirements/TM01-app-shell-auth-layout-requirements.md) | `pace-prototype/apps/pace-team/app.jsx` (routing, `NAV_ITEMS`, org landing/overview, shell) | `src/App.tsx`, `AuthenticatedShell.tsx` | Built | Pass | Org landing `/`, overview `/orgs/:orgId`, slim in-org nav, OrgContextBar, user menu extras, NotFound → org picker; org-forms pace-core drift fixed for validate |
| 2 | TM02 | [TM02-member-directory-requirements.md](../requirements/TM02-member-directory-requirements.md) | `pages/MemberPages.jsx` (`MembersPage`, `MemberInvitePage`) | `src/pages/members/` | Built | Pass | PageHeader + invite route, pending tab label/counts, normal-mode bulk bar + selection, comms picker unchanged |
| 3 | TM05 | [TM05-member-requests-review-requirements.md](../requirements/TM05-member-requests-review-requirements.md) | `pages/ApprovalsEventsPages.jsx` (`ApprovalsPage`) | `src/pages/approvals/` | Built | Pass | PageHeader + Approval rules stub; Open/Resolved tabs with counts; custom ApprovalQueueList; in-page selection (URL stays `/approvals`); legacy `/approvals/:requestId` redirect with state |
| 4 | TM06 | [TM06-membership-types-requirements.md](../requirements/TM06-membership-types-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsMembershipTypes`) | membership types settings | Built | Pass | PageHeader + header New membership type action |
| 5 | TM07 | [TM07-sub-organisations-requirements.md](../requirements/TM07-sub-organisations-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsSubOrgs`) | sub-org settings | Built | Pass | PageHeader + header New sub-organisation action (removed CardHeader duplicate) |
| 6 | TM08 | [TM08-organisation-settings-financial-requirements.md](../requirements/TM08-organisation-settings-financial-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`SettingsOrganisation`, `SettingsPeople`) | org settings | Built | Pass | PageHeader; two-column grid with OrganisationSettingsOverviewCard + Financial card; org-change toast hook extracted |
| 7 | TM09 | [TM09-org-form-authoring-requirements.md](../requirements/TM09-org-form-authoring-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`FormsPage`, `FormAuthoringPage`) | `src/pages/forms/` | Built | Pass | Forms list PageHeader + New form in header; FormAuthoringPage PageHeader with Preview/Duplicate stubs |
| 8 | TM11 | [TM11-report-builder-requirements.md](../requirements/TM11-report-builder-requirements.md) | `pages/FormsReportsSettingsPages.jsx` (`ReportsPage`) | `src/pages/reports/` | Built | Pass | PageHeader with subtitle on ReportsPage |
| 9 | TM03 | [TM03-member-360-requirements.md](../requirements/TM03-member-360-requirements.md) | `pages/MemberPages.jsx` (`Member360Page`) | member 360 page | Built | Pass | PageHeader + avatar hero band; Member details / Records / Standing roles tab shell |
| 10 | TM04 | [TM04-standing-roles-requirements.md](../requirements/TM04-standing-roles-requirements.md) | `pages/MemberPages.jsx` (`MemberRolesPage`) | member roles | Built | Pass | Org-wide `/member-roles` placeholder retained (per-member roles at `/members/:id/roles` unchanged) |
| 11 | TM10 | [TM10-events-attendees-requirements.md](../requirements/TM10-events-attendees-requirements.md) | `pages/ApprovalsEventsPages.jsx` (`EventsPage`, `NewEventPage`); `pages/EventDetailCommsPages.jsx` (`EventDetailPage`) | events pages | Built | Pass | Events list PageHeader, Upcoming/Past tabs, combined Event column, Create event → `/events/new` stub; Event detail PageHeader, KPI cards, attendee + placeholder tabs |
| 12 | TM13 | [TM13-communications-pump-requirements.md](../requirements/TM13-communications-pump-requirements.md) | `pages/EventDetailCommsPages.jsx` (`CommunicationsPage`); `app.jsx` (`CommunicationsLogPage` at `/communications/log`) | `src/pages/communications/` | Built | Pass | PageHeader + Send log route stub; compose-first layout (CommComposer before Recipients) |
| 13 | TM12 | [TM12-photo-moderation-requirements.md](../requirements/TM12-photo-moderation-requirements.md) | No prototype screen — audit requirement prose only; note gap in **Implementation delta (pass 2)** | photo moderation | Built | Pass | PageHeader on PhotoModerationPage (no prototype layout; requirement prose only) |

## Prototype kit index

Surfaces and routes: `pace-prototype/apps/pace-team/README.md` and `pace-prototype/apps/pace-team/app.jsx`.

Shared shell: `pace-prototype/apps/_pace-core/`.

## Legacy build queue (Evidence)

On **Built**, optionally append a one-line uplift note to [team-build-queue.md](./team-build-queue.md) when the slice maps 1:1.

## Validate

From repo root: `npm run validate`. Do not mark **Built** until validate exits 0 after slice uplift.
