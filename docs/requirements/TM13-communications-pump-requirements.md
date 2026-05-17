# TEAM-13 — Communications via PUMP

## §1 Slice metadata

```
Slice ID:        TEAM-13
Name:            Communications — org member send / schedule via PUMP (CR23 consumer)
Status:          Draft
Depends on:      TEAM-01 (app shell, ToastProvider, AuthenticatedShell, navigation), TEAM-02 (member directory + canonical comms-picker hand-off contract)
Backend impact:  Read contract only (consumer of CR23 PUMP Edge functions and pace-core comms package; no schema changes authored by this slice). Implementation gated on platform PUMP Edge deployment, gateway config seeding, and template fixture seeding — see §15.
Frontend impact: UI
Routes owned:    /communications
QA pack:         docs/test-packs/TM13-qa-pack.md
```

---

## §2 Overview

TEAM-13 delivers the org-admin communications composer at `/communications`. The page mounts the `CommComposer` from `@solvera/pace-core/comms`, lets an operator pick between a filtered organisation broadcast and a manually-curated member list, choose a channel (email or SMS), select an active org template, edit subject and body, preview merge tokens, and either send immediately or schedule for later via PUMP Edge functions. Recipient resolution, sender identity, suppression, and delivery are all PUMP-side concerns — TEAM submits a `RecipientPoolDescriptor`, never a resolved member list. The route is wrapped by `<PagePermissionGuard pageName="CommsLog" operation="read">` against the canonical PUMP-registered page resource. Manual recipient selection hands off to the directory picker at `/members` per the contract owned by TEAM-02.

---

## §3 What this slice delivers

### Purpose

Org-admin staff need a single surface to send a one-off email or SMS to organisation members, either by filtering the directory inline or by curating a specific list of members through the directory picker. TEAM-13 produces that surface. The slice is intentionally narrow: compose, preview, send or schedule, see the outcome, compose another. Template authoring, scheduled-message management, suppression administration, gateway configuration, and analytics all live in PUMP and are out of scope.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Communications composer | `/communications` | Single page; renders the `CommComposer` plus a TEAM-owned recipient-mode card above it |

### Boundaries

TEAM-13 does **not** own:
- The directory picker at `/members` — that is TEAM-02. This slice consumes the picker hand-off payload via `sessionStorage` and never modifies how the picker works.
- The PUMP Edge functions `pump-resolve-pool`, `pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-templates`, `pump-load-merge-fields`, `pump-cancel`, `pump-webhook` — those are deployed by the PUMP repository.
- The `CommComposer`, `RecipientPoolPreview`, `MergeFieldToolbar`, `MessagePreview` components themselves — those are owned by `@solvera/pace-core/comms`. This slice consumes the composer; it does not patch it.
- Template authoring, the template library, organisation comms settings, delivery analytics, suppression management, and the scheduled-message inbox — those are PUMP application surfaces.
- Cancellation or rescheduling of a scheduled message — PUMP owns the scheduled-message lifecycle UX.
- Persisted drafts — the composer is ephemeral in TEAM v1; leaving the page discards the working state.
- Gateway configuration and webhook handling — PUMP Edge owns the writes against `pump_message`, `pump_message_recipient`, `pump_delivery_event`, and `pump_suppression`.
- Direct `INSERT` against `pump_message` from TEAM — every send and schedule goes through `pump-send` / `pump-schedule` Edge functions via the shared adapter.
- Reviving the deprecated `team_unit` table or any unit-scoped recipient filter in v1.
- Inventing recipient-pool filters that PUMP Edge does not yet support; the v1 inline filter set is `member_type_ids` plus `include_inactive` only.

### Architectural posture

**Adapter-only mutations.** Every send, schedule, send-test, template load, merge-field load, and pool resolve goes through the `CommSendAdapter` returned by `useCommSendAdapter({ organisationId, sourceApp: 'team' })`. The adapter calls the PUMP Edge slugs internally; this slice does not invoke `functions.invoke` directly and does not write to any `pump_*` table from the browser. `source_app` is always the literal string `'team'`.

**Pool descriptor, not resolved list.** When the operator initiates a send, the slice passes a `RecipientPoolDescriptor` (either `OrgMembersPool` or `ManualPool`) to the adapter. PUMP Edge resolves the descriptor server-side. Resolved member lists never leave the browser as a send payload.

**Page guard.** `<PagePermissionGuard pageName="CommsLog" operation="read">` wraps the page content. The `pageName` value is the canonical page resource registered under the PUMP `rbac_apps` row — the same page key PUMP Edge uses for `isPermitted` checks. No `scope` prop is passed; no `appName` override prop is passed. Scope resolves from `OrganisationServiceProvider` context.

**RBAC context for the composer.** The slice derives `CommRbacContext` from `useCan` calls against the canonical permission strings: `canCompose = useCan('create:page.CommsLog', { organisationId })`, `canSend = useCan('update:page.CommsLog', { organisationId })`, `canSchedule = useCan('update:page.CommsLog', { organisationId })`, `scopeType = 'organisation'`, `scopeId = selectedOrganisation.id`. The composer renders its own read-only state when `canSend === false`.

**No event scope.** TEAM is not event-scoped. The slice never sets `sourceContextType` or `sourceContextId` on the adapter or in the request; every send from TEAM v1 carries `source_context_type === undefined`, `source_context_id === undefined`. PUMP Edge enforces authorisation by `organisation_id` claim alone for TEAM-originated sends.

**Override on `blockSendOnUnresolvedTokens`.** The composer's default is `false`. TEAM mounts the composer with `blockSendOnUnresolvedTokens={true}` to gate the Send and Schedule actions while any merge token in the draft cannot be resolved against the loaded `mergeFields` list.

**Picker hand-off contract — consumer side.** Picker initiation is a `navigate('/members', { state: { intent: 'commsManualPick' } })` call. The picker (TEAM-02) writes its result to `sessionStorage['pace:team:comms:manual-pick']` with payload shape `{ organisationId: string, memberIds: string[], updatedAt: number }`. On `/communications` mount, this slice reads the key once: if a payload exists and `payload.organisationId === selectedOrganisation.id`, it switches the recipient mode to "Specific members", builds a `ManualPool` from `payload.memberIds`, and removes the key from `sessionStorage`. If a payload exists but `organisationId` mismatches, the slice still removes the key and starts in the default mode. Read-once-and-clear is the contract; the slice never inspects the payload across re-renders.

**Sender identity pre-fill.** On mount with a resolved organisation, the slice calls the `pump_get_effective_sender_identity` RPC (via `useSecureSupabase().rpc(...)`) to obtain the org's effective `EffectivePumpSenderIdentity`. The slice then seeds the composer's `draft.sender_name`, `draft.sender_email`, `draft.sender_phone`, and `draft.reply_to` (when present and non-null) from the RPC's return. Operators may edit these fields, but the §16 do-not bars typing addresses outside the org's verified senders.

**Toast context.** The slice imports `toast` from `@solvera/pace-core/components` for fire-and-forget notifications (stale-org clearing, send success, send failure, send-test success, send-test failure). `<ToastProvider>` is mounted by TEAM-01 inside `AuthenticatedShell`; this slice does not mount it.

**Page metadata.** `usePaceMain({ printTitle: 'Communications' })` is called on page mount.

### Page-level guards and evaluation ordering

The route `/communications` sits inside `AuthenticatedShell` (TEAM-01) and is wrapped by `<PagePermissionGuard pageName="CommsLog" operation="read">`. Evaluation order when context is absent:

1. **Authentication check** — `ProtectedRoute` (TEAM-01) fires first. An unauthenticated user is redirected to `/login`; the guard never evaluates.
2. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, `AuthenticatedShell` renders a loading state; no feature content or guard is shown.
3. **No-org check** — If `selectedOrganisation === null` after org loading completes, `AuthenticatedShell` renders the "No organisation assigned. Please contact your administrator." empty state from TEAM-01. `PagePermissionGuard` is not reached; no RBAC query fires.
4. **Page permission guard** — Once org context is resolved, `PagePermissionGuard` evaluates with `pageName: 'CommsLog'`, `operation: 'read'`. Scope is resolved internally; no `scope` prop is passed. While the RBAC check is in flight (`isLoading === true`) and no `loading` prop is supplied, the guard returns `null` (a brief blank inside the PaceMain content area is acceptable). On `can === false`, `<AccessDenied />` is rendered. On `can === true`, the page body renders.

If `selectedOrganisation` somehow resolves to `null` after step 3 (a race during org switch), the RBAC engine evaluates with `organisationId: undefined`, the check returns pending, and the guard returns `null`. The no-org check at step 3 prevents this path under normal conditions.

---

## §4 Functional specification

### Page entry / surface entry

- **F-01** The route `/communications` renders for an authenticated user whose currently selected organisation has resolved and who has `read:page.CommsLog` permission.
- **F-02** On entry, the page sets `printTitle` to "Communications" via `usePaceMain`.
- **F-03** The page heading is "Communications" (sentence case). No breadcrumb is rendered. No description sub-text is rendered.
- **F-04** On mount with a resolved `selectedOrganisation`, the page calls `pump_get_effective_sender_identity` and seeds the composer's draft with the returned `senderName`, `fromAddress`, `senderPhone`, and `replyToAddress`. Null fields seed empty strings.
- **F-05** On mount with a resolved `selectedOrganisation`, the page reads `sessionStorage['pace:team:comms:manual-pick']` exactly once. If a payload exists and `payload.organisationId === selectedOrganisation.id`, the recipient mode is set to "Specific members" and the manual member list is hydrated from `payload.memberIds`. The key is then removed from `sessionStorage`. If a payload exists with a different `organisationId`, the key is removed and the page starts in default mode. If no payload exists, no action is taken.
- **F-06** The page initial recipient mode when no manual-pick payload applies is "All organisation members" (org broadcast).
- **F-07** The composer initial channel is `'email'`. The composer initial draft body fields are empty unless the manual-pick hydration or the sender-identity pre-fill has populated them.

### Loading states

- **F-08** While the page-level RBAC check is in flight, a brief blank inside the `PaceMain` content area is acceptable (no `loading` prop is passed to `PagePermissionGuard`).
- **F-09** While the composer's internal pool resolution (`pump-resolve-pool`) is in flight, the recipient pool preview card renders an `<Alert role="status">` reading "Resolving recipient pool." The composer Card itself remains visible and editable.
- **F-10** While the composer's internal templates fetch (`pump-load-templates`) is in flight, the templates section is omitted. When the fetch returns zero templates, the templates section is also omitted (the composer renders the section only when at least one template is available for the active channel).
- **F-11** While the composer's internal merge-fields fetch (`pump-load-merge-fields`) is in flight, the merge-fields toolbar renders zero buttons but does not block editing.
- **F-12** While the `pump_get_effective_sender_identity` RPC is in flight, the sender fields render empty (placeholder text only). Once the RPC returns, the fields populate.

### Empty states

- **F-13** When the org has zero active templates for the current channel, the templates section of the composer is not rendered. The composer remains usable; the operator may compose without selecting a template.
- **F-14** When `pump-resolve-pool` returns `estimated_count: 0` for the current pool, the recipient pool preview card renders the count "0 estimated recipients" and the Send-now and Schedule actions are disabled with the inline copy "No recipients match these filters." rendered above the composer's CardFooter.

