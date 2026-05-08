import { describe, expect, it } from 'vitest';
import { CURRENCY_OTHER_OPTION } from './organisationSettings.types';
import {
  organisationSettingsSchema,
  toFormValues,
  toMutationInput,
} from './organisationSettings.validation';

const validPayload = {
  baseCurrencySelection: 'AUD',
  baseCurrencyOther: '',
  joiningFee: '25.00',
  recurringFee: '10.00',
  feeRecurrenceDays: '30',
  taxRate: '10.00',
  bankAccountName: 'Operating account',
  bankBsb: '123-456',
  bankAccountNumber: '12345678',
};

describe('organisation settings validation', () => {
  it('requires base currency', () => {
    const result = organisationSettingsSchema.safeParse({
      ...validPayload,
      baseCurrencySelection: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.baseCurrencySelection).toContain('Base currency is required.');
    }
  });

  it('validates other currency ISO format', () => {
    const result = organisationSettingsSchema.safeParse({
      ...validPayload,
      baseCurrencySelection: CURRENCY_OTHER_OPTION,
      baseCurrencyOther: 'usd1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.baseCurrencyOther).toContain(
        'Currency must be a 3-letter ISO code, e.g. AUD.'
      );
    }
  });

  it('rejects invalid tax rate', () => {
    const result = organisationSettingsSchema.safeParse({
      ...validPayload,
      taxRate: '150',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.taxRate).toContain(
        'Tax rate must be between 0 and 100, with at most two decimal places.'
      );
    }
  });

  it('rejects invalid bsb and account number formats', () => {
    const result = organisationSettingsSchema.safeParse({
      ...validPayload,
      bankBsb: '12-34567',
      bankAccountNumber: 'abc',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bankBsb).toContain(
        'BSB must be six digits, optionally with a hyphen (e.g. 123-456).'
      );
      expect(result.error.flatten().fieldErrors.bankAccountNumber).toContain(
        'Account number must be 4 to 20 digits.'
      );
    }
  });

  it('normalises payload values for save', () => {
    const payload = toMutationInput(
      {
        baseCurrencySelection: CURRENCY_OTHER_OPTION,
        baseCurrencyOther: ' nzd ',
        joiningFee: ' 12.50 ',
        recurringFee: '',
        feeRecurrenceDays: ' 30 ',
        taxRate: ' 10.00 ',
        bankAccountName: '  ',
        bankBsb: ' 123-456 ',
        bankAccountNumber: ' 12345678 ',
      },
      'org-1'
    );

    expect(payload).toEqual({
      organisationId: 'org-1',
      baseCurrency: 'NZD',
      joiningFee: 12.5,
      recurringFee: null,
      feeRecurrenceDays: 30,
      taxRate: 10,
      bankAccountName: null,
      bankBsb: '123-456',
      bankAccountNumber: '12345678',
    });
  });

  it('maps unknown saved base currency to other option', () => {
    const values = toFormValues({
      id: 'setting-1',
      organisationId: 'org-1',
      joiningFee: 25,
      recurringFee: 10,
      feeRecurrenceDays: 30,
      taxRate: 10,
      baseCurrency: 'MXN',
      bankAccountName: 'Ops',
      bankBsb: '123456',
      bankAccountNumber: '12345678',
    });

    expect(values.baseCurrencySelection).toBe(CURRENCY_OTHER_OPTION);
    expect(values.baseCurrencyOther).toBe('MXN');
  });
});
