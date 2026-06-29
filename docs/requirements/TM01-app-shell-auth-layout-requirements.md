# TEAM-01 — App shell, auth, layout

## §1 Slice metadata

```
Slice ID:        TEAM-01
Name:            App shell, auth, layout
Status:          Draft
Depends on:      None
Backend impact:  None
Frontend impact: UI
Routes owned:    /login; /; /orgs/:orgId; *
QA pack:         docs/test-packs/TM01-qa-pack.md
```

---

## §2 Overview

TEAM-01 establishes the complete application shell for the TEAM app. It wires the full provider stack (Supabase auth, org context, RBAC), renders the login page, the authenticated app chrome (header, navigation, footer), the organisation landing page at `/`, the organisation overview at `/orgs/:orgId`, and the catch-all NotFound page. All subsequent slices (TEAM-02 through TEAM-13) render their routes inside the shell this slice produces. Org overview may surface rolled-up KPIs and attention items; feature-domain queries for members, events, forms, and so on remain in downstream slices.

The shell follows the **two-level org model** from the functional prototype (mirrors pace-base): pick an organisation, then work inside that org via a slim top nav plus an Organisation setup launcher on the overview.

- **Prototype reference:** routing, `NAV_ITEMS`, org landing/overview, and shell chrome in `pace-prototype/apps/pace-team/app.jsx` and `pace-prototype/apps/pace-team/pages/OrganisationPages.jsx` (`OrgLandingPage`, `OrgOverviewPage`, `OrgContextBar`).

The shell is greenfield — the legacy repo contained no `App.tsx`, no router, no layout component, and no home page. Provider wiring is guided by pace-core2 patterns; **layout authority** is the pace-team prototype kit.

---

## §3 What this slice delivers

### Purpose

TEAM-01 gives authenticated staff a stable, org-aware application shell to navigate from. It protects all admin surfaces from unauthenticated access, establishes org context for every feature query that follows, and provides the navigation scaffold from which every other TEAM slice is reached.

### Surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Login page | `/login` | Unauthenticated; always accessible |
| Authenticated shell (chrome) | All authenticated routes | Header + optional OrgContextBar + PaceMain + footer |
| Organisation landing | `/` | Pick an organisation; empty primary nav |
| Organisation overview | `/orgs/:orgId` | Hero, KPIs, member-request attention, Organisation setup launcher, upcoming events |
| NotFound page | `*` | Catch-all within the authenticated shell |
| Inactivity warning modal | *(overlay)* | Rendered by `UnifiedAuthProvider` idle timer |
| Toast notifications | *(overlay)* | Rendered by `Toaster` inside `ToastProvider`; mounted by `AuthenticatedShell` so any authenticated route may call `toast(...)` |

### Boundaries

TEAM-01 does **not** own:
- Any feature-domain data queries (membership lists, events, communications, forms, reports, moderation, settings data)
- Route-level `PagePermissionGuard` for registered read paths — shell uses **`team-route-registry.ts`** + **`useShellRouteAccessDenied`**
- Any participant-facing surfaces

### Architectural posture

**APP_NAME constant.** `APP_NAME = 'TEAM'` is declared as a named export constant in `src/App.tsx` and imported (not redeclared) in `main.tsx`. Both `setupRBAC` and `UnifiedAuthProvider` receive `APP_NAME`.

**setupRBAC call ordering.** Before `setupRBAC(...)`, initialise `resolveTeamAppId` with `createGetAppIdResolver(supabaseClient)`. Call `setupRBAC(supabaseClient, { appName: APP_NAME, getAppId: resolveTeamAppId })` at module level in `main.tsx`, before `createRoot(...)`. It must not be called inside a component, hook, or effect.

**Provider stack.**
```
QueryClientProvider
  BrowserRouter
    UnifiedAuthProvider (supabaseClient, appName, inactivity config)
      AppProviders (bridge component — see below)
        OrganisationServiceProvider (supabaseClient, user, session)
          App (router + routes)
```

**OrganisationServiceProvider wiring.** `OrganisationServiceProvider` does not consume `UnifiedAuthProvider` context internally — it requires `user` and `session` as explicit props. An internal bridge component named `AppProviders`, defined in `main.tsx`, calls `useUnifiedAuthContext()` and passes the returned `user` and `session` as props. `AppProviders` is placed as the immediate child of `UnifiedAuthProvider` and the immediate parent of `OrganisationServiceProvider`. It is not exported and has no other responsibility.

**Inactivity logout.** `UnifiedAuthProvider` is configured with:
- `idleTimeoutMs={30 * 60 * 1000}` (30 minutes)
- `warnBeforeMs={2 * 60 * 1000}` (2 minutes)
- `onIdleLogout` calling `supabaseClient.auth.signOut()` directly
- `renderInactivityWarning` rendering `<InactivityWarningModal>`

**EventServiceProvider.** Do not add `EventServiceProvider` — TEAM is not event-scoped.

**Route guards.** `ProtectedRoute` wraps all authenticated routes and redirects unauthenticated users to `/login`. Registered route **read** access is enforced by **`PaceAppLayout`** with **`enforcePermissions`**, **`routeAccessDenied={useShellRouteAccessDenied(getTeamRoutePermissionForPath)}`**, and **`permissionFallback={<AccessDenied />}`**, backed by **`src/lib/navigation/team-route-registry.ts`**. Primary nav visibility is map-driven: each `NavigationItem` carries **`pageId`** (from the registry) and is pre-filtered by `NavigationMenu` — do **not** use **`NavigationGuard`**. **`PagePermissionGuard`** on `/` and `/orgs/:orgId` covers landing/overview read; TEAM-02 through TEAM-13 add **`PagePermissionGuard`** only for mutation affordances or scoped-read overrides on their pages — not duplicate route-read gates for paths already in the registry.

