import { z } from '@solvera/pace-core/utils';
import type {
  CreateSubOrganisationInput,
  SubOrganisationFormValues,
  UpdateSubOrganisationInput,
} from './subOrganisations.types';

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const createSubOrganisationSchema: z.ZodType<SubOrganisationFormValues> = z
  .object({
    name: z.string(),
    displayName: z.string(),
    description: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.name.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Internal name is required.',
      });
    }

    if (values.displayName.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayName'],
        message: 'Display name is required.',
      });
    }
  });

export const editSubOrganisationSchema: z.ZodType<SubOrganisationFormValues> = z
  .object({
    name: z.string(),
    displayName: z.string(),
    description: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.displayName.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayName'],
        message: 'Display name is required.',
      });
    }
  });

export function toCreateSubOrganisationInput(
  values: SubOrganisationFormValues,
  parentId: string
): CreateSubOrganisationInput {
  return {
    name: values.name.trim(),
    displayName: values.displayName.trim(),
    description: trimToNull(values.description),
    parentId,
  };
}

export function toUpdateSubOrganisationInput(values: SubOrganisationFormValues): UpdateSubOrganisationInput {
  return {
    displayName: values.displayName.trim(),
    description: trimToNull(values.description),
    isActive: values.isActive,
  };
}
