export interface SubOrganisationRow extends Record<string, unknown> {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  parentId: string | null;
}

export interface SubOrganisationFormValues {
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
}

export interface CreateSubOrganisationInput {
  name: string;
  displayName: string;
  description: string | null;
  parentId: string;
}

export interface UpdateSubOrganisationInput {
  displayName: string;
  description: string | null;
  isActive: boolean;
}

export interface SubOrganisationMutationError {
  code?: string;
  message: string;
  raw: unknown;
}
