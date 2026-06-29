import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  LoadingSpinner,
  PaceAppLayout,
  PasswordChangeForm,
  ToastProvider,
} from '@solvera/pace-core/components';
import type { NavigationItem, UserMenuExtraAction } from '@solvera/pace-core/components';
import { AccessDenied, useShellRouteAccessDenied } from '@solvera/pace-core/rbac';
import { useUnifiedAuth } from '@solvera/pace-core/hooks';
import { getTeamRoutePermissionForPath } from '@/lib/navigation/team-route-registry';
import { OrgContextBar } from '@/components/layout/OrgContextBar';
import {
  buildInOrgNavItems,
  isOrganisationLandingPath,
  resolveInOrgPageLabel,
  shouldShowOrgContextBar,
} from '@/lib/shell/inOrgNav';

interface AuthenticatedShellProps {
  appName: string;
}

export function AuthenticatedShell({ appName }: AuthenticatedShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isLoading,
    user,
    selectedOrganisation,
    selectedOrganisationId,
    signOut,
    updatePassword,
  } = useUnifiedAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const routeAccessDenied = useShellRouteAccessDenied(getTeamRoutePermissionForPath);

  const navItems = useMemo((): NavigationItem[] => {
    if (isOrganisationLandingPath(location.pathname)) {
      return [];
    }
    if (selectedOrganisationId == null) {
      return [];
    }
    return buildInOrgNavItems(selectedOrganisationId);
  }, [location.pathname, selectedOrganisationId]);

  const orgContextLabel = useMemo(() => resolveInOrgPageLabel(location.pathname), [location.pathname]);
  const showOrgContextBar = shouldShowOrgContextBar(location.pathname) && selectedOrganisation != null && orgContextLabel != null;

  const extraMenuActions = useMemo((): UserMenuExtraAction[] => {
    return [
      {
        id: 'all-organisations',
        label: 'All organisations',
        onSelect: () => navigate('/'),
      },
      {
        id: 'branch-settings',
        label: 'Branch settings',
        onSelect: () => navigate('/settings/organisation'),
      },
    ];
  }, [navigate]);

  useEffect(() => {
    const overviewMatch = /^\/orgs\/([^/]+)\/?$/u.exec(location.pathname);
    if (
      overviewMatch != null
      && selectedOrganisationId != null
      && overviewMatch[1] !== selectedOrganisationId
    ) {
      navigate(`/orgs/${selectedOrganisationId}`, { replace: true });
    }
  }, [location.pathname, navigate, selectedOrganisationId]);

  const userFullName = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name;
    if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
      return metadataName;
    }
    if (typeof user?.email === 'string' && user.email.trim().length > 0) {
      return user.email;
    }
    return 'Authenticated user';
  }, [user]);

  const userEmail = user?.email ?? 'No email available';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const passwordDialog = (
    <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <PasswordChangeForm
            onSubmit={async ({ newPassword }) => updatePassword(newPassword)}
            onSuccess={() => setPasswordDialogOpen(false)}
            onCancel={() => setPasswordDialogOpen(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <ToastProvider>
        <main className="grid min-h-screen place-items-center">
          <LoadingSpinner label="Loading authenticated shell" />
        </main>
      </ToastProvider>
    );
  }

  if (selectedOrganisation == null) {
    return (
      <ToastProvider>
        <PaceAppLayout
          appName={appName}
          navItems={navItems}
          userFullName={userFullName}
          userEmail={userEmail}
          onUserMenuSignOut={handleSignOut}
          onUserMenuChangePassword={() => setPasswordDialogOpen(true)}
          extraMenuActions={extraMenuActions}
          showContextSelector
          showOrganisations
          showEvents={false}
          enforcePermissions
          routeAccessDenied={routeAccessDenied}
          permissionFallback={<AccessDenied />}
        >
          <main className="grid min-h-[60vh] place-items-center">
            <section>
              <p>No organisation assigned. Please contact your administrator.</p>
            </section>
          </main>
          {passwordDialog}
        </PaceAppLayout>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PaceAppLayout
        appName={appName}
        navItems={navItems}
        userFullName={userFullName}
        userEmail={userEmail}
        onUserMenuSignOut={handleSignOut}
        onUserMenuChangePassword={() => setPasswordDialogOpen(true)}
        extraMenuActions={extraMenuActions}
        showContextSelector
        showOrganisations
        showEvents={false}
        enforcePermissions
        routeAccessDenied={routeAccessDenied}
        permissionFallback={<AccessDenied />}
      >
        {showOrgContextBar ? (
          <OrgContextBar org={selectedOrganisation} pageLabel={orgContextLabel} />
        ) : null}
        <Outlet />
        {passwordDialog}
      </PaceAppLayout>
    </ToastProvider>
  );
}
