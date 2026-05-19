// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildManualPickPayload, getManualPickStorageKey } from '@/lib/members/memberDirectory.picker';
import { readManualPickInitialState } from '@/lib/communications/commsManualPick';

describe('readManualPickInitialState', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('returns org_members when sessionStorage has no payload', () => {
    expect(readManualPickInitialState('org-a')).toEqual({
      recipientMode: 'org_members',
      manualMemberIds: [],
    });
  });

  it('hydrates manual mode and clears key when org matches with member ids', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(
      key,
      JSON.stringify(buildManualPickPayload('org-a', ['m1', 'm2']))
    );
    expect(readManualPickInitialState('org-a')).toEqual({
      recipientMode: 'manual',
      manualMemberIds: ['m1', 'm2'],
    });
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it('enters manual mode with empty list when org matches but memberIds is empty', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(key, JSON.stringify(buildManualPickPayload('org-a', [])));
    expect(readManualPickInitialState('org-a')).toEqual({
      recipientMode: 'manual',
      manualMemberIds: [],
    });
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it('clears key and defaults to org_members when organisationId mismatches', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(
      key,
      JSON.stringify(buildManualPickPayload('other-org', ['m99']))
    );
    expect(readManualPickInitialState('org-a')).toEqual({
      recipientMode: 'org_members',
      manualMemberIds: [],
    });
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
});
