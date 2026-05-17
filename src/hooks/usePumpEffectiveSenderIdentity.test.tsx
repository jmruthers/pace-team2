// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { usePumpEffectiveSenderIdentity } from '@/hooks/usePumpEffectiveSenderIdentity';

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () =>
    ({
      rpc: vi.fn(async () => ({
        data: [{ senderName: 'Test', fromAddress: 'a@example.com', replyToAddress: null, senderPhone: null }],
        error: null,
      })),
    }) as Record<string, unknown>,
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: string) => new Error(`${error}`),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('usePumpEffectiveSenderIdentity', () => {
  it('coerces RPC array payload into a single row', async () => {
    const { result } = renderHook(() => usePumpEffectiveSenderIdentity('org-x'), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toMatchObject({
      senderName: 'Test',
      fromAddress: 'a@example.com',
    });
  });
});
