/* eslint-disable pace-core-compliance/max-named-exports */
import type { WorkflowAccessMode } from '@solvera/pace-core/forms';
import type {
  WorkflowAuthoringMetadata,
  WorkflowAuthoringState,
  WorkflowFieldDefinition,
  WorkflowFormStatus,
  WorkflowType,
} from '@solvera/pace-core/forms';

import type {
  CoreFormDetailRaw,
  CoreFormFieldRaw,
  CoreFormListRowRaw,
  MapDetailToAuthoringResult,
  OrgFormScheduleLimitsInput,
  OrgFormsTableRow,
  OrgWorkflowType,
} from '@/lib/forms/orgForms.types';
import { statusBadgeLabel, workflowTypeTeamLabel } from '@/lib/forms/orgForms.display';

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (iso == null || iso.trim() === '') {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function datetimeLocalToIso(local: string): string | null {
  const trimmed = local.trim();
  if (trimmed === '') {
    return null;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export function parseMaxSubmissionsInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.floor(n);
}

const TEAM_ALLOWED: ReadonlySet<WorkflowType> = new Set([
  'org_signup',
  'information_collection',
  'consent_capture',
  'generic',
]);

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
    isPrimaryEntrypoint: false,
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
  };
}

function coerceWorkflowType(raw: string): WorkflowType {
  if (TEAM_ALLOWED.has(raw as WorkflowType)) {
    return raw as WorkflowType;
  }
  return 'generic';
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

export function mapDetailRowToAuthoring(row: CoreFormDetailRaw): MapDetailToAuthoringResult {
  const metadata: WorkflowAuthoringMetadata = {
    id: row.id,
    organisationId: row.organisation_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    workflowType: coerceWorkflowType(row.workflow_type),
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
    isPrimaryEntrypoint: row.is_primary_entrypoint === true,
    isActive: row.is_active !== false,
  };

  const fieldRows = row.fields ?? [];
  const sorted = [...fieldRows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const fields = sorted.map(mapFieldRow);

  const scheduleLimits: OrgFormScheduleLimitsInput = {
    maxSubmissionsInput: row.max_submissions == null ? '' : String(row.max_submissions),
    confirmationMessage: row.confirmation_message ?? '',
    isRequired: row.is_required === true,
  };

  return { state: { metadata, fields }, scheduleLimits };
}

export function mapListRowToTableRow(row: CoreFormListRowRaw): OrgFormsTableRow {
  const wfType = coerceWorkflowType(row.workflow_type) as OrgWorkflowType;
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

export interface CoreFormFieldWriteRow {
  form_id: string;
  organisation_id: string;
  field_key: string;
  field_label: string | null;
  field_type: string;
  field_description: null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  validation_rules: null;
  display_options: Record<string, unknown> | null;
}

function coreFieldWritableColumns(field: WorkflowFieldDefinition): {
  field_key: string;
  field_label: string | null;
  field_type: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  display_options: Record<string, unknown> | null;
} {
  const lt = field.fieldLabel?.trim() ?? '';
  const disp =
    field.displayOptions != null && Object.keys(field.displayOptions).length > 0
      ? field.displayOptions
      : null;
  return {
    field_key: field.fieldKey.trim(),
    field_label: lt === '' ? null : lt,
    field_type: field.fieldType.trim().toLowerCase(),
    sort_order: field.sortOrder,
    is_required: field.isRequired === true,
    is_active: field.isActive !== false,
    display_options: disp,
  };
}

/** UPDATE payload fragment for PostgREST on `core_form_fields`. */
export function mapDefinitionToFieldUpdatePayload(field: WorkflowFieldDefinition): Record<string, unknown> {
  const columns = coreFieldWritableColumns(field);
  return {
    field_key: columns.field_key,
    field_label: columns.field_label,
    field_type: columns.field_type,
    sort_order: columns.sort_order,
    is_required: columns.is_required,
    is_active: columns.is_active,
    display_options: columns.display_options,
  };
}

export function mapDefinitionToInsertFieldRow(
  formId: string,
  organisationId: string,
  field: WorkflowFieldDefinition,
): CoreFormFieldWriteRow {
  return {
    form_id: formId,
    organisation_id: organisationId,
    ...coreFieldWritableColumns(field),
    field_description: null,
    validation_rules: null,
  };
}

/** Returns ids from previous DB fetch removed from current state — uuid-only from server. */
export function computeRemovedFieldIds(
  priorDbFieldIds: string[],
  currentFields: WorkflowFieldDefinition[]
): string[] {
  const current = new Set(currentFields.map((f) => f.id));
  return priorDbFieldIds.filter((id) => !current.has(id));
}

/** Heuristic: pace-core authoring rows use synthetic ids (`field-<n>`). Server rows are UUID-shaped. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyPersistedFieldId(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function computeFieldsToInsert(
  currentFields: WorkflowFieldDefinition[]
): WorkflowFieldDefinition[] {
  return currentFields.filter((f) => !isLikelyPersistedFieldId(f.id));
}

export function computeFieldsToUpdate(
  currentFields: WorkflowFieldDefinition[]
): WorkflowFieldDefinition[] {
  return currentFields.filter((f) => isLikelyPersistedFieldId(f.id));
}
