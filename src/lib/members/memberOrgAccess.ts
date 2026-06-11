export function isMemberAccessibleInOrganisation(
  memberOrganisationId: string,
  selectedOrganisationId: string,
  hasActivePlacementInSelectedOrg: boolean
): boolean {
  return memberOrganisationId === selectedOrganisationId || hasActivePlacementInSelectedOrg;
}