### Error states

- **F-15** A user without `read:page.CommsLog` sees `<AccessDenied />` rendered inside the `AuthenticatedShell` chrome with copy "You do not have permission to view this page." (the `AccessDenied` default).
- **F-16** When `pump-resolve-pool` fails, the recipient pool preview card renders `<Alert variant="destructive">` with title "Recipient pool unavailable" and description set to the error message returned from the adapter. Send-now and Schedule remain disabled while the pool preview is in error. Switching channel or re-applying filters re-runs the resolve.
- **F-17** When `pump-send` fails, a `'destructive'`-variant toast renders with the normalised error message returned from the adapter. The composer draft remains unchanged. No inline alert is added by TEAM-13; the composer's internal banners (read-only, strict-template, unresolved-tokens) continue to render based on their own conditions.
- **F-18** When `pump-schedule` fails, behaviour matches F-17 — destructive toast, draft unchanged.
- **F-19** When `pump-send-test` fails, a `'destructive'`-variant toast renders with the normalised error message.
- **F-20** When `pump_get_effective_sender_identity` fails, the sender fields render empty and a `'destructive'`-variant toast renders with the message "Could not resolve sender identity. Set the sender details before sending." The composer remains usable; the operator may type sender details directly (subject to the §16 do-not).
- **F-21** When the RBAC permission queries fail, the composer renders the read-only state (treating `canSend = false`, `canCompose = false`); a `'destructive'`-variant toast renders with the message "Could not load permissions. Refresh to retry."

### Primary content

- **F-22** Above the composer Card, a TEAM-owned recipient-mode Card renders with the heading "Recipients" and a radio group with two options:
  - Option 1: label "All organisation members"; helper copy "Send to filtered organisation membership"; value `'org_members'`.
  - Option 2: label "Specific members"; helper copy "Pick members from the directory"; value `'manual'`.
- **F-23** When the recipient mode is "All organisation members", the recipient-mode Card renders the org-broadcast filters below the radio group:
  - **Membership types** — multi-select chips populated from `core_membership_type` rows for the current org with `is_active = true`. Each chip shows the type name; click toggles inclusion. The selected type ids drive `OrgMembersPool.filters.member_type_ids` (cast to strings — see BR-12).
  - **Include inactive members** — a single checkbox labelled "Include inactive members". Default unchecked. When checked, sets `OrgMembersPool.filters.include_inactive = true`.
- **F-24** When the recipient mode is "Specific members" and no manual list is yet selected, the recipient-mode Card renders a primary `Button` labelled "Choose members…". Click navigates to `/members` with `location.state.intent = 'commsManualPick'`.
- **F-25** When the recipient mode is "Specific members" and a manual list has been hydrated (either from the picker hand-off or from a prior selection in this session), the recipient-mode Card renders the count "{N} members selected" alongside a secondary `Button` labelled "Choose again". Click navigates back to the picker with the same `location.state` payload. (The picker hydrates the prior selection via `sessionStorage` per TEAM-02 BR-07 — but only if the slice writes a fresh payload before navigating, which it does on this path.)
- **F-26** Below the recipient-mode Card, the `CommComposer` from `@solvera/pace-core/comms` renders. Its embedded sub-components — channel selector, templates list, sender fields, channel-conditional fields (subject + body_html for email; sender_phone for SMS), preview/edit toggle, body fields, merge-field toolbar, send-test button, schedule control, send-now button, optional cancel button, and the recipient-pool preview Card — are described in §5.
- **F-27** The composer is mounted with `recipientPool` set to the slice's current pool descriptor:
  - When recipient mode is "All organisation members": `{ type: 'org_members', organisation_id: selectedOrganisation.id, filters: { member_type_ids: <string[]>, include_inactive: <boolean> } }`. `member_type_ids` is omitted when no membership types are selected; `include_inactive` is omitted when unchecked (default).
  - When recipient mode is "Specific members" and a list is selected: `{ type: 'manual', member_ids: <string[]> }`.
  - When recipient mode is "Specific members" and no list is selected: `{ type: 'manual', member_ids: [] }`.
- **F-28** The composer is mounted with `rbac` set to the `CommRbacContext` derived per §3 (canCompose, canSend, canSchedule, scopeType `'organisation'`, scopeId `selectedOrganisation.id`).
- **F-29** The composer is mounted with `organisationId = selectedOrganisation.id`, `sourceApp = 'team'`, `adapter = useCommSendAdapter({ organisationId: selectedOrganisation.id, sourceApp: 'team' })`, `blockSendOnUnresolvedTokens = true`, and `onCancel = () => navigate('/')`.
- **F-30** The composer's `templates`, `mergeFields`, and `recipientPreview` props are not supplied by this slice. The composer drives those queries internally via `useCommTemplates`, `useCommMergeFields`, and `useResolvedPool`.

### Primary actions

- **F-31** **Channel — Email.** Click on the Email button in the composer sets `draft.channel = 'email'`. Composer-internal `draftForChannel` carries email-specific fields (subject, body_html, sender_email, reply_to) through unchanged or initialised to empty; SMS-specific fields are not cleared on this transition (they remain on the draft object but are hidden from the email view). The pool preview re-resolves with `channel: 'email'` and warning resolution updates accordingly (e.g. `no_email` warnings replace `no_phone`).
- **F-32** **Channel — SMS.** Click on the SMS button sets `draft.channel = 'sms'`. Composer-internal `draftForChannel` clears email-specific fields (subject, body_html, sender_email, reply_to) from the draft. The pool preview re-resolves with `channel: 'sms'`.
- **F-33** **Template selection.** Click on a template button in the composer's templates section calls the composer's internal `applyTemplate` which sets `draft.template_id`, `draft.channel`, `draft.subject`, `draft.body_html`, and `draft.body_text` from the template. The selected template button shows a primary visual treatment (default variant); other template buttons show outline. Templates whose `require_merge_field_validation === true` show a "(Strict)" suffix in their button label and trigger the strict-mode banner above the composer Card while selected.
- **F-34** **Recipient mode — All organisation members.** Selecting the radio for "All organisation members" sets the slice's recipient mode to `'org_members'` and rebuilds the composer's `recipientPool` per F-27. The composer's internal `useResolvedPool` re-runs on the new descriptor.
- **F-35** **Recipient mode — Specific members.** Selecting the radio for "Specific members" sets the slice's recipient mode to `'manual'`. If a hydrated `member_ids` list is available, the composer's `recipientPool` is `{ type: 'manual', member_ids: [...] }`. If not, the composer's `recipientPool` is `{ type: 'manual', member_ids: [] }` and the composer's pool preview renders with `estimated_count: 0` once `pump-resolve-pool` returns.
- **F-36** **Choose members… / Choose again.** Click writes `{ organisationId: selectedOrganisation.id, memberIds: <currentMemberIds>, updatedAt: Date.now() }` to `sessionStorage['pace:team:comms:manual-pick']` and calls `navigate('/members', { state: { intent: 'commsManualPick' } })`. The picker (TEAM-02) reads-and-hydrates from this key on entry, then writes its own payload back on Done; this slice reads-and-clears the key on next mount.
- **F-37** **Membership-type chip.** Click on a chip toggles its inclusion in `OrgMembersPool.filters.member_type_ids`. The composer's internal `useResolvedPool` re-runs on the new descriptor.
- **F-38** **Include inactive checkbox.** Toggle sets `OrgMembersPool.filters.include_inactive` to the new value. Composer re-resolves the pool.
- **F-39** **Sender name input.** Editable text input. Updates `draft.sender_name`. Composer-internal `validateCommDraft` requires non-empty `sender_name` before send.
- **F-40** **Sender email input (email channel).** Editable text input. Updates `draft.sender_email`. Required for email send per `validateCommDraft`.
- **F-41** **Sender phone input (SMS channel).** Editable text input. Updates `draft.sender_phone`. Required for SMS send per `validateCommDraft`.
- **F-42** **Subject input (email channel).** Editable text input. Updates `draft.subject`. Selection state captured for merge-token insertion via the toolbar.
- **F-43** **HTML body textarea (email channel, edit mode).** Editable textarea. Updates `draft.body_html`. Selection state captured for merge-token insertion.
- **F-44** **Plain text body textarea (both channels, edit mode).** Editable textarea. Updates `draft.body_text`. Required for both channels per `validateCommDraft`. Selection state captured for merge-token insertion.
- **F-45** **Preview / Edit toggle.** Click toggles between body-edit mode (textareas + merge-field toolbar) and preview mode (`MessagePreview` component). The button label flips between "Preview" (when in edit mode) and "Edit" (when in preview mode). Switching does not modify the draft.
- **F-46** **Merge-field button.** Click on a button in the merge-field toolbar inserts that field's `token` (e.g. `{{first_name}}`) at the cursor position of the most recently focused field (subject, body_html, or body_text).
- **F-47** **Send test.** Click on "Send test" in the CardFooter calls `adapter.sendTest(...)` with a `CommSendTestRequest` built from the current draft (no `pool`, no `system_key`, no `system_recipient`, no `bypass_suppression`). PUMP Edge dispatches the message to the signed-in user's contact for the chosen channel. On success, a `'success'`-variant toast renders with copy "Test message sent." On failure, a `'destructive'`-variant toast renders with the error message. The draft remains unchanged either way.
- **F-48** **Schedule.** First click on the "Schedule" button in the CardFooter expands the datetime-local input below the button and changes its label to "Confirm schedule". Second click (now "Confirm schedule") calls `adapter.schedule(...)` with a `CommScheduleRequest` containing the assembled `CommSendRequest` plus `scheduled_at` (the datetime-local value as ISO 8601). On success, the composer collapses the schedule input and clears its local datetime state, calls `onScheduleComplete({ messageId, scheduledAtIso })` (where `scheduledAtIso` is the same merged string passed to Edge), and a `'success'`-variant toast renders with copy "Message scheduled for {datetime}." The draft is reset for the current channel and the operator remains on `/communications`. On failure, a `'destructive'`-variant toast renders with the error and the draft remains unchanged.
- **F-49** **Send now.** Click on "Send now" in the CardFooter calls `adapter.send(...)` with a `CommSendRequest` containing the current pool descriptor and draft. The composer-internal gating (validation, strict-template, unresolved-tokens) runs before the adapter call; failures call `onSendError` which the slice routes to a destructive toast (F-17). On success, `onSendComplete(result)` fires and the slice renders a `'success'`-variant toast with copy "Message sent to {result.total_recipients} recipients." When `result.suppression_skipped > 0`, the toast description appends " {result.suppression_skipped} skipped (suppression)." When `result.warnings.length > 0`, the toast description appends " Some recipients had unresolved tokens; check delivery in PUMP." The slice then resets the draft body fields to empty for the current channel (the channel value and the pre-filled sender identity carry through to the next compose) and remains on `/communications`.
- **F-50** **Cancel.** Click on "Cancel" in the CardFooter (only renders because the slice supplies `onCancel`) calls `navigate('/')`. The draft is discarded; nothing is persisted.

