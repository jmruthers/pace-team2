import { describe, expect, it } from 'vitest';
import {
  createSubOrganisationSchema,
  editSubOrganisationSchema,
  toCreateSubOrganisationInput,
  toUpdateSubOrganisationInput,
} from './subOrganisations.validation';

const validPayload = {
  name: 'scouts-victoria-north',
  displayName: 'Scouts Victoria North',
  description: ' Northern district ',
  isActive: true,
};

describe('sub-organisation validation schema', () => {
  it('requires internal name on create', () => {
    const result = createSubOrganisationSchema.safeParse({
      ...validPayload,
      name: '  ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain('Internal name is required.');
    }
  });

  it('requires display name on create', () => {
    const result = createSubOrganisationSchema.safeParse({
      ...validPayload,
      displayName: ' ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.displayName).toContain('Display name is required.');
    }
  });

  it('requires display name on edit', () => {
    const result = editSubOrganisationSchema.safeParse({
      ...validPayload,
      displayName: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.displayName).toContain('Display name is required.');
    }
  });

  it('normalises create payload with trim and null description', () => {
    const payload = toCreateSubOrganisationInput(
      {
        name: ' scouts-north ',
        displayName: ' Scouts North ',
        description: '   ',
        isActive: true,
      },
      'org-parent-id'
    );

    expect(payload).toEqual({
      name: 'scouts-north',
      displayName: 'Scouts North',
      description: null,
      parentId: 'org-parent-id',
    });
  });

  it('normalises update payload with trim and preserves active flag', () => {
    const payload = toUpdateSubOrganisationInput({
      name: 'ignored-on-update',
      displayName: '  Updated Name  ',
      description: '  Updated description  ',
      isActive: false,
    });

    expect(payload).toEqual({
      displayName: 'Updated Name',
      description: 'Updated description',
      isActive: false,
    });
  });
});