**`AuthenticatedShell` component.** All authenticated routes mount inside a layout route component at `src/components/layout/AuthenticatedShell.tsx`. This component is the single place responsible for:
1. Checking auth loading state — renders `<LoadingSpinner />` while `isLoading === true` (from `useUnifiedAuth()`)
2. Checking org context — renders the "no organisation assigned" empty state if `selectedOrganisation === null` after loading resolves
3. Rendering `<PaceAppLayout>` with `<Outlet />` for all normal authenticated routes, passing **route-aware `navItems`** (empty on landing; slim in-org nav on overview and feature routes — see §5), **`enforcePermissions`**, **`routeAccessDenied`**, and **`permissionFallback`** (see §3 route guards)
4. Rendering **`OrgContextBar`** (breadcrumb region) on in-org feature routes only — not on landing or overview
5. Hosting the change-password dialog (see below)
6. Wrapping its rendered children in `<ToastProvider>` so that any descendant route or component can call the module-level `toast(...)` function from `@solvera/pace-core/components` to show success or error notifications. `ToastProvider` renders `<Toaster />` internally — `AuthenticatedShell` does not mount `<Toaster />` directly. `ToastProvider` is the outermost element returned by `AuthenticatedShell`, wrapping the `LoadingSpinner` branch, the no-org branch, and the `PaceAppLayout` + `<Outlet />` branch alike, so `toast(...)` is callable from every state the shell can render.

`AuthenticatedShell` uses `useUnifiedAuth()` to access `isLoading`, `user`, `selectedOrganisation`, `signOut`, and `updatePassword`. It derives display values as follows:
- `userFullName`: `user?.user_metadata?.full_name` if present and non-empty string; otherwise `user?.email`; otherwise `'Authenticated user'`
- `userEmail`: `user?.email ?? 'No email available'`

**Change-password dialog.** `AuthenticatedShell` owns the change-password dialog. `onUserMenuChangePassword` on `PaceAppLayout` is wired to `() => setPasswordDialogOpen(true)`. The dialog renders `PasswordChangeForm` from `@solvera/pace-core/components`. On submit, `updatePassword(newPassword)` is called (from `useUnifiedAuth()`); if `result.error != null`, the error is returned to `PasswordChangeForm` for display; on success, the dialog closes.

### Page-level guards and evaluation ordering

The landing route `/` and overview route `/orgs/:orgId` sit behind `ProtectedRoute` and `PagePermissionGuard` with `pageName="home"` and `operation="read"`. The evaluation order when context is absent is:

1. **Session restoration** — `SessionRestorationLoader` holds all content until `isRestoring === false` or restoration times out (10,000 ms default). Nothing renders before this resolves.
2. **Authentication check** — `ProtectedRoute` fires before org context or any guard. Unauthenticated users are redirected to `/login` immediately; they never reach the org check or the guard.
3. **Org context loading** — `OrganisationServiceProvider` resolves memberships. While `isLoading === true`, the authenticated shell renders a loading state; no feature content or guard is shown.
4. **No-org check** — If `selectedOrganisation === null` after org loading completes, the authenticated shell renders the "no organisation assigned" empty state. `PagePermissionGuard` is not reached; no RBAC query fires.
5. **Page permission guard** — `PagePermissionGuard` fires with org scope fully resolved. Scope is resolved internally by the guard from the `OrganisationServiceProvider` context — no scope prop is passed. While the RBAC check is in flight (`isLoading === true`), the guard returns `null` (no `loading` prop supplied); this brief blank is acceptable for TEAM.

If `selectedOrganisation` is null when the guard would otherwise evaluate (e.g. race condition), the RBAC engine evaluates with `organisationId: undefined`; the check returns pending and the guard returns `null`. In practice, the no-org check at step 4 prevents this path from being reached under normal conditions.

---

## §4 Functional specification

### Page entry

**Login page `/login`**
- Renders unconditionally — no auth check, no guard, no org check.
- Shows the TEAM logo, app name "TEAM", email field, password field, and sign-in button.
- On successful authentication, redirects to `/` (default `onSuccessRedirectPath`).
- An already-authenticated user who navigates to `/login` is redirected to `/` by `PaceLoginPage` internally.

**Authenticated shell (all authenticated routes)**
- `ProtectedRoute` wraps all authenticated routes. An unauthenticated user is redirected to `/login` with no content flash.
- `SessionRestorationLoader` renders a loading spinner until session restoration completes or times out.
- Once authenticated, `OrganisationServiceProvider` resolves org context. While resolving, the shell shows a loading state.
- If `selectedOrganisation === null` after org loading, the shell shows the "no organisation assigned" empty state inside the app chrome. No feature content renders.
- All authenticated routes are wrapped in `PaceAppLayout`, which renders the header, `PaceMain` content area, and footer.

**Organisation landing `/`**
- Requires authentication (ProtectedRoute).
- Requires org context (no-org check fires before guard).
- Requires `read` permission on the `home` page (PagePermissionGuard).
- Primary nav in header is **empty** (no Overview / Members / Communications / Reports items).
- Renders organisation picker: breadcrumb, heading ("Choose an organisation" when multiple memberships; "Your organisation" when one), subtitle, grid of org cards (initials badge, kind, name, region, role, summary stats), and rolled-up `AttentionQueue` for orgs with pending approvals.
- Selecting an org card navigates to `/orgs/:orgId` and sets org context to that organisation.

**Organisation overview `/orgs/:orgId`**
- Requires authentication, org context, and `read:page.home`.
- Uses slim in-org primary nav (Overview, Members, Communications, Reports).
- Does **not** render `OrgContextBar` (overview breadcrumb is in page content via `EntityOverview` / `PageHeader`).
- Renders `EntityOverview` pattern: hero (`HeroBadge` + org meta), KPI row, member-request `AttentionQueue`, Organisation setup launcher grid (3×2 `CardGrid` / `Card fill` navigational cards), and Events section with `EventTile` grid (see prototype; event data owned by TEAM-10).
- Header actions: Edit organisation → `/settings/organisation`; Switch organisation → `/`.

**NotFound page `*`**
- Renders within the authenticated shell for unmatched routes.
- Shows a 404 message and a primary action back to the organisation picker (`/`).
- No feature queries. No external error logging required; `console.error` with the unmatched path is acceptable.

### Loading states

