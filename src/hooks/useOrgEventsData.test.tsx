// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrgEventsData } from '@/hooks/useOrgEventsData';

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

describe('useOrgEventsData', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [
        {
          event_id: 'event-1',
          event_name: 'Summer camp',
          event_date: '2026-05-05',
          event_days: 1,
          event_venue: 'Hall',
          members_registered_count: 4,
        },
      ],
      error: null,
    });
  });

  it('loads events via app_org_event_summaries RPC', async () => {
    const { result } = renderHook(() => useOrgEventsData('org-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).toHaveBeenCalledWith('app_org_event_summaries', {
      p_organisation_id: 'org-1',
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]?.event_name).toBe('Summer camp');
    expect(result.current.rawCount).toBe(1);
  });

  it('does not invoke RPC when organisationId is null', async () => {
    const { result } = renderHook(() => useOrgEventsData(null), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });

  it('refetches when organisationId changes', async () => {
    const { result, rerender } = renderHook(
      ({ orgId }: { orgId: string | null }) => useOrgEventsData(orgId),
      {
        wrapper,
        initialProps: { orgId: 'org-a' as string | null },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).toHaveBeenCalledWith('app_org_event_summaries', {
      p_organisation_id: 'org-a',
    });

    rpcMock.mockResolvedValue({
      data: [
        {
          event_id: 'event-2',
          event_name: 'Winter camp',
          event_date: '2026-01-01',
          event_days: 1,
          event_venue: null,
          members_registered_count: 2,
        },
      ],
      error: null,
    });

    rerender({ orgId: 'org-b' });

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('app_org_event_summaries', {
        p_organisation_id: 'org-b',
      });
    });

    await waitFor(() => {
      expect(result.current.events[0]?.event_name).toBe('Winter camp');
    });
  });
});
