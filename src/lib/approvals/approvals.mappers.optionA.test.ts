import { describe, expect, it } from 'vitest';
import {
  buildMembershipIssuingOrgMessage,
  buildTransferClosureMessage,
} from '@/lib/approvals/approvals.optionA.copy';

describe('Option A approval copy helpers', () => {
  it('builds membership issuing org message', () => {
    expect(buildMembershipIssuingOrgMessage('Scouts Victoria')).toBe(
      'Membership record will be held at: Scouts Victoria'
    );
  });

  it('returns null for empty issuing org name', () => {
    expect(buildMembershipIssuingOrgMessage('  ')).toBeNull();
  });

  it('builds transfer closure message', () => {
    expect(buildTransferClosureMessage('1st Morwell')).toBe(
      'Membership at 1st Morwell will be closed on approval.'
    );
  });
});