- **Session restoring** — `SessionRestorationLoader` renders a centred spinner and sr-only text "Restoring session…" until restoration resolves or times out. Covers the full viewport.
- **Org loading** — while `isLoading === true` (from `useUnifiedAuth()`), `AuthenticatedShell` renders `<LoadingSpinner />` — the same full-viewport spinner component used during session restoration. `PaceAppLayout` and routes do not render until loading resolves.
- **RBAC check in flight** — `PagePermissionGuard` returns `null` during the RBAC check. Brief blank in PaceMain content area; acceptable for TEAM.

### Empty states

- **No organisation assigned** — user is authenticated but `selectedOrganisation === null` after org loading. The authenticated shell renders a message: **"No organisation assigned. Please contact your administrator."** Full-page within PaceMain. No CTA. No redirect. No feature content.
- **NotFound page** — user navigates to an unmatched route. Renders 404 heading, short message, and a "Back to organisations" link to `/`.

### Error states

- **Login — bad credentials** — `PaceLoginPage` renders an inline error message below the form. The form remains interactive.
- **Login — network / server error** — `PaceLoginPage` renders an inline error message. No redirect.
- **Permission denied on landing or overview** — `PagePermissionGuard` renders `<AccessDenied />`: "You do not have permission to view this page." Authenticated shell chrome (header, footer) remains visible.
- **Inactivity warning** — `InactivityWarningModal` appears as an overlay after 28 minutes of inactivity. Displays a countdown in seconds. Two actions: "Stay signed in" (primary) and "Sign out" (secondary). If no action is taken within 2 minutes, idle logout fires.

### Primary content — organisation landing (`/`)

- **Breadcrumb** — `pace-team` → Organisations (via `Breadcrumb`).
- **Heading** — "Choose an organisation" when the user has multiple memberships; "Your organisation" when only one.
- **Subtitle** — explains that the user administers N organisations (multi) or can open their organisation (single).
- **Org card grid** — one card per membership (`section` grid). Each card shows initials badge, org kind, display name, region, role, and summary stats (active members, units, upcoming events). Full-card click navigates to `/orgs/:orgId`.
- **Attention queue** — rolled-up items for orgs with pending join/transfer requests; click opens that org (same as picking the card).

### Primary content — organisation overview (`/orgs/:orgId`)

- **EntityOverview regions** (top to bottom): breadcrumb trail; page title + subtitle; header action row; hero band; KPI row; member-request attention queue; Organisation setup launcher grid; Events section.
- **Organisation setup launcher** — six navigational cards (prototype destinations):

| Label | Destination |
|-------|-------------|
| Organisation details | `/settings/organisation` |
| People & access | `/settings/people` |
| Member roles | `/member-roles` |
| Membership types | `/settings/membership-types` |
| Sub-organisations | `/settings/sub-orgs` |
| Forms | `/forms` |

- **Hero primary actions** — View members → `/members`; Review approvals → `/approvals`.
- **Events section** — up to six upcoming `EventTile` cards + "Browse all" → `/events` (content owned by TEAM-10; layout owned here).

### Primary actions — shell

- **Primary nav (in-org only)** — Overview, Members, Communications, Reports. Hidden on organisation landing (`/`).
- **Nav item click** — navigates to href. Overview href is `/orgs/:selectedOrganisationId`.
- **Org context selector** — allows users with multiple org memberships to switch org context. On overview, switching updates URL to `/orgs/:newId`. Provided by `PaceAppLayout` (`showOrganisations={true}`).
- **User menu — sign out** — signs out via Supabase auth, clears session, and the user is redirected to `/login`.
- **User menu — change password** — opens the change-password dialog in `AuthenticatedShell`.
- **User menu — All organisations** — navigates to `/` (organisation landing).
- **User menu — Branch settings** — navigates to `/settings/organisation`.

### Permission-conditional rendering

- **Landing and overview content** — only shown if `PagePermissionGuard pageName="home" operation="read"` passes. If denied, `AccessDenied` is shown instead.
- **Primary nav (in-org mode)** — items carry `pageId` from **`team-route-registry.ts`**; `NavigationMenu` hides items the permission map denies. Shell **`routeAccessDenied`** blocks direct navigation to disallowed registered routes.
- **Feature routes (TEAM-02+)** — route read enforced by shell map; slices add **`PagePermissionGuard`** only for mutations or scoped read where needed.

### Navigation

- Unauthenticated user on any protected route → `/login` (ProtectedRoute).
- Successful sign-in → `/` (PaceLoginPage default redirect).
- Org card pick or attention item → `/orgs/:orgId`.
- Slim nav item click → respective route.
- User with single org may land on `/` then immediately open their only card (optional pass-2 shortcut; prototype always shows landing).
- Unmatched route → `*` NotFound page.
- Sign out → `/login`.
- Idle logout → `/login`.

### Edge cases and constraints

- Session restoration timeout (10,000 ms default): if timed out, children render with whatever auth state exists; user sees login or app accordingly.
- User with multiple org memberships: first membership's org is auto-selected on load; org context selector in header allows switching.
- Navigating to an unbuilt slice route renders the NotFound page cleanly — no unhandled error.
- Inactivity countdown begins 2 minutes before the 30-minute idle threshold. If the user dismisses the modal and remains idle, the modal re-appears on the next tick cycle.

---

## §5 Visual specification

### Shell variants

**Login page**
Full-page centred card layout (`PaceLoginPage` default). TEAM logo above the form. App name "TEAM" as heading. Email, password, sign-in button stacked vertically. Error message below the button. No header, footer, or navigation.

**Organisation landing (`/`)**
Vertical stack inside `PaceMain`:
1. **Header** — logo, org context selector (when memberships exist), user menu. **No primary nav items.**
2. **PaceMain** — `PageHeader` + org card grid + optional `AttentionQueue`.
3. **PaceFooter**

**Organisation overview (`/orgs/:orgId`)**
Same header/footer as landing, but header includes **slim primary nav** (Overview, Members, Communications, Reports). No `OrgContextBar`. Main content uses `EntityOverview` composition (see Primary content §4).

**In-org feature routes** (all routes except `/`, `/orgs/:orgId`, `/login`, `*`)
1. **Header** — slim primary nav + org selector + user menu.
2. **`OrgContextBar`** — `Breadcrumb` trail: Organisations → {org display name} → {current page label}. Rendered between header and `PaceMain`.
3. **PaceMain** — slice page content.
4. **PaceFooter**

