// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';

const toastMock = vi.hoisted(() => vi.fn());
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsListPage } from '@/pages/events/EventsListPage';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';

const useOrgEventsDataMock = vi.fn();
const useOrganisationsContextMock = vi.fn();
const navigateMock = vi.fn();

let pageGuardAllows = true;

const sampleEvent: OrgEventSummaryRow = {
  event_id: 'event-1',
  event_name: 'Summer camp',
  event_date: '2026-09-05',
  event_days: 3,
  event_venue: 'Town Hall',
  members_registered_count: 4,
  event_date_sort_key: new Date(2026, 8, 5).getTime(),
};

vi.mock('@/hooks/useOrgEventsData', () => ({
  useOrgEventsData: (...args: unknown[]) => useOrgEventsDataMock(...args),
}));

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

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => useOrganisationsContextMock(),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: ({ message }: { message?: string }) => (
    <p data-testid="access-denied">{message ?? 'Denied'}</p>
  ),
  PagePermissionGuard: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    pageGuardAllows ? <>{children}</> : <>{fallback}</>,
}));

vi.mock('@solvera/pace-core/components', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/components')>();
  const { buildEventsListDataTableMock } = await import('@/test-utils/eventsPageMocks');
  return { ...actual, ...buildEventsListDataTableMock(), toast: toastMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <EventsListPage />
    </MemoryRouter>,
  );
}

describe('EventsListPage', () => {
  beforeEach(() => {
    pageGuardAllows = true;
    navigateMock.mockReset();
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: 'org-1', name: 'Org One' },
    });
    useOrgEventsDataMock.mockReturnValue({
      events: [sampleEvent],
      rawCount: 1,
      isLoading: false,
      isFetching: false,
      loadErrorMessage: null,
      refetchEvents: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders events heading and four columns in order with default sort', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Events' })).toBeTruthy();
    expect(screen.getAllByTestId('column-headers')[0]?.textContent).toBe(
      'Event|Days|Dates|Registered',
    );
    expect(screen.getAllByTestId('initial-sort')[0]?.textContent).toBe(
      JSON.stringify([{ id: 'event_date_sort_key', desc: true }]),
    );
  });

  it('renders access denied when page guard denies', () => {
    pageGuardAllows = false;
    renderPage();
    expect(screen.getByTestId('access-denied')).toBeTruthy();
  });

  it('shows loading spinner on initial load', () => {
    useOrgEventsDataMock.mockReturnValue({
      events: [],
      rawCount: 0,
      isLoading: true,
      isFetching: true,
      loadErrorMessage: null,
      refetchEvents: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Loading events')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Events' })).toBeNull();
  });

  it('shows error alert and retry when load fails with no data', async () => {
    const refetchEvents = vi.fn();
    useOrgEventsDataMock.mockReturnValue({
      events: [],
      rawCount: 0,
      isLoading: false,
      isFetching: false,
      loadErrorMessage: 'RPC failed',
      refetchEvents,
    });
    renderPage();
    expect(screen.getByText('Could not load events')).toBeTruthy();
    expect(screen.getByText('RPC failed')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchEvents).toHaveBeenCalled();
  });

  it('shows empty state when there are no events', () => {
    useOrgEventsDataMock.mockReturnValue({
      events: [],
      rawCount: 0,
      isLoading: false,
      isFetching: false,
      loadErrorMessage: null,
      refetchEvents: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('No upcoming events')).toBeTruthy();
  });

  it('navigates to event detail on row activate', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Summer camp' }));
    expect(navigateMock).toHaveBeenCalledWith('/events/event-1');
  });
});