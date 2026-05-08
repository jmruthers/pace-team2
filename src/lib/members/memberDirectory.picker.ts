import type { ManualPickPayload, PickerBannerState } from './memberDirectory.types';

const MANUAL_PICK_STORAGE_KEY = 'pace:team:comms:manual-pick';

export function getPickerBannerState(selectedCount: number): PickerBannerState {
  if (selectedCount > 2000) {
    return {
      variant: 'destructive',
      title: 'Selection too large',
      description: 'Reduce selection to at most 2000 members.',
      doneEnabled: false,
      showEmptyHelper: false,
    };
  }

  if (selectedCount > 500) {
    return {
      variant: 'default',
      title: 'Large audience',
      description: `Confirm you intend to message ${selectedCount} members.`,
      doneEnabled: true,
      showEmptyHelper: false,
    };
  }

  if (selectedCount === 0) {
    return {
      variant: 'default',
      title: 'Selecting members for a comms send',
      description: '0 selected',
      doneEnabled: false,
      showEmptyHelper: true,
    };
  }

  return {
    variant: 'default',
    title: 'Selecting members for a comms send',
    description: `${selectedCount} selected`,
    doneEnabled: true,
    showEmptyHelper: false,
  };
}

export function toSelectionRecord(selectedIds: string[]): Record<string, boolean> {
  return selectedIds.reduce<Record<string, boolean>>((accumulator, memberId) => {
    accumulator[memberId] = true;
    return accumulator;
  }, {});
}

export function selectionRecordToIds(selection: Record<string, boolean>): string[] {
  return Object.entries(selection)
    .filter(([, isSelected]) => isSelected)
    .map(([memberId]) => memberId);
}

export function readManualPickPayload(rawPayload: string | null, organisationId: string): string[] {
  if (rawPayload == null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<ManualPickPayload>;
    if (parsed.organisationId !== organisationId || !Array.isArray(parsed.memberIds)) {
      return [];
    }
    return parsed.memberIds.filter((memberId): memberId is string => typeof memberId === 'string');
  } catch {
    return [];
  }
}

export function buildManualPickPayload(organisationId: string, memberIds: string[]): ManualPickPayload {
  return {
    organisationId,
    memberIds,
    updatedAt: Date.now(),
  };
}

export function getManualPickStorageKey(): string {
  return MANUAL_PICK_STORAGE_KEY;
}
