import type {
  WorkflowAccessMode,
  WorkflowAuthoringMetadata,
  WorkflowAuthoringState,
  WorkflowFieldDefinition,
  WorkflowFormStatus,
  WorkflowType,
} from '@solvera/pace-core/forms';

import { statusBadgeLabel, workflowTypeTeamLabel } from '@/lib/forms/orgForms.display';
import type {
  CoreFormDetailRaw,
  CoreFormFieldRaw,
  CoreFormListRowRaw,
  MapDetailToAuthoringResult,
  OrgFormScheduleLimitsInput,
  OrgFormsTableRow,
  OrgWorkflowType,
} from '@/lib/forms/orgForms.types';

const TEAM_AUTHORING_WORKFLOW_TYPES: ReadonlySet<WorkflowType> = new Set([
  'org_signup',
  'information_collection',
  'consent_capture',
]);

function coerceOrgWorkflowType(raw: string): OrgWorkflowType {
  if (
    raw === 'org_signup' ||
    raw === 'information_collection' ||
    raw === 'consent_capture' ||
    raw === 'generic'
  ) {
    return raw;
  }
  return 'generic';
}

/** Maps DB `workflow_type` to pace-core authoring metadata (legacy `generic` → information_collection). */
function coerceAuthoringWorkflowType(raw: string): WorkflowType {
  if (TEAM_AUTHORING_WORKFLOW_TYPES.has(raw as WorkflowType)) {
    return raw as WorkflowType;
  }
  if (raw === 'generic') {
    return 'information_collection';
  }
  return 'information_collection';
}

function coerceWorkflowAccessMode(raw: string): WorkflowAccessMode {
  return raw === 'public' ? 'public' : 'authenticated_member';
}

function coerceWorkflowStatus(raw: string): WorkflowFormStatus {
  if (raw === 'published' || raw === 'closed') {
    return raw;
  }
  return 'draft';
}

function mapFieldRow(row: CoreFormFieldRaw): WorkflowFieldDefinition {
  const ft = row.field_type?.trim().toLowerCase() ?? 'text';
  return {
    id: row.id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label ?? '',
    fieldType: ft === '' ? 'text' : ft,
    sortOrder: row.sort_order ?? 0,
    isRequired: row.is_required ?? false,
    isActive: row.is_active !== false,
    displayOptions: row.display_options ?? undefined,
  };
}

export function createEmptyAuthoringState(organisationId: string): WorkflowAuthoringState {
  const metadata: WorkflowAuthoringMetadata = {
    slug: '',
    name: '',
    description: '',
    workflowType: 'org_signup',
    accessMode: 'authenticated_member',
    status: 'draft',
    opensAt: null,
    closesAt: null,
    workflowConfig: {},
    isActive: false,
    organisationId,
  };
  return { metadata, fields: [] };
}

export function defaultScheduleLimits(): OrgFormScheduleLimitsInput {
  return {
    maxSubmissionsInput: '',
    confirmationMessage: '',
    isRequired: false,
    isPrimaryEntrypoint: false,
  };
}

export function mapDetailRowToAuthoring(row: CoreFormDetailRaw): MapDetailToAuthoringResult {
  const metadata: WorkflowAuthoringMetadata = {
    id: row.id,
    organisationId: row.organisation_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    workflowType: coerceAuthoringWorkflowType(row.workflow_type),
    accessMode: coerceWorkflowAccessMode(row.access_mode),
    status: coerceWorkflowStatus(row.status),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    workflowConfig:
      typeof row.workflow_config === 'object' &&
      row.workflow_config != null &&
      !Array.isArray(row.workflow_config)
        ? (row.workflow_config as WorkflowAuthoringMetadata['workflowConfig'])
        : {},
    isActive: row.is_active !== false,
  };

  const fieldRows = row.fields ?? [];
  const sorted = [...fieldRows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const fields = sorted.map(mapFieldRow);

  const scheduleLimits: OrgFormScheduleLimitsInput = {
    maxSubmissionsInput: row.max_submissions == null ? '' : String(row.max_submissions),
    confirmationMessage: row.confirmation_message ?? '',
    isRequired: row.is_required === true,
    isPrimaryEntrypoint: row.is_primary_entrypoint === true,
  };

  return { state: { metadata, fields }, scheduleLimits };
}

export function mapListRowToTableRow(row: CoreFormListRowRaw): OrgFormsTableRow {
  const wfType = coerceOrgWorkflowType(row.workflow_type);
  const st = coerceWorkflowStatus(row.status);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    workflow_type: wfType,
    status: st,
    is_active: row.is_active !== false,
    is_primary_entrypoint: row.is_primary_entrypoint === true,
    updated_at: row.updated_at,
    workflowTypeLabel: workflowTypeTeamLabel(wfType),
    statusLabelTitleCase: statusBadgeLabel(st),
    primarySortRank: row.is_primary_entrypoint === true ? 0 : 1,
  };
}
