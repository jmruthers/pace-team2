export type MembershipStatus = 'Active' | 'Suspended' | 'Provisional' | 'Lapsed' | 'Resigned' | 'Revoked';
export type RequestType = 'join' | 'transfer';

export interface MembershipTypeOption {
  id: number;
  name: string;
}

export interface MemberDirectoryRow extends Record<string, unknown> {
  id: string;
  personId: string;
  membershipNumber: string | null;
  membershipStatus: MembershipStatus;
  membershipTypeId: number | null;
  membershipTypeName: string | null;
  organisationId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string | null;
}

export interface PendingDirectoryRow extends MemberDirectoryRow {
  requestType: RequestType;
  requestedAt: string;
}

export interface ManualPickPayload {
  organisationId: string;
  memberIds: string[];
  updatedAt: number;
}

export interface PickerBannerState {
  variant: 'default' | 'destructive';
  title: string;
  description: string;
  doneEnabled: boolean;
  showEmptyHelper: boolean;
}

export interface TeamMemberRequestMatchRecord {
  id: string;
  organisation_id: string;
  subject_member_id: string | null;
  subject_person_id: string | null;
  request_type: RequestType;
  status: 'pending' | 'on_hold';
  created_at: string;
}
