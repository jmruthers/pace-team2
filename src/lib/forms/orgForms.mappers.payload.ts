import type { WorkflowAuthoringState } from '@solvera/pace-core/forms';

import type { OrgFormScheduleLimitsInput } from '@/lib/forms/orgForms.types';
import { parseMaxSubmissionsInput } from '@/lib/forms/orgForms.mappers.datetime';

export interface CoreFormsInsertPayload {
  name: string;
  slug: string;
  description: string | null;
  workflow_type: string;
  access_mode: string;
  status: string;
  is_primary_entrypoint: boolean;
  is_active: boolean;
  organisation_id: string;
  event_id: null;
  workflow_config: Record<string, never>;
  title: null;
  opens_at: string | null;
  closes_at: string | null;
  max_submissions: number | null;
  confirmation_message: string | null;
  is_required: boolean;
}

export interface CoreFormsUpdatePayload {
  name: string;
  description: string | null;
  workflow_type: string;
  access_mode: string;
  status: string;
  is_primary_entrypoint: boolean;
  is_active: boolean;
  event_id: null;
  workflow_config: Record<string, never>;
  title: null;
  opens_at: string | null;
  closes_at: string | null;
  max_submissions: number | null;
  confirmation_message: string | null;
  is_required: boolean;
}

export function mapStateToCoreFormsInsertPayload(
  organisationId: string,
  state: WorkflowAuthoringState,
  scheduleLimits: OrgFormScheduleLimitsInput
): CoreFormsInsertPayload {
  const meta = state.metadata;
  const desc = meta.description?.trim() ?? '';
  const conf = scheduleLimits.confirmationMessage.trim();

  return {
    name: meta.name.trim(),
    slug: meta.slug.trim(),
    description: desc === '' ? null : desc,
    workflow_type: meta.workflowType,
    access_mode: meta.accessMode,
    status: meta.status,
    is_primary_entrypoint: meta.isPrimaryEntrypoint === true,
    is_active: meta.isActive !== false,
    organisation_id: organisationId,
    event_id: null,
    workflow_config: {},
    title: null,
    opens_at: meta.opensAt ?? null,
    closes_at: meta.closesAt ?? null,
    max_submissions: parseMaxSubmissionsInput(scheduleLimits.maxSubmissionsInput),
    confirmation_message: conf === '' ? null : conf,
    is_required: scheduleLimits.isRequired === true,
  };
}

export function mapStateToCoreFormsUpdatePayload(
  state: WorkflowAuthoringState,
  scheduleLimits: OrgFormScheduleLimitsInput
): CoreFormsUpdatePayload {
  const meta = state.metadata;
  const desc = meta.description?.trim() ?? '';
  const conf = scheduleLimits.confirmationMessage.trim();

  return {
    name: meta.name.trim(),
    description: desc === '' ? null : desc,
    workflow_type: meta.workflowType,
    access_mode: meta.accessMode,
    status: meta.status,
    is_primary_entrypoint: meta.isPrimaryEntrypoint === true,
    is_active: meta.isActive !== false,
    event_id: null,
    workflow_config: {},
    title: null,
    opens_at: meta.opensAt ?? null,
    closes_at: meta.closesAt ?? null,
    max_submissions: parseMaxSubmissionsInput(scheduleLimits.maxSubmissionsInput),
    confirmation_message: conf === '' ? null : conf,
    is_required: scheduleLimits.isRequired === true,
  };
}
