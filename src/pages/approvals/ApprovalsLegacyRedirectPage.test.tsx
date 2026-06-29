// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ApprovalsLegacyRedirectPage } from '@/pages/approvals/ApprovalsLegacyRedirectPage';

function ApprovalsLandingPage() {
  const location = useLocation();
  return <p data-testid="landing-state">{JSON.stringify(location.state)}</p>;
}

describe('ApprovalsLegacyRedirectPage', () => {
  afterEach(() => {
    cleanup();
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
});
