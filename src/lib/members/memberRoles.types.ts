export interface MemberRolesMemberRecord {
  id: string;
  organisationId: string;
  membershipTypeId: number | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
}

export interface MemberRoleTypeOption {
  id: number;
  name: string;
  membershipTypeId: number | null;
}

export interface MemberRoleRow extends Record<string, unknown> {
  id: string;
  memberId: string;
  roleId: number;
  organisationId: string;
  startDate: string;
  endDate: string | null;
  roleName: string | null;
  title: string | null;
}

export interface AddMemberRolePayload {
  memberId: string;
  roleId: number;
  organisationId: string;
  startDate: string;
  title?: string | null;
}

export interface EditMemberRolePayload {
  roleEntryId: string;
  organisationId: string;
  roleId: number;
  title?: string | null;
}

export interface EndMemberRolePayload {
  roleEntryId: string;
  organisationId: string;
  endDate: string;
}
