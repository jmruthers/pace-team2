import {
  Avatar,
  Badge,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@solvera/pace-core/components';
import { useState } from 'react';
import { launchMemberProfile } from '@solvera/pace-core/member-profile-launch';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import type { Member360MutationError } from '@/hooks/useMember360Data';
import { membershipStatusBadgeVariant } from '@/lib/members/member360.display.badges';
import { Member360IdentitySection } from '@/components/members/member360/Member360IdentitySection';
import type { Member360LoadedViewProps } from '@/components/members/member360/member360LoadedView.types';
import { Member360BackNav } from '@/components/members/member360/Member360PageStates';
import { Member360SectionError } from '@/components/members/member360/Member360SectionError';
import { Member360PageOverlays } from '@/components/members/member360/Member360PageOverlays';
import { Member360RecordsSection } from '@/components/members/member360/Member360RecordsSection';
import { Member360StandingRolesCard } from '@/components/members/member360/Member360StandingRolesCard';

export type { Member360LoadedViewProps } from '@/components/members/member360/member360LoadedView.types';

export function Member360LoadedView({
  onBack,
  onViewRoles,
  memberPhonesErrorMessage,
  onRefetchMemberPhones,
  identity,
  records,
  overlays,
}: Member360LoadedViewProps) {
  const {
    member,
    memberName,
    memberEmailText,
    memberPhonesText,
    memberResidentialAddressText,
    memberPostalAddressText,
    showIssuingOrganisation,
    issuingOrganisationName,
    placementOrganisationName,
    activePlacementStartDate,
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
    onDiscardDialogOpen,
  } = identity;

  const [activeTab, setActiveTab] = useState('details');

  return (
    <main className="grid gap-4 pb-8">
      <Member360BackNav onBack={onBack} />

      <PageHeader title={memberName} subtitle="Member 360 profile and records." />

      <section className="grid gap-4 rounded-2xl border border-sec-200 bg-main-50 p-4 md:grid-cols-[auto_1fr] md:items-center">
        <Avatar name={memberName} />
        <article className="grid gap-2">
          <h2>{memberName}</h2>
          <Badge variant={membershipStatusBadgeVariant(member.membershipStatus)}>
            {member.membershipStatus}
          </Badge>
        </article>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Member details</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="roles">Standing roles</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
      <Member360IdentitySection
        display={{
          memberName,
          memberEmail: memberEmailText,
          phonesText: memberPhonesText,
          residentialAddress: memberResidentialAddressText,
          postalAddress: memberPostalAddressText,
          showIssuingOrganisation,
          issuingOrganisationName,
          placementOrganisationName,
          activePlacementStartDate,
          allowUpdate: canUpdateMember,
          showPortalEdit,
          showPortalView,
          onPortalEdit: () =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'edit',
              memberId: member.id,
            }),
          onPortalView: () =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'view',
              memberId: member.id,
            }),
          memberStatusLabel: member.membershipStatus,
          memberStatusVariant: membershipStatusBadgeVariant(member.membershipStatus),
        }}
        form={{
          editing,
          setEditing,
          initialValues,
          onSubmit: async (values) => {
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
          },
          onDirtyCancel: onDiscardDialogOpen,
          savePending: saveIdentityPending,
          genderOptions: genderTypes,
          pronounOptions: pronounTypes,
          membershipTypeOptions: membershipTypes,
        }}
      />
        </TabsContent>
        <TabsContent value="records">
      <Member360RecordsSection {...records} />
        </TabsContent>
        <TabsContent value="roles">
      <Member360StandingRolesCard onViewRoles={onViewRoles} />
        </TabsContent>
      </Tabs>

      <Member360PageOverlays {...overlays} />

      {memberPhonesErrorMessage != null && (
        <Member360SectionError
          title="Could not load member phones"
          message={memberPhonesErrorMessage}
          onRetry={onRefetchMemberPhones}
        />
      )}
    </main>
  );
}
