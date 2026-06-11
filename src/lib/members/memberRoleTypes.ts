import type { MemberRoleTypeOption } from '@/lib/members/memberRoles.types';

export function filterRoleTypesForMembership(
  roleTypes: MemberRoleTypeOption[],
  membershipTypeId: number | null
): MemberRoleTypeOption[] {
  if (membershipTypeId == null) {
    return roleTypes;
  }
  return roleTypes.filter(
    (roleType) => roleType.membershipTypeId == null || roleType.membershipTypeId === membershipTypeId
  );
}
