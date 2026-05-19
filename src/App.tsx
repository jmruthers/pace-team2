import { Link, Route, Routes } from 'react-router-dom';
import type { NavigationItem } from '@solvera/pace-core/components';
import { Card, CardContent, CardHeader, CardTitle, PaceLoginPage, ProtectedRoute } from '@solvera/pace-core/components';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { AuthenticatedShell } from './components/layout/AuthenticatedShell';
import { MemberDirectoryPage } from './pages/members/MemberDirectoryPage';
import { Member360Page } from './pages/members/Member360Page';
import { MemberRolesPage } from './pages/members/MemberRolesPage';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage';
import { MembershipTypesPage } from './pages/settings/MembershipTypesPage';
import { OrganisationSettingsPage } from './pages/settings/OrganisationSettingsPage';
import { SubOrganisationsPage } from './pages/settings/SubOrganisationsPage';
import { CommunicationsPage } from './pages/communications/CommunicationsPage';
import { FormsListPage } from './pages/forms/FormsListPage';
import { FormAuthoringPage } from './pages/forms/FormAuthoringPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { PhotoModerationPage } from './pages/moderation/PhotoModerationPage';
export const APP_NAME = 'TEAM';

const NAV_ITEMS: NavigationItem[] = [
  { id: 'home', label: 'Home', href: '/', icon: 'Home' },
  { id: 'members', label: 'Members', href: '/members', icon: 'Users' },
  { id: 'approvals', label: 'Approvals', href: '/approvals', icon: 'ClipboardCheck' },
  { id: 'events', label: 'Events', href: '/events', icon: 'Calendar' },
  { id: 'communications', label: 'Communications', href: '/communications', icon: 'MessageSquare' },
  { id: 'forms', label: 'Forms', href: '/forms', icon: 'FileText' },
  { id: 'reports', label: 'Reports', href: '/reports', icon: 'BarChart2' },
  { id: 'moderation', label: 'Moderation', href: '/moderation/photos', icon: 'Shield' },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    children: [
      { id: 'settings-membership-types', label: 'Membership Types', href: '/settings/membership-types' },
      { id: 'settings-organisations', label: 'Organisations', href: '/settings/organisations' },
      { id: 'settings-org', label: 'Organisation settings', href: '/settings/org' },
    ],
  },
];

type ShortcutIconName =
  | 'Home'
  | 'Users'
  | 'ClipboardCheck'
  | 'Calendar'
  | 'MessageSquare'
  | 'FileText'
  | 'BarChart2'
  | 'Shield'
  | 'Settings';

type HomeShortcut = { label: string; href: string; icon: ShortcutIconName };

const HOME_SHORTCUTS: HomeShortcut[] = [
  { label: 'Home', href: '/', icon: 'Home' },
  { label: 'Members', href: '/members', icon: 'Users' },
  { label: 'Approvals', href: '/approvals', icon: 'ClipboardCheck' },
  { label: 'Events', href: '/events', icon: 'Calendar' },
  { label: 'Communications', href: '/communications', icon: 'MessageSquare' },
  { label: 'Forms', href: '/forms', icon: 'FileText' },
  { label: 'Reports', href: '/reports', icon: 'BarChart2' },
  { label: 'Moderation', href: '/moderation/photos', icon: 'Shield' },
  { label: 'Settings', href: '/settings/membership-types', icon: 'Settings' },
];

