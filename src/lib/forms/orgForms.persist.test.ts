import type { WorkflowFieldDefinition } from '@solvera/pace-core/forms';
import { describe, expect, it } from 'vitest';

import { replaceFormFields, type OrgFormsSecureClient } from './orgForms.persist';

describe('replaceFormFields (TM09)', () => {
  it('returns apiErr when delete fails', async () => {
    const sb = {
      from() {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({
                  error: { message: 'delete denied', code: '42501' },
                }),
              }),
            }),
          }),
          insert: async () => ({ error: null }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      },
    } as unknown as OrgFormsSecureClient;

    const fields: WorkflowFieldDefinition[] = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        fieldKey: 'keep',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: false,
      },
    ];

    const result = await replaceFormFields(
      sb,
      'org-1',
      'form-1',
      ['00000000-0000-4000-8000-0000000000aa'],
      fields,
    );

    expect(result).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        context: 'core_form_fields',
        message: expect.stringMatching(/\S/),
      }),
    });
  });

  it('returns apiErr when insert fails', async () => {
    const sb = {
      from() {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({ error: null }),
              }),
            }),
          }),
          insert: async () => ({
            error: { message: 'insert denied' },
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      },
    } as unknown as OrgFormsSecureClient;

    const fields: WorkflowFieldDefinition[] = [
      {
        id: 'field-new',
        fieldKey: 'new_field',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: false,
      },
    ];

    const result = await replaceFormFields(sb, 'org-1', 'form-1', [], fields);

    expect(result).toMatchObject({
      ok: false,
      error: { context: 'core_form_fields' },
    });
  });
});
