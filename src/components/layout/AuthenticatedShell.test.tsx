// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthenticatedShell } from './AuthenticatedShell';

type OrgSelection = { id: string; display_name: string; name: string };

type AuthFixture = {
  isLoading: boolean;
  user: { email: string; user_metadata: Record<string, unknown> };
  selectedOrganisation: OrgSelection | null;
  selectedOrganisationId: string | null;
  signOut: ReturnType<typeof vi.fn>;
  updatePassword: ReturnType<typeof vi.fn>;
};

let authFixture: AuthFixture = {
  isLoading: false,
  user: { email: 'staff@example.com', user_metadata: {} },
  selectedOrganisation: { id: 'org-1', display_name: 'Demo Org', name: 'Demo Org' },
  selectedOrganisationId: 'org-1',
  signOut: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
};

let shellRouteAccessDenied = false;

vi.mock('@solvera/pace-core/hooks', () => ({
  useUnifiedAuth: () => authFixture,
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <main>Access denied</main>,
  useShellRouteAccessDenied: () => shellRouteAccessDenied,
}));

vi.mock('@solvera/pace-core/components', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  LoadingSpinner: ({ label }: { label: string }) => <p>{label}</p>,
  Breadcrumb: ({ items }: { items: Array<{ label: string }> }) => (
    <nav aria-label="Breadcrumb">{items.map((item) => item.label).join(' / ')}</nav>
  ),
  PaceAppLayout: ({
    children,
    appName,
    userEmail,
    userFullName,
    navItems,
    routeAccessDenied,
    permissionFallback,
  }: {
    children?: ReactNode;
    appName: string;
    userEmail: string;
    userFullName: string;
    navItems?: Array<{ label: string }>;
    routeAccessDenied?: boolean;
    permissionFallback?: ReactNode;
  }) => {
    if (routeAccessDenied === true) {
      return <>{permissionFallback}</>;
    }
    return (
      <div
        data-testid="pace-app-shell"
        data-app={appName}
        data-email={userEmail}
        data-fullname={userFullName}
        data-nav-count={navItems?.length ?? 0}
      >
        <header>Mini shell</header>
        {children}
      </div>
    );
  },
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <aside>{children}</aside> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogBody: ({ children }: { children: ReactNode }) => <>{children}</>,
  PasswordChangeForm: () => <span>pwd-form</span>,
}));

function OutletChild() {
  return (
    <article>
      <h1>Member directory</h1>
      Outlet child fixture
    </article>
  );
}

function renderShell(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AuthenticatedShell appName="TEAM" />}>
          <Route index element={<OutletChild />} />
          <Route path="members" element={<OutletChild />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    cleanup();
    shellRouteAccessDenied = false;
    authFixture = {
      isLoading: false,
      user: { email: 'staff@example.com', user_metadata: {} },
      selectedOrganisation: { id: 'org-1', display_name: 'Demo Org', name: 'Demo Org' },
      selectedOrganisationId: 'org-1',
      signOut: vi.fn(async () => undefined),
      updatePassword: vi.fn(async () => undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth resolves', () => {
    authFixture = { ...authFixture, isLoading: true };

    renderShell();

    expect(screen.getByText('Loading authenticated shell')).toBeTruthy();
  });

  it('shows no-organisation messaging when organisation is unavailable', () => {
    authFixture = { ...authFixture, selectedOrganisation: null, selectedOrganisationId: null };

    renderShell();

    expect(screen.getByText(/No organisation assigned/u)).toBeTruthy();
    expect(screen.queryByText('Outlet child fixture')).toBeNull();
  });

  it('renders outlet when authenticated with organisation context', () => {
    renderShell();

    const shellNode = screen.getByTestId('pace-app-shell');
    expect(shellNode.getAttribute('data-app')).toBe('TEAM');
    expect(screen.getByText('Outlet child fixture')).toBeTruthy();
  });

  it('uses empty primary nav on organisation landing', () => {
    renderShell('/');

    expect(screen.getByTestId('pace-app-shell').getAttribute('data-nav-count')).toBe('0');
  });

  it('renders slim in-org nav and context bar on feature routes', () => {
    renderShell('/members');

    expect(screen.getByTestId('pace-app-shell').getAttribute('data-nav-count')).toBe('4');
    expect(screen.getByLabelText('Breadcrumb')).toBeTruthy();
  });

  it('does not mount outlet content when shell route access is denied', () => {
    shellRouteAccessDenied = true;
    renderShell('/members');

    expect(screen.getByText('Access denied')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Member directory' })).toBeNull();
    expect(screen.queryByText('Outlet child fixture')).toBeNull();
  });
});
