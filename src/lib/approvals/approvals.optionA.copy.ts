export function buildTransferClosureMessage(sourceOrganisationName: string | null): string | null {
  const sourceName = sourceOrganisationName?.trim() ?? '';
  if (sourceName.length === 0) {
    return null;
  }
  return `Membership at ${sourceName} will be closed on approval.`;
}

export function buildMembershipIssuingOrgMessage(issuingOrganisationName: string | null): string | null {
  const name = issuingOrganisationName?.trim() ?? '';
  if (name.length === 0) {
    return null;
  }
  return `Membership record will be held at: ${name}`;
}
