import { describe, expect, it, vi } from 'vitest';
import {
  buildResolveInvalidationTargets,
  buildResolveSuccessInvalidationTargets,
  getResolveErrorOutcome,
  runResolveMemberRequestRpc,
} from '@/hooks/useResolveMemberRequest';

describe('useResolveMemberRequest contracts', () => {
  it('builds invalidation targets for open/closed/request/count keys', () => {
    expect(buildResolveInvalidationTargets('org-1', 'req-1')).toEqual([
      ['approvals', 'open', 'org-1'],
      ['approvals', 'closed', 'org-1'],
      ['approvals', 'request', 'req-1', 'org-1'],
      ['approvals', 'open-count', 'org-1'],
    ]);
  });

  it('uses open + request + count invalidation for put-on-hold', () => {
    expect(buildResolveSuccessInvalidationTargets('org-1', 'req-1', 'on_hold')).toEqual([
      ['approvals', 'open', 'org-1'],
      ['approvals', 'request', 'req-1', 'org-1'],
      ['approvals', 'open-count', 'org-1'],
    ]);
  });

  it('marks stale resolve as navigate + invalidate outcome', () => {
    const outcome = getResolveErrorOutcome(new Error('Resolvable request not found'));
    expect(outcome).toMatchObject({
      shouldNavigateToList: true,
      shouldInvalidateAll: true,
      keepDialogOpen: false,
    });
  });

  it('keeps dialogs open for duplicate member number errors', () => {
    const outcome = getResolveErrorOutcome(new Error('Membership number already exists for this organisation'));
    expect(outcome).toMatchObject({
      shouldNavigateToList: false,
      shouldInvalidateAll: false,
      keepDialogOpen: true,
    });
  });

  it('passes p_placement_role_id null on resolve RPC', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await runResolveMemberRequestRpc({ rpc }, { requestId: 'req-1', status: 'approved' });
    expect(rpc).toHaveBeenCalledWith('app_resolve_member_request', {
      p_request_id: 'req-1',
      p_status: 'approved',
      p_review_notes: null,
      p_member_number: null,
      p_placement_role_id: null,
    });
  });
});
