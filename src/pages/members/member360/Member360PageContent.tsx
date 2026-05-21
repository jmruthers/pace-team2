import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Label,
  toast,
} from '@solvera/pace-core/components';
import { ChevronRight } from '@solvera/pace-core/icons';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { useResourcePermissions } from '@solvera/pace-core/rbac';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { launchMemberProfile } from '@solvera/pace-core/member-profile-launch';
import { type Member360MutationError, useMember360Data } from '@/hooks/useMember360Data';
import { filterApplications, filterCards, filterContacts } from '@/lib/members/member360.display.badges';
import {
  formatOptionalText,
  formatPhoneRows,
  getMemberDisplayName,
  toIdentityFormValues,
} from '@/lib/members/member360.display.format';
import { membershipStatusBadgeVariant } from '@/lib/members/member360.display.badges';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type {
  AdditionalContactRow,
  IdentityFormValues,
  MemberApplicationRow,
  MemberCardRow,
} from '@/lib/members/member360.types';
import { Member360IdentitySection } from '@/pages/members/member360/Member360IdentitySection';
import {
  Member360BackNav,
  Member360LoadErrorState,
  Member360LoadingState,
  Member360NotFound,
  Member360OrgMismatchState,
} from '@/pages/members/member360/Member360PageStates';
import { Member360SectionError } from '@/pages/members/member360/Member360SectionError';
import { Member360PageOverlays } from '@/pages/members/member360/Member360PageOverlays';
import { useMember360TableColumns } from '@/pages/members/member360/useMember360TableColumns';