### Secondary actions

- **F-51** **Stale-org guard.** When `selectedOrganisation` changes while `/communications` is mounted, the slice resets recipient mode to "All organisation members", clears any hydrated manual `member_ids`, clears the membership-type chip selection, resets `include_inactive` to false, and renders a `'default'`-variant toast with copy "Manual recipients cleared — organisation changed." (5000 ms duration). The composer's `organisationId`, `recipientPool`, and `rbac` props update on the new org; internal pool / templates / merge-fields fetches re-run. The sender-identity pre-fill RPC re-runs against the new org.
- **F-52** **Send-test button — gated.** "Send test" is disabled when `blockForUnresolved` is true (any unresolved tokens with `blockSendOnUnresolvedTokens = true`).
- **F-53** **Schedule button — gated.** "Schedule" is disabled when `rbac.canSchedule === false` or `blockForUnresolved` is true.
- **F-54** **Send-now button — gated.** "Send now" is disabled when `blockForUnresolved` is true. It is also gated by the composer's internal `validateCommDraft` (empty body, missing sender, channel-specific missing fields) — failure surfaces via `onSendError`.
- **F-55** **Zero-recipient guard.** When the recipient pool preview shows `estimated_count === 0`, the slice renders inline copy "No recipients match these filters." above the CardFooter and the Send-now and Schedule buttons are blocked from invoking the adapter (the slice intercepts the click and surfaces a `'destructive'`-variant toast with the same copy). Send-test is unaffected (it does not depend on the pool).

### Permission-conditional rendering

- **F-56** When `read:page.CommsLog` is denied, `<AccessDenied />` renders and no recipient-mode card or composer renders.
- **F-57** When `read:page.CommsLog` is allowed but `create:page.CommsLog` is denied (`canCompose === false`), the composer renders the read-only banner ("You have view-only access to this message.") and disables all editable inputs.
- **F-58** When `read:page.CommsLog` is allowed and `create:page.CommsLog` is allowed but `update:page.CommsLog` is denied (`canSend === false`, `canSchedule === false`), the composer renders the read-only banner; the CardFooter renders a single `<Alert role="status">` "You have view-only access to this message." in place of the Send-test, Schedule, Send-now, and Cancel buttons.

### Navigation

- **F-59** The page is reachable from the TEAM-01 navigation menu via the Communications entry (`/communications`).
- **F-60** "Choose members…" / "Choose again" navigates to `/members` with `location.state.intent = 'commsManualPick'`.
- **F-61** Cancel navigates to `/`.
- **F-62** Successful send / schedule does not navigate; the operator remains on `/communications` (F-49, F-48).

### Edge cases and constraints

- **F-63** **Manual-pick org mismatch.** A manual-pick payload in `sessionStorage` whose `organisationId` differs from the current `selectedOrganisation.id` is ignored — the key is removed and the page starts in default mode (BR-04).
- **F-64** **Manual list with `member_ids.length === 0`.** When the recipient mode is "Specific members" and no members are selected, the pool descriptor is `{ type: 'manual', member_ids: [] }`. The pool preview returns `estimated_count: 0` and Send-now / Schedule are blocked (F-55).
- **F-65** **Membership-type filter with no chips selected.** When recipient mode is "All organisation members" and no chips are selected, `OrgMembersPool.filters.member_type_ids` is omitted from the descriptor. PUMP Edge resolves against the entire (active, by default) organisation membership.
- **F-66** **Include-inactive filter.** When `include_inactive` is unchecked, the property is omitted from the descriptor (PUMP Edge defaults to active-only). When checked, `include_inactive: true` is set explicitly.
- **F-67** **No event scope.** Every `CommSendRequest` and `CommScheduleRequest` from this slice has `source_context_type === undefined` and `source_context_id === undefined` (BR-09).
- **F-68** **Suppression bypass.** This slice never sets `bypass_suppression`. The default `false` applies (BR-10).
- **F-69** **`source_app`.** Every adapter call from this slice carries `source_app === 'team'` (BR-11).
- **F-70** **Membership-type id cast.** `core_membership_type.id` is integer in dev-db; CR23's `OrgMembersPoolFilters.member_type_ids` is `string[]`. The slice casts integer ids to strings before placing them in the descriptor (BR-12).
- **F-71** **Channel-aware pool warnings are informational.** Warnings from `pump-resolve-pool` (e.g. `no_email`, `no_phone`, `suppressed`, `unknown`) render in the recipient pool preview Card but do not block send (BR-08).
- **F-72** **Strict-template gate.** When the active template's `require_merge_field_validation === true` and the draft has unresolved tokens, the composer's internal `handleSend` calls `onSendError('Resolve merge tokens before sending this strict template.')` and the adapter is not invoked (BR-06).
- **F-73** **Block-on-unresolved gate.** With `blockSendOnUnresolvedTokens = true`, the composer's internal `handleSend` calls `onSendError('Resolve all tokens before sending.')` whenever any unresolved token is present in the draft, regardless of template strictness (BR-06).

---

## §5 Visual specification

### Layout

The page renders inside the TEAM-01 `AuthenticatedShell` (`PaceAppLayout` chrome — header, `PaceMain`, footer). Within `PaceMain`, top-to-bottom:

- **Page heading row.** A heading "Communications" (sentence case) at the top of `PaceMain`. No breadcrumb. No description sub-text.
- **Recipient-mode Card.** A `Card` with `CardHeader` ("Recipients" title; no description) and `CardContent` containing the radio group and (when "All organisation members" is selected) the inline filter controls (membership-type chips + include-inactive checkbox). When "Specific members" is selected, the Card content is the picker CTA / populated state instead of the inline filters.
- **Composer Card and pool preview Card.** Below the recipient-mode Card, the `CommComposer` renders. Its return is a `<section aria-label="Communication composer">` containing (top-to-bottom): conditional inline `<Alert>` banners for unresolved-tokens / read-only / strict-template gating, a `Card` titled "Compose communication", and a `RecipientPoolPreview` Card titled "Recipients" sitting as a sibling Card *below* the composer Card. The pool preview Card is part of the composer's render tree, not a separate slice-owned element.

The page does not implement a desktop two-column split; the composer's layout is single-column. The pool preview is below, not beside.

Breakpoints: standard pace-core2 responsive behaviour applies. `PaceMain`'s `max-w-(--app-width)` and `p-4` apply per TEAM-01.

### Components

**Page heading**
- A heading element with text "Communications" rendered via the slice's normal heading element. No breadcrumb, no description.

**Recipient-mode Card** (`@solvera/pace-core/components` — `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Label`, `Input` of type radio, `Button`)
- `Card` with `CardHeader` containing `<CardTitle>Recipients</CardTitle>`. No `CardDescription`.
- `CardContent` lays out the controls in a vertical stack (`grid gap-4`).
- **Radio group** (single-select). Two `Label` rows, each containing a radio input and the visible label text.
  - Row 1: radio input with `value="org_members"`; label text "All organisation members"; helper paragraph "Send to filtered organisation membership" rendered below the label in muted text.
  - Row 2: radio input with `value="manual"`; label text "Specific members"; helper paragraph "Pick members from the directory" rendered below the label in muted text.
  - The radio group's controlled value is the slice's recipient mode state.
- **Org-broadcast filters (rendered when value === `'org_members'`).** A vertical sub-stack:
  - **Membership-type chip row.** A heading "Membership types" (small heading, e.g. `<h4>`). Below the heading, a horizontal flex of `Button` chips — one per row in `core_membership_type` for the current org with `is_active = true`, ordered by `name` ascending. Each chip's label is the type name. Selected chips render with `variant="default"`; unselected chips render with `variant="outline"`. Click toggles inclusion. When zero chips are selected, no helper copy renders.
  - **Include-inactive checkbox.** A `Label` row containing a checkbox `Input` and the text "Include inactive members". Default unchecked.
- **Manual-list controls (rendered when value === `'manual'`).** A vertical sub-stack:
  - When `member_ids.length === 0`: a `Button` with `variant="default"` (primary) and label "Choose members…".
  - When `member_ids.length > 0`: an inline row showing the count text "{N} members selected" followed by a `Button` with `variant="outline"` and label "Choose again".
