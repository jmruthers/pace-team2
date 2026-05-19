import { useQuery } from '@tanstack/react-query';
import { useUnifiedAuth } from '@solvera/pace-core/hooks';
import { isPermittedCached, useResolvedScope, type Permission } from '@solvera/pace-core/rbac';

const COMMS_PERMISSIONS = [
  'create:page.CommsLog',
  'update:page.CommsLog',
] as const satisfies readonly Permission[];

export type CommsLogRbacState = {
  canCompose: boolean;
  canSend: boolean;
  canSchedule: boolean;
  isLoading: boolean;
  hasPermissionError: boolean;
};

const DENIED: CommsLogRbacState = {
  canCompose: false,
  canSend: false,
  canSchedule: false,
  isLoading: false,
  hasPermissionError: false,
};

/** TM13 F-28 / F-21 — CommsLog page permissions with explicit RPC error detection. */
export function useCommsLogRbac(organisationId: string): CommsLogRbacState {
  const auth = useUnifiedAuth();
  const resolved = useResolvedScope();

  const userId = auth.user?.id ?? '';
  const scopeReady = organisationId.length > 0 && resolved.scope.appId != null;
  const enabled = Boolean(userId) && scopeReady && !resolved.isLoading;

  const query = useQuery({
    queryKey: ['comms-log-rbac', userId, organisationId, resolved.scope.appId],
    enabled,
    queryFn: async (): Promise<Omit<CommsLogRbacState, 'isLoading'>> => {
      const scope = { ...resolved.scope, organisationId };
      const results = await Promise.all(
        COMMS_PERMISSIONS.map((permission) =>
          isPermittedCached({ userId, scope, permission })
        )
      );

      const hasPermissionError = results.some((result) => !result.ok);
      if (hasPermissionError) {
        return {
          canCompose: false,
          canSend: false,
          canSchedule: false,
          hasPermissionError: true,
        };
      }

      const [composeResult, sendResult] = results;
      const canCompose = composeResult.ok ? composeResult.data : false;
      const canSend = sendResult.ok ? sendResult.data : false;

      return {
        canCompose,
        canSend,
        canSchedule: canSend,
        hasPermissionError: false,
      };
    },
  });

  if (!userId) {
    return DENIED;
  }

  if (!enabled) {
    return { ...DENIED, isLoading: true };
  }

  if (query.isError) {
    return {
      canCompose: false,
      canSend: false,
      canSchedule: false,
      isLoading: false,
      hasPermissionError: true,
    };
  }

  if (query.isPending || query.data == null) {
    return { ...DENIED, isLoading: true };
  }

  return {
    ...query.data,
    isLoading: false,
  };
}
