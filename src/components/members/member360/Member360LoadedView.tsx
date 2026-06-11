import { toast } from '@solvera/pace-core/components';
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

  return (
    <main className="grid gap-4 pb-8">
      <Member360BackNav onBack={onBack} />

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

      <Member360RecordsSection {...records} />

      <Member360StandingRolesCard onViewRoles={onViewRoles} />

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
