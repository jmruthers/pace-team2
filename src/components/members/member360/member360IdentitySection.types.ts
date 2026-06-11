import type { Badge } from '@solvera/pace-core/components';
import type { IdentityFormValues } from '@/lib/members/member360.types';

export interface Member360IdentityDisplayProps {
  memberName: string;
  memberEmail: string;
  phonesText: string;
  residentialAddress: string;
  postalAddress: string;
  showIssuingOrganisation: boolean;
  issuingOrganisationName: string | null;
  placementOrganisationName: string | null;
  activePlacementStartDate: string | null;
  allowUpdate: boolean;
  showPortalEdit: boolean;
  showPortalView: boolean;
  onPortalEdit: () => void;
  onPortalView: () => void;
  memberStatusLabel: string;
  memberStatusVariant: Parameters<typeof Badge>[0]['variant'];
}

export interface Member360IdentityFormProps {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  initialValues: IdentityFormValues;
  onSubmit: (values: IdentityFormValues) => Promise<void>;
  onDirtyCancel: () => void;
  savePending: boolean;
  genderOptions: Array<{ id: number; name: string }>;
  pronounOptions: Array<{ id: number; name: string }>;
  membershipTypeOptions: Array<{ id: number; name: string }>;
}

export interface Member360IdentitySectionProps {
  display: Member360IdentityDisplayProps;
  form: Member360IdentityFormProps;
}