- **Zero-recipient inline copy (rendered when the composer's pool preview reports `estimated_count === 0`).** A muted paragraph "No recipients match these filters." rendered above the composer's Card.

**`CommComposer`** (`@solvera/pace-core/comms`)
- Purpose: compose, preview, send, schedule, send-test the message.
- The composer renders a `<section aria-label="Communication composer" class="grid gap-4">` containing, in this order:
  - **Conditional banners:**
    - `<Alert role="status">` "Resolve all tokens before sending — Resolve all tokens before sending." when `blockSendOnUnresolvedTokens === true` and unresolved tokens exist.
    - `<Alert>` "Read-only mode — You have view-only access to this message." when `canCompose === false` or `canSend === false`.
    - `<Alert role="status">` "Strict template — All merge tokens must resolve before this template can be sent." when the selected template has `require_merge_field_validation === true`.
  - **Compose Card.** A `Card` with `CardHeader` ("Compose communication" title; "PUMP resolves recipients, sender identity, suppression, and delivery." description). `CardContent` (vertical `grid gap-4`) containing:
    - **Channel `<fieldset>`.** Legend "Channel". A two-column `<menu>` of two `Button` controls — "Email" (primary variant when active, outline otherwise) and "SMS" (same).
    - **Templates `<section>` (rendered only when at least one template exists for the active channel).** Heading "Templates". A `<menu>` (auto-fit grid, `minmax(12rem, 1fr)` columns) of `Button` chips — one per template for the active channel, label is template `name`, with " (Strict)" appended when `require_merge_field_validation === true`. Selected template renders `variant="default"`; others render `variant="outline"`. `size="small"`. Disabled when `canCompose === false`.
    - **Sender name `<Label>`.** Text input bound to `draft.sender_name`. Label text "Sender name". Disabled when `canCompose === false`.
    - **Email-only fields (channel === `'email'`).** Two stacked `<Label>` rows:
      - "Sender email" — text input bound to `draft.sender_email`.
      - "Subject" — text input bound to `draft.subject`. Selection state captured for merge-token insertion.
    - **SMS-only field (channel === `'sms'`).** A single `<Label>` row "Sender phone" with a text input bound to `draft.sender_phone`.
    - **Preview / Edit toggle.** A `Button variant="outline"` with text "Preview" (when in edit mode) or "Edit" (when in preview mode). Disabled when `canCompose === false`.
    - **In edit mode (channel === `'email'`).** A `<Label>` "HTML body" with a `Textarea` bound to `draft.body_html` (selection state captured), then a `<Label>` "Plain text body" with a `Textarea` bound to `draft.body_text`, then the `MergeFieldToolbar`.
    - **In edit mode (channel === `'sms'`).** A `<Label>` "Plain text body" with a `Textarea` bound to `draft.body_text`, then the `MergeFieldToolbar`.
    - **In preview mode.** A `MessagePreview` Card replaces the body fields and toolbar.
  - **CardFooter.** Right-aligned `grid gap-2`. When `canSend === false`, renders a single `<Alert role="status">` "You have view-only access to this message." When `canSend === true`, renders these controls top-to-bottom:
    - `Button variant="outline"` "Send test" — disabled when `blockForUnresolved` is true.
    - When schedule expanded, a `<Label>` "Schedule at" with an `Input type="datetime-local"` bound to the local `scheduledAt` state. Disabled when `canSchedule === false` or `blockForUnresolved` is true.
    - `Button variant="outline"` "Schedule" (or "Confirm schedule" when expanded). Disabled when `canSchedule === false` or `blockForUnresolved` is true.
    - `Button variant="outline"` "Cancel" — only renders because TEAM-13 supplies `onCancel`. Disabled when `canCompose === false`.
    - `Button` (default / primary variant) "Send now" — disabled when `blockForUnresolved` is true.
  - **`RecipientPoolPreview` Card (sibling to the Compose Card).** When the pool resolution is loading: `<Alert role="status">Resolving recipient pool.</Alert>`. When resolution failed: `<Alert variant="destructive">` titled "Recipient pool unavailable" with the error message. When no preview yet: `<Alert role="status">No recipient pool has been resolved yet.</Alert>`. When resolved: a `Card` with `CardHeader` ("Recipients" title; "{estimated_count} estimated recipients" description) and `CardContent` containing a "Sample" sub-section with a list of names (when `sample_names.length > 0`) and a "Warnings" `<Alert>` with a list of warning messages formatted via `poolWarningLabel(warning)` (e.g. "12 recipients have no email address") when `warnings.length > 0`.

**`MergeFieldToolbar`** (`@solvera/pace-core/comms`)
- Renders inside the composer body in edit mode (below the body Textarea).
- When `mergeFields.length === 0`: a single paragraph "No merge fields are available for this pool."
- When `mergeFields.length > 0`: a `<section aria-label="Merge fields">` with a heading "Merge fields" and an auto-fit grid `<menu>` (`minmax(10rem, 1fr)` columns) of `Button variant="outline" size="small"` chips, one per merge field. Each chip's label is the field's `label` property; click inserts the field's `token` at the cursor of the most recently focused field.

**`MessagePreview`** (`@solvera/pace-core/comms`)
- Renders inside the composer body in preview mode.
- A `Card` with `CardHeader` ("Preview" title; "Email preview uses sanitised HTML." or "SMS preview uses plain text." description per channel) and `CardContent` containing:
  - When `draft.subject` is non-empty: a "Subject" sub-section showing the subject text.
  - When channel is email: a sanitised-HTML preview rendered via `dangerouslySetInnerHTML` after `sanitiseCommHtml`. Max-height `16rem` with `overflow-auto`.
  - When channel is SMS: a plain-text preview rendered as a paragraph in a bordered article (same max-height).
  - When unresolved tokens are present: an `<Alert>` titled "Unresolved merge tokens" with a list of token strings highlighted via `<mark>`.

**Toasts** — surfaced via the module-level `toast({ title, description?, variant?, duration? })` from `@solvera/pace-core/components`. Variants used by this slice:
- `'default'` — stale-org clear.
- `'success'` — successful send (F-49), successful schedule (F-48), successful send-test (F-47).
- `'destructive'` — adapter / Edge errors on send, schedule, send-test, sender-identity RPC, RBAC permission queries (F-17, F-18, F-19, F-20, F-21, F-55).

Default duration 5000 ms. Notifications appear in an `aside[role="region"]` overlay anchored bottom-right of the viewport. The slice does not mount `<Toaster />` itself — TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.

### States

- **Loading — page-level RBAC pending.** Brief blank inside `PaceMain` (no `loading` prop on `PagePermissionGuard`).
- **Loading — sender-identity RPC.** Sender fields render with empty values; placeholder text only.
- **Loading — pool resolve in flight.** `RecipientPoolPreview` Card shows `<Alert role="status">Resolving recipient pool.</Alert>`. Composer Card remains editable.
- **Loading — templates fetch in flight.** Templates section is omitted (composer renders the rest).
- **Empty — no templates for active channel.** Templates section is omitted.
- **Empty — pool resolves to zero recipients.** `RecipientPoolPreview` Card shows description "0 estimated recipients" and (when warnings) any warning items. Inline copy "No recipients match these filters." renders above the composer's CardFooter. Send-now and Schedule are disabled and the slice intercepts clicks to surface a `'destructive'` toast.
- **Error — pool resolve failed.** `RecipientPoolPreview` Card shows `<Alert variant="destructive">` titled "Recipient pool unavailable" with the error message. Send-now and Schedule are disabled.
- **Error — send / schedule / send-test failed.** Composer Card and pool preview render with the in-progress draft and pool intact. A `'destructive'`-variant toast renders with the normalised error.
- **Error — sender-identity RPC failed.** Sender fields render empty; a `'destructive'`-variant toast renders with copy "Could not resolve sender identity. Set the sender details before sending."
- **Error — RBAC permission queries failed.** Composer renders the read-only banner; a `'destructive'`-variant toast renders with copy "Could not load permissions. Refresh to retry."
- **Permission denied — page.** `<AccessDenied />` in `PaceMain` with TEAM-01 chrome (header, footer) visible.
- **Permission denied — compose.** Composer renders the "Read-only mode" inline `<Alert>` and disables all editable inputs. CardFooter renders the single read-only `<Alert>` instead of buttons (when `canSend` is also false).
- **Success — send.** `'success'`-variant toast "Message sent to {N} recipients." (with optional " {M} skipped (suppression).") draft resets for current channel; operator remains on `/communications`.
- **Success — schedule.** `'success'`-variant toast "Message scheduled for {datetime}." Schedule input collapses; draft resets for current channel.
- **Success — send-test.** `'success'`-variant toast "Test message sent." Draft unchanged.
- **Stale-org clear.** `'default'`-variant toast "Manual recipients cleared — organisation changed." Recipient mode resets to "All organisation members"; chip selection clears; include-inactive resets to false.

### Interactions

- **Recipient-mode radio.** Click on either radio updates the slice's recipient mode. The recipient-mode Card content swaps between filter controls and manual-list controls. The composer's `recipientPool` prop updates; the composer's internal `useResolvedPool` re-runs.
- **Membership-type chip.** Hover: `Button variant="outline"` hover treatment. Click: toggles selection (default ↔ outline visual state). Pool re-resolves.
- **Include-inactive checkbox.** Click: toggles. Pool re-resolves.
- **Choose members… / Choose again button.** Hover: button hover treatment. Click: writes a fresh sessionStorage payload and navigates to `/members` with `location.state.intent = 'commsManualPick'`.
- **Channel buttons.** Click: sets channel and re-resolves pool. Email-only or SMS-only fields swap accordingly.
- **Template button.** Click: applies the template (writes subject, body_html, body_text, template_id, channel into the draft). Selected template visually flips to default variant; previously-selected template flips to outline.
- **Sender / subject / body inputs.** Standard text-input interactions. Selection state captured on `onSelect` and `onFocus` for merge-token insertion.
- **Preview / Edit toggle.** Click: swaps the body area between editor and `MessagePreview`. Toggling does not modify the draft.
- **Merge-field button.** Click: inserts the field's `token` at the captured cursor position of the active field.
- **Send test.** Click: invokes `adapter.sendTest`. Disabled when `blockForUnresolved` is true. Success / failure toasts per F-47.
- **Schedule.** First click expands the datetime-local input below the button and changes label to "Confirm schedule". Second click invokes `adapter.schedule`. Disabled when `canSchedule === false` or `blockForUnresolved` is true.
- **Send now.** Click: invokes `adapter.send`. Disabled when `blockForUnresolved` is true. Composer-internal validation may abort with `onSendError`.
- **Cancel.** Click: navigates to `/`. Disabled when `canCompose === false`.
- **Toast.** Auto-dismisses after 5000 ms. Non-blocking.
- **Org switch.** When `selectedOrganisation` changes, the slice resets recipient mode, clears manual list, clears chip selection, resets include-inactive, re-runs sender-identity RPC, re-runs composer-internal queries, and renders the stale-org `'default'` toast.

### Permission-conditional rendering

| Condition | Page entry | Composer | Send-test / Schedule / Send-now / Cancel |
|---|---|---|---|
| Not authenticated | Redirect to `/login` (TEAM-01 ProtectedRoute) | n/a | n/a |
| Authenticated, no org | TEAM-01 no-org empty state | n/a | n/a |
| Authenticated, org, `read:page.CommsLog` denied | `<AccessDenied />` | Hidden | Hidden |
| Authenticated, org, `read:page.CommsLog` allowed, `create:page.CommsLog` denied | Page visible | Read-only banner; inputs disabled | CardFooter shows read-only Alert; no buttons |
| Authenticated, org, `read:page.CommsLog` allowed, `create:page.CommsLog` allowed, `update:page.CommsLog` denied | Page visible | Editable inputs | CardFooter shows read-only Alert; no buttons |
| Authenticated, org, all three allowed | Page visible | Editable | All four buttons render with their normal gating (block-on-unresolved, schedule expansion) |

---

## §6 Business rules

**BR-01 — Page access.**
- Input: navigation to `/communications`.
- Output: `<PagePermissionGuard pageName="CommsLog" operation="read">` evaluates with org scope from `OrganisationServiceProvider`. Deny → `<AccessDenied />`. Allow → page body renders.
- Edge: no-org → TEAM-01 no-org empty state fires before the guard.

**BR-02 — `CommRbacContext` derivation.**
- Input: `useCan` results for `create:page.CommsLog` and `update:page.CommsLog` evaluated against current org.
- Output: `{ canCompose: <create>, canSend: <update>, canSchedule: <update>, scopeType: 'organisation', scopeId: selectedOrganisation.id }`.
- Edge: when `canSend === false`, the composer renders its read-only state and CardFooter renders the read-only `<Alert>` in place of the four action buttons.

**BR-03 — Recipient mode switching.**
- Input: user selects radio "All organisation members" or "Specific members".
- Output: when mode changes, the slice rebuilds the `recipientPool` descriptor. For "All organisation members", descriptor is `OrgMembersPool` with current chip + include-inactive filters. For "Specific members", descriptor is `ManualPool` with current `member_ids` (empty when no list hydrated).
- Edge: mode switch does not reset the draft body, subject, sender, or template.

**BR-04 — Manual hand-off — read-once-and-clear on mount.**
- Input: `/communications` mount; existing or absent `sessionStorage['pace:team:comms:manual-pick']` payload.
- Output:
  - If payload exists AND `payload.organisationId === selectedOrganisation.id` → set recipient mode to "Specific members"; build `ManualPool` with `member_ids = payload.memberIds`; remove the key from `sessionStorage`.
  - If payload exists but `organisationId` mismatches → remove the key; do not switch mode; start in default mode.
  - If no payload → no action.
- Edge: read-once-and-clear is unconditional once the key is read (whether or not the payload was applied). This is the contract TEAM-02 specifies in its BR-10.

**BR-05 — Manual hand-off — picker entry.**
- Input: user clicks "Choose members…" or "Choose again".
- Output: write `{ organisationId: selectedOrganisation.id, memberIds: <currentMemberIds>, updatedAt: Date.now() }` to `sessionStorage['pace:team:comms:manual-pick']`. Then call `navigate('/members', { state: { intent: 'commsManualPick' } })`. Member ids are never placed in the URL.
- Edge: writing the payload before navigation lets the picker hydrate from the prior selection. The picker writes its own payload back on Done; this slice reads-and-clears it on the next `/communications` mount.

**BR-06 — Send-time gating.**
- Input: Send-now or Schedule click.
- Output: the composer evaluates internally:
  1. `validateCommDraft(draft)` — if invalid (e.g. empty body, missing sender), `onSendError(<combined message>)` fires and the adapter is not called.
  2. If `selectedTemplate.require_merge_field_validation === true` AND any unresolved tokens exist → `onSendError('Resolve merge tokens before sending this strict template.')` fires and the adapter is not called.
  3. If `blockSendOnUnresolvedTokens === true` AND any unresolved tokens exist → `onSendError('Resolve all tokens before sending.')` fires and the adapter is not called.
  4. Otherwise, the adapter call proceeds.
- Edge: TEAM mounts with `blockSendOnUnresolvedTokens = true`, so all sends require fully-resolved tokens regardless of template strictness. Server-side validation in PUMP Edge is the ultimate authority.

**BR-07 — Zero-recipient guard.**
- Input: composer's pool preview reports `estimated_count === 0`.
- Output: inline copy "No recipients match these filters." renders above the CardFooter. Send-now and Schedule are disabled and any click that bypasses disabled state surfaces a `'destructive'`-variant toast with the same copy. Send-test is unaffected (does not depend on the pool).
- Edge: this rule applies regardless of recipient mode — an empty `ManualPool` triggers the same guard as an `OrgMembersPool` whose filters return zero matches.

**BR-08 — Channel-aware pool warnings are informational.**
- Input: `pump-resolve-pool` returns `CommPoolWarning[]` (e.g. `no_email`, `no_phone`, `suppressed`, `unknown`).
- Output: warnings render under the recipient summary in the `RecipientPoolPreview` Card with text formatted via `poolWarningLabel(warning)`. Send proceeds; PUMP Edge skips suppressed / contactless recipients at send time and reports them in `CommSendResult.suppression_skipped` / `warnings`.
- Edge: no client-side filtering of the pool to "only members with the channel's contact". TEAM does not pre-filter recipients.

**BR-09 — Source context.**
- Input: any adapter call from this slice (resolvePool, loadTemplates, loadMergeFields, send, sendTest, schedule).
- Output: `source_context_type` and `source_context_id` are `undefined`. The adapter's option fields `sourceContextType` and `sourceContextId` are not supplied to `useCommSendAdapter`.
- Edge: PUMP Edge enforces authorisation by `organisation_id` claim alone for TEAM-originated org-scoped sends.

**BR-10 — `bypass_suppression` invariant.**
- Input: any `adapter.send` or `adapter.schedule` call from this slice.
- Output: `bypass_suppression` is never set; defaults to `false`. Operator-initiated sends always consult the suppression registry.
- Edge: `bypass_suppression: true` is only set by Edge-side `sendSystemNotification` paths; this slice never invokes that path.

**BR-11 — `source_app` invariant.**
- Input: any adapter call from this slice.
- Output: `source_app === 'team'` literal. Either the slice sets it explicitly on the request or relies on `useCommSendAdapter`'s auto-fill from the `sourceApp: 'team'` option.

**BR-12 — `member_type_ids` cast.**
- Input: user selects one or more membership-type chips.
- Output: the slice converts `core_membership_type.id` (integer) values to strings before placing them in `OrgMembersPool.filters.member_type_ids: string[]`.
- Edge: when no chips are selected, the property is omitted from the descriptor entirely.

**BR-13 — Stale-org guard.**
- Input: `selectedOrganisation` changes while `/communications` is mounted.
- Output: recipient mode resets to "All organisation members"; manual `member_ids` clears; chip selection clears; `include_inactive` resets to false. The composer's `organisationId`, `recipientPool`, and `rbac` props update on the new org. The sender-identity RPC re-runs against the new org. A `'default'`-variant toast renders with copy "Manual recipients cleared — organisation changed." (5000 ms duration).
- Edge: any in-flight `pump-resolve-pool` or RPC for the previous org is discarded.

**BR-14 — Sender-identity pre-fill.**
- Input: page mount with resolved `selectedOrganisation`; org switch.
- Output: call `pump_get_effective_sender_identity(organisation_id := selectedOrganisation.id, source_context_type := null, source_context_id := null)` via `useSecureSupabase().rpc(...)`. Seed `draft.sender_name`, `draft.sender_email`, `draft.sender_phone`, `draft.reply_to` from the returned `EffectivePumpSenderIdentity` (`senderName`, `fromAddress`, `senderPhone`, `replyToAddress`). Null fields seed empty strings.
- Edge: RPC failure renders empty fields and a destructive toast (F-20). Operators may type sender details directly, subject to §16.

**BR-15 — Cancel destination.**
- Input: user clicks the composer's Cancel button.
- Output: `navigate('/')`. The draft is discarded.

**BR-16 — Send / Schedule success — toast and reset.**
- Input: `onSendComplete(result)` or `onScheduleComplete({ messageId, scheduledAtIso })` fires after a successful adapter call.
- Output:
  - Send: `'success'`-variant toast "Message sent to {result.total_recipients} recipients." plus appended " {M} skipped (suppression)." when `result.suppression_skipped > 0`, plus appended " Some recipients had unresolved tokens; check delivery in PUMP." when `result.warnings.length > 0`. Reset draft body fields (subject, body_html, body_text, template_id) to empty for the current channel; the channel value and the pre-filled sender identity carry through to the next compose. Remain on `/communications`.
  - Schedule: `'success'`-variant toast "Message scheduled for {scheduled_at}." Schedule control collapses (handled internally by the composer). Reset draft body fields to empty for the current channel; the channel value and pre-filled sender identity carry through to the next compose. Remain on `/communications`.
- Edge: when both `suppression_skipped > 0` and `warnings.length > 0`, both clauses are appended to the toast description in that order.

**BR-17 — Send-test success / failure toasts.**
- Input: `adapter.sendTest` returns success / failure.
- Output: success — `'success'`-variant toast "Test message sent." Failure — `'destructive'`-variant toast with the normalised error message. The draft remains unchanged either way.

**BR-18 — Send / Schedule failure — toast and draft intact.**
- Input: `onSendError(message)` fires.
- Output: `'destructive'`-variant toast with the normalised message. Draft unchanged. No inline alert added by TEAM-13; the composer's internal banners (read-only, strict-template, unresolved-tokens) continue to render based on their own conditions.

**BR-19 — Permission load failure.**
- Input: `useCan` query for any of the three permission strings fails.
- Output: composer renders the read-only state (treating `canSend = false`, `canCompose = false`); `'destructive'`-variant toast renders with copy "Could not load permissions. Refresh to retry."

---

## §7 API / Contract

### Public exports

This slice publishes no symbols for other slices to import. The composer surface lives behind `/communications`.

### Read contracts

- **Sender identity RPC.** `useSecureSupabase().rpc('pump_get_effective_sender_identity', { organisation_id: selectedOrganisation.id, source_context_type: null, source_context_id: null })`. Returns `EffectivePumpSenderIdentity` (one row).
- **Membership-type filter source.** `useSecureSupabase().from('core_membership_type').select('id, name').eq('organisation_id', selectedOrganisation.id).eq('is_active', true).order('name', { ascending: true })`. Used to populate the chip row.
- **Recipient pool preview.** `adapter.resolvePool(pool, { organisationId, channel })` → `CommRecipientPreview` (count, sample names, warnings). Edge slug: `pump-resolve-pool`. Driven by the composer's internal `useResolvedPool`; this slice does not invoke it directly.
- **Templates.** `adapter.loadTemplates({ organisationId, channel })` → `CommTemplate[]`. Edge slug: `pump-load-templates`. Driven by the composer's internal `useCommTemplates`.
- **Merge fields.** `adapter.loadMergeFields({ organisationId, channel, recipientPool })` → `CommMergeField[]`. Edge slug: `pump-load-merge-fields`. Driven by the composer's internal `useCommMergeFields`.

### Write contracts

- **Send.** `adapter.send(request: CommSendRequest)` → `ApiResult<CommSendResult>`. Edge slug: `pump-send`. The slice ensures `request.source_app === 'team'`, `request.organisation_id === selectedOrganisation.id`, `request.bypass_suppression` is omitted (defaults `false`), `request.source_context_type` and `request.source_context_id` are `undefined`. The composer's internal `buildCommSendRequest` assembles the request from the current `recipientPool`, `draft`, and `rbac` context.
- **Schedule.** `adapter.schedule(request: CommScheduleRequest)` → `ApiResult<CommScheduleResult>`. Edge slug: `pump-schedule`. Same shape as `CommSendRequest` plus `scheduled_at` (ISO 8601). Same invariants.
- **Send test.** `adapter.sendTest(request: CommSendTestRequest)` → `ApiResult<CommSendResult>`. Edge slug: `pump-send-test`. Omits `pool`, `system_key`, `system_recipient`, `bypass_suppression`. Recipient is the signed-in user's contact for the active channel (resolved server-side).

### Cross-slice handoffs

- **TEAM-01** mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`. TEAM-13 calls the module-level `toast(...)` and relies on this mount.
- **TEAM-01** owns `ProtectedRoute`, the `AuthenticatedShell` no-org check, the navigation menu (which lists "Communications"), and the `PaceAppLayout` chrome. TEAM-13 renders inside that chrome.
- **TEAM-02** owns `/members`. TEAM-13 hands off to the picker by calling `navigate('/members', { state: { intent: 'commsManualPick' } })` after writing `{ organisationId, memberIds, updatedAt }` to `sessionStorage['pace:team:comms:manual-pick']`. TEAM-13 reads-and-clears the same key on `/communications` mount when `payload.organisationId === selectedOrganisation.id`. The soft-cap (500) and hard-cap (2000) on the manual list are enforced inside TEAM-02; TEAM-13 displays only.
- **TEAM-06** owns `core_membership_type` mutations. TEAM-13 reads `core_membership_type.id` and `name` for the membership-type chip row.

### ID contracts

- `selectedOrganisation.id` (uuid) — used as `organisationId` for the adapter, `recipientPool.organisation_id` for `OrgMembersPool`, the `pump_get_effective_sender_identity` RPC argument, and the `sessionStorage` payload's `organisationId`.
- `core_member.id` (uuid) — consumed via the picker hand-off as the elements of `payload.memberIds` and `ManualPool.member_ids`. TEAM-13 does not query `core_member` itself.
- `core_membership_type.id` (integer) — read for the chip row; cast to string at the descriptor boundary.

---

## §8 Data and schema references

### Tables and RPCs accessed

| Object | Access | Via |
|---|---|---|
| `core_membership_type` | SELECT | `useSecureSupabase()` |
| `pump_get_effective_sender_identity(...)` | RPC (read) | `useSecureSupabase().rpc(...)` |
| `pump-resolve-pool` (Edge) | invoke | `adapter.resolvePool` (`@solvera/pace-core/comms`) |
| `pump-load-templates` (Edge) | invoke | `adapter.loadTemplates` |
| `pump-load-merge-fields` (Edge) | invoke | `adapter.loadMergeFields` |
| `pump-send` (Edge) | invoke | `adapter.send` |
| `pump-send-test` (Edge) | invoke | `adapter.sendTest` |
| `pump-schedule` (Edge) | invoke | `adapter.schedule` |

This slice does not SELECT, INSERT, UPDATE, or DELETE on any `pump_*` table directly. PUMP Edge owns those writes.

### `pump_get_effective_sender_identity` return shape (live dev-db)

Returns one row with fields matching `EffectivePumpSenderIdentity`: `organisationId`, `sourceContextType` (`'event' | 'organisation' | null`), `sourceContextId`, `senderName`, `fromAddress`, `replyToAddress`, `senderPhone`, `resolvedFrom`, `resolvedOrganisationId`, `canSendEmail`, `canSendSms`. Null fields indicate no value at that level.

### `core_membership_type` columns (live dev-db)

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | integer | NO | sequence |
| `name` | text | NO | — |
| `is_active` | boolean | NO | `true` |
| `organisation_id` | uuid | NO | — |

### `pump_message` (read-by-Edge only; for reference)

The PUMP Edge functions write to `pump_message`, `pump_message_recipient`, `pump_delivery_event`, and consult `pump_suppression`, `pump_organisation_templates`, `pump_system_templates`, `pump_org_settings`, `pump_gateway_config`. TEAM-13 never reads or writes these tables directly.

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `pump_get_effective_sender_identity(uuid, text, uuid)` exists and returns the expected shape. Smoke-test with `selectedOrganisation.id` and null context.
- Confirm `core_membership_type.is_active NOT NULL DEFAULT true`.
- Confirm `rbac_app_pages` row exists with `page_name = 'CommsLog'`, `app_id = data_get_app_id('PUMP')`, `scope_type = 'organisation'`.
- Confirm PUMP Edge functions `pump-resolve-pool`, `pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-templates`, `pump-load-merge-fields` are deployed on dev (`list_edge_functions`).
- Confirm `pump_gateway_config` has at least one row per channel for the dev environment.
- Confirm `pump_organisation_templates` has at least one fixture row per org per channel for demo.

### Domain references

- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates.
- `pace-core2/packages/core/docs/requirements/CR23-comms-platform.md` — authoritative integration contract (consumer-side reference for `RecipientPoolDescriptor`, `CommSendAdapter`, `EffectivePumpSenderIdentity`, RBAC model).
- `pace-core2/packages/core/docs/database/decisions/DB-change-decisions-p4.md` — PUMP DB foundation (DB-404 through DB-411 + DB-421 sender identity + system template seeds).

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|---|---|---|
| `useSecureSupabase` | `@solvera/pace-core/rbac` | Org-scoped Supabase client for the membership-type SELECT and the `pump_get_effective_sender_identity` RPC call |
| `useCan` | `@solvera/pace-core/rbac` | Permission gating to derive `CommRbacContext` (`canCompose`, `canSend`, `canSchedule`) |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard for `pageName="CommsLog"` `operation="read"` |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when the page guard denies |
| `useOrganisationsContext` | `@solvera/pace-core/providers` | Read `selectedOrganisation` for org id, RBAC scope, RPC argument, descriptor population |
| `usePaceMain` | `@solvera/pace-core/hooks` | Set `printTitle="Communications"` on page mount |
| `CommComposer` | `@solvera/pace-core/comms` | The composer surface |
| `useCommSendAdapter` | `@solvera/pace-core/comms` | Returns the `CommSendAdapter` configured for `sourceApp: 'team'` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@solvera/pace-core/components` | Recipient-mode Card |
| `Label` | `@solvera/pace-core/components` | Radio rows; checkbox row in include-inactive control |
| `Input` | `@solvera/pace-core/components` | Radio input controls; include-inactive checkbox input |
| `Button` | `@solvera/pace-core/components` | Membership-type chip Buttons; "Choose members…" / "Choose again" CTAs |
| `toast` | `@solvera/pace-core/components` | Stale-org notification, send / schedule / send-test success and failure, sender-identity RPC failure, permission-load failure |
| `RecipientPoolDescriptor`, `OrgMembersPool`, `ManualPool`, `CommRbacContext`, `CommDraft`, `CommSendRequest`, `CommScheduleRequest`, `CommSendResult`, `CommScheduleResult`, `CommTemplate`, `CommMergeField`, `CommPoolWarning`, `CommTokenWarning`, `CommSendAdapter`, `EffectivePumpSenderIdentity` | `@solvera/pace-core/comms` (types) | Type definitions consumed by the slice's controlled draft, recipient-pool state, and the RPC-shaped sender-identity hook |

### §9.2 Slice-specific caveats

- **`useCommSendAdapter` default behaviour is the v1 contract.** Mount with exactly `{ organisationId: selectedOrganisation.id, sourceApp: 'team' }`. Do not supply `sourceContextType` / `sourceContextId` — TEAM v1 sends are organisation-scoped only.
- **`CommComposer` mounts with `blockSendOnUnresolvedTokens={true}`.** This overrides the composer's default of `false`. Send and Schedule will refuse to dispatch while any merge token in the draft cannot be resolved against the loaded `mergeFields` list.
- **`CommComposer` `templates`, `mergeFields`, and `recipientPreview` props are not supplied.** The composer drives those queries internally via its own hooks. Supplying empty arrays would not change behaviour but supplying populated arrays would short-circuit the internal queries; TEAM v1 does not.
- **`CommComposer` `onCancel` is wired to `navigate('/')`.** The button only renders because TEAM provides the prop. Omitting `onCancel` removes the Cancel button entirely.
- **`PagePermissionGuard` page resolution is verify-then-confirm.** The slice mounts `<PagePermissionGuard pageName="CommsLog">` with no `appName` override, even though `CommsLog` is registered under the PUMP `rbac_apps` row. If the guard's page lookup is name-only, this passes; if it requires `(app_id, name)` matching against TEAM's app_id, it fails. §15 Done criteria carries the verification step. Do not pre-emptively add the override prop.
- **`toast` mounting dependency.** `toast(...)` requires `<ToastProvider>` to be mounted in an ancestor. TEAM-01 mounts it inside `AuthenticatedShell`. The slice does not mount `Toaster` itself.
- **Sender-identity RPC argument ordering.** The slice calls `pump_get_effective_sender_identity` with `organisation_id`, `source_context_type`, `source_context_id` in that order. TEAM v1 passes the second and third arguments as `null`.
- **Stale-org reset is a slice responsibility.** When `selectedOrganisation` changes mid-mount, the slice clears recipient mode, manual list, chip selection, and include-inactive state, then re-runs the sender-identity RPC. The composer's internal hooks re-run on their dependency change automatically.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback |
|---|---|---|---|
| `/communications` | `CommsLog` | `read` | `<AccessDenied message="You do not have permission to view this page." />` (default copy) |

### Action-level access

| Action | Permission | Resolver | UI behaviour when denied |
|---|---|---|---|
| Read page (composer view) | `read:page.CommsLog` | `PagePermissionGuard` (page level) | `<AccessDenied />` |
| Compose / edit draft | `create:page.CommsLog` | `useCan` → `canCompose` on `CommRbacContext` | Composer renders read-only banner; inputs disabled |
| Send-now / Send-test | `update:page.CommsLog` | `useCan` → `canSend` on `CommRbacContext` | CardFooter renders read-only Alert in place of buttons |
| Schedule | `update:page.CommsLog` | `useCan` → `canSchedule` on `CommRbacContext` | Schedule button hidden alongside Send-now (CardFooter Alert) |

### Server-side enforcement

- **`core_membership_type` SELECT** is enforced by the dev RLS policy `read_team_membership_types` (`USING is_authenticated_user()`).
- **`pump_get_effective_sender_identity`** runs with caller authority and consults RLS / RBAC inside the function body.
- **PUMP Edge functions** call pace-core `isPermitted()` against `{operation}:page.CommsLog` and validate the `organisation_id` claim. UI gating per `CommRbacContext` is UX only; Edge authority is the security boundary.

### Cross-app guard verification

The page resource `CommsLog` is registered under the PUMP `rbac_apps` row, but `setupRBAC(...)` in TEAM-01 was called with `appName: 'TEAM'`. The slice mounts `<PagePermissionGuard pageName="CommsLog" operation="read">` without an `appName` override. §15 Done criteria includes a dev verification step to confirm this resolves. If verification fails, the slice is patched to add `appName="PUMP"` and a CR23 capability item is filed for cross-app guard resolution support.

---

## §11 Acceptance criteria

**AC-01 — Page entry, authenticated, has org, has read permission.**
Given a user is authenticated, has an org, and has `read:page.CommsLog`, when they navigate to `/communications`, then the page renders the heading "Communications", the recipient-mode Card with the radio defaulted to "All organisation members", and the composer Card with channel set to email, sender fields pre-filled from the effective sender identity, and the recipient pool preview Card visible below. (Traces F-01, F-03, F-04, F-06, F-07, F-22, F-26.)

**AC-02 — Sender identity pre-fill.**
Given an org whose `pump_get_effective_sender_identity` returns `senderName: 'Org Comms'`, `fromAddress: 'comms@example.org'`, `replyToAddress: 'replies@example.org'`, `senderPhone: null`, when the page mounts, then the composer's Sender name field shows "Org Comms", Sender email shows "comms@example.org", and Sender phone shows the empty string when the channel is later switched to SMS. (Traces F-04, BR-14.)

**AC-03 — Recipient mode default and switch.**
Given the page is loaded with recipient mode "All organisation members", when the user selects the "Specific members" radio with no manual list yet, then the recipient-mode Card renders the "Choose members…" Button and the composer's pool preview Card shows `estimated_count: 0` after the resolver returns. (Traces F-22, F-24, F-35, BR-03.)

**AC-04 — Manual hand-off entry writes payload and navigates.**
Given the user is in "Specific members" mode with no list selected, when they click "Choose members…", then `sessionStorage['pace:team:comms:manual-pick']` is set to `{ organisationId: <currentOrgId>, memberIds: [], updatedAt: <ms> }` and the app navigates to `/members` with `location.state.intent === 'commsManualPick'`. (Traces F-24, F-36, BR-05.)

**AC-05 — Manual hand-off return and read-once-and-clear.**
Given the user returns from `/members` with `sessionStorage['pace:team:comms:manual-pick']` set to `{ organisationId: <currentOrgId>, memberIds: ['m1','m2','m3'], updatedAt: <ms> }`, when `/communications` mounts, then the recipient mode is set to "Specific members", the Card renders "3 members selected" alongside the "Choose again" Button, the composer's `recipientPool` is `{ type: 'manual', member_ids: ['m1','m2','m3'] }`, and `sessionStorage['pace:team:comms:manual-pick']` is no longer set. (Traces F-05, F-25, BR-04.)

**AC-06 — Manual hand-off org mismatch ignores payload but clears key.**
Given `sessionStorage['pace:team:comms:manual-pick']` is set with an `organisationId` differing from the current `selectedOrganisation.id`, when `/communications` mounts, then the recipient mode is "All organisation members", the composer's `recipientPool` is `OrgMembersPool` with no filters, and `sessionStorage['pace:team:comms:manual-pick']` is no longer set. (Traces F-63, BR-04.)

**AC-07 — Membership-type filter applies to descriptor.**
Given the recipient mode is "All organisation members" and the org has membership types "Junior" (id 1) and "Senior" (id 2), when the user selects only the Junior chip, then the composer's `recipientPool` is `{ type: 'org_members', organisation_id: <orgId>, filters: { member_type_ids: ['1'] } }` (id cast to string) and the pool preview re-runs. (Traces F-23, F-37, F-65, BR-12.)

**AC-08 — Include-inactive toggle.**
Given the recipient mode is "All organisation members" and the include-inactive checkbox is unchecked, when the user checks it, then the composer's `recipientPool` is `{ type: 'org_members', organisation_id: <orgId>, filters: { include_inactive: true } }` (`member_type_ids` omitted) and the pool preview re-runs. (Traces F-23, F-38, F-66.)

**AC-09 — Channel switch from email to SMS.**
Given the channel is email and the draft has `subject: 'Hello'`, `body_html: '<p>Hi</p>'`, `body_text: 'Hi'`, `sender_email: 'a@b.com'`, when the user clicks SMS, then the composer's draft carries `body_text: 'Hi'` through unchanged, drops `subject` and `body_html` and `sender_email`, and the SMS-only sender phone field renders. The pool preview re-runs with `channel: 'sms'`. (Traces F-31, F-32.)

**AC-10 — Template selection populates draft.**
Given the active channel is email and one active template "Welcome" exists for the org with `subject: 'Welcome!'`, `body_html: '<p>Hi {{first_name}}</p>'`, `body_text: 'Hi {{first_name}}'`, `require_merge_field_validation: false`, when the user clicks the "Welcome" template button, then `draft.template_id`, `draft.subject`, `draft.body_html`, `draft.body_text`, and `draft.channel` populate from the template. (Traces F-33.)

**AC-11 — Strict template gates send.**
Given a strict template (`require_merge_field_validation: true`) is selected, the body contains `{{unknown_token}}` not present in the merge-fields list, and the user clicks Send-now, when the composer evaluates the gate, then the adapter is not called and a `'destructive'`-variant toast renders with copy "Resolve merge tokens before sending this strict template." The draft remains unchanged. (Traces F-72, BR-06, BR-18.)

**AC-12 — Block-on-unresolved gates send.**
Given `blockSendOnUnresolvedTokens={true}` is in effect, no template is selected, and the body contains `{{unknown_token}}`, when the user clicks Send-now, then the composer's blocking banner is visible, the adapter is not called, and a `'destructive'`-variant toast renders with copy "Resolve all tokens before sending." The draft remains unchanged. (Traces F-73, BR-06, BR-18.)

**AC-13 — Successful send toast and reset.**
Given a valid email draft with all tokens resolved and a non-empty pool, when the user clicks Send-now and `pump-send` returns `{ message_id: 'msg_1', total_recipients: 47, suppression_skipped: 3, warnings: [] }`, then a `'success'`-variant toast renders with copy "Message sent to 47 recipients. 3 skipped (suppression).", the draft resets to empty for the email channel (preserving sender identity pre-fill), and the operator remains on `/communications`. (Traces F-49, BR-16.)

**AC-14 — Successful schedule toast and reset.**
Given a valid email draft with all tokens resolved and the user has expanded the schedule control to `2026-12-01T10:00`, when they click "Confirm schedule" and `pump-schedule` returns `{ message_id: 'msg_2' }`, then a `'success'`-variant toast renders with copy "Message scheduled for 2026-12-01T10:00.", the schedule input collapses, the draft resets for the email channel, and the operator remains on `/communications`. (Traces F-48, BR-16.)

**AC-15 — Send failure toast leaves draft intact.**
Given a valid draft and the adapter returns `{ ok: false, error: { code: 'PUMP_GATEWAY_DOWN', message: 'Gateway unavailable' } }`, when the user clicks Send-now, then a `'destructive'`-variant toast renders with copy "Gateway unavailable" and the draft remains unchanged. (Traces F-17, BR-18.)

**AC-16 — Send-test success toast.**
Given a valid email draft with all tokens resolved, when the user clicks "Send test" and `pump-send-test` returns success, then a `'success'`-variant toast renders with copy "Test message sent." and the draft remains unchanged. (Traces F-47, BR-17.)

**AC-17 — Send-test failure toast.**
Given a valid email draft and the send-test adapter returns `{ ok: false, error: { code: 'PUMP_SEND_TEST_FAILED', message: 'Could not deliver test message' } }`, when the user clicks "Send test", then a `'destructive'`-variant toast renders with copy "Could not deliver test message" and the draft remains unchanged. (Traces F-19, BR-17.)

**AC-18 — Zero-recipient guard.**
Given the recipient mode is "All organisation members" with filters that match no rows and `pump-resolve-pool` returns `{ estimated_count: 0, sample_names: [], warnings: [] }`, when the user attempts to click Send-now, then the inline copy "No recipients match these filters." renders above the CardFooter, the Send-now and Schedule buttons are disabled, and any click that bypasses the disabled state surfaces a `'destructive'`-variant toast with the same copy. (Traces F-14, F-55, BR-07.)

**AC-19 — Stale-org clears manual list and toasts.**
Given the recipient mode is "Specific members" with `member_ids.length === 5` for org A, when the user switches the org context to org B, then the recipient mode resets to "All organisation members", the manual list clears, the chip selection clears, the include-inactive checkbox unchecks, the sender-identity RPC re-runs against org B, and a `'default'`-variant toast renders with copy "Manual recipients cleared — organisation changed." (Traces F-51, BR-13.)

**AC-20 — Permission denied — read.**
Given a user is authenticated with org context but lacks `read:page.CommsLog`, when they navigate to `/communications`, then `<AccessDenied />` renders with copy "You do not have permission to view this page." inside the `AuthenticatedShell` chrome and no recipient-mode card or composer renders. (Traces F-15, F-56.)

**AC-21 — Read-only mode (canSend false).**
Given a user has `read:page.CommsLog` and `create:page.CommsLog` but not `update:page.CommsLog`, when they view `/communications`, then the composer renders the "Read-only mode" inline banner, all editable inputs are disabled, the CardFooter renders a single read-only `<Alert>` "You have view-only access to this message." in place of the Send-test, Schedule, Send-now, and Cancel buttons. (Traces F-58.)

**AC-22 — Cancel navigation.**
Given the user has any in-progress draft and the Cancel button is enabled, when they click Cancel, then the app navigates to `/` and the draft is discarded. (Traces F-50, BR-15.)

**AC-23 — Sender-identity RPC failure surfaces toast.**
Given `pump_get_effective_sender_identity` fails on mount, when the page renders, then the sender fields render empty and a `'destructive'`-variant toast renders with copy "Could not resolve sender identity. Set the sender details before sending." (Traces F-20, BR-14.)

**AC-24 — `bypass_suppression` invariant.**
Given any successful send from this slice, when the request reaches `pump-send`, then the request payload omits `bypass_suppression` (defaulting `false`); no UI affordance allows the operator to set it. (Traces F-68, BR-10.)

**AC-25 — `source_app` and `source_context` invariants.**
Given any successful send or schedule from this slice, when the request reaches `pump-send` or `pump-schedule`, then the request payload has `source_app === 'team'`, `source_context_type === undefined`, and `source_context_id === undefined`. (Traces F-67, F-69, BR-09, BR-11.)

---

## §12 Verification

- **MCP test — `pump_get_effective_sender_identity`.** Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)), call the RPC with a known org id and `null` source context. Confirm the return shape matches `EffectivePumpSenderIdentity` (organisationId, sourceContextType, sourceContextId, senderName, fromAddress, replyToAddress, senderPhone, resolvedFrom, resolvedOrganisationId, canSendEmail, canSendSms).
- **MCP test — `core_membership_type` for chip row.** Confirm `SELECT id, name FROM core_membership_type WHERE organisation_id = :orgId AND is_active = true ORDER BY name` returns at least one row for the demo org.
- **MCP test — `rbac_app_pages` `CommsLog` row.** Confirm a row exists with `page_name = 'CommsLog'`, `app_id = data_get_app_id('PUMP')`, `scope_type = 'organisation'`.
- **MCP test — Edge function deployment.** Run `list_edge_functions` and confirm the presence of `pump-resolve-pool`, `pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-templates`, `pump-load-merge-fields`. If any are missing, see §15 — implementation is gated.
- **MCP test — `pump_gateway_config`.** Confirm at least one row exists per channel for the dev environment. If absent, dispatch will fail at PUMP Edge time.
- **Fixture seed — `pump_organisation_templates`.** Seed at least one row per channel for the demo org, e.g. `{ id: <uuid>, organisation_id: <demoOrgId>, name: 'Welcome', channel: 'email', subject: 'Welcome', body_html: '<p>Hi {{first_name}}</p>', body_text: 'Hi {{first_name}}', is_active: true, require_merge_field_validation: false }`. Without at least one row, the templates section will not render.
- **In-app demo flow — happy path send.** Sign in as a TEAM org-admin with all three `CommsLog` permissions. Visit `/communications`. Confirm the page heading, recipient-mode Card, composer Card, and pool preview Card render. Confirm the sender fields are pre-filled. Type a body. Click Send now. Confirm the success toast and the draft reset.
- **In-app demo flow — schedule.** Repeat the happy path, but click Schedule, pick a future datetime, click Confirm schedule. Confirm the success toast.
- **In-app demo flow — send-test.** With a valid draft, click Send test. Confirm the success toast and that the message was delivered to the signed-in user's contact.
- **In-app demo flow — manual hand-off.** Switch recipient mode to "Specific members". Click "Choose members…". Confirm `/members` enters picker mode with the Members tab only. Select three members and click Done. Confirm return to `/communications` with "3 members selected" rendered and the pool preview showing 3 recipients.
- **In-app demo flow — manual hand-off org switch.** Re-enter picker mode, select members, switch the org context. Confirm the stale-org toast renders and the manual list clears.
- **In-app demo flow — strict template.** Seed a strict template (`require_merge_field_validation: true`). Select it. Type an unknown token like `{{not_a_field}}`. Click Send. Confirm the destructive toast "Resolve merge tokens before sending this strict template."
- **In-app demo flow — block-on-unresolved.** Without a template selected, type `{{not_a_field}}` in the body. Confirm the unresolved-tokens banner renders, Send-now is disabled, and any direct adapter invocation is blocked.
- **In-app demo flow — permission read-only.** Sign in as a user with `read:page.CommsLog` only. Confirm the composer renders read-only and the CardFooter shows the read-only Alert.