**NotFound (`*`)**
Centred content in `PaceMain`: 404 heading, one-line message, `Button` or link "Back to organisations" → `/`.

**Inactivity warning modal**
Full-viewport overlay. Centred dialog. Countdown in seconds. "Stay signed in" (primary), "Sign out" (secondary).

### Components

**`PaceLoginPage`**
- `appName="TEAM"` — logos from `/logos/team-logo-square.svg`, `/logos/team-favicon.svg`, `/logos/team-logo-wide.svg`.
- `onSuccessRedirectPath="/"` (default).

**`PaceAppLayout`**
- `appName={APP_NAME}` — `"TEAM"`.
- `navItems` — **route-aware**. Pass `[]` on `/`. Pass slim in-org array on overview and feature routes:

```ts
const inOrgNavItems: NavigationItem[] = [
  { id: 'nav-overview',      label: 'Overview',       href: `/orgs/${selectedOrganisationId}`, icon: 'LayoutDashboard', pageId: 'HomePage' },
  { id: 'nav-members',       label: 'Members',        href: '/members',                        icon: 'Users',           pageId: 'MembersPage' },
  { id: 'nav-communications', label: 'Communications', href: '/communications',               icon: 'MessageSquare',   pageId: 'CommsLogPage' },
  { id: 'nav-reports',       label: 'Reports',        href: '/reports',                        icon: 'BarChart2',       pageId: 'ReportsPage' },
];
```

`pageId` values MUST match **`team-route-registry.ts`** / `rbac_app_pages.page_name`. Registry helper: **`getTeamRoutePermissionForPath(pathname)`** for shell `routeAccessDenied`.

Approvals, Events, Forms, Moderation, and Settings are **not** in primary nav — reached from overview launcher, hero actions, user menu, or deep links (prototype IA).

- `showOrganisations={true}` — org context selector in header.
- `showEvents={false}` — TEAM is not event-scoped at shell level.
- `userFullName` / `userEmail` — derived per §3.
- `onUserMenuSignOut` — `signOut()` then navigate `/login`.
- `onUserMenuChangePassword` — opens change-password dialog.
- Optional user-menu entries (pass 2): "All organisations" → `/`; "Branch settings" → `/settings/organisation`.

**`OrgContextBar`**
- Team-local wrapper in `src/components/layout/OrgContextBar.tsx` (or equivalent).
- Uses pace-core `Breadcrumb` with trail built from org context + current page label supplied by route/slice.
- Omit on `/`, `/orgs/:orgId`, and `/login`.

**Organisation landing page**
- `PageHeader` with `Breadcrumb`.
- Org cards: `section` grid (`Card fill` or semantic button cards); multi-column when many orgs, single-column when one.
- `AttentionQueue` below grid when any org has pending approvals.

**Organisation overview page**
- `EntityOverview` from `@solvera/pace-core/components` (or composed equivalent): `HeroBadge`, KPI tiles, `AttentionQueue`, `CardGrid`/`CardGridItem` launcher section, Events `section` with `EventTile` grid.
- Launcher label: "Organisation setup".

**Navigation** — Primary nav renders inline in header per prototype (pace-core `PaceAppLayout` / CR05c); not a 12-item dropdown of all TEAM areas.

**`SessionRestorationLoader`**, **`InactivityWarningModal`**, **`LoadingSpinner`**, **`ToastProvider`**, **Change-password dialog** — unchanged from prior spec (see §5 components in build notes).

### Layout acceptance criteria (prototype alignment)

- [ ] Organisation landing renders with **empty** primary nav and org card grid.
- [ ] Organisation overview renders slim nav (Overview, Members, Communications, Reports) and Organisation setup launcher grid.
- [ ] In-org feature routes render `OrgContextBar` breadcrumb between header and main content.
- [ ] NotFound primary action returns to organisation picker (`/`), not a shortcut-tile home.
- [ ] User menu includes path back to all organisations and branch settings (prototype parity).

### Implementation delta (pass 2)

Current `pace-team2/src/` diverges from prototype layout (informational — pass 2 realigns implementation):

- `HomePage` at `/` with welcome heading and nine shortcut tiles instead of org landing + overview at `/orgs/:orgId`.
- `NAV_ITEMS` lists nine top-level areas plus Settings children in a dropdown; prototype uses slim four-item in-org nav only.
- No `OrgContextBar` component or breadcrumb region on feature routes.
- Settings routes use `/settings/org` and `/settings/organisations` instead of prototype `/settings/organisation` and `/settings/sub-orgs`.
- No user-menu shortcuts for "All organisations" or branch settings.
- [`team-architecture-requirements.md`](./team-architecture-requirements.md) route table still reflects production paths — schedule architecture doc pass after pass 2 shell work.
- QA pack (`docs/test-packs/TM01-qa-pack.md`) may still reference shortcut-tile home — update during pass 2 verification.

### States

**Login** — loading, error, success redirect to `/` (unchanged).

**Session restoring** — full-viewport `SessionRestorationLoader`.

**Org loading** — `AuthenticatedShell` renders `<LoadingSpinner />`.

**No org** — "No organisation assigned. Please contact your administrator." in PaceMain.

**Permission denied** — `AccessDenied` on landing or overview when `read:page.home` fails.

**Inactivity warning** — modal overlay with countdown (unchanged).

### Interactions

**Org card** — click navigates to `/orgs/:orgId` and selects org context.

**Launcher card** — navigates to destination route.

**Slim nav** — item click navigates; Overview returns to current org overview URL.

**Org context selector** — switches membership; on overview, updates `/orgs/:id` URL.

**User menu / change password / inactivity** — unchanged from prior spec.

### Permission-conditional rendering

| Condition | Landing / overview | Shell chrome |
|-----------|-------------------|-------------|
| Not authenticated | Redirect `/login` | Not shown |
| Authenticated, no org | Empty state message | Shown |
| Authenticated, lacks `read:page.home` | `AccessDenied` | Shown |
| Authenticated, has permission | Shown | Shown |

---

## §6 Business rules

