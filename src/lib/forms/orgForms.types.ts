import type { WorkflowAuthoringState } from '@solvera/pace-core/forms';

export type OrgWorkflowType =
  | 'org_signup'
  | 'information_collection'
  | 'consent_capture'
  | 'generic';

/** Schedule & limits columns on `core_forms` authored outside `WorkflowAuthoringMetadata`. */
export interface OrgFormScheduleLimitsInput {
  maxSubmissionsInput: string;
  confirmationMessage: string;
  isRequired: boolean;
  isPrimaryEntrypoint: boolean;
}

export interface CoreFormListRowRaw {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  workflow_type: string;
  status: string;
  access_mode: string;
  is_active: boolean;
  is_primary_entrypoint: boolean;
  opens_at: string | null;
  closes_at: string | null;
  max_submissions: number | null;
  confirmation_message: string | null;
  is_required: boolean;
  updated_at: string;
}

export interface CoreFormFieldRaw {
  id: string;
  field_key: string;
  field_label: string | null;
  field_type: string | null;
  sort_order: number | null;
  is_required: boolean | null;
  is_active: boolean | null;
  display_options: Record<string, unknown> | null;
}

export interface CoreFormDetailRaw extends Omit<CoreFormListRowRaw, 'updated_at'> {
  organisation_id: string;
  workflow_config: unknown;
  title: string | null;
  fields: CoreFormFieldRaw[] | null;
  updated_at: string | null;
}

/** DataTable row enriched for search/sort/display. */
export interface OrgFormsTableRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  workflow_type: OrgWorkflowType;
  status: 'draft' | 'published' | 'closed';
  is_active: boolean;
  is_primary_entrypoint: boolean;
  updated_at: string;
  workflowTypeLabel: string;
  statusLabelTitleCase: string;
  /** Ascending puts primary-first (TM09 F-26). */
  primarySortRank: number;
}

export interface MapDetailToAuthoringResult {
  state: WorkflowAuthoringState;
  scheduleLimits: OrgFormScheduleLimitsInput;
}
