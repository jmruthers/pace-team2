import type { ApprovalFormResponseEntry, ApprovalRequestStatus, ApprovalRequestType, ApprovalRequestRow } from './approvals.types';

interface JoinedPerson {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
}

interface JoinedMember {
  id?: string;
  organisation_id?: string | null;
  deleted_at?: string | null;
}

interface JoinedMembershipType {
  id?: string | null;
  name?: string | null;
}

interface JoinedOrganisation {
  id?: string;
  name?: string | null;
}

interface JoinedFormField {
  field_key?: string | null;
  label?: string | null;
  sort_order?: number | null;
}

interface JoinedResponseValue {
  field_key?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
  value_uuid?: string | null;
}

function asObject<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function stringifyResponseValue(value: JoinedResponseValue): string {
  if (value.value_text != null && value.value_text.trim().length > 0) {
    return value.value_text;
  }
  if (value.value_number != null) {
    return String(value.value_number);
  }
  if (value.value_boolean != null) {
    return value.value_boolean ? 'Yes' : 'No';
  }
  if (value.value_date != null && value.value_date.length > 0) {
    return value.value_date;
  }
  if (value.value_uuid != null && value.value_uuid.length > 0) {
    return value.value_uuid;
  }
  return '—';
}

export function getPersonDisplayName(row: ApprovalRequestRow): string {
  const firstName = row.subjectPreferredName ?? row.subjectFirstName ?? '';
  const lastName = row.subjectLastName ?? '';
  const candidate = `${firstName} ${lastName}`.trim();
  if (candidate.length > 0) {
    return candidate;
  }
  return 'Unknown applicant';
}

/** TM05 F-39 — initials seed uses preferred_name ?? first_name with last_name. */
export function getApprovalApplicantAvatarName(row: ApprovalRequestRow): string {
  const preferred = row.subjectPreferredName?.trim() ?? '';
  const first = row.subjectFirstName?.trim() ?? '';
  const last = row.subjectLastName?.trim() ?? '';
  const given = preferred.length > 0 ? preferred : first;
  const compound = `${given} ${last}`.trim();
  if (compound.length > 0) {
    return compound;
  }
  return getPersonDisplayName(row);
}

export function hasDistinctApprovalPreferredName(row: ApprovalRequestRow): boolean {
  const preferred = row.subjectPreferredName?.trim() ?? '';
  const first = row.subjectFirstName?.trim() ?? '';
  return preferred.length > 0 && first.length > 0 && preferred !== first;
}

export function getResolverDisplayName(row: ApprovalRequestRow): string {
  const firstName = row.resolverPreferredName ?? row.resolverFirstName ?? '';
  const lastName = row.resolverLastName ?? '';
  const candidate = `${firstName} ${lastName}`.trim();
  if (candidate.length > 0) {
    return candidate;
  }
  return 'Unknown reviewer';
}

