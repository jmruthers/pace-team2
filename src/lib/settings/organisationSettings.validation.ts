import { z } from '@solvera/pace-core/utils';
import {
  BASE_CURRENCY_OPTIONS,
  CURRENCY_OTHER_OPTION,
  type OrganisationSettingsFormValues,
  type OrganisationSettingsMutationInput,
  type OrganisationSettingsRow,
} from './organisationSettings.types';

const DECIMAL_TWO_DP_PATTERN = /^\d+(\.\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const BSB_PATTERN = /^\d{3}-?\d{3}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{4,20}$/;

const BASE_CURRENCY_OPTION_SET = new Set<string>(BASE_CURRENCY_OPTIONS);

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return Number.parseFloat(trimmed);
}

function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}

function isValidOptionalMoney(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || DECIMAL_TWO_DP_PATTERN.test(trimmed);
}

function toDecimalDisplay(value: number | null): string {
  if (value == null) {
    return '';
  }
  return String(value);
}

export const organisationSettingsSchema: z.ZodType<OrganisationSettingsFormValues> = z
  .object({
    baseCurrencySelection: z.string(),
    baseCurrencyOther: z.string(),
    joiningFee: z.string(),
    recurringFee: z.string(),
    feeRecurrenceDays: z.string(),
    taxRate: z.string(),
    bankAccountName: z.string(),
    bankBsb: z.string(),
    bankAccountNumber: z.string(),
  })
  .superRefine((values, context) => {
    const usingOther = values.baseCurrencySelection === CURRENCY_OTHER_OPTION;
    const selectedCurrency = usingOther
      ? values.baseCurrencyOther.trim().toUpperCase()
      : values.baseCurrencySelection.trim().toUpperCase();

    if (selectedCurrency.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseCurrencySelection'],
        message: 'Base currency is required.',
      });
    } else if (!ISO_CURRENCY_PATTERN.test(selectedCurrency)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [usingOther ? 'baseCurrencyOther' : 'baseCurrencySelection'],
        message: 'Currency must be a 3-letter ISO code, e.g. AUD.',
      });
    }

    if (!usingOther && !BASE_CURRENCY_OPTION_SET.has(values.baseCurrencySelection)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseCurrencySelection'],
        message: 'Base currency is required.',
      });
    }

    if (!isValidOptionalMoney(values.joiningFee)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['joiningFee'],
        message: 'Joining fee must be 0 or more, with at most two decimal places.',
      });
    } else {
      const joiningFee = parseOptionalDecimal(values.joiningFee);
      if (joiningFee != null && joiningFee < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['joiningFee'],
          message: 'Joining fee must be 0 or more, with at most two decimal places.',
        });
      }
    }

    if (!isValidOptionalMoney(values.recurringFee)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurringFee'],
        message: 'Recurring fee must be 0 or more, with at most two decimal places.',
      });
    } else {
      const recurringFee = parseOptionalDecimal(values.recurringFee);
      if (recurringFee != null && recurringFee < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recurringFee'],
          message: 'Recurring fee must be 0 or more, with at most two decimal places.',
        });
      }
    }

    const recurrenceTrimmed = values.feeRecurrenceDays.trim();
    if (recurrenceTrimmed.length > 0 && !INTEGER_PATTERN.test(recurrenceTrimmed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feeRecurrenceDays'],
        message: 'Recurrence must be a whole number of 0 or more days.',
      });
    } else {
      const recurrence = parseOptionalInteger(values.feeRecurrenceDays);
      if (recurrence != null && recurrence < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['feeRecurrenceDays'],
          message: 'Recurrence must be a whole number of 0 or more days.',
        });
      }
    }

    if (!isValidOptionalMoney(values.taxRate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxRate'],
        message: 'Tax rate must be between 0 and 100, with at most two decimal places.',
      });
    } else {
      const taxRate = parseOptionalDecimal(values.taxRate);
      if (taxRate != null && (taxRate < 0 || taxRate > 100)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['taxRate'],
          message: 'Tax rate must be between 0 and 100, with at most two decimal places.',
        });
      }
    }

    const bankAccountName = values.bankAccountName.trim();
    if (bankAccountName.length > 80) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankAccountName'],
        message: 'Bank account name must be 1 to 80 characters.',
      });
    }

    const bankBsb = values.bankBsb.trim();
    if (bankBsb.length > 0 && !BSB_PATTERN.test(bankBsb)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankBsb'],
        message: 'BSB must be six digits, optionally with a hyphen (e.g. 123-456).',
      });
    }

    const bankAccountNumber = values.bankAccountNumber.trim();
    if (bankAccountNumber.length > 0 && !ACCOUNT_NUMBER_PATTERN.test(bankAccountNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankAccountNumber'],
        message: 'Account number must be 4 to 20 digits.',
      });
    }
  });

export function toFormValues(row: OrganisationSettingsRow | null): OrganisationSettingsFormValues {
  if (row == null) {
    return {
      baseCurrencySelection: 'AUD',
      baseCurrencyOther: '',
      joiningFee: '',
      recurringFee: '',
      feeRecurrenceDays: '',
      taxRate: '',
      bankAccountName: '',
      bankBsb: '',
      bankAccountNumber: '',
    };
  }

  const baseCurrency = row.baseCurrency.toUpperCase();
  const baseCurrencySelection = BASE_CURRENCY_OPTION_SET.has(baseCurrency)
    ? baseCurrency
    : CURRENCY_OTHER_OPTION;

  return {
    baseCurrencySelection,
    baseCurrencyOther: baseCurrencySelection === CURRENCY_OTHER_OPTION ? baseCurrency : '',
    joiningFee: toDecimalDisplay(row.joiningFee),
    recurringFee: toDecimalDisplay(row.recurringFee),
    feeRecurrenceDays: row.feeRecurrenceDays == null ? '' : String(row.feeRecurrenceDays),
    taxRate: toDecimalDisplay(row.taxRate),
    bankAccountName: row.bankAccountName ?? '',
    bankBsb: row.bankBsb ?? '',
    bankAccountNumber: row.bankAccountNumber ?? '',
  };
}

export function toMutationInput(
  values: OrganisationSettingsFormValues,
  organisationId: string
): OrganisationSettingsMutationInput {
  const usingOther = values.baseCurrencySelection === CURRENCY_OTHER_OPTION;
  const baseCurrencySource = usingOther ? values.baseCurrencyOther : values.baseCurrencySelection;
  const baseCurrency = baseCurrencySource.trim().toUpperCase();

  return {
    organisationId,
    baseCurrency,
    joiningFee: parseOptionalDecimal(values.joiningFee),
    recurringFee: parseOptionalDecimal(values.recurringFee),
    feeRecurrenceDays: parseOptionalInteger(values.feeRecurrenceDays),
    taxRate: parseOptionalDecimal(values.taxRate),
    bankAccountName: trimToNull(values.bankAccountName),
    bankBsb: trimToNull(values.bankBsb),
    bankAccountNumber: trimToNull(values.bankAccountNumber),
  };
}
