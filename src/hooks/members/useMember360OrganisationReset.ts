import { useEffect, useRef } from 'react';
import type { AdditionalContactRow } from '@/lib/members/member360.types';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type { MemberCardRow } from '@/lib/members/member360.types';

export function useMember360OrganisationReset(
  organisationId: string | null | undefined,
  setEditing: (value: boolean) => void,
  setDiscardDialogOpen: (value: boolean) => void,
  setDeactivateTarget: (value: MemberCardRow | null) => void,
  setSelectedContact: (value: AdditionalContactRow | null) => void,
  setSelectedContactDetail: (value: ContactDetailData | null) => void,
  setSelectedContactDetailError: (value: string | null) => void
): void {
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextOrganisationId = organisationId ?? null;
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
  }, [
    organisationId,
    setDeactivateTarget,
    setDiscardDialogOpen,
    setEditing,
    setSelectedContact,
    setSelectedContactDetail,
    setSelectedContactDetailError,
  ]);
}