**BR-01 — Unauthenticated redirect**
- Input: user navigates to any route other than `/login` without a valid Supabase session.
- Output: `ProtectedRoute` redirects to `/login`. No admin content is rendered.

**BR-02 — Session restoration wait**
- Input: app module loads; a Supabase session cookie or token may be present.
- Output: `SessionRestorationLoader` renders until `isRestoring === false || hasTimedOut === true`.
- Edge: default restoration timeout is 10,000 ms. On timeout, children render with whatever auth state is currently resolved — restoration is not retried.

**BR-03 — No-org empty state**
- Input: user is authenticated; `OrganisationServiceProvider` resolves; `selectedOrganisation === null` (user has no org memberships).
- Output: authenticated shell renders "No organisation assigned. Please contact your administrator." inside PaceMain. No feature queries fire. No redirect. PagePermissionGuard is not reached.

**BR-04 — Org auto-selection**
- Input: user is authenticated; user has ≥ 1 org membership.
- Output: `OrganisationServiceProvider` auto-selects the first membership's organisation on mount. `selectedOrganisation` and `selectedOrganisationId` are populated before routes render.

**BR-05 — setupRBAC ordering**
- Input: `main.tsx` module loads.
- Output: `resolveTeamAppId` is assigned from `createGetAppIdResolver(supabaseClient)`, then `setupRBAC(supabaseClient, { appName: 'TEAM', getAppId: resolveTeamAppId })` executes before any React component mounts. The RBAC engine is initialised before any `PagePermissionGuard` evaluates.

**BR-06 — Landing and overview permission check**
- Input: authenticated user with org context navigates to `/` or `/orgs/:orgId`.
- Output: `PagePermissionGuard pageName="home" operation="read"` evaluates. If permitted: page content renders. If denied: `AccessDenied` renders.

**BR-07 — Inactivity warning**
- Input: `elapsed ≥ idleTimeoutMs − warnBeforeMs` (i.e. user has been idle for ≥ 28 minutes).
- Output: `InactivityWarningModal` renders as an overlay. Countdown shows `timeRemaining` seconds.

**BR-08 — Stay signed in**
- Input: `InactivityWarningModal` is showing; user clicks "Stay signed in".
- Output: `onStaySignedIn` is called; idle timer resets to zero elapsed; modal unmounts; session continues.

**BR-09 — Idle logout**
- Input: `InactivityWarningModal` is showing and the user takes no action for `warnBeforeMs` (2 minutes).
- Output: `onIdleLogout` fires; `supabaseClient.auth.signOut()` is called; user is redirected to `/login`.

**BR-10 — Unimplemented route catch-all**
- Input: user navigates to a TEAM route whose slice has not yet been built.
- Output: the `*` route renders the NotFound page. No unhandled error is thrown. `console.error` with the unmatched path is acceptable.

---

## §7 API / Contract

### Public exports

`src/App.tsx` exports `APP_NAME = 'TEAM'` as a named constant. This is the only public export from this slice consumed by `main.tsx`.

### Read contracts

All reads in this slice are internal to pace-core2 providers:
- `OrganisationServiceProvider` reads org membership data to resolve `selectedOrganisation`. No slice-level query.
- `PagePermissionGuard` reads RBAC tables via the RBAC engine. No slice-level query.

### Write contracts

- **Sign out** — `signOut()` from `useUnifiedAuth()` in `AuthenticatedShell` (user menu); `supabaseClient.auth.signOut()` directly in `onIdleLogout` callback in `main.tsx` (module-level, hooks unavailable). Both clear the Supabase session. No TEAM-specific contract.
- **Change password** — `updatePassword(newPassword: string)` from `useUnifiedAuth()`. Returns `{ error?: AuthError }`. On `error != null`: return result to `PasswordChangeForm` for inline display. On success: close dialog. No redirect.

### Cross-slice handoffs

- TEAM-01 provides the shell (providers + layout) inside which all other slices render their routes.
- Sibling slices (TEAM-02 through TEAM-13) add their routes to the App router and define their own `PagePermissionGuard` configurations. No explicit handoff contract — context is shared via pace-core2 providers.

### ID contracts

None — TEAM-01 does not expose or consume typed entity IDs.

---

## §8 Data and schema references

### Tables accessed (via pace-core2 providers)

| Table | Access | Via |
|-------|--------|-----|
| `core_organisations` | Read | `OrganisationServiceProvider` |
| `rbac_apps` | Read | RBAC engine (setupRBAC) |
| `rbac_app_pages` | Read | RBAC engine (PagePermissionGuard) |
| `rbac_organisation_roles` | Read | RBAC engine (permission resolution) |

### Dev-db catalogue snapshot (historic capture preview dev ref; MCP `execute_sql` uses `yihzsfcceciimdoiibif` — [`npm run mcp:verification`](../../package.json))

- Confirm `rbac_apps` row: `name = 'TEAM'`, `is_active = true`.
- Confirm or note absence of `rbac_app_pages` row for `pageName = 'home'` and `app_id` matching TEAM. Absence during early build is expected — do not invent a workaround or substitute local permission logic.

### Post-build RBAC seeding reminder

After TEAM-01 (and all slices) are built and before release, the following `rbac_app_pages` rows must be added for the TEAM app. All rows use `scope_type = 'organisation'`.

| `page_name` | Owning slice |
|-------------|-------------|
| `home` | TEAM-01 |
| `members` | TEAM-02, TEAM-03 |
| `member-roles` | TEAM-04 |
| `approvals` | TEAM-05 |
| `membership-types` | TEAM-06 |
| `organisations` | TEAM-07 |
| `org-settings` | TEAM-08 |
| `forms` | TEAM-09 |
| `events` | TEAM-10 |
| `reports` | TEAM-11 |
| `moderation-photos` | TEAM-12 |

**PUMP-owned (do not seed under TEAM):** `/communications` uses `comms-log` registered under `data_get_app_id('PUMP')`. TEAM-13 consumes that page key; org-admin grants come from TEAM-DB-017 on the PUMP catalogue row.

Existing legacy rows (`Activities`, `dashboard`, `Dashboard`, `Members`, `Reports`, `team-crm`, `team-relationships`) must be removed at the same time.

### Domain references

- `pace-core2/packages/core/docs/requirements/CR03-auth-and-context.md` — provider wiring contract; inactivity MUST requirement; `OrganisationServiceProvider` explicit `user` + `session` props
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` usage: `pageName` + `operation`; no `scope` prop; no `useCan` at page level
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout` and `NavigationMenu` dropdown contract; `navItems` shape
- `pace-core2/packages/core/docs/requirements/CR08-advanced-ui.md` — `InactivityWarningModal` contract

---

## §9 pace-core2 imports

### §9.1 Imports table

| Symbol | Import path | One-line why |
|--------|-------------|--------------|
| `UnifiedAuthProvider` | `@solvera/pace-core` | Root auth provider; inactivity config entry point |
| `InactivityWarningModal` | `@solvera/pace-core/components` | Rendered by `renderInactivityWarning` callback in `main.tsx` |
| `LoadingSpinner` | `@solvera/pace-core/components` | Full-viewport spinner in `AuthenticatedShell` during auth/org loading |
| `PaceLoginPage` | `@solvera/pace-core/components` | Login surface |
| `PaceAppLayout` | `@solvera/pace-core/components` | App chrome — header, PaceMain, footer |
| `ProtectedRoute` | `@solvera/pace-core/components` | Redirects unauthenticated users to `/login` |
| `SessionRestorationLoader` | `@solvera/pace-core/components` | Loading state during Supabase session restoration |
| `PasswordChangeForm` | `@solvera/pace-core/components` | Form inside change-password dialog |
| `Dialog` | `@solvera/pace-core/components` | Change-password dialog root |
| `DialogBody` | `@solvera/pace-core/components` | Change-password dialog body wrapper |
| `DialogContent` | `@solvera/pace-core/components` | Change-password dialog content panel |
| `DialogHeader` | `@solvera/pace-core/components` | Change-password dialog header |
| `DialogTitle` | `@solvera/pace-core/components` | Change-password dialog title ("Change password") |
| `OrganisationServiceProvider` | `@solvera/pace-core/providers` | Org context provider; requires explicit `user` + `session` |
| `useUnifiedAuthContext` | `@solvera/pace-core/providers` | Called in `AppProviders` bridge to extract `user` + `session` |
| `setupRBAC` | `@solvera/pace-core/rbac` | Initialise RBAC engine at module level before root render |
| `PagePermissionGuard` | `@solvera/pace-core/rbac` | Page-level guard on `/` and `/orgs/:orgId` landing/overview read |
| `useShellRouteAccessDenied` | `@solvera/pace-core/rbac` | Shell route read denial from `team-route-registry` map |
| `AccessDenied` | `@solvera/pace-core/rbac` | Fallback when shell route or page guard denies access |
| `usePaceMain` | `@solvera/pace-core/hooks` | Configures shell metadata (title, print orientation) from page components |
| `useUnifiedAuth` | `@solvera/pace-core/hooks` | Auth + org context in `AuthenticatedShell`; provides `isLoading`, `user`, `selectedOrganisation`, `signOut`, `updatePassword` |
| `NavigationItem` | `@solvera/pace-core/components` | Type for `navItems` array |
| `ToastProvider` | `@solvera/pace-core/components` | Mounted by `AuthenticatedShell`; establishes toast context and renders `<Toaster />` internally so any slice can call `toast(...)` |
| `Toaster` | `@solvera/pace-core/components` | Rendered by `ToastProvider`; not imported directly by `AuthenticatedShell`. Listed for downstream slices that may render it in tests or storybook contexts |
| `toast` | `@solvera/pace-core/components` | Module-level function — `(props: { title?, description?, variant?: 'default' \| 'destructive' \| 'success', action?, duration? }) => string`. Throws if called outside `ToastProvider` |

### §9.2 Slice-specific caveats

**`OrganisationServiceProvider` wiring.** This provider requires `user` and `session` as explicit props — it does not read from `UnifiedAuthProvider` context automatically. The `AppProviders` bridge component (defined in `main.tsx`, not exported) must call `useUnifiedAuthContext()` and pass the returned values. Reference pattern from pace-base2:

```tsx
function AppProviders() {
  const { user, session } = useUnifiedAuthContext();
  return (
    <OrganisationServiceProvider supabaseClient={supabaseClient} user={user} session={session}>
      <App />
    </OrganisationServiceProvider>
  );
}
```

**`onIdleLogout`.** This prop is a module-level callback, not called inside a component. Call `supabaseClient.auth.signOut()` directly (as a void-wrapped Promise). Do not attempt to call a `signOut` function from a hook — hooks cannot be used here.

**`renderInactivityWarning`.** The callback receives `{ timeRemaining, onStaySignedIn, onSignOutNow }`. Render `<InactivityWarningModal isOpen timeRemaining={timeRemaining} onStaySignedIn={onStaySignedIn} onSignOutNow={onSignOutNow} />`. `isOpen` is always `true` when the render function is called (the provider mounts/unmounts the modal by calling/not calling the render function).

**`AuthenticatedShell` responsibilities.** All of the following must live in `src/components/layout/AuthenticatedShell.tsx` and nowhere else: the `isLoading` spinner check, the no-org empty state check, the `PaceAppLayout` render with `<Outlet />`, and the change-password dialog. Do not scatter these across `App.tsx`, page components, or `main.tsx`.

**`userFullName` derivation.** Read from `useUnifiedAuth().user`. Derive as: `user?.user_metadata?.full_name` if it is a non-empty string; otherwise `user?.email`; otherwise `'Authenticated user'`. Do not pass a raw user object to `PaceAppLayout`.

**`onUserMenuSignOut`.** Call `signOut()` from `useUnifiedAuth()` (hook-based, inside component), then `navigate('/login', { replace: true })`. This differs from `onIdleLogout` in `main.tsx` which uses `supabaseClient.auth.signOut()` directly because hooks are unavailable there.

**`updatePassword`.** Returned by `useUnifiedAuth()`. Signature: `(newPassword: string) => Promise<{ error?: AuthError }>`. Return the full result object to `PasswordChangeForm`'s `onSubmit` handler — do not swallow errors.

