import type {
  CommChannel,
  CommScheduleRequest,
  CommSendAdapter,
  CommSendRequest,
  CommSendTestRequest,
  RecipientPoolDescriptor,
} from '@solvera/pace-core/comms';
import { createErrorResult, type ApiResult } from '@solvera/pace-core/types';

export const ZERO_RECIPIENT_MESSAGE = 'No recipients match these filters.';

export type TeamCommSendAdapterCallbacks = {
  getEstimatedRecipientCount: () => number | null;
  onZeroRecipientBlocked?: () => void;
  onSendTestSuccess?: () => void;
};

type RequestWithTeamContext = {
  source_context_type?: string;
  source_context_id?: string;
  bypass_suppression?: boolean;
};

function stripTeamRequestContext<T extends RequestWithTeamContext>(request: T): T {
  const next = { ...request };
  delete next.source_context_type;
  delete next.source_context_id;
  delete next.bypass_suppression;
  return next;
}

function stripMergeFieldsContext(input: {
  organisationId: string;
  channel: CommChannel;
  recipientPool: RecipientPoolDescriptor;
  sourceContextType?: string;
  sourceContextId?: string;
}): {
  organisationId: string;
  channel: CommChannel;
  recipientPool: RecipientPoolDescriptor;
} {
  return {
    organisationId: input.organisationId,
    channel: input.channel,
    recipientPool: input.recipientPool,
  };
}

async function resolveApiResult<T>(
  value: Promise<ApiResult<T>> | ApiResult<T>
): Promise<ApiResult<T>> {
  return Promise.resolve(value);
}

/** TM13 BR-09 / BR-10 / F-55 — TEAM adapter wrapper over pace-core CommSendAdapter. */
export function createTeamCommSendAdapter(
  base: CommSendAdapter,
  callbacks: TeamCommSendAdapterCallbacks
): CommSendAdapter {
  const blockWhenEmptyPool = async (): Promise<ApiResult<never> | null> => {
    const count = callbacks.getEstimatedRecipientCount();
    if (count !== 0) {
      return null;
    }
    callbacks.onZeroRecipientBlocked?.();
    return createErrorResult('TEAM_ZERO_RECIPIENTS', ZERO_RECIPIENT_MESSAGE);
  };

  return {
    resolvePool: (pool, context) => base.resolvePool(pool, context),
    loadTemplates: (input) => base.loadTemplates(input),
    loadMergeFields: (input) =>
      base.loadMergeFields(stripMergeFieldsContext(input)),
    send: async (request: CommSendRequest) => {
      const blocked = await blockWhenEmptyPool();
      if (blocked != null) {
        return blocked;
      }
      return resolveApiResult(base.send(stripTeamRequestContext(request)));
    },
    sendTest: async (request: CommSendTestRequest) => {
      const result = await resolveApiResult(base.sendTest(stripTeamRequestContext(request)));
      if (result.ok) {
        callbacks.onSendTestSuccess?.();
      }
      return result;
    },
    schedule: async (request: CommScheduleRequest) => {
      const blocked = await blockWhenEmptyPool();
      if (blocked != null) {
        return blocked;
      }
      return resolveApiResult(base.schedule(stripTeamRequestContext(request)));
    },
    saveDraft: (draft) => base.saveDraft(draft),
  };
}
