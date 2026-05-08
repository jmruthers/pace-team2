export type ApprovalRequestStatus = 'pending' | 'on_hold' | 'approved' | 'rejected' | 'withdrawn';
export type ApprovalRequestType = 'join' | 'transfer';
export type ApprovalRequestTypeFilter = 'all' | ApprovalRequestType;

export interface ApprovalRequestRow extends Record<string, unknown> {
  id: string;
  organisationId: string;
  requestType: ApprovalRequestType;
  status: ApprovalRequestStatus;
  createdAt: string | null;
  resolvedAt: string | null;
  targetOrganisationId: string | null;
  sourceOrganisationId: string | null;
  membershipTypeId: string | null;
  membershipTypeName: string | null;
  applicantMemberNumber: string | null;
  reviewNotes: string | null;
  subjectPersonId: string | null;
  subjectFirstName: string | null;
  subjectLastName: string | null;
  subjectPreferredName: string | null;
  subjectEmail: string | null;
  sourceOrganisationName: string | null;
  subjectMemberId: string | null;
  subjectMemberDeletedAt: string | null;
  resolverFirstName: string | null;
  resolverLastName: string | null;
  resolverPreferredName: string | null;
}

export interface ApprovalFormResponseEntry extends Record<string, unknown> {
  fieldKey: string;
  label: string;
  value: string;
  sortOrder: number;
}

export interface ResolveRequestPayload {
  requestId: string;
  status: 'approved' | 'rejected' | 'on_hold';
  reviewNotes?: string | null;
  memberNumber?: string | null;
}
