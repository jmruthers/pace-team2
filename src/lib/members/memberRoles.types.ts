export interface MemberRolesMemberRecord {
  id: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
}

export interface MemberRoleTypeOption {
  id: number;
  name: string;
}

export interface MemberRoleRow extends Record<string, unknown> {
  id: string;
  memberId: string;
  roleId: number;
  organisationId: string;
  startDate: string;
  endDate: string | null;
  roleName: string | null;
}

export interface AddMemberRolePayload {
  memberId: string;
  roleId: number;
  organisationId: string;
  startDate: string;
}

export interface EndMemberRolePayload {
  roleEntryId: string;
  organisationId: string;
  endDate: string;
}
