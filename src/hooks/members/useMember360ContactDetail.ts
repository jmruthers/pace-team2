import { useEffect } from 'react';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type { AdditionalContactRow } from '@/lib/members/member360.types';

export function useMember360ContactDetail(
  selectedContact: AdditionalContactRow | null,
  fetchContactDetails: (contact: AdditionalContactRow) => Promise<ContactDetailData>,
  setSelectedContactDetail: (value: ContactDetailData | null) => void,
  setSelectedContactDetailError: (value: string | null) => void
): void {
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
  }, [fetchContactDetails, selectedContact, setSelectedContactDetail, setSelectedContactDetailError]);
}
