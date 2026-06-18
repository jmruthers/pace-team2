// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const toastMock = vi.hoisted(() => vi.fn());
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDetailPage } from '@/pages/events/EventDetailPage';
import type { OrgEventAttendeeRow } from '@/lib/events/events.types';

const useEventAttendeesDataMock = vi.fn();
const useOrganisationsContextMock = vi.fn();
const navigateMock = vi.fn();

let pageGuardAllows = true;
let organisationId = 'org-1';

const attendeeFixture: OrgEventAttendeeRow = {
  member_id: 'member-1',
  person_id: 'person-1',
  first_name: 'Samantha',
  last_name: 'Doe',
  preferred_name: 'Sam',
  application_status: 'approved',
  event_id: 'event-1',
  event_name: 'Summer camp',
  event_date: '2026-05-05',
  event_days: 3,
  event_venue: 'Town Hall',
};

vi.mock('@/hooks/useEventAttendeesData', () => ({
  useEventAttendeesData: (...args: unknown[]) => useEventAttendeesDataMock(...args),
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

vi.mock('@solvera/pace-core/icons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solvera/pace-core/icons')>();
  return {
    ...actual,
    ChevronLeft: () => <span aria-hidden>left</span>,
  };
});

vi.mock('@solvera/pace-core/components', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/components')>();
  const { buildEventDetailDataTableMock } = await import('@/test-utils/eventsPageMocks');
  return { ...actual, ...buildEventDetailDataTableMock(), toast: toastMock };
});

function defaultHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    attendees: [attendeeFixture],
    rawCount: 1,
    header: {
      event_id: attendeeFixture.event_id,
      event_name: attendeeFixture.event_name,
      event_date: attendeeFixture.event_date,
      event_days: attendeeFixture.event_days,
      event_venue: attendeeFixture.event_venue,
    },
    isLoading: false,
    isFetching: false,
    isSuccess: true,
    showOrgMismatch: false,
    loadErrorMessage: null,
    refetchAttendees: vi.fn(),
    ...overrides,
  };
}

function TestHarness() {
  return (
    <MemoryRouter initialEntries={['/events/event-1']}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderPage() {
  return render(<TestHarness />);
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    pageGuardAllows = true;
    organisationId = 'org-1';
    navigateMock.mockReset();
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: organisationId, name: 'Org One' },
    });
    useEventAttendeesDataMock.mockImplementation(() => defaultHookReturn());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders back button, header card, and attendee columns with default sort', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Back to events/i })).toBeTruthy();
    expect(screen.getByText('Summer camp')).toBeTruthy();
    expect(screen.getByTestId('column-headers').textContent).toBe('Name|Application status');
    expect(screen.getByTestId('initial-sort').textContent).toBe(
      JSON.stringify([
        { id: 'last_name', desc: false },
        { id: 'first_name', desc: false },
      ]),
    );
  });

  it('renders event not found when attendees RPC returns zero rows', () => {
    useEventAttendeesDataMock.mockReturnValue(
      defaultHookReturn({
        attendees: [],
        rawCount: 0,
        header: null,
        isSuccess: true,
      }),
    );
    renderPage();
    expect(screen.getByRole('heading', { name: 'Event not found' })).toBeTruthy();
    expect(
      screen.getByText("We couldn't find this event for your current organisation."),
    ).toBeTruthy();
  });

  it('renders org-mismatch alert after org switch when attendees become empty', async () => {
    const view = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('attendees-table')).toBeTruthy();
    });

    organisationId = 'org-2';
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: organisationId, name: 'Org Two' },
    });
    useEventAttendeesDataMock.mockReturnValue(
      defaultHookReturn({
        attendees: [],
        rawCount: 0,
        header: null,
        isSuccess: true,
        isLoading: false,
        showOrgMismatch: true,
      }),
    );
    view.rerender(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByText('This event is not in your current organisation')).toBeTruthy();
    });
    expect(screen.getByText('Switch back, or return to the events list.')).toBeTruthy();
  });

  it('navigates to member 360 on attendee row activate', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Open attendee' }));
    expect(navigateMock).toHaveBeenCalledWith('/members/member-1');
  });

  it('navigates back to events list from back button', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Back to events/i }));
    expect(navigateMock).toHaveBeenCalledWith('/events');
  });

  it('shows error alert and retry when load fails with no data', async () => {
    const refetchAttendees = vi.fn();
    useEventAttendeesDataMock.mockReturnValue(
      defaultHookReturn({
        attendees: [],
        rawCount: 0,
        header: null,
        isLoading: false,
        isSuccess: false,
        loadErrorMessage: 'RPC failed',
        refetchAttendees,
      }),
    );
    renderPage();
    expect(screen.getByText('Could not load event')).toBeTruthy();
    expect(screen.getByText('RPC failed')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchAttendees).toHaveBeenCalled();
  });
});