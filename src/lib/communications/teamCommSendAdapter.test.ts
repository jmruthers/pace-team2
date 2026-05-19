import { describe, expect, it, vi } from 'vitest';
import type { CommSendAdapter, CommSendRequest, CommSendTestRequest } from '@solvera/pace-core/comms';
import { createSuccessResult } from '@solvera/pace-core/types';
import {
  createTeamCommSendAdapter,
  ZERO_RECIPIENT_MESSAGE,
} from '@/lib/communications/teamCommSendAdapter';

function mockBaseAdapter(): CommSendAdapter {
  return {
    resolvePool: vi.fn(async () =>
      createSuccessResult({ estimated_count: 1, sample_names: [], warnings: [] })
    ),
    loadTemplates: vi.fn(async () => createSuccessResult([])),
    loadMergeFields: vi.fn(async () => createSuccessResult([])),
    send: vi.fn(async () =>
      createSuccessResult({
        message_id: 'msg-1',
        total_recipients: 1,
        suppression_skipped: 0,
        warnings: [],
      })
    ),
    sendTest: vi.fn(async () =>
      createSuccessResult({
        message_id: 'test-1',
        total_recipients: 1,
        suppression_skipped: 0,
        warnings: [],
      })
    ),
    schedule: vi.fn(async () => createSuccessResult({ message_id: 'msg-2' })),
    saveDraft: vi.fn(async (draft) => createSuccessResult(draft)),
  };
}

const baseRequest: CommSendRequest = {
  organisation_id: 'org-1',
  channel: 'email',
  body_text: 'Hi',
  sender_name: 'Org',
  source_app: 'team',
  source_context_type: 'organisation',
  source_context_id: 'org-1',
  bypass_suppression: true,
};

describe('createTeamCommSendAdapter', () => {
  it('strips source_context and bypass_suppression on send', async () => {
    const base = mockBaseAdapter();
    const adapter = createTeamCommSendAdapter(base, {
      getEstimatedRecipientCount: () => 1,
    });

    await adapter.send(baseRequest);

    const call = vi.mocked(base.send).mock.calls[0]?.[0];
    expect(call?.source_app).toBe('team');
    expect(call).not.toHaveProperty('source_context_type');
    expect(call).not.toHaveProperty('source_context_id');
    expect(call).not.toHaveProperty('bypass_suppression');
  });

  it('blocks send and schedule when estimated count is zero', async () => {
    const base = mockBaseAdapter();
    const onZeroRecipientBlocked = vi.fn();
    const adapter = createTeamCommSendAdapter(base, {
      getEstimatedRecipientCount: () => 0,
      onZeroRecipientBlocked,
    });

    const sendResult = await adapter.send(baseRequest);
    const scheduleResult = await adapter.schedule({ ...baseRequest, scheduled_at: '2026-12-01T10:00' });

    expect(sendResult.ok).toBe(false);
    if (sendResult.ok === false) {
      expect(sendResult.error.message).toBe(ZERO_RECIPIENT_MESSAGE);
    }
    expect(scheduleResult.ok).toBe(false);
    expect(base.send).not.toHaveBeenCalled();
    expect(base.schedule).not.toHaveBeenCalled();
    expect(onZeroRecipientBlocked).toHaveBeenCalledTimes(2);
  });

  it('invokes onSendTestSuccess when sendTest succeeds', async () => {
    const base = mockBaseAdapter();
    const onSendTestSuccess = vi.fn();
    const adapter = createTeamCommSendAdapter(base, {
      getEstimatedRecipientCount: () => 1,
      onSendTestSuccess,
    });

    const testRequest = {
      organisation_id: 'org-1',
      channel: 'email',
      body_text: 'Hi',
      sender_name: 'Org',
      source_app: 'team',
      source_context_type: 'organisation',
      source_context_id: 'org-1',
    } satisfies CommSendTestRequest;

    await adapter.sendTest(testRequest);

    expect(onSendTestSuccess).toHaveBeenCalledOnce();
    const call = vi.mocked(base.sendTest).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty('source_context_type');
    expect(call).not.toHaveProperty('source_context_id');
  });

  it('omits source context from loadMergeFields input', async () => {
    const base = mockBaseAdapter();
    const adapter = createTeamCommSendAdapter(base, {
      getEstimatedRecipientCount: () => 1,
    });

    await adapter.loadMergeFields({
      organisationId: 'org-1',
      channel: 'email',
      recipientPool: { type: 'manual', member_ids: ['m1'] },
      sourceContextType: 'organisation',
      sourceContextId: 'org-1',
    });

    expect(base.loadMergeFields).toHaveBeenCalledWith({
      organisationId: 'org-1',
      channel: 'email',
      recipientPool: { type: 'manual', member_ids: ['m1'] },
    });
  });
});
