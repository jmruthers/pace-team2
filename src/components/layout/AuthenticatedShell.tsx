import { useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
import type { NavigationItem } from '@solvera/pace-core/components';
import { useUnifiedAuthContext } from '@solvera/pace-core';
import { useUnifiedAuth } from '@solvera/pace-core/hooks';
import { OrganisationServiceProvider } from '@solvera/pace-core/providers';
import { supabaseClient } from '@/lib/supabase';
import { useApprovalsOpenCount } from '@/hooks/useApprovalsData';

interface AuthenticatedShellProps {
  appName: string;
  navItems: NavigationItem[];
}

function AuthenticatedShellInner({ appName, navItems }: AuthenticatedShellProps) {
  const navigate = useNavigate();
  const { isLoading, organisationLoading, user, selectedOrganisation, signOut, updatePassword } = useUnifiedAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const pendingApprovalsCount = useApprovalsOpenCount(selectedOrganisation?.id ?? null);

  const navItemsWithApprovalsBadge = useMemo((): NavigationItem[] => {
    return navItems.map((item) => {
      if (item.id !== 'approvals') {
        return item;
      }
      if (pendingApprovalsCount <= 0) {
        return { ...item, label: 'Approvals' };
      }
      return { ...item, label: `Approvals (${pendingApprovalsCount})` };
    });
  }, [navItems, pendingApprovalsCount]);

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

  if (isLoading || organisationLoading) {
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
          navItems={navItemsWithApprovalsBadge}
          userFullName={userFullName}
          userEmail={userEmail}
          onUserMenuSignOut={handleSignOut}
          onUserMenuChangePassword={() => setPasswordDialogOpen(true)}
          showOrganisations
          showEvents={false}
        >
          <main className="grid min-h-[60vh] place-items-center">
            <section>
              <p>No organisation assigned. Please contact your administrator.</p>
            </section>
          </main>
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
        </PaceAppLayout>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PaceAppLayout
        appName={appName}
        navItems={navItemsWithApprovalsBadge}
        userFullName={userFullName}
        userEmail={userEmail}
        onUserMenuSignOut={handleSignOut}
        onUserMenuChangePassword={() => setPasswordDialogOpen(true)}
        showOrganisations
        showEvents={false}
      >
        <Outlet />
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
      </PaceAppLayout>
    </ToastProvider>
  );
}

export function AuthenticatedShell({ appName, navItems }: AuthenticatedShellProps) {
  const { user, session } = useUnifiedAuthContext();
  return (
    <OrganisationServiceProvider supabaseClient={supabaseClient} user={user} session={session}>
      <AuthenticatedShellInner appName={appName} navItems={navItems} />
    </OrganisationServiceProvider>
  );
}
