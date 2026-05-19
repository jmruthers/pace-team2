import type { CommSendResult } from '@solvera/pace-core/comms';

/** TM13 F-49 / BR-16 — optional toast description fragments after send. */
export function appendSendOutcomeDescription(result: CommSendResult): string | undefined {
  const fragments: string[] = [];
  if (result.suppression_skipped > 0) {
    fragments.push(`${result.suppression_skipped} skipped (suppression).`);
  }
  if (result.warnings.length > 0) {
    fragments.push('Some recipients had unresolved tokens; check delivery in PUMP.');
  }
  if (fragments.length === 0) {
    return undefined;
  }
  return fragments.join(' ');
}