---

## §13 Testing requirements

- Unit / integration tests covering the manual-pick read-once-and-clear logic: org match path, org mismatch path, missing payload path.
- Unit / integration tests covering the stale-org reset: recipient mode, manual list, chip selection, include-inactive, sender-identity RPC re-run.
- Component test that asserts `recipientPool` rebuilds correctly when the membership-type chips change, when the include-inactive checkbox toggles, and when the recipient mode radio changes.
- Component test that asserts `member_type_ids` are cast from integer to string at the descriptor boundary.
- Component test that asserts every adapter call carries `source_app === 'team'`, `source_context_type === undefined`, `source_context_id === undefined`, and that `bypass_suppression` is never set on the request.
- Component test that asserts the success-toast copy includes "{N} recipients" and conditionally appends "{M} skipped (suppression)" and " Some recipients had unresolved tokens; check delivery in PUMP." per `result.suppression_skipped` and `result.warnings.length`.
- Component test that asserts the zero-recipient guard blocks Send-now and Schedule and surfaces the "No recipients match these filters." copy.
- Component test that asserts `<PagePermissionGuard pageName="CommsLog" operation="read">` is rendered with no `appName` and no `scope` prop.
- Otherwise: standard PDLC quality gates apply.

---

## §14 Build execution rules

- All reads (membership types, sender-identity RPC) must go via `useSecureSupabase()`. Do not call `createClient` directly.
- All sends, schedules, send-tests, template loads, merge-field loads, and pool resolves must go via the `CommSendAdapter` returned by `useCommSendAdapter`. Do not invoke `functions.invoke` directly. Do not write to `pump_message`, `pump_message_recipient`, `pump_delivery_event`, or `pump_suppression` from this slice.
- Mount `<PagePermissionGuard pageName="CommsLog" operation="read">` with no `appName` override and no `scope` prop. If the verification step in §15 fails, patch the slice to add `appName="PUMP"` and file a CR23 capability item.
- Mount `CommComposer` with `blockSendOnUnresolvedTokens={true}`, `sourceApp='team'`, `onCancel={() => navigate('/')}`. Do not supply `templates`, `mergeFields`, or `recipientPreview` props — let the composer drive its own queries.
- Mount `useCommSendAdapter` with `{ organisationId: selectedOrganisation.id, sourceApp: 'team' }` only. Do not pass `sourceContextType` / `sourceContextId`.
- Cast `core_membership_type.id` (integer) to string before placing it in `OrgMembersPool.filters.member_type_ids`.
- Read-once-and-clear `sessionStorage['pace:team:comms:manual-pick']` on `/communications` mount. Always remove the key after reading, regardless of whether the payload was applied.
- Write a fresh sessionStorage payload before every navigation to the picker (so the picker can hydrate the prior selection).
- Do not query production database during build or test. All MCP catalogue checks use verified-contract project `yihzsfcceciimdoiibif` ([`npm run mcp:verification`](../../package.json)); preview `SUPABASE_PROJECT_REF` remains for browser/app connectivity only.

