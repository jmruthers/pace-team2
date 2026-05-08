/* eslint-disable pace-core-compliance/max-named-exports */
export type MembershipStatus = 'Active' | 'Provisional' | 'Suspended' | 'Lapsed' | 'Resigned' | 'Revoked';

export type ContactPermissionType = 'full' | 'notify' | 'none';

export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'draft';

export interface MemberProfileRecord {
  id: string;
  personId: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string | null;
  dateOfBirth: string | null;
  genderId: number | null;
  genderName: string | null;
  pronounId: number | null;
  pronounName: string | null;
  userId: string | null;
  membershipTypeId: number | null;
  membershipTypeName: string | null;
  membershipNumber: string | null;
  membershipStatus: MembershipStatus;
  validFrom: string | null;
  validTo: string | null;
  residentialAddressId: string | null;
  residentialAddress: string | null;
  postalAddressId: string | null;
  postalAddress: string | null;
}

export interface MemberPhoneRow {
  id: string;
  personId: string;
  phoneNumber: string | null;
  phoneTypeName: string | null;
}

export interface AdditionalContactRow extends Record<string, unknown> {
  id: string;
  personId: string;
  contactPersonId: string | null;
  contactTypeName: string | null;
  permissionType: ContactPermissionType;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  residentialAddressId: string | null;
  postalAddressId: string | null;
}

export interface MemberCardRow extends Record<string, unknown> {
  id: string;
  memberId: string;
  cardIdentifier: string;
  isActive: boolean;
  createdAt: string;
}

export interface MemberApplicationRow extends Record<string, unknown> {
  id: string;
  status: ApplicationStatus;
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
}

export interface LookupOption {
  id: number;
  name: string;
}

export interface IdentityFormValues {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  dateOfBirth: string;
  genderId: string;
  pronounId: string;
  membershipTypeId: string;
  membershipNumber: string;
  validFrom: string;
  validTo: string;
}

export interface ContactDetailData {
  phonesText: string;
  residentialAddress: string;
  postalAddress: string;
}