function ShortcutIcon({ name }: { name: ShortcutIconName }) {
  const iconPathByName: Record<ShortcutIconName, string> = {
    Home: 'M3 10.5L12 3l9 7.5V21h-6.75v-6.75h-4.5V21H3v-10.5z',
    Users: 'M7.5 11.25a3 3 0 100-6 3 3 0 000 6zm9 0a3 3 0 100-6 3 3 0 000 6zM3 20.25c0-2.625 2.625-4.5 4.5-4.5s4.5 1.875 4.5 4.5M12 20.25c0-2.625 2.625-4.5 4.5-4.5S21 17.625 21 20.25',
    ClipboardCheck: 'M9 3.75h6l.75 1.5H18A2.25 2.25 0 0120.25 7.5v11.25A2.25 2.25 0 0118 21H6A2.25 2.25 0 013.75 18.75V7.5A2.25 2.25 0 016 5.25h2.25L9 3.75zm1.5 9.75l2.25 2.25 4.5-4.5',
    Calendar: 'M6 3v3M18 3v3M3.75 9h16.5M5.25 5.25h13.5A1.5 1.5 0 0120.25 6.75v12A1.5 1.5 0 0118.75 20.25H5.25a1.5 1.5 0 01-1.5-1.5v-12a1.5 1.5 0 011.5-1.5z',
    MessageSquare: 'M4.5 5.25h15A1.5 1.5 0 0121 6.75v9A1.5 1.5 0 0119.5 17.25H9l-4.5 3v-3H4.5A1.5 1.5 0 013 15.75v-9A1.5 1.5 0 014.5 5.25z',
    FileText: 'M7.5 3.75h6l3 3v13.5H7.5A1.5 1.5 0 016 18.75V5.25a1.5 1.5 0 011.5-1.5zm3.75 6h4.5m-7.5 3h7.5m-7.5 3h7.5',
    BarChart2: 'M4.5 20.25V12m6 8.25V7.5m6 12.75v-9m-12 0h15.75',
    Shield: 'M12 3.75l7.5 3v5.25c0 4.5-3 7.5-7.5 8.25-4.5-.75-7.5-3.75-7.5-8.25V6.75l7.5-3z',
    Settings: 'M12 8.25A3.75 3.75 0 1112 15.75 3.75 3.75 0 0112 8.25zm0-5.25l1.2 2.4 2.64.39.39 2.64 2.4 1.2-1.5 2.25 1.5 2.25-2.4 1.2-.39 2.64-2.64.39L12 21l-1.2-2.4-2.64-.39-.39-2.64-2.4-1.2 1.5-2.25-1.5-2.25 2.4-1.2.39-2.64 2.64-.39L12 3z',
  };

  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={iconPathByName[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomePage() {
  usePaceMain({ printTitle: 'Home', ariaLabel: 'TEAM home' });
  const { selectedOrganisation } = useUnifiedAuth();
  const organisationName = selectedOrganisation?.display_name || selectedOrganisation?.name || 'Organisation';

  return (
    <main>
      <section className="grid gap-6">
        <header>
          <h1>Welcome to TEAM</h1>
          <p>{organisationName}</p>
        </header>
        <article className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="TEAM navigation shortcuts">
          {HOME_SHORTCUTS.map((shortcut) => {
            return (
            <Link
              key={shortcut.label}
              to={shortcut.href}
              className="block transition duration-150 hover:-translate-y-0.5 active:translate-y-0.5"
            >
              <Card>
                <CardHeader className="grid gap-1">
                  <ShortcutIcon name={shortcut.icon} />
                  <CardTitle>{shortcut.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Open {shortcut.label}</p>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </article>
      </section>
    </main>
  );
}

function NotFoundPage() {
  usePaceMain({ printTitle: 'Not Found', ariaLabel: 'Page not found' });

  return (
    <main className="grid min-h-[60vh] place-items-center">
      <section className="grid gap-3 justify-items-center">
        <h1>404</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/">Go to home</Link>
      </section>
    </main>
  );
}



function App() {
  return (
    <Routes>
      <Route path="/login" element={<PaceLoginPage appName={APP_NAME} />} />
      <Route element={<ProtectedRoute loginPath="/login" />}>
        <Route element={<AuthenticatedShell appName={APP_NAME} navItems={NAV_ITEMS} />}>
          <Route
            index
            element={(
              <PagePermissionGuard pageName="home" operation="read" fallback={<AccessDenied />}>
                <HomePage />
              </PagePermissionGuard>
            )}
          />
          <Route
            path="members"
            element={<MemberDirectoryPage />}
          />
          <Route
            path="members/:memberId"
            element={<Member360Page />}
          />
          <Route
            path="members/:memberId/roles"
            element={<MemberRolesPage />}
          />
          <Route
            path="approvals"
            element={(
              <PagePermissionGuard pageName="approvals" operation="read" fallback={<AccessDenied />}>
                <ApprovalsPage />
              </PagePermissionGuard>
            )}
          />
          <Route
            path="approvals/:requestId"
            element={(
              <PagePermissionGuard pageName="approvals" operation="read" fallback={<AccessDenied />}>
                <ApprovalsPage />
              </PagePermissionGuard>
            )}
          />
          <Route
            path="communications"
            element={<CommunicationsPage />}
          />
          <Route
            path="forms/new"
            element={<FormAuthoringPage />}
          />
          <Route
            path="forms/:formId"
            element={<FormAuthoringPage />}
          />
          <Route path="forms" element={<FormsListPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="moderation/photos" element={<PhotoModerationPage />} />
          <Route
            path="settings/membership-types"
            element={<MembershipTypesPage />}
          />
          <Route
            path="settings/organisations"
            element={<SubOrganisationsPage />}
          />
          <Route
            path="settings/org"
            element={<OrganisationSettingsPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
