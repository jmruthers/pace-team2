// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommsLogRbac } from './useCommsLogRbac';

const isPermittedCachedMock = vi.fn();
const useResolvedScopeMock = vi.fn();
const useUnifiedAuthMock = vi.fn();

vi.mock('@solvera/pace-core/rbac', () => ({
  isPermittedCached: (...args: unknown[]) => isPermittedCachedMock(...args),
  useResolvedScope: () => useResolvedScopeMock(),
  toPagePermission: (pageName: string, operation: string) => `${operation}:page.${pageName}`,
}));

vi.mock('@solvera/pace-core/hooks', () => ({
  useUnifiedAuth: () => useUnifiedAuthMock(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCommsLogRbac (TM13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUnifiedAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useResolvedScopeMock.mockReturnValue({
      scope: { appId: 'team-app' },
      isLoading: false,
    });
  });

  it('TM13 F-28: sets hasPermissionError when permission RPC fails', async () => {
    isPermittedCachedMock.mockImplementation(async ({ permission }: { permission: string }) => {
      if (permission === 'create:page.CommsLogPage') {
        return { ok: false, error: 'rpc failed' };
      }
      return { ok: true, data: true };
    });

    const { result } = renderHook(() => useCommsLogRbac('org-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermissionError).toBe(true);
    expect(result.current.canCompose).toBe(false);
    expect(result.current.canSend).toBe(false);
    expect(result.current.canSchedule).toBe(false);
  });

  it('grants compose when create is allowed and send/schedule follow update', async () => {
    isPermittedCachedMock.mockImplementation(async ({ permission }: { permission: string }) => {
      if (permission === 'create:page.CommsLogPage') {
        return { ok: true, data: true };
      }
      if (permission === 'update:page.CommsLogPage') {
        return { ok: true, data: true };
      }
      return { ok: true, data: false };
    });

    const { result } = renderHook(() => useCommsLogRbac('org-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermissionError).toBe(false);
    expect(result.current.canCompose).toBe(true);
    expect(result.current.canSend).toBe(true);
    expect(result.current.canSchedule).toBe(true);
  });

  it('denies send and schedule when update permission is false', async () => {
    isPermittedCachedMock.mockImplementation(async ({ permission }: { permission: string }) => {
      if (permission === 'create:page.CommsLogPage') {
        return { ok: true, data: true };
      }
      if (permission === 'update:page.CommsLogPage') {
        return { ok: true, data: false };
      }
      return { ok: true, data: false };
    });

    const { result } = renderHook(() => useCommsLogRbac('org-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canCompose).toBe(true);
    expect(result.current.canSend).toBe(false);
    expect(result.current.canSchedule).toBe(false);
  });

  it('stays loading when organisation scope is not ready', () => {
    useResolvedScopeMock.mockReturnValue({
      scope: { appId: null },
      isLoading: false,
    });

    const { result } = renderHook(() => useCommsLogRbac('org-1'), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.canCompose).toBe(false);
  });

  it('returns denied when user is not signed in', () => {
    useUnifiedAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(() => useCommsLogRbac('org-1'), { wrapper: createWrapper() });
    expect(result.current).toMatchObject({
      canCompose: false,
      canSend: false,
      canSchedule: false,
      isLoading: false,
      hasPermissionError: false,
    });
  });
});
