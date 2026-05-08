import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@solvera/pace-core/components';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { apiErr, apiOk } from '@/lib/apiResult';
import type { ResolveRequestPayload } from '@/lib/approvals/approvals.types';
import type { ApiResult } from '@/lib/apiResult';

interface SupabaseLike {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
}

export interface ResolveErrorOutcome {
  title: string;
  shouldNavigateToList: boolean;
  shouldInvalidateAll: boolean;
  keepDialogOpen: boolean;
}

function buildResolveSuccessTitle(status: ResolveRequestPayload['status']): string {
  if (status === 'approved') {
    return 'Request approved.';
  }
  if (status === 'rejected') {
    return 'Request rejected.';
  }
  return 'Request placed on hold.';
}

export function buildResolveSuccessInvalidationTargets(
  organisationId: string,
  requestId: string,
  status: ResolveRequestPayload['status']
) {
  if (status === 'on_hold') {
    return [
      ['approvals', 'open', organisationId] as const,
      ['approvals', 'request', requestId, organisationId] as const,
      ['approvals', 'open-count', organisationId] as const,
    ];
  }
  return buildResolveInvalidationTargets(organisationId, requestId);
}

export function buildResolveInvalidationTargets(organisationId: string, requestId: string) {
  return [
    ['approvals', 'open', organisationId] as const,
    ['approvals', 'closed', organisationId] as const,
    ['approvals', 'request', requestId, organisationId] as const,
    ['approvals', 'open-count', organisationId] as const,
  ];
}

export function getResolveErrorOutcome(error: unknown): ResolveErrorOutcome {
  const message = HandleSupabaseError(error, 'team_member_request').message;
  if (message.includes('Resolvable request not found')) {
    return {
      title: 'This request has already been resolved by another admin. Refreshing the queue.',
      shouldNavigateToList: true,
      shouldInvalidateAll: true,
      keepDialogOpen: false,
    };
  }
  if (message.includes('Membership number already exists for this organisation')) {
    return {
      title: 'Could not resolve request: Membership number already exists for this organisation.',
      shouldNavigateToList: false,
      shouldInvalidateAll: false,
      keepDialogOpen: true,
    };
  }
  if (message.includes('Permission denied')) {
    return {
      title: 'Could not resolve request: Permission denied.',
      shouldNavigateToList: false,
      shouldInvalidateAll: false,
      keepDialogOpen: true,
    };
  }
  return {
    title: `Could not resolve request: ${message}.`,
    shouldNavigateToList: false,
    shouldInvalidateAll: false,
    keepDialogOpen: true,
  };
}

export async function runResolveMemberRequestRpc(
  secureSupabase: SupabaseLike,
  payload: ResolveRequestPayload
): Promise<ApiResult<void>> {
  // eslint-disable-next-line pace-core-compliance/rpc-naming-pattern
  const { error } = await secureSupabase.rpc('app_resolve_member_request', {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_review_notes: payload.reviewNotes ?? null,
    p_member_number: payload.memberNumber ?? null,
  });

  if (error != null) {
    return apiErr({ message: HandleSupabaseError(error, 'team_member_request').message, cause: error });
  }
  return apiOk(undefined);
}

export function useResolveMemberRequest(organisationId: string | null, requestId: string | undefined, onNavigateToList: () => void) {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: ResolveRequestPayload) => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }
      const result = await runResolveMemberRequestRpc(secureSupabase, payload);
      if (result.ok === false) {
        throw result.error;
      }
    },
  });

  const resolveRequest = async (payload: ResolveRequestPayload): Promise<ResolveErrorOutcome | null> => {
    try {
      await mutation.mutateAsync(payload);
      if (organisationId != null) {
        const targets = buildResolveSuccessInvalidationTargets(organisationId, payload.requestId, payload.status);
        await Promise.all(targets.map((target) => queryClient.invalidateQueries({ queryKey: target })));
      }
      toast({
        title: buildResolveSuccessTitle(payload.status),
        variant: 'success',
      });
      onNavigateToList();
      return null;
    } catch (error: unknown) {
      const outcome = getResolveErrorOutcome(error);
      toast({
        title: outcome.title,
        variant: 'destructive',
      });
      if (outcome.shouldInvalidateAll && organisationId != null && requestId != null) {
        const targets = buildResolveInvalidationTargets(organisationId, requestId);
        await Promise.all(targets.map((target) => queryClient.invalidateQueries({ queryKey: target })));
      }
      if (outcome.shouldNavigateToList) {
        onNavigateToList();
      }
      return outcome;
    }
  };

  return {
    resolveRequest,
    resolvePending: mutation.isPending,
  };
}
