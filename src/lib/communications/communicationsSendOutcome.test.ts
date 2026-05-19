import { describe, expect, it } from 'vitest';
import { appendSendOutcomeDescription } from '@/lib/communications/communicationsSendOutcome';

describe('appendSendOutcomeDescription', () => {
  it('returns undefined when no suppression or warnings', () => {
    expect(
      appendSendOutcomeDescription({
        message_id: 'm1',
        total_recipients: 10,
        suppression_skipped: 0,
        warnings: [],
      })
    ).toBeUndefined();
  });

  it('appends suppression and warning fragments', () => {
    expect(
      appendSendOutcomeDescription({
        message_id: 'm1',
        total_recipients: 47,
        suppression_skipped: 3,
        warnings: [{ type: 'unresolved_token', count: 1, message: 'x' }],
      })
    ).toBe(
      '3 skipped (suppression). Some recipients had unresolved tokens; check delivery in PUMP.'
    );
  });
});
