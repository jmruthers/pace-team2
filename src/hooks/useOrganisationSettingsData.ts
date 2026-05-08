import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError, NormalizeSupabaseError } from '@solvera/pace-core/utils';
import type {
  OrganisationSettingsMutationError,
  OrganisationSettingsMutationInput,
  OrganisationSettingsRow,
} from '@/lib/settings/organisationSettings.types';

interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  select(selection: string): SupabaseQueryBuilderLike;
  upsert(payload: Record<string, unknown>, options?: Record<string, unknown>): SupabaseQueryBuilderLike;
  maybeSingle(): Promise<unknown>;
  single(): Promise<unknown>;
}

interface SupabaseTableLike {
  select(selection: string): SupabaseQueryBuilderLike;
  upsert(payload: Record<string, unknown>, options?: Record<string, unknown>): SupabaseQueryBuilderLike;
}

interface SecureSupabaseLike {
  from(table: string): SupabaseTableLike;
}

interface OrganisationSettingsRawRow {
  id: string;
  organisation_id: string;
  joining_fee: number | null;
  recurring_fee: number | null;
  fee_recurrence_days: number | null;
  tax_rate: number | null;
  base_currency: string;
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
}

const ORGANISATION_SETTINGS_QUERY_KEY = 'organisation-settings';
const ORGANISATION_SETTINGS_COLUMNS =
  'id, organisation_id, joining_fee, recurring_fee, fee_recurrence_days, tax_rate, base_currency, bank_account_name, bank_bsb, bank_account_number';

function mapOrganisationSettingsRow(row: OrganisationSettingsRawRow): OrganisationSettingsRow {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    joiningFee: row.joining_fee,
    recurringFee: row.recurring_fee,
    feeRecurrenceDays: row.fee_recurrence_days,
    taxRate: row.tax_rate,
    baseCurrency: row.base_currency,
    bankAccountName: row.bank_account_name,
    bankBsb: row.bank_bsb,
    bankAccountNumber: row.bank_account_number,
  };
}

function toMutationError(error: unknown): OrganisationSettingsMutationError {
  const normalized = NormalizeSupabaseError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    raw: error,
  };
}

export function useOrganisationSettingsData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseLike | null;
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: [ORGANISATION_SETTINGS_QUERY_KEY, organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<OrganisationSettingsRow | null> => {
      if (organisationId == null || secureSupabase == null) {
        return null;
      }

      const { data, error } = (await secureSupabase
        .from('core_org_settings')
        .select(ORGANISATION_SETTINGS_COLUMNS)
        .eq('organisation_id', organisationId)
        .maybeSingle()) as { data: OrganisationSettingsRawRow | null; error: unknown };

      if (error != null) {
        throw error;
      }

      return data == null ? null : mapOrganisationSettingsRow(data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: OrganisationSettingsMutationInput): Promise<OrganisationSettingsRow> => {
      if (secureSupabase == null) {
        throw new Error('Organisation context is unavailable.');
      }

      const { data, error } = (await secureSupabase
        .from('core_org_settings')
        .upsert(
          {
            organisation_id: input.organisationId,
            base_currency: input.baseCurrency,
            joining_fee: input.joiningFee,
            recurring_fee: input.recurringFee,
            fee_recurrence_days: input.feeRecurrenceDays,
            tax_rate: input.taxRate,
            bank_account_name: input.bankAccountName,
            bank_bsb: input.bankBsb,
            bank_account_number: input.bankAccountNumber,
          },
          { onConflict: 'organisation_id' }
        )
        .select(ORGANISATION_SETTINGS_COLUMNS)
        .single()) as { data: OrganisationSettingsRawRow | null; error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }

      if (data == null) {
        throw toMutationError(new Error('Could not save organisation settings.'));
      }

      return mapOrganisationSettingsRow(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ORGANISATION_SETTINGS_QUERY_KEY, organisationId] });
    },
  });

  return {
    organisationSettings: settingsQuery.data ?? null,
    hasExistingRow: settingsQuery.data != null,
    isLoading: settingsQuery.isLoading,
    loadErrorMessage: settingsQuery.isError
      ? HandleSupabaseError(settingsQuery.error, 'core_org_settings').message
      : null,
    refetchOrganisationSettings: settingsQuery.refetch,
    saveOrganisationSettings: saveMutation.mutateAsync,
    savePending: saveMutation.isPending,
  };
}
