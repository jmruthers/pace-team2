import type { WorkflowFieldDefinition } from '@solvera/pace-core/forms';

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
