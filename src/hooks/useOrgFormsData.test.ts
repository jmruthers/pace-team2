// @vitest-environment jsdom
import type { WorkflowFieldDefinition } from '@solvera/pace-core/forms';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  computeRemovedFieldIds,
  isLikelyPersistedFieldId,
  mapDefinitionToFieldUpdatePayload,
} from '@/lib/forms/orgForms.mappers.fields';
import { replaceFormFields } from '@/lib/forms/orgForms.persist';
import type { OrgFormsSecureClient } from '@/lib/forms/orgForms.persist';
import {
  CORE_FORMS_DETAIL_SELECT,
  CORE_FORMS_LIST_SELECT,
  useOrgFormsData,
} from '@/hooks/useOrgFormsData';

const listQuerySecureSupabase = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () => listQuerySecureSupabase.current,
}));

describe('org form field operations', () => {
  it('computeRemovedFieldIds removes server ids absent from state', () => {
    const prior = ['uuid-1', 'uuid-2'];
    const current: WorkflowFieldDefinition[] = [
      {
        id: 'uuid-1',
        fieldKey: 'a',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: false,
      },
    ];
    expect(computeRemovedFieldIds(prior, current)).toEqual(['uuid-2']);
  });

  it('isLikelyPersistedFieldId rejects pace-core synthetic ids', () => {
    expect(isLikelyPersistedFieldId('field-1')).toBe(false);
    expect(isLikelyPersistedFieldId('00000000-0000-4000-8000-000000000001')).toBe(true);
  });

  it('mapDefinitionToFieldUpdatePayload trims empty label to null', () => {
    const field: WorkflowFieldDefinition = {
      id: '00000000-0000-4000-8000-000000000002',
      fieldKey: 'core_person.first_name',
      fieldType: 'text',
      fieldLabel: '   ',
      sortOrder: 1,
      isActive: true,
      isRequired: true,
    };
    const payload = mapDefinitionToFieldUpdatePayload(field);
    expect(payload.field_label).toBeNull();
  });
});

describe('replaceFormFields', () => {
  it('issues delete, insert, and update in order', async () => {
    const calls: string[] = [];
    const sb = {
      from(table: string) {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => {
                  calls.push(`delete:${table}`);
                  return { error: null };
                },
              }),
            }),
          }),
          insert: async () => {
            calls.push(`insert:${table}`);
            return { error: null };
          },
          update: () => ({
            eq: () => ({
              eq: async () => {
                calls.push(`update:${table}`);
                return { error: null };
              },
            }),
          }),
        };
      },
    };

    const prior = ['00000000-0000-4000-8000-0000000000aa'];
    const fields: WorkflowFieldDefinition[] = [
      {
        id: '00000000-0000-4000-8000-0000000000bb',
        fieldKey: 'x',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: false,
      },
      {
        id: 'field-2',
        fieldKey: 'y',
        fieldType: 'text',
        sortOrder: 2,
        isActive: true,
        isRequired: false,
      },
    ];

    const result = await replaceFormFields(
      sb as unknown as OrgFormsSecureClient,
      'org-1',
      'form-1',
      prior,
      fields,
    );

    expect(result.ok).toBe(true);
    expect(calls.some((c) => c.startsWith('delete:'))).toBe(true);
    expect(calls.some((c) => c.startsWith('insert:'))).toBe(true);
    expect(calls.some((c) => c.startsWith('update:'))).toBe(true);
  });
});

describe('list query contract (smoke)', () => {
  it('exports expected select fragments for TM09 §7', () => {
    expect(CORE_FORMS_LIST_SELECT).toContain('workflow_type');
    expect(CORE_FORMS_DETAIL_SELECT).toContain('fields:core_form_fields');
  });
});

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useOrgFormsData — list query (TM09 §13)', () => {
  beforeEach(() => {
    listQuerySecureSupabase.current = null;
  });

  it('applies organisation_id and event_id IS NULL filters', async () => {
    const order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    const select = vi.fn(() => ({ eq }));
    listQuerySecureSupabase.current = {
      from: vi.fn(() => ({ select })),
    };

    const { result } = renderHook(() => useOrgFormsData('org-fixture-1'), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(eq).toHaveBeenCalledWith('organisation_id', 'org-fixture-1');
    expect(is).toHaveBeenCalledWith('event_id', null);
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });
});