---

## §15 Done criteria

- All 25 acceptance criteria (AC-01 through AC-25) verified via the slice's QA pack.
- **Implementation blocked until:**
  - **(a)** PUMP Edge functions `pump-resolve-pool`, `pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-templates`, and `pump-load-merge-fields` are deployed on verified-contract project `yihzsfcceciimdoiibif` (backend-ready MCP target).
  - **(b)** `pump_gateway_config` is seeded with at least one row per channel for the dev environment so `pump-send` can dispatch.
  - **(c)** `pump_organisation_templates` is seeded with at least one fixture row per org per channel so the composer's templates section populates for demo.
  The v6 slice does not author the Edge function bodies. Until items (a), (b), and (c) are confirmed via Supabase MCP and a manual smoke-send succeeds, this slice cannot be marked Done.
- **Cross-app guard verification.** Verify on dev that a user with PUMP `read:page.CommsLog` grant can pass `<PagePermissionGuard pageName="CommsLog">` even though TEAM's `setupRBAC` was called with `appName='TEAM'`. If the page lookup is name-only, this passes. If it requires `(app_id, name)` matching against TEAM's app_id, this fails — in which case the slice is patched to add `appName='PUMP'` override prop on the guard, and a CR23 capability item is filed for cross-app guard resolution support.
- **TEAM org-admin role-template seeding.** Confirm the TEAM org-admin role template includes `read:page.CommsLog`, `create:page.CommsLog`, and `update:page.CommsLog` grants on dev. Without these grants, the page guard or the `useCan` checks deny and operators see `<AccessDenied />` or the read-only state. Seeding is a post-build platform task; absence does not block authoring but blocks Done.
- **Picker hand-off contract verified end-to-end.** A click on "Choose members…" writes the sessionStorage payload, the picker (TEAM-02) hydrates from it, the picker's Done writes the new payload, and `/communications` mount reads-and-clears it; the resulting `recipientPool` matches the chosen `memberIds`.
- **Send / schedule / send-test invariants verified.** Inspect a successful adapter call request body and confirm `source_app === 'team'`, `source_context_type === undefined`, `source_context_id === undefined`, `bypass_suppression` omitted (or `false`).

