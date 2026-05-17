import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

type RpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export type EffectivePumpSenderRow = {
  senderName?: string | null;
  fromAddress?: string | null;
  replyToAddress?: string | null;
  senderPhone?: string | null;
};

function coerceSenderPayload(data: unknown): EffectivePumpSenderRow | null {
  if (data == null) {
    return null;
  }
  if (Array.isArray(data) && data.length > 0) {
    const [first] = data;
    if (first === null || typeof first !== 'object') {
      return null;
    }
    return first as EffectivePumpSenderRow;
  }
  if (typeof data === 'object') {
    return data as EffectivePumpSenderRow;
  }
  return null;
}

/** TM13 — `pump_get_effective_sender_identity` (PUMP contract; name is platform-owned). */
export function usePumpEffectiveSenderIdentity(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as RpcClient | null;

  return useQuery({
    queryKey: ['pump-effective-sender', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<EffectivePumpSenderRow | null> => {
      if (organisationId == null || secureSupabase == null) {
        return null;
      }

      // TM13 §3 / §15 — RPC slug owned by PUMP; not an `app_*` / `data_*` consumer naming pattern.
      /* eslint-disable-next-line pace-core-compliance/rpc-naming-pattern -- TM13 PUMP contract */
      const { data, error } = await secureSupabase.rpc('pump_get_effective_sender_identity', {
        organisation_id: organisationId,
        source_context_type: null,
        source_context_id: null,
      });

      if (error != null) {
        throw new Error(HandleSupabaseError(error, 'pump sender identity').message);
      }

      return coerceSenderPayload(data);
    },
  });
}