**Import sub-paths.** Verify that `@solvera/pace-core/components`, `/providers`, `/rbac`, and `/hooks` resolve correctly during `npm run validate`. If any sub-path fails to resolve, escalate before proceeding — do not fall back to root barrel imports or internal `packages/core/src/*` paths.

---

## §10 Permission and access rules

### Page-level guards

| Route | `pageName` | `operation` | Fallback | Notes |
|-------|-----------|------------|---------|-------|
| `/` | `home` | `read` | `<AccessDenied />` | Landing; also in shell route registry |
| `/orgs/:orgId` | `home` | `read` | `<AccessDenied />` | Overview; also in shell route registry |

All other TEAM routes: shell **read** via **`team-route-registry.ts`** + **`useShellRouteAccessDenied`**. TEAM-02 through TEAM-13 add **`PagePermissionGuard`** only for **mutations** or **scoped read** on their pages.

### Access rules

- `PagePermissionGuard` resolves scope internally from `OrganisationServiceProvider` context. No `scope` prop is passed.
- A user must be authenticated before any guard fires (`ProtectedRoute` fires first).
- A user must have org context before any guard fires (no-org check fires before the guard; see §3 evaluation ordering).
- Users denied `read:page.home` see `AccessDenied` within the authenticated shell; the header and footer remain visible.
- Primary nav items without read permission are hidden by `NavigationMenu` map filtering; direct URL access to a registered route without read shows shell `AccessDenied`.
- Do **not** use **`NavigationGuard`** — removed from pace-core.

---

## §11 Acceptance criteria

- [x] **AC-01 — Unauthenticated redirect**

Given a user is not authenticated, when they navigate to `/`, then they are redirected to `/login` and no TEAM admin content is visible.

- [x] **AC-02 — Successful login**

Given a user on `/login` enters valid credentials, when they submit the sign-in form, then they are authenticated and redirected to `/`.

- [x] **AC-03 — Login error — bad credentials**

Given a user on `/login` enters invalid credentials, when they submit the sign-in form, then an inline error message is displayed and no redirect occurs.

- [ ] **AC-04 — Organisation landing — authenticated with org**

Given a user is authenticated and has at least one org membership, when they navigate to `/`, then the organisation landing renders org cards and empty primary nav within the app chrome.

- [ ] **AC-04b — Organisation overview**

Given a user picks an organisation or navigates to `/orgs/:orgId`, when the overview loads, then slim primary nav, KPI row, Organisation setup launcher, and Events section regions render per prototype layout.

- [ ] **AC-04c — OrgContextBar on feature routes**

Given a user navigates to an in-org feature route (e.g. `/members`), when the page renders, then `OrgContextBar` shows breadcrumb Organisations → org name → page label between header and main content.

- [x] **AC-05 — No organisation assigned**

Given a user is authenticated but has no org membership, when they navigate to any authenticated route, then the shell renders "No organisation assigned. Please contact your administrator." and no feature content is visible.

- [ ] **AC-06 — Permission denied on landing or overview**

Given a user is authenticated with an org but lacks `read:page.home` permission, when they navigate to `/` or `/orgs/:orgId`, then `AccessDenied` is displayed within PaceMain and the header and footer remain visible.

- [x] **AC-07 — Session restoration**

Given a user has a valid session token, when the app loads, then `SessionRestorationLoader` shows a loading spinner until restoration completes, after which the user sees the app without re-entering credentials.

- [ ] **AC-08 — Inactivity warning appears**

Given a user has been idle for 28 minutes (30-minute timeout minus 2-minute warning), when the idle timer fires, then `InactivityWarningModal` appears with a visible countdown in seconds.

- [ ] **AC-09 — Stay signed in**

Given `InactivityWarningModal` is showing, when the user clicks "Stay signed in", then the modal closes, the idle timer resets, and the session continues.

- [ ] **AC-10 — Idle logout**

Given `InactivityWarningModal` is showing and the user takes no action for 2 minutes, when the warning period expires, then the user is signed out and redirected to `/login`.

- [x] **AC-11 — Catch-all for unbuilt route**

Given a user navigates to a route not yet implemented (e.g. `/events` before the slice is built), when they arrive, then the NotFound page renders without an unhandled error.

- [x] **AC-12 — App chrome on all authenticated pages**

Given a user is authenticated with org context, when they view any authenticated route, then the TEAM logo, navigation menu trigger, org context selector, and user menu are visible in the header.

- [ ] **AC-13 — Slim in-org nav (RBAC-gated)**

Given a user is on an in-org route (overview or feature page), when they view the header, then primary nav shows Overview, Members, Communications, and Reports only when the permission map grants read for each item's `pageId` — not Approvals, Events, Forms, Moderation, or Settings.

- [x] **AC-14 — Sign out**

Given a user is authenticated, when they sign out via the user menu, then their session is cleared and they are redirected to `/login`.

- [ ] **AC-15 — Change password — success**

Given a user is authenticated and opens the change-password dialog via the user menu, when they submit a valid new password, then the password is updated and the dialog closes with no redirect.

- [ ] **AC-16 — Change password — error**

Given a user is authenticated and opens the change-password dialog, when they submit a password that fails validation (e.g. too short), then an inline error message is displayed within the form and the dialog remains open.

- [x] **AC-17 — `npm run validate` passes**

Given the TEAM-01 implementation is complete, when `npm run validate` runs, then it exits with code 0 with no TypeScript errors and no lint errors.

- [ ] **AC-18 — Toast notifications mountable from any authenticated route**

Given a user is authenticated and inside the `AuthenticatedShell`, when any descendant component calls `toast({ title, description, variant })` from `@solvera/pace-core/components`, then a notification renders as an overlay anchored to the bottom-right of the viewport without throwing a "must be called within a ToastProvider" error, and the notification auto-dismisses after its `duration` (default 5000 ms).

---

## §12 Verification