---

## §16 Do not

- Do not implement TEAM-side persisted drafts. The composer is ephemeral; leaving the page discards the working state.
- Do not implement a TEAM-side scheduled-message management surface (cancellation, rescheduling). PUMP owns the scheduled-message lifecycle.
- Do not implement the full PUMP product surface here: template library CRUD, organisation comms settings UI, delivery analytics, suppression management, and the full scheduled-message inbox all live in PUMP.
- Do not implement gateway or webhook handlers. PUMP Edge owns those.
- Do not send a resolved recipient list from the browser. Always pass a `RecipientPoolDescriptor` (`OrgMembersPool` or `ManualPool`); PUMP Edge resolves server-side.
- Do not type arbitrary from-addresses outside the org's verified senders. The composer's Sender name / Sender email / Sender phone fields are pre-filled from `pump_get_effective_sender_identity` and are intended for adjustment within the org's verified-sender set; arbitrary from-addresses violate the platform-managed sender identity contract.
- Do not revive `team_unit` or any unit-scoped recipient filter in v1. `unit_ids` and `age_min`/`age_max` filters are deferred (see §17).
- Do not `INSERT` directly into `pump_message`, `pump_message_recipient`, `pump_delivery_event`, or `pump_suppression` from TEAM. PUMP Edge owns those writes.
- Do not mount `<Toaster />` from this slice. TEAM-01 mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`.
- Do not invent recipient-pool filters that PUMP Edge does not yet support. The v1 filter set is `member_type_ids` and `include_inactive` only.
- Do not present a base-table-first view of recipients. The recipient pool is summarised as count + sample names + warnings via `pump-resolve-pool`; the slice does not render a full member list of the resolved pool.
- Do not pass a `scope` prop to `PagePermissionGuard`. Do not pre-emptively pass `appName="PUMP"` — the verification step in §15 drives that decision.
- Do not pass `sourceContextType` / `sourceContextId` to `useCommSendAdapter` or to the composer's `rbac` context as anything other than `'organisation'` / `selectedOrganisation.id`. TEAM v1 is organisation-scoped only.
- Do not set `bypass_suppression` on any adapter call. The default `false` applies; only Edge-side `sendSystemNotification` paths set `true`.
- Do not run any verification or smoke send against production. Dev-db only.

---

## §17 References

- `/rebuild/project-brief.md` — admin-only mandate; communications scope; cross-app PUMP integration.
- `/rebuild/architecture.md` — slice ownership, route registry, canonical `pageName` map (`CommsLog` registered under PUMP), comms-picker contract.
- **TEAM-01** — provides `ProtectedRoute`, `AuthenticatedShell`, `PaceAppLayout`, the navigation menu (Communications entry), and **mounts `<ToastProvider>` (which renders `<Toaster />` internally) inside `AuthenticatedShell`** so TEAM-13 can call `toast(...)`. TEAM-13 depends on this mount.
- **TEAM-02** — owns `/members`. TEAM-13 hands off to the picker via `sessionStorage['pace:team:comms:manual-pick']` with shape `{ organisationId: string, memberIds: string[], updatedAt: number }`. The picker enforces the soft cap (500) and hard cap (2000) on the manual list; TEAM-13 is the consumer side and displays only.
- **TEAM-06** — owns `core_membership_type` mutations. TEAM-13 reads `core_membership_type.id` and `name` for the chip row.
- `pace-core2/packages/core/docs/standards/3-security-rbac-standards.md` — RBAC helper attributes; `data_check_rbac_permission_with_context`; `data_get_app_id`; canonical RLS policy templates.
- `pace-core2/packages/core/docs/requirements/CR23-comms-platform.md` — authoritative integration contract for `RecipientPoolDescriptor`, `CommSendAdapter`, `EffectivePumpSenderIdentity`, RBAC model.
- `pace-core2/packages/core/docs/database/decisions/DB-change-decisions-p4.md` — PUMP DB foundation (DB-404 through DB-411 + DB-421).

### Platform prerequisites and follow-on items

- **Platform prerequisite — PUMP Edge deployment.** PUMP Edge functions `pump-resolve-pool`, `pump-send`, `pump-schedule`, `pump-send-test`, `pump-load-templates`, `pump-load-merge-fields` must be deployed on dev before TEAM-13 can be marked Done. Currently absent on dev as of the audit. Listed in §15.
- **Platform prerequisite — `pump_gateway_config` seeding.** At least one row per channel must exist on dev for `pump-send` to dispatch. Currently zero rows. Listed in §15.
- **Demo prerequisite — `pump_organisation_templates` seeding.** At least one fixture row per org per channel is needed for the templates section to render. Currently zero rows. Listed in §12 / §15.
- **Platform prerequisite — TEAM org-admin role-template seeding.** TEAM org-admin role template must include `read:page.CommsLog`, `create:page.CommsLog`, and `update:page.CommsLog` grants on dev. Listed in §15.
- **Capability item (non-blocking) — CR23 `lockSenderIdentity` prop.** The composer renders Sender name / Sender email / Sender phone as editable inputs. TEAM v1 pre-fills from `pump_get_effective_sender_identity` and §16 bars typing arbitrary from-addresses, but the composer does not currently accept a prop to lock or hide these inputs. CR23 should add a `lockSenderIdentity` prop in a follow-up so consumer apps can enforce platform-managed identity at the UI layer.
- **Doc fix (non-blocking) — CR23 §Visual specification updated to match the single-column rendered layout in `components.tsx`.** The CR23 spec describes a "two-column desktop layout"; the package source `components.tsx` renders a single-column Card with the recipient pool preview as a sibling Card below. The doc should be corrected to reflect actual rendering. This slice's §5 describes the actual rendered layout, not the doc's recipe.
- **Deferred — `unit_ids` and `age_min`/`age_max` filters.** Deferred to a v2 follow-up. Re-introduction depends on PUMP Edge resolver support for the `unit_ids` field and on validated DOB / age data; revive `team_unit` is out of scope.
- **Deferred — PUMP deep-link / suite navigation.** A "Manage in PUMP" affordance is deferred to a v2 follow-up gated on a verified PUMP route export.
- **Deferred — TEAM-side scheduled-message inbox / log.** Deferred to a future iteration; PUMP owns the scheduled-message lifecycle UX.
