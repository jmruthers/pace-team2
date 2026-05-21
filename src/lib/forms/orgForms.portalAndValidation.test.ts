import { validateWorkflowAuthoringState } from '@solvera/pace-core/forms';

import { createEmptyAuthoringState } from '@/lib/forms/orgForms.mappers.authoring';
import { composePortalFormsUrl } from '@/lib/forms/orgForms.portalUrl';

import { describe, expect, it } from 'vitest';

describe('composePortalFormsUrl', () => {
  it('joins trimmed origin without trailing slash', () => {
    const r = composePortalFormsUrl('https://forms.example.com/', 'org-signup-2026');
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://forms.example.com/forms/org-signup-2026');
  });

  it('rejects unset origin', () => {
    const r = composePortalFormsUrl(undefined, 'x');
    expect(r.ok).toBe(false);
    expect(r.errorTitle).toBe('Portal origin not configured. Contact your administrator.');
  });
});

describe('validateWorkflowAuthoringState — TM09 BR-F parity', () => {
  const orgId = '00000000-0000-4000-8000-000000000001';

  it('invalid_name — empty name', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.name = '';
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'invalid_name')).toBe(true);
    expect(r.errors.find((e) => e.code === 'invalid_name')?.message).toBe('Name is required.');
  });

  it('invalid_slug — bad shape', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'Bad Slug!';
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'invalid_slug')).toBe(true);
  });

  it('invalid_workflow_access_combination', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'ok-slug';
    s.metadata.workflowType = 'org_signup';
    s.metadata.accessMode = 'public';
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'invalid_workflow_access_combination')).toBe(true);
  });

  it('missing_scope — org_signup without organisationId', () => {
    const s = createEmptyAuthoringState('');
    s.metadata.slug = 'ok-slug';
    s.metadata.organisationId = '';
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'missing_scope')).toBe(true);
  });

  it('invalid_entrypoint — generic + primary', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'ok-slug';
    s.metadata.workflowType = 'generic';
    s.metadata.isPrimaryEntrypoint = true;
    s.fields.push({
      id: 'f1',
      fieldKey: 'a.a',
      fieldType: 'text',
      sortOrder: 1,
      isActive: true,
      isRequired: false,
    });
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'invalid_entrypoint')).toBe(true);
    expect(r.errors.find((e) => e.code === 'invalid_entrypoint')?.message).toBe(
      'Primary entrypoint is only valid for base_registration and org_signup forms.',
    );
  });

  it('missing_active_fields', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'ok-slug';
    s.fields = [];
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'missing_active_fields')).toBe(true);
  });

  it('duplicate_field_key among active fields', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'ok-slug';
    s.fields.push(
      {
        id: '1',
        fieldKey: 'core_person.first_name',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: false,
      },
      {
        id: '2',
        fieldKey: 'core_person.first_name',
        fieldType: 'text',
        sortOrder: 2,
        isActive: true,
        isRequired: false,
      },
    );
    const r = validateWorkflowAuthoringState(s);
    const dup = r.errors.filter((e) => e.code === 'duplicate_field_key');
    expect(dup.some((e) => e.message.includes('Duplicate field key detected'))).toBe(true);
  });

  it('activation_blocked when isActive with prior errors', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.slug = 'bad slug!!';
    s.metadata.isActive = true;
    s.fields.push({
      id: '1',
      fieldKey: 'k',
      fieldType: 'text',
      sortOrder: 1,
      isActive: true,
      isRequired: false,
    });
    const r = validateWorkflowAuthoringState(s);
    expect(r.errors.some((e) => e.code === 'activation_blocked')).toBe(true);
  });

  it('unknown_field_type warning for date — Save allowed when no errors', () => {
    const s = createEmptyAuthoringState(orgId);
    s.metadata.name = 'Form with catalogue type';
    s.metadata.slug = 'ok-slug';
    s.fields.push({
      id: '1',
      fieldKey: 'core_person.email',
      fieldType: 'date',
      sortOrder: 1,
      isActive: true,
      isRequired: false,
    });
    const r = validateWorkflowAuthoringState(s);
    expect(r.isValid).toBe(true);
    expect(r.warnings.some((w) => w.code === 'unknown_field_type')).toBe(true);
    expect(r.warnings.find((w) => w.code === 'unknown_field_type')?.message).toContain('"date"');
  });
});