export function statusLabel(status: ApprovalRequestStatus): string {
  if (status === 'on_hold') {
    return 'On hold';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function requestTypeLabel(type: ApprovalRequestType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatRequestSubmittedAt(iso: string | null): string {
  if (iso == null || iso.trim() === '') {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const datePart = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const timePart = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${datePart} at ${timePart}`;
}

export function formatResolvedDateHeading(iso: string | null): string {
  if (iso == null || iso.trim() === '') {
    return 'unknown date';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return 'unknown date';
  }
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function mapRequestCoreFields(raw: Record<string, unknown>): Pick<
  ApprovalRequestRow,
  | 'id'
  | 'organisationId'
  | 'requestType'
  | 'status'
  | 'createdAt'
  | 'resolvedAt'
  | 'targetOrganisationId'
  | 'sourceOrganisationId'
  | 'membershipTypeId'
  | 'applicantMemberNumber'
  | 'reviewNotes'
> {
  return {
    id: String(raw.id ?? ''),
    organisationId: String(raw.organisation_id ?? ''),
    requestType: (raw.request_type as ApprovalRequestType) ?? 'join',
    status: (raw.status as ApprovalRequestStatus) ?? 'pending',
    createdAt: (raw.created_at as string | null) ?? null,
    resolvedAt: (raw.resolved_at as string | null) ?? null,
    targetOrganisationId: (raw.target_organisation_id as string | null) ?? null,
    sourceOrganisationId: (raw.source_organisation_id as string | null) ?? null,
    membershipTypeId: (raw.membership_type_id as string | null) ?? null,
    applicantMemberNumber: (raw.applicant_member_number as string | null) ?? null,
    reviewNotes: (raw.review_notes as string | null) ?? (raw.resolution_note as string | null) ?? null,
  };
}

function mapSubjectPersonFields(person: JoinedPerson | null): Pick<
  ApprovalRequestRow,
  'subjectPersonId' | 'subjectFirstName' | 'subjectLastName' | 'subjectPreferredName' | 'subjectEmail'
> {
  return {
    subjectPersonId: (person?.id as string | undefined) ?? null,
    subjectFirstName: person?.first_name ?? null,
    subjectLastName: person?.last_name ?? null,
    subjectPreferredName: person?.preferred_name ?? null,
    subjectEmail: person?.email ?? null,
  };
}

function mapSubjectMemberFields(member: JoinedMember | null): Pick<
  ApprovalRequestRow,
  'subjectMemberId' | 'subjectMemberOrganisationId' | 'subjectMemberDeletedAt'
> {
  return {
    subjectMemberId: (member?.id as string | undefined) ?? null,
    subjectMemberOrganisationId: member?.organisation_id ?? null,
    subjectMemberDeletedAt: member?.deleted_at ?? null,
  };
}

function mapResolverPersonFields(person: JoinedPerson | null): Pick<
  ApprovalRequestRow,
  'resolverFirstName' | 'resolverLastName' | 'resolverPreferredName'
> {
  return {
    resolverFirstName: person?.first_name ?? null,
    resolverLastName: person?.last_name ?? null,
    resolverPreferredName: person?.preferred_name ?? null,
  };
}

export function mapRequestRow(raw: Record<string, unknown>): ApprovalRequestRow {
  const subjectPerson = asObject(raw.subject_person as JoinedPerson | JoinedPerson[] | null);
  const subjectMember = asObject(raw.subject_member as JoinedMember | JoinedMember[] | null);
  const membershipType = asObject(raw.membership_type as JoinedMembershipType | JoinedMembershipType[] | null);
  const sourceOrg = asObject(raw.source_org as JoinedOrganisation | JoinedOrganisation[] | null);
  const targetOrg = asObject(raw.target_org as JoinedOrganisation | JoinedOrganisation[] | null);
  const resolverPerson = asObject(raw.resolver_person as JoinedPerson | JoinedPerson[] | null);

  return {
    ...mapRequestCoreFields(raw),
    targetOrganisationName: targetOrg?.name ?? null,
    membershipTypeName: membershipType?.name ?? null,
    sourceOrganisationName: sourceOrg?.name ?? null,
    ...mapSubjectPersonFields(subjectPerson),
    ...mapSubjectMemberFields(subjectMember),
    ...mapResolverPersonFields(resolverPerson),
  };
}

export function mapFormResponseEntries(raw: Record<string, unknown> | null): ApprovalFormResponseEntry[] {
  if (raw == null) {
    return [];
  }
  const values = asArray(raw.values as JoinedResponseValue[] | JoinedResponseValue | null);
  const form = asObject(raw.form as { fields?: JoinedFormField[] | JoinedFormField | null } | null);
  const fields = asArray(form?.fields);
  const labelByKey = new Map<string, string>();
  const orderByKey = new Map<string, number>();

  for (const field of fields) {
    const fieldKey = field.field_key ?? '';
    if (fieldKey.length === 0) {
      continue;
    }
    labelByKey.set(fieldKey, field.label ?? fieldKey);
    orderByKey.set(fieldKey, field.sort_order ?? Number.MAX_SAFE_INTEGER);
  }

  return values
    .map((value): ApprovalFormResponseEntry | null => {
      const fieldKey = value.field_key ?? '';
      if (fieldKey.length === 0) {
        return null;
      }
      return {
        fieldKey,
        label: labelByKey.get(fieldKey) ?? fieldKey,
        value: stringifyResponseValue(value),
        sortOrder: orderByKey.get(fieldKey) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry): entry is ApprovalFormResponseEntry => entry != null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}