- Confirm `createGetAppIdResolver`, `resolveTeamAppId`, and `setupRBAC(supabaseClient, { appName: APP_NAME, getAppId: resolveTeamAppId })` appear at module level in `main.tsx`, not inside a component, hook, or effect.
- Confirm `APP_NAME` is exported from `src/App.tsx` and imported (not redeclared) in `main.tsx`.
- Confirm `AppProviders` bridge calls `useUnifiedAuthContext()` and passes `user` and `session` to `OrganisationServiceProvider` — not sourced from any other mechanism.
- Confirm `AuthenticatedShell` is implemented as a React Router layout route (renders `<Outlet />`), located at `src/components/layout/AuthenticatedShell.tsx`.
- Confirm `AuthenticatedShell` checks `isLoading` first (renders `<LoadingSpinner />`), then checks `selectedOrganisation === null` (renders no-org message), before rendering `<PaceAppLayout>`.
- Confirm change-password dialog is defined in `AuthenticatedShell` and wired to `onUserMenuChangePassword`.
- Confirm `EventServiceProvider` is absent from the provider stack.
- Confirm `AuthenticatedShell` passes **`enforcePermissions`**, **`routeAccessDenied={useShellRouteAccessDenied(getTeamRoutePermissionForPath)}`**, and **`permissionFallback={<AccessDenied />}`** to `PaceAppLayout`.
- Confirm **`src/lib/navigation/team-route-registry.ts`** registers all authenticated TEAM routes and exports **`getTeamRoutePermissionForPath`**.
- Confirm slim in-org `navItems` (Overview, Members, Communications, Reports) with **`pageId`** and empty nav on `/`.
- Confirm `OrgContextBar` renders on in-org feature routes and is omitted on `/` and `/orgs/:orgId`.
- Confirm organisation landing and overview routes exist (`/`, `/orgs/:orgId`).
- Confirm `/logos/team-logo-square.svg`, `/logos/team-favicon.svg`, and `/logos/team-logo-wide.svg` exist in the public directory. If absent, note as a known asset gap and raise with the product team — do not block build on this.
- Against MCP verification project (`yihzsfcceciimdoiibif`; [`npm run mcp:verification`](../../package.json); [`docs/delivery/mcp-verification-preflight-queries.md`](../delivery/mcp-verification-preflight-queries.md)): confirm `rbac_apps` row `name = 'TEAM'` is active.

---

## §13 Testing requirements

n/a — standard PDLC quality gates apply.

---

## §14 Build execution rules

- `APP_NAME` must be declared as `export const APP_NAME = 'TEAM'` in `src/App.tsx`. Import it in `main.tsx`. Do not redeclare it elsewhere.
- `setupRBAC` must be called at module level in `main.tsx`, before `createRoot(...)`, with `getAppId` provided via `resolveTeamAppId` from `createGetAppIdResolver(supabaseClient)`. Not inside a component, hook, or effect.
- `AppProviders` bridge is defined in `main.tsx`. Do not create a separate file for it. Do not export it.
- `AuthenticatedShell` is created at `src/components/layout/AuthenticatedShell.tsx`. It is used as a React Router layout route (renders `<Outlet />`). It is the only component that checks `isLoading`, the no-org state, and hosts the change-password dialog. Do not implement any of these checks in `App.tsx`, individual page components, or `main.tsx`.
- Do not add `EventServiceProvider` — TEAM is not event-scoped.
- Do not pass a `scope` prop to `PagePermissionGuard`.
- Do not use `useCan` for page-level route protection — `PagePermissionGuard` only.
- Do not import from internal `packages/core/src/*` paths — use published sub-paths only.

---

## §15 Done criteria

- All 18 acceptance criteria (AC-01 through AC-18) verified via the QA pack (`docs/test-packs/TM01-qa-pack.md`).
- `@solvera/pace-core` sub-path imports (`/components`, `/providers`, `/rbac`, `/hooks`) confirmed resolving in `npm run validate` output.
- Post-build RBAC seeding reminder documented in the QA pack: 12 canonical `rbac_app_pages` rows to be added and 7 legacy rows to be removed before release.

---

## §16 Do not

- Do not use a single flat home page with nine shortcut tiles as the TEAM landing IA — use organisation landing + overview (prototype model).
- Do not put Approvals, Events, Forms, Moderation, or Settings in primary header nav — use overview launcher and deep links.
- Do not fetch feature-domain detail on landing beyond org-card summary stats and rolled-up attention counts; overview KPIs/attention/events are shell-level summaries only (detail queries stay in owning slices).
- Do not add `EventServiceProvider` to the provider stack.
- Do not implement **`NavigationGuard`** — use map-first nav (`pageId` on items) and shell **`routeAccessDenied`** instead.
- Do not add duplicate **`PagePermissionGuard pageName operation='read'`** on routes already covered by **`team-route-registry.ts`** unless the page requires scoped-read override.
- Do not add `team_unit` usage.
- Do not add participant-facing routes.
- Do not add a debug RBAC panel or any RBAC diagnostics UI.
- Do not implement custom auth guards or permission logic — use `ProtectedRoute` and `PagePermissionGuard` from `@solvera/pace-core` exclusively.
- Do not import from internal `packages/core/src/*` paths.

---

## §17 References

- [`team-project-brief-requirements.md`](./team-project-brief-requirements.md) — scope boundaries, admin-only mandate
- [`team-architecture-requirements.md`](./team-architecture-requirements.md) — provider stack, route map (pass-2 realignment pending)
- `pace-prototype/apps/pace-team/app.jsx` — routing, `NAV_ITEMS`, shell chrome
- `pace-prototype/apps/pace-team/pages/OrganisationPages.jsx` — `OrgLandingPage`, `OrgOverviewPage`, `OrgContextBar`
- `pace-core2/packages/core/docs/requirements/CR03-auth-and-context.md` — `UnifiedAuthProvider` wiring; inactivity MUST; `OrganisationServiceProvider` explicit props
- `pace-core2/packages/core/docs/requirements/CR04-rbac.md` — `PagePermissionGuard` API; no `scope` prop; no `useCan` at page level
- `pace-core2/packages/core/docs/requirements/CR05c-layout-and-shell.md` — `PaceAppLayout`; `NavigationMenu` dropdown contract; `navItems` shape
- `pace-core2/packages/core/docs/requirements/CR08-advanced-ui.md` — `InactivityWarningModal` contract
