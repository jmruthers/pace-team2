import { describe, expect, it } from 'vitest';
import {
  fetchOrganisationName,
  pickOrganisationDisplayName,
  resolveIssuingOrganisationId,
  shouldShowIssuingOrganisationContext,
} from '@/lib/members/issuingOrganisation';

describe('pickOrganisationDisplayName', () => {
  it('prefers display_name over name', () => {
    expect(
      pickOrganisationDisplayName({ id: '1', name: 'Legacy', display_name: 'Scouts Victoria' })
    ).toBe('Scouts Victoria');
  });

  it('falls back to name when display_name is empty', () => {
    expect(pickOrganisationDisplayName({ id: '1', name: 'Flat Org', display_name: '  ' })).toBe('Flat Org');
  });
});

describe('shouldShowIssuingOrganisationContext', () => {
  it('returns false when issuing equals selected org', () => {
    expect(shouldShowIssuingOrganisationContext('org-a', 'org-a')).toBe(false);
  });

  it('returns true when issuing differs from selected org', () => {
    expect(shouldShowIssuingOrganisationContext('root', 'sub')).toBe(true);
  });
});

describe('resolveIssuingOrganisationId', () => {
  it('returns the same id for a flat org', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'flat-org', parent_id: null },
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await resolveIssuingOrganisationId(supabase, 'flat-org');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('flat-org');
    }
  });

  it('walks parent_id chain to the root org', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => {
              if (value === 'sub-org') {
                return { data: { id: 'sub-org', parent_id: 'root-org' }, error: null };
              }
              if (value === 'root-org') {
                return { data: { id: 'root-org', parent_id: null }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    const result = await resolveIssuingOrganisationId(supabase, 'sub-org');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('root-org');
    }
  });

  it('falls back to input org when row is missing', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await resolveIssuingOrganisationId(supabase, 'missing-org');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('missing-org');
    }
  });

  it('returns apiErr when query fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'db error' } }),
          }),
        }),
      }),
    };

    const result = await resolveIssuingOrganisationId(supabase, 'org-a');
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.message).toBeTruthy();
    }
  });
});

describe('fetchOrganisationName', () => {
  it('returns display name on success', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: '1', name: 'Legacy', display_name: 'Scouts Victoria' },
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await fetchOrganisationName(supabase, '1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('Scouts Victoria');
    }
  });

  it('returns apiErr when query fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'db error' } }),
          }),
        }),
      }),
    };

    const result = await fetchOrganisationName(supabase, '1');
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.message).toBeTruthy();
    }
  });
});
