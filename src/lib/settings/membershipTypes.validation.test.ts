import { describe, expect, it } from 'vitest';
import { membershipTypeSchema } from './membershipTypes.validation';

const validPayload = {
  name: 'Junior',
  minAge: '5',
  maxAge: '12',
  isActive: true,
};

describe('membership type validation schema', () => {
  it('requires name', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      name: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain('Name is required.');
    }
  });

  it('rejects name longer than 80 chars', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      name: 'a'.repeat(81),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain('Name must be 1 to 80 characters.');
    }
  });

  it('rejects leading/trailing whitespace in name', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      name: ' Junior ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain('Name must not start or end with whitespace.');
    }
  });

  it('rejects non-integer minimum age', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      minAge: '2.5',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.minAge).toContain('Minimum age must be a whole number.');
    }
  });

  it('rejects out-of-range minimum age', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      minAge: '121',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.minAge).toContain('Minimum age must be between 0 and 120.');
    }
  });

  it('rejects non-integer maximum age', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      maxAge: '7.4',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxAge).toContain('Maximum age must be a whole number.');
    }
  });

  it('rejects out-of-range maximum age', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      maxAge: '-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxAge).toContain('Maximum age must be between 0 and 120.');
    }
  });

  it('rejects max age lower than min age', () => {
    const result = membershipTypeSchema.safeParse({
      ...validPayload,
      minAge: '18',
      maxAge: '12',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxAge).toContain('Maximum age must be greater than or equal to minimum age.');
    }
  });
});
