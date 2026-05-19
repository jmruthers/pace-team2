// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventAttendeesData } from '@/hooks/useEventAttendeesData';

const rpcMock = vi.fn();

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

vi.mock('@solvera/pace-core/components', () => ({
  toast: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const attendeeFixture = {
  member_id: 'member-1',
  person_id: 'person-1',
  first_name: 'Samantha',
  last_name: 'Doe',
  preferred_name: 'Sam',
  application_status: 'submitted',
  event_id: 'event-1',
  event_name: 'Summer camp',
  event_date: '2026-05-05',
  event_days: 3,
  event_venue: 'Hall',
};

describe('useEventAttendeesData', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [attendeeFixture],
      error: null,
    });
  });

  it('loads attendees via app_org_event_attendees RPC', async () => {
    const { result } = renderHook(() => useEventAttendeesData('org-1', 'event-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).toHaveBeenCalledWith('app_org_event_attendees', {
      p_organisation_id: 'org-1',
      p_event_id: 'event-1',
    });
    expect(result.current.attendees).toHaveLength(1);
    expect(result.current.header?.event_name).toBe('Summer camp');
    expect(result.current.rawCount).toBe(1);
  });

  it('trusts RPC to exclude draft applications from payload', async () => {
    rpcMock.mockResolvedValue({
      data: [
        attendeeFixture,
        {
          ...attendeeFixture,
          member_id: 'member-2',
          application_status: 'approved',
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useEventAttendeesData('org-1', 'event-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.attendees).toHaveLength(2);
    });

    expect(result.current.attendees.map((row) => row.application_status)).toEqual([
      'submitted',
      'approved',
    ]);
    expect(result.current.rawCount).toBe(2);
  });

  it('does not invoke RPC when eventId is missing', async () => {
    const { result } = renderHook(() => useEventAttendeesData('org-1', undefined), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.current.attendees).toEqual([]);
  });

  it('sets showOrgMismatch when org switches and attendees RPC returns zero rows', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stableWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ orgId }: { orgId: string }) => useEventAttendeesData(orgId, 'event-1'),
      {
        wrapper: stableWrapper,
        initialProps: { orgId: 'org-a' },
      },
    );

    await waitFor(() => {
      expect(result.current.attendees).toHaveLength(1);
    });

    expect(result.current.showOrgMismatch).toBe(false);

    rpcMock.mockResolvedValue({ data: [], error: null });
    rerender({ orgId: 'org-b' });

    await waitFor(() => {
      expect(result.current.showOrgMismatch).toBe(true);
    });

    expect(result.current.attendees).toHaveLength(0);
  });

  it('does not set showOrgMismatch on first load when attendees RPC returns zero rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useEventAttendeesData('org-1', 'event-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.showOrgMismatch).toBe(false);
    expect(result.current.attendees).toEqual([]);
  });
});
