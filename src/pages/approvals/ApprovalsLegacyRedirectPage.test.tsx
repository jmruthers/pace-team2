// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsLegacyRedirectPage } from '@/pages/approvals/ApprovalsLegacyRedirectPage';

let pageGuardAllows = true;

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    pageGuardAllows ? <>{children}</> : <>{fallback}</>,
}));

function ApprovalsLandingPage() {
  const location = useLocation();
  return <p data-testid="landing-state">{JSON.stringify(location.state)}</p>;
}

describe('ApprovalsLegacyRedirectPage', () => {
  afterEach(() => {
    cleanup();
    pageGuardAllows = true;
  });

  it('redirects legacy request URLs to /approvals with requestId state', () => {
    render(
      <MemoryRouter initialEntries={['/approvals/req-legacy']}>
        <Routes>
          <Route path="/approvals/:requestId" element={<ApprovalsLegacyRedirectPage />} />
          <Route path="/approvals" element={<ApprovalsLandingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('landing-state').textContent).toBe(
      JSON.stringify({ requestId: 'req-legacy' }),
    );
  });

  it('renders access denied when page guard denies', () => {
    pageGuardAllows = false;
    render(
      <MemoryRouter initialEntries={['/approvals/req-legacy']}>
        <Routes>
          <Route path="/approvals/:requestId" element={<ApprovalsLegacyRedirectPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Denied')).toBeTruthy();
  });
});
