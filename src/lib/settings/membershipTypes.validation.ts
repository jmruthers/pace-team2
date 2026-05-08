import { z } from '@solvera/pace-core/utils';
import type { MembershipTypeFormValues } from './membershipTypes.types';

function parseOptionalAge(value: string): {
  value: number | null;
  invalidType: boolean;
  outOfRange: boolean;
} {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { value: null, invalidType: false, outOfRange: false };
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { value: null, invalidType: true, outOfRange: false };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed)) {
    return { value: null, invalidType: true, outOfRange: false };
  }
  if (parsed < 0 || parsed > 120) {
    return { value: parsed, invalidType: false, outOfRange: true };
  }
  return { value: parsed, invalidType: false, outOfRange: false };
}

export const membershipTypeSchema: z.ZodType<MembershipTypeFormValues> = z
  .object({
    name: z.string(),
    minAge: z.string(),
    maxAge: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    const name = values.name;
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name is required.',
      });
    } else if (trimmedName.length < 1 || trimmedName.length > 80) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name must be 1 to 80 characters.',
      });
    }

    if (name !== trimmedName && trimmedName.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name must not start or end with whitespace.',
      });
    }

    const minAge = parseOptionalAge(values.minAge);
    if (minAge.invalidType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAge'],
        message: 'Minimum age must be a whole number.',
      });
    } else if (minAge.outOfRange) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAge'],
        message: 'Minimum age must be between 0 and 120.',
      });
    }

    const maxAge = parseOptionalAge(values.maxAge);
    if (maxAge.invalidType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxAge'],
        message: 'Maximum age must be a whole number.',
      });
    } else if (maxAge.outOfRange) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxAge'],
        message: 'Maximum age must be between 0 and 120.',
      });
    }

    if (
      minAge.value != null
      && maxAge.value != null
      && !minAge.invalidType
      && !maxAge.invalidType
      && !minAge.outOfRange
      && !maxAge.outOfRange
      && minAge.value > maxAge.value
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxAge'],
        message: 'Maximum age must be greater than or equal to minimum age.',
      });
    }
  });

export function toMutationInput(values: MembershipTypeFormValues) {
  const toNullableInt = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return Number.parseInt(trimmed, 10);
  };

  return {
    name: values.name.trim(),
    minAge: toNullableInt(values.minAge),
    maxAge: toNullableInt(values.maxAge),
    isActive: values.isActive,
  };
}
