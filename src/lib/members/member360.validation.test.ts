import { describe, expect, it } from 'vitest';
import { member360IdentitySchema } from './member360.validation';

const validPayload = {
  firstName: 'Ava',
  lastName: 'Adams',
  preferredName: '',
  email: '',
  dateOfBirth: '',
  genderId: '',
  pronounId: '',
  membershipTypeId: '',
  membershipNumber: '',
  validFrom: '',
  validTo: '',
};

describe('member360 validation schema', () => {
  it('requires first name', () => {
    const result = member360IdentitySchema.safeParse({
      ...validPayload,
      firstName: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.firstName).toContain('First name is required.');
    }
  });

  it('rejects future date of birth', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = member360IdentitySchema.safeParse({
      ...validPayload,
      dateOfBirth: tomorrow.toISOString().slice(0, 10),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dateOfBirth).toContain('Date of birth cannot be in the future.');
    }
  });

  it('rejects valid-to earlier than valid-from', () => {
    const result = member360IdentitySchema.safeParse({
      ...validPayload,
      validFrom: '2026-05-01',
      validTo: '2026-04-30',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.validTo).toContain('Valid to must be on or after Valid from.');
    }
  });
});
