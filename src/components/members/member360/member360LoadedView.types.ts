import type { DataTableColumn } from '@solvera/pace-core/components';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type {
  AdditionalContactRow,
  IdentityFormValues,
  LookupOption,
  MemberApplicationRow,
  MemberCardRow,
  MemberProfileRecord,
} from '@/lib/members/member360.types';

export interface Member360IdentityPanelProps {
  member: MemberProfileRecord;
  memberName: string;
  memberEmailText: string;
  memberPhonesText: string;
  memberResidentialAddressText: string;
  memberPostalAddressText: string;
  showIssuingOrganisation: boolean;
  issuingOrganisationName: string | null;
  placementOrganisationName: string | null;
  activePlacementStartDate: string | null;
  canUpdateMember: boolean;
  showPortalEdit: boolean;
  showPortalView: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  initialValues: IdentityFormValues;
  saveIdentity: (params: {
    member: MemberProfileRecord;
    values: IdentityFormValues;
    lookups: {
      genderTypes: LookupOption[];
      pronounTypes: LookupOption[];
      membershipTypes: LookupOption[];
    };
  }) => Promise<unknown>;
  saveIdentityPending: boolean;
  genderTypes: LookupOption[];
  pronounTypes: LookupOption[];
  membershipTypes: LookupOption[];
  onDiscardDialogOpen: () => void;
}

export interface Member360RecordsPanelProps {
  contacts: AdditionalContactRow[];
  filteredContacts: AdditionalContactRow[];
  contactsSearch: string;
  onContactsSearchChange: (value: string) => void;
  contactsLoading: boolean;
  contactsErrorMessage: string | null;
  onRefetchContacts: () => void;
  contactColumns: DataTableColumn<AdditionalContactRow>[];
  cards: MemberCardRow[];
  filteredCards: MemberCardRow[];
  cardsSearch: string;
  onCardsSearchChange: (value: string) => void;
  cardsLoading: boolean;
  cardsErrorMessage: string | null;
  onRefetchCards: () => void;
  cardColumns: DataTableColumn<MemberCardRow>[];
  applications: MemberApplicationRow[];
  filteredApplications: MemberApplicationRow[];
  applicationsSearch: string;
  onApplicationsSearchChange: (value: string) => void;
  applicationsLoading: boolean;
  applicationsErrorMessage: string | null;
  onRefetchApplications: () => void;
  applicationColumns: DataTableColumn<MemberApplicationRow>[];
}

export interface Member360OverlaysPanelProps {
  discardDialogOpen: boolean;
  setDiscardDialogOpen: (value: boolean) => void;
  setEditing: (value: boolean) => void;
  deactivateTarget: MemberCardRow | null;
  setDeactivateTarget: (value: MemberCardRow | null) => void;
  deactivateOrReactivateCard: (params: { cardId: string; isActive: boolean }) => Promise<unknown>;
  selectedContact: AdditionalContactRow | null;
  setSelectedContact: (value: AdditionalContactRow | null) => void;
  selectedContactDetail: ContactDetailData | null;
  setSelectedContactDetail: (value: ContactDetailData | null) => void;
  selectedContactDetailError: string | null;
  setSelectedContactDetailError: (value: string | null) => void;
}

export interface Member360LoadedViewProps {
  onBack: () => void;
  onViewRoles: () => void;
  memberPhonesErrorMessage: string | null;
  onRefetchMemberPhones: () => void;
  identity: Member360IdentityPanelProps;
  records: Member360RecordsPanelProps;
  overlays: Member360OverlaysPanelProps;
}
