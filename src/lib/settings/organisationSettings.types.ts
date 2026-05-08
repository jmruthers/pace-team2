export const CURRENCY_OTHER_OPTION = '__other__';

export const BASE_CURRENCY_OPTIONS = [
  'AUD',
  'NZD',
  'USD',
  'GBP',
  'EUR',
  'SGD',
  'HKD',
  'JPY',
  'CAD',
  'CHF',
] as const;

export type BaseCurrencyOption = (typeof BASE_CURRENCY_OPTIONS)[number];

export interface OrganisationSettingsRow extends Record<string, unknown> {
  id: string;
  organisationId: string;
  joiningFee: number | null;
  recurringFee: number | null;
  feeRecurrenceDays: number | null;
  taxRate: number | null;
  baseCurrency: string;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
}

export interface OrganisationSettingsFormValues {
  baseCurrencySelection: string;
  baseCurrencyOther: string;
  joiningFee: string;
  recurringFee: string;
  feeRecurrenceDays: string;
  taxRate: string;
  bankAccountName: string;
  bankBsb: string;
  bankAccountNumber: string;
}

export interface OrganisationSettingsMutationInput {
  organisationId: string;
  baseCurrency: string;
  joiningFee: number | null;
  recurringFee: number | null;
  feeRecurrenceDays: number | null;
  taxRate: number | null;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
}

export interface OrganisationSettingsMutationError {
  code?: string;
  message: string;
  raw: unknown;
}
