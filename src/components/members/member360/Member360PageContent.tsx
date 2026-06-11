import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { useResourcePermissions } from '@solvera/pace-core/rbac';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { useMember360Data } from '@/hooks/useMember360Data';
import { filterApplications, filterCards, filterContacts } from '@/lib/members/member360.display.badges';
import {
  formatOptionalText,
  formatPhoneRows,
  getMemberDisplayName,
  toIdentityFormValues,
} from '@/lib/members/member360.display.format';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type { AdditionalContactRow, MemberCardRow } from '@/lib/members/member360.types';
import { Member360GuardView } from '@/components/members/member360/Member360GuardView';
import { Member360LoadedView } from '@/components/members/member360/Member360LoadedView';
import { useMember360ContactDetail } from '@/hooks/members/useMember360ContactDetail';
import { useMember360OrganisationReset } from '@/hooks/members/useMember360OrganisationReset';
import { useMember360TableColumns } from '@/hooks/members/useMember360TableColumns';

export function Member360PageContent() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const { user } = useUnifiedAuth();
  const memberPermissions = useResourcePermissions(PAGE_NAMES.members);
  const portalPermissions = useResourcePermissions(PAGE_NAMES.memberProfile);

  const {
    member,
    memberAccessibleInSelectedOrg,
    showIssuingOrganisation,
    issuingOrganisationName,
    activePlacementAtSelectedOrg,
    memberLoading,
    memberErrorMessage,
    refetchMember,
    memberPhones,
    memberPhonesLoading,
    memberPhonesErrorMessage,
    refetchMemberPhones,
    contacts,
    contactsLoading,
    contactsErrorMessage,
    refetchContacts,
    cards,
    cardsLoading,
    cardsErrorMessage,
    refetchCards,
    applications,
    applicationsLoading,
    applicationsErrorMessage,
    refetchApplications,
    genderTypes,
    pronounTypes,
    membershipTypes,
    saveIdentity,
    saveIdentityPending,
    deactivateOrReactivateCard,
    fetchContactDetails,
  } = useMember360Data({
    memberId,
    organisationId: selectedOrganisation?.id ?? null,
  });

  const [editing, setEditing] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<MemberCardRow | null>(null);
  const [selectedContact, setSelectedContact] = useState<AdditionalContactRow | null>(null);
  const [selectedContactDetail, setSelectedContactDetail] = useState<ContactDetailData | null>(null);
  const [selectedContactDetailError, setSelectedContactDetailError] = useState<string | null>(null);
  const [contactsSearch, setContactsSearch] = useState('');
  const [cardsSearch, setCardsSearch] = useState('');
  const [applicationsSearch, setApplicationsSearch] = useState('');
  const memberName = member == null ? 'Member 360' : getMemberDisplayName(member);
  usePaceMain({ printTitle: memberName });

  useMember360ContactDetail(
    selectedContact,
    fetchContactDetails,
    setSelectedContactDetail,
    setSelectedContactDetailError
  );

  useMember360OrganisationReset(
    selectedOrganisation?.id,
    setEditing,
    setDiscardDialogOpen,
    setDeactivateTarget,
    setSelectedContact,
    setSelectedContactDetail,
    setSelectedContactDetailError
  );

  const isOrgMismatch =
    member != null && selectedOrganisation != null && memberAccessibleInSelectedOrg === false;
  const isActingTargetMember = member != null && member.userId != null && user?.id === member.userId;

  const showPortalEdit = !isActingTargetMember && portalPermissions.canUpdate;
  const showPortalView = !isActingTargetMember && !portalPermissions.canUpdate && portalPermissions.canRead;

  const canUpdateMember = memberPermissions.canUpdate;

  const memberPhonesText = formatPhoneRows(memberPhones);
  const memberEmailText = formatOptionalText(member?.email ?? null);
  const memberResidentialAddressText = formatOptionalText(member?.residentialAddress ?? null);
  const memberPostalAddressText = formatOptionalText(member?.postalAddress ?? null);

  const initialValues = member == null ? null : toIdentityFormValues(member);

  const { contactColumns, cardColumns, applicationColumns } = useMember360TableColumns({
    canUpdateMember,
    deactivateOrReactivateCard,
    onDeactivateCard: (row) => setDeactivateTarget(row),
    onViewContact: (row) => {
      setSelectedContactDetail(null);
      setSelectedContactDetailError(null);
      setSelectedContact(row);
    },
  });

  const { filteredContacts, filteredCards, filteredApplications } = useMemo(
    () => ({
      filteredContacts: filterContacts(contacts, contactsSearch),
      filteredCards: filterCards(cards, cardsSearch),
      filteredApplications: filterApplications(applications, applicationsSearch),
    }),
    [applications, applicationsSearch, cards, cardsSearch, contacts, contactsSearch]
  );

  return (
    <Member360GuardView
      memberLoading={memberLoading}
      memberErrorMessage={memberErrorMessage}
      memberMissing={member == null}
      identityValuesMissing={initialValues == null}
      isOrgMismatch={isOrgMismatch}
      onRetryMember={() => void refetchMember()}
      onBackToMembers={() => navigate('/members')}
    >
    <Member360LoadedView
      onBack={() => navigate('/members')}
      onViewRoles={() => navigate(`/members/${member.id}/roles`)}
      memberPhonesErrorMessage={memberPhonesErrorMessage}
      onRefetchMemberPhones={() => void refetchMemberPhones()}
      identity={{
        member,
        memberName,
        memberEmailText,
        memberPhonesText: memberPhonesLoading ? 'Loading…' : memberPhonesText,
        memberResidentialAddressText,
        memberPostalAddressText,
        showIssuingOrganisation,
        issuingOrganisationName,
        placementOrganisationName:
          activePlacementAtSelectedOrg != null
            ? (selectedOrganisation?.display_name ?? selectedOrganisation?.name ?? null)
            : null,
        activePlacementStartDate: activePlacementAtSelectedOrg?.startDate ?? null,
        canUpdateMember,
        showPortalEdit,
        showPortalView,
        editing,
        setEditing,
        initialValues,
        saveIdentity,
        saveIdentityPending,
        genderTypes,
        pronounTypes,
        membershipTypes,
        onDiscardDialogOpen: () => setDiscardDialogOpen(true),
      }}
      records={{
        contacts,
        filteredContacts,
        contactsSearch,
        onContactsSearchChange: setContactsSearch,
        contactsLoading,
        contactsErrorMessage,
        onRefetchContacts: () => void refetchContacts(),
        contactColumns,
        cards,
        filteredCards,
        cardsSearch,
        onCardsSearchChange: setCardsSearch,
        cardsLoading,
        cardsErrorMessage,
        onRefetchCards: () => void refetchCards(),
        cardColumns,
        applications,
        filteredApplications,
        applicationsSearch,
        onApplicationsSearchChange: setApplicationsSearch,
        applicationsLoading,
        applicationsErrorMessage,
        onRefetchApplications: () => void refetchApplications(),
        applicationColumns,
      }}
      overlays={{
        discardDialogOpen,
        setDiscardDialogOpen,
        setEditing,
        deactivateTarget,
        setDeactivateTarget,
        deactivateOrReactivateCard,
        selectedContact,
        setSelectedContact,
        selectedContactDetail,
        setSelectedContactDetail,
        selectedContactDetailError,
        setSelectedContactDetailError,
      }}
    />
    </Member360GuardView>
  );
}