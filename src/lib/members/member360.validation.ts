import { z } from '@solvera/pace-core/utils';
import type { IdentityFormValues } from './member360.types';

export const member360IdentitySchema: z.ZodType<IdentityFormValues> = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    preferredName: z.string(),
    email: z.string(),
    dateOfBirth: z.string(),
    genderId: z.string(),
    pronounId: z.string(),
    membershipTypeId: z.string(),
    membershipNumber: z.string(),
    validFrom: z.string(),
    validTo: z.string(),
  })
  .superRefine((values, context) => {
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const preferredName = values.preferredName.trim();
    const email = values.email.trim();
    const membershipNumber = values.membershipNumber.trim();

    if (firstName.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstName'],
        message: 'First name is required.',
      });
    } else if (firstName.length > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstName'],
        message: 'First name must be 1 to 100 characters.',
      });
    }

    if (lastName.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastName'],
        message: 'Last name is required.',
      });
    } else if (lastName.length > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastName'],
        message: 'Last name must be 1 to 100 characters.',
      });
    }

    if (preferredName.length > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['preferredName'],
        message: 'Preferred name must be at most 100 characters.',
      });
    }

    if (email.length > 0) {
      if (email.length > 254) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Email must be at most 254 characters.',
        });
      } else {
        const emailSchema = z.string().email();
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['email'],
            message: 'Email must be a valid email address.',
          });
        }
      }
    }

    if (membershipNumber.length > 50) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['membershipNumber'],
        message: 'Membership number must be at most 50 characters.',
      });
    }

    const dobValue = values.dateOfBirth.trim();
    if (dobValue.length > 0) {
      const dateOfBirth = new Date(dobValue);
      if (Number.isNaN(dateOfBirth.valueOf())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateOfBirth'],
          message: 'Date of birth cannot be in the future.',
        });
      } else {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (dateOfBirth.getTime() > today.getTime()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dateOfBirth'],
            message: 'Date of birth cannot be in the future.',
          });
        }
      }
    }

    const validFromValue = values.validFrom.trim();
    const validToValue = values.validTo.trim();
    if (validFromValue.length > 0 && validToValue.length > 0) {
      const validFrom = new Date(validFromValue);
      const validTo = new Date(validToValue);
      if (!Number.isNaN(validFrom.valueOf()) && !Number.isNaN(validTo.valueOf()) && validFrom.getTime() > validTo.getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validTo'],
          message: 'Valid to must be on or after Valid from.',
        });
      }
    }
  });
