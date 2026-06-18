import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import type { Organisation } from '@solvera/pace-core/types';
import { PaceLoginPage, ProtectedRoute } from '@solvera/pace-core/components';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { AuthenticatedShell } from './components/layout/AuthenticatedShell';
import { MemberDirectoryPage } from './pages/members/MemberDirectoryPage';
import { MemberInvitePage } from './pages/members/MemberInvitePage';
import { Member360Page } from './pages/members/Member360Page';
import { MemberRolesPage } from './pages/members/MemberRolesPage';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage';
import { ApprovalsLegacyRedirectPage } from './pages/approvals/ApprovalsLegacyRedirectPage';
import { MembershipTypesPage } from './pages/settings/MembershipTypesPage';
import { OrganisationSettingsPage } from './pages/settings/OrganisationSettingsPage';
import { SubOrganisationsPage } from './pages/settings/SubOrganisationsPage';
import { CommunicationsPage } from './pages/communications/CommunicationsPage';
import { CommunicationsLogPage } from './pages/communications/CommunicationsLogPage';
import { FormsListPage } from './pages/forms/FormsListPage';
import { FormAuthoringPage } from './pages/forms/FormAuthoringPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { PhotoModerationPage } from './pages/moderation/PhotoModerationPage';
import { EventsListPage } from './pages/events/EventsListPage';
import { EventDetailPage } from './pages/events/EventDetailPage';
import { EventNewPage } from './pages/events/EventNewPage';
import { OrgLandingPage, pickOrganisation } from './pages/shell/OrgLandingPage';
import { OrgOverviewPage } from './pages/shell/OrgOverviewPage';
import { MemberRolesPlaceholderPage } from './pages/members/MemberRolesPlaceholderPage';
import { SettingsPeoplePage } from './pages/settings/SettingsPeoplePage';

export const APP_NAME = 'TEAM';

function OrgLandingRoute() {
  const navigate = useNavigate();
  const { switchOrganisation } = useUnifiedAuth();

  return (
    <OrgLandingPage
      onPickOrganisation={(org: Organisation) => pickOrganisation(org, switchOrganisation, navigate)}
    />
  );
}

function NotFoundPage() {
  usePaceMain({ printTitle: 'Not Found', ariaLabel: 'Page not found' });

  return (
    <main className="grid min-h-[60vh] place-items-center">
      <section className="grid gap-3 justify-items-center">
        <h1>404</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/">Back to organisations</Link>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PaceLoginPage appName={APP_NAME} />} />
      <Route element={<ProtectedRoute loginPath="/login" />}>
        <Route element={<AuthenticatedShell appName={APP_NAME} />}>
          <Route index element={<OrgLandingRoute />} />
          <Route path="orgs/:orgId" element={<OrgOverviewPage />} />
          <Route path="members" element={<MemberDirectoryPage />} />
          <Route path="members/invite" element={<MemberInvitePage />} />
          <Route path="members/:memberId" element={<Member360Page />} />
          <Route path="members/:memberId/roles" element={<MemberRolesPage />} />
          <Route
            path="member-roles"
            element={<MemberRolesPlaceholderPage />}
          />
          <Route
            path="approvals"
            element={(
              <PagePermissionGuard pageName={PAGE_NAMES.approvals} operation="read" fallback={<AccessDenied />}>
                <ApprovalsPage />
              </PagePermissionGuard>
            )}
          />
          <Route
            path="approvals/:requestId"
            element={(
              <PagePermissionGuard pageName={PAGE_NAMES.approvals} operation="read" fallback={<AccessDenied />}>
                <ApprovalsLegacyRedirectPage />
              </PagePermissionGuard>
            )}
          />
          <Route path="communications" element={<CommunicationsPage />} />
          <Route path="communications/log" element={<CommunicationsLogPage />} />
          <Route path="events" element={<EventsListPage />} />
          <Route path="events/new" element={<EventNewPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="forms/new" element={<FormAuthoringPage />} />
          <Route path="forms/:formId" element={<FormAuthoringPage />} />
          <Route path="forms" element={<FormsListPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="moderation/photos" element={<PhotoModerationPage />} />
          <Route path="settings/membership-types" element={<MembershipTypesPage />} />
          <Route path="settings/organisations" element={<SubOrganisationsPage />} />
          <Route path="settings/sub-orgs" element={<SubOrganisationsPage />} />
          <Route path="settings/org" element={<OrganisationSettingsPage />} />
          <Route path="settings/organisation" element={<OrganisationSettingsPage />} />
          <Route path="settings/people" element={<SettingsPeoplePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
