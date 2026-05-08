export interface MembershipTypeRow extends Record<string, unknown> {
  id: number;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  isActive: boolean;
  organisationId: string;
  membersCount: number;
}

export interface MembershipTypeFormValues {
  name: string;
  minAge: string;
  maxAge: string;
  isActive: boolean;
}

export interface MembershipTypeMutationInput {
  name: string;
  minAge: number | null;
  maxAge: number | null;
  isActive: boolean;
}

export interface MembershipTypeMutationError {
  code?: string;
  message: string;
  raw: unknown;
}
