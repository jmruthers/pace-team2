import type { WorkflowAuthoringValidationIssue } from '@solvera/pace-core/forms';

import type { OrgFormScheduleLimitsInput } from '@/lib/forms/orgForms.types';

/** TEAM-only rules layered on pace-core `validateWorkflowAuthoringState` (TM09 BR-F rule 7). */
export function validateOrgFormAuthoringExtras(
  workflowType: string,
  scheduleLimits: OrgFormScheduleLimitsInput,
): WorkflowAuthoringValidationIssue[] {
  if (
    scheduleLimits.isPrimaryEntrypoint === true &&
    workflowType !== 'base_registration' &&
    workflowType !== 'org_signup'
  ) {
    return [
      {
        code: 'invalid_entrypoint',
        path: 'scheduleLimits.isPrimaryEntrypoint',
        message: 'Primary entrypoint is only valid for base_registration and org_signup forms.',
      },
    ];
  }
  return [];
}
