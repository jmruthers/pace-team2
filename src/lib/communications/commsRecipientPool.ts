import type { RecipientPoolDescriptor } from '@solvera/pace-core/comms';

/** TM13 F-27 — org broadcast pool with optional filters (ids cast to string at boundary). */
export function buildOrgMembersPool(
  organisationId: string,
  memberTypeStringIds: string[],
  includeInactive: boolean
): RecipientPoolDescriptor {
  const filters: {
    member_type_ids?: string[];
    include_inactive?: boolean;
  } = {};

  if (memberTypeStringIds.length > 0) {
    filters.member_type_ids = [...memberTypeStringIds];
  }
  if (includeInactive) {
    filters.include_inactive = true;
  }

  const hasFilters = Object.keys(filters).length > 0;

  return {
    type: 'org_members',
    organisation_id: organisationId,
    ...(hasFilters ? { filters } : {}),
  };
}