export function Member360PageContent() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const { user } = useUnifiedAuth();
  const memberPermissions = useResourcePermissions('members');
  const portalPermissions = useResourcePermissions('member-profile');

  const {
    member,
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
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  const memberName = member == null ? 'Member 360' : getMemberDisplayName(member);
  usePaceMain({ printTitle: memberName });

  useEffect(() => {
    if (selectedContact == null) {
      return;
    }
    let isCurrent = true;
    void fetchContactDetails(selectedContact)
      .then((detail) => {
        if (isCurrent) {
          setSelectedContactDetail(detail);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSelectedContactDetailError(HandleSupabaseError(error, 'core_contact').message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [fetchContactDetails, selectedContact]);

  useEffect(() => {
    const nextOrganisationId = selectedOrganisation?.id ?? null;
    if (previousOrganisationIdRef.current === undefined) {
      previousOrganisationIdRef.current = nextOrganisationId;
      return;
    }
    if (previousOrganisationIdRef.current === nextOrganisationId) {
      return;
    }
    previousOrganisationIdRef.current = nextOrganisationId;
    queueMicrotask(() => {
      setEditing(false);
      setDiscardDialogOpen(false);
      setDeactivateTarget(null);
      setSelectedContact(null);
      setSelectedContactDetail(null);
      setSelectedContactDetailError(null);
    });
  }, [selectedOrganisation?.id]);

  const isOrgMismatch = member != null && selectedOrganisation != null && member.organisationId !== selectedOrganisation.id;
  const isActingTargetMember = member != null && member.userId != null && user?.id === member.userId;

  const showPortalEdit = !isActingTargetMember && portalPermissions.canUpdate;
  const showPortalView = !isActingTargetMember && !portalPermissions.canUpdate && portalPermissions.canRead;

  const canUpdateMember = memberPermissions.canUpdate;

  const memberPhonesText = formatPhoneRows(memberPhones);
  const memberEmailText = formatOptionalText(member?.email ?? null);
  const memberResidentialAddressText = formatOptionalText(member?.residentialAddress ?? null);
  const memberPostalAddressText = formatOptionalText(member?.postalAddress ?? null);

  const initialValues: IdentityFormValues | null = member == null ? null : toIdentityFormValues(member);

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

  if (memberLoading) {
    return <Member360LoadingState />;
  }

  if (memberErrorMessage != null) {
    return <Member360LoadErrorState message={memberErrorMessage} onRetry={() => void refetchMember()} />;
  }

  if (member == null) {
    return <Member360NotFound />;
  }

  if (isOrgMismatch) {
    return <Member360OrgMismatchState onBack={() => navigate('/members')} />;
  }

  const filteredContacts = filterContacts(contacts, contactsSearch);
  const filteredCards = filterCards(cards, cardsSearch);
  const filteredApplications = filterApplications(applications, applicationsSearch);

  return (
    <main className="grid gap-4 pb-8">
      <Member360BackNav onBack={() => navigate('/members')} />

      {initialValues != null && (
        <Member360IdentitySection
          memberName={memberName}
          memberEmail={memberEmailText}
          phonesText={memberPhonesLoading ? 'Loading…' : memberPhonesText}
          residentialAddress={memberResidentialAddressText}
          postalAddress={memberPostalAddressText}
          allowUpdate={canUpdateMember}
          showPortalEdit={showPortalEdit}
          showPortalView={showPortalView}
          onPortalEdit={() =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'edit',
              memberId: member.id,
            })
          }
          onPortalView={() =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'view',
              memberId: member.id,
            })
          }
          editing={editing}
          setEditing={setEditing}
          memberStatusLabel={member.membershipStatus}
          memberStatusVariant={membershipStatusBadgeVariant(member.membershipStatus)}
          initialValues={initialValues}
          onSubmit={async (values) => {
            try {
              await saveIdentity({
                member,
                values,
                lookups: {
                  genderTypes,
                  pronounTypes,
                  membershipTypes,
                },
              });
              setEditing(false);
              toast({ title: 'Member saved.', variant: 'success' });
            } catch (error: unknown) {
              const normalizedError = error as Member360MutationError;
              const fallbackContext = normalizedError?.context ?? 'core_member';
              const title =
                normalizedError?.message ??
                HandleSupabaseError(error, fallbackContext).message;
              toast({
                title,
                variant: 'destructive',
              });
            }
          }}
          onDirtyCancel={() => setDiscardDialogOpen(true)}
          savePending={saveIdentityPending}
          genderOptions={genderTypes}
          pronounOptions={pronounTypes}
          membershipTypeOptions={membershipTypes}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Additional contacts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-contacts-search">
            Search contacts
            <Input id="member-contacts-search" value={contactsSearch} onChange={(value) => setContactsSearch(value)} />
          </Label>
          {contactsErrorMessage != null ? (
            <Member360SectionError title="Could not load contacts" message={contactsErrorMessage} onRetry={() => void refetchContacts()} />
          ) : (
            <DataTable<AdditionalContactRow>
              data={filteredContacts}
              columns={contactColumns}
              rbac={{ pageName: 'members' }}
              description={`${contacts.length} contacts`}
              isLoading={contactsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState={{ title: 'No additional contacts recorded.', description: '' }}
              features={{
                import: false,
                export: false,
                hierarchical: false,
                grouping: false,
                creation: false,
                editing: false,
                deletion: false,
                deleteSelected: false,
                selection: false,
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member cards</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-cards-search">
            Search cards
            <Input id="member-cards-search" value={cardsSearch} onChange={(value) => setCardsSearch(value)} />
          </Label>
          {cardsErrorMessage != null ? (
            <Member360SectionError title="Could not load cards" message={cardsErrorMessage} onRetry={() => void refetchCards()} />
          ) : (
            <DataTable<MemberCardRow>
              data={filteredCards}
              columns={cardColumns}
              rbac={{ pageName: 'members' }}
              description={`${cards.length} cards`}
              isLoading={cardsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'createdAt', desc: true }]}
              emptyState={{ title: 'No cards recorded.', description: '' }}
              features={{
                import: false,
                export: false,
                hierarchical: false,
                grouping: false,
                creation: false,
                editing: false,
                deletion: false,
                deleteSelected: false,
                selection: false,
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-applications-search">
            Search applications
            <Input
              id="member-applications-search"
              value={applicationsSearch}
              onChange={(value) => setApplicationsSearch(value)}
            />
          </Label>
          {applicationsErrorMessage != null ? (
            <Member360SectionError
              title="Could not load applications"
              message={applicationsErrorMessage}
              onRetry={() => void refetchApplications()}
            />
          ) : (
            <DataTable<MemberApplicationRow>
              data={filteredApplications}
              columns={applicationColumns}
              rbac={{ pageName: 'members' }}
              description={`${applications.length} applications`}
              isLoading={applicationsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'eventDate', desc: true }]}
              emptyState={{ title: 'No applications recorded.', description: '' }}
              features={{
                import: false,
                export: false,
                hierarchical: false,
                grouping: false,
                creation: false,
                editing: false,
                deletion: false,
                deleteSelected: false,
                selection: false,
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standing roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => navigate(`/members/${member.id}/roles`)}>
            View roles ›
            <ChevronRight size={16} aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <Member360PageOverlays
        discardDialogOpen={discardDialogOpen}
        setDiscardDialogOpen={setDiscardDialogOpen}
        setEditing={setEditing}
        deactivateTarget={deactivateTarget}
        setDeactivateTarget={setDeactivateTarget}
        deactivateOrReactivateCard={deactivateOrReactivateCard}
        selectedContact={selectedContact}
        setSelectedContact={setSelectedContact}
        selectedContactDetail={selectedContactDetail}
        setSelectedContactDetail={setSelectedContactDetail}
        selectedContactDetailError={selectedContactDetailError}
        setSelectedContactDetailError={setSelectedContactDetailError}
      />

      {memberPhonesErrorMessage != null && (
        <Member360SectionError title="Could not load member phones" message={memberPhonesErrorMessage} onRetry={() => void refetchMemberPhones()} />
      )}
    </main>
  );
}