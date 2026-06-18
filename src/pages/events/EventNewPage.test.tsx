// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventNewPage } from '@/pages/events/EventNewPage';

const navigateMock = vi.fn();
let pageGuardAllows = true;

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p data-testid="access-denied">Denied</p>,
  PagePermissionGuard: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    pageGuardAllows ? <>{children}</> : <>{fallback}</>,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  return buildPaceCoreComponentsMock(vi.fn());
});

describe('EventNewPage', () => {
  beforeEach(() => {
    pageGuardAllows = true;
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders create-event stub and navigates back to events list', async () => {
    render(
      <MemoryRouter>
        <EventNewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Create event' })).toBeTruthy();
    expect(screen.getByText('Event creation is coming soon')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back to events' }));
    expect(navigateMock).toHaveBeenCalledWith('/events');
  });

  it('renders access denied when page guard denies', () => {
    pageGuardAllows = false;
    render(
      <MemoryRouter>
        <EventNewPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('access-denied')).toBeTruthy();
  });
});
