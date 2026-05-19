import type { ManualPickPayload } from '@/lib/members/memberDirectory.types';
import {
  getManualPickStorageKey,
} from '@/lib/members/memberDirectory.picker';

export type CommsRecipientMode = 'org_members' | 'manual';

export type ManualPickHandoff = {
  recipientMode: CommsRecipientMode;
  manualMemberIds: string[];
};

function parseMatchingManualPick(raw: string, organisationId: string): ManualPickHandoff | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ManualPickPayload>;
    if (parsed.organisationId !== organisationId || !Array.isArray(parsed.memberIds)) {
      return null;
    }
    const manualMemberIds = parsed.memberIds.filter(
      (memberId): memberId is string => typeof memberId === 'string'
    );
    return { recipientMode: 'manual', manualMemberIds };
  } catch {
    return null;
  }
}

/**
 * TM13 F-05 / BR-04 — read-once-and-clear manual pick from sessionStorage on mount.
 * Matching org with empty memberIds still enters "Specific members" mode (AC-03).
 */
export function readManualPickInitialState(organisationId: string): ManualPickHandoff {
  if (typeof window === 'undefined') {
    return { recipientMode: 'org_members', manualMemberIds: [] };
  }

  const key = getManualPickStorageKey();
  const raw = window.sessionStorage.getItem(key);
  if (raw == null) {
    return { recipientMode: 'org_members', manualMemberIds: [] };
  }

  window.sessionStorage.removeItem(key);
  const handoff = parseMatchingManualPick(raw, organisationId);
  if (handoff != null) {
    return handoff;
  }

  return { recipientMode: 'org_members', manualMemberIds: [] };
}
