import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormField,
  Input,
  LoadingSpinner,
  PageHeader,
  SaveActions,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { useOrganisationSettingsData } from '@/hooks/useOrganisationSettingsData';
import {
  BASE_CURRENCY_OPTIONS,
  CURRENCY_OTHER_OPTION,
  type OrganisationSettingsFormValues,
  type OrganisationSettingsMutationError,
} from '@/lib/settings/organisationSettings.types';
import {
  organisationSettingsSchema,
  toFormValues,
  toMutationInput,
} from '@/lib/settings/organisationSettings.validation';
import { OrganisationSettingsOverviewCard } from '@/components/settings/OrganisationSettingsOverviewCard';

const FINANCIAL_DESCRIPTION = 'Joining and recurring fees, tax rate, base currency, and bank-account details.';
const CURRENCY_23514_MESSAGE = 'Currency must be a 3-letter ISO code, e.g. AUD.';

function useOrganisationChangeToast(hasLocalEdits: boolean, organisationId: string | null | undefined) {
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextOrganisationId = organisationId ?? null;
    if (previousOrganisationIdRef.current === undefined) {
      previousOrganisationIdRef.current = nextOrganisationId;
      return;
    }
    if (previousOrganisationIdRef.current === nextOrganisationId) {
      return;
    }

    previousOrganisationIdRef.current = nextOrganisationId;

    if (hasLocalEdits) {
      toast({
        title: 'Editing cancelled — organisation changed.',
        variant: 'default',
      });
    }
  }, [hasLocalEdits, organisationId]);
}

function OrganisationSettingsPageContent() {
  usePaceMain({ printTitle: 'Organisation settings', ariaLabel: 'Organisation settings' });

  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const permissions = useResourcePermissions(PAGE_NAMES.orgSettings) as {
    canCreate: boolean;
    canUpdate: boolean;
    isLoading?: boolean;
  };

  const {
    organisationSettings,
    hasExistingRow,
    isLoading,
    loadErrorMessage,
    refetchOrganisationSettings,
    saveOrganisationSettings,
    savePending,
  } = useOrganisationSettingsData(organisationId);

  const [serverCurrencyError, setServerCurrencyError] = useState<string | null>(null);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [formResetNonce, setFormResetNonce] = useState(0);
  const [formDefaults, setFormDefaults] = useState<OrganisationSettingsFormValues>(() => toFormValues(null));
  const [formDefaultsSourceKey, setFormDefaultsSourceKey] = useState<string>('loaded');

  useOrganisationChangeToast(hasLocalEdits, selectedOrganisation?.id);

  const loadedValues = useMemo(() => toFormValues(organisationSettings), [organisationSettings]);
  const loadedValuesSignature = useMemo(() => JSON.stringify(loadedValues), [loadedValues]);
  const formDefaultValues = formDefaultsSourceKey === loadedValuesSignature ? formDefaults : loadedValues;
  const formKey = useMemo(
    () => `${organisationId ?? 'none'}:${loadedValuesSignature}:${formResetNonce}`,
    [formResetNonce, loadedValuesSignature, organisationId]
  );
  const canShowSave = permissions.isLoading !== true && (hasExistingRow ? permissions.canUpdate : permissions.canCreate);

  return (
    <main className="grid gap-4 pb-24">
      <PageHeader
        title="Organisation settings"
        subtitle="Update profile and financial settings for your organisation."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <OrganisationSettingsOverviewCard organisation={selectedOrganisation} />

      <Card>
        <CardHeader>
          <CardTitle>Financial</CardTitle>
          <CardDescription>{FINANCIAL_DESCRIPTION}</CardDescription>
        </CardHeader>
        {loadErrorMessage != null ? (
          <CardContent className="grid gap-3">
            <Alert variant="destructive">
              <AlertTitle>Could not load organisation settings</AlertTitle>
              <AlertDescription>{loadErrorMessage}</AlertDescription>
            </Alert>
            <nav aria-label="Retry organisation settings">
              <Button type="button" onClick={() => void refetchOrganisationSettings()}>
                Retry
              </Button>
            </nav>
          </CardContent>
        ) : null}
        {isLoading ? (
          <CardContent>
            <section className="grid place-items-center py-6">
              <LoadingSpinner />
            </section>
          </CardContent>
        ) : null}
        {!isLoading && loadErrorMessage == null ? (
          <Form<OrganisationSettingsFormValues>
            key={formKey}
            schema={organisationSettingsSchema}
            mode="onChange"
            defaultValues={formDefaultValues}
            onSubmit={async (values) => {
              if (organisationId == null) {
                return;
              }

              setServerCurrencyError(null);

              try {
                const savedRow = await saveOrganisationSettings(toMutationInput(values, organisationId));
                const savedFormValues = toFormValues(savedRow);
                setFormDefaults(savedFormValues);
                setFormDefaultsSourceKey(`saved:${JSON.stringify(savedFormValues)}`);
                setFormResetNonce((previous) => previous + 1);
                setHasLocalEdits(false);
                toast({
                  title: 'Organisation settings saved.',
                  variant: 'success',
                });
              } catch (error: unknown) {
                const mutationError = error as OrganisationSettingsMutationError;
                if (mutationError?.code === '23514') {
                  setServerCurrencyError(CURRENCY_23514_MESSAGE);
                  return;
                }

                toast({
                  title: 'Could not save organisation settings',
                  description: mutationError?.message ?? 'Unknown error',
                  variant: 'destructive',
                });
              }
            }}
          >
            {(methods) => {
              const hasValidationErrors = Object.keys(methods.formState.errors ?? {}).length > 0;
              const showValidationAlert = methods.formState.isSubmitted && hasValidationErrors;
              const selectedBaseCurrency = methods.watch('baseCurrencySelection');
              const usingOtherCurrency = selectedBaseCurrency === CURRENCY_OTHER_OPTION;
              const saveDisabled = savePending
                || methods.formState.isSubmitting
                || !methods.formState.isValid
                || !methods.formState.isDirty;

              return (
                <>
                  <CardContent className="grid gap-3">
                    {showValidationAlert ? (
                      <Alert variant="destructive">
                        <AlertTitle>Please fix the errors below.</AlertTitle>
                      </Alert>
                    ) : null}
                    {serverCurrencyError != null ? (
                      <Alert variant="destructive">
                        <AlertTitle>{serverCurrencyError}</AlertTitle>
                      </Alert>
                    ) : null}

                    <FormField<OrganisationSettingsFormValues>
                      name="baseCurrencySelection"
                      label="Base currency"
                      required
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Select
                            value={String(field.value ?? '')}
                            onValueChange={(value) => {
                              field.onChange(value ?? '');
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                              if ((value ?? '') !== CURRENCY_OTHER_OPTION) {
                                methods.setValue('baseCurrencyOther', '', { shouldDirty: true });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {BASE_CURRENCY_OPTIONS.map((currencyCode) => (
                                  <SelectItem key={currencyCode} value={currencyCode}>
                                    {currencyCode}
                                  </SelectItem>
                                ))}
                                <SelectItem value={CURRENCY_OTHER_OPTION}>Other...</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {!usingOtherCurrency ? (
                            <p>All currency amounts on this page are saved in this currency.</p>
                          ) : null}
                        </section>
                      )}
                    />

                    {usingOtherCurrency ? (
                      <FormField<OrganisationSettingsFormValues>
                        name="baseCurrencyOther"
                        label="Other currency code"
                        required
                        render={({ field }) => (
                          <section className="grid gap-2">
                            <Input
                              type="text"
                              value={String(field.value ?? '')}
                              placeholder="Three-letter ISO code (e.g. AUD)"
                              onChange={(value) => {
                                field.onChange(value);
                                setServerCurrencyError(null);
                                setHasLocalEdits(true);
                              }}
                              onBlur={() => {
                                const uppercase = String(field.value ?? '').toUpperCase();
                                field.onChange(uppercase);
                              }}
                            />
                            <p>Three uppercase letters. Example: AUD, USD, GBP.</p>
                          </section>
                        )}
                      />
                    ) : null}

                    <FormField<OrganisationSettingsFormValues>
                      name="joiningFee"
                      label="Joining fee"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={String(field.value ?? '')}
                            placeholder="0.00"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>AUD (or selected base currency).</p>
                        </section>
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="recurringFee"
                      label="Recurring fee"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={String(field.value ?? '')}
                            placeholder="0.00"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>AUD (or selected base currency).</p>
                        </section>
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="feeRecurrenceDays"
                      label="Recurrence (days)"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={String(field.value ?? '')}
                            placeholder="0"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>Days between recurring charges.</p>
                        </section>
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="taxRate"
                      label="Tax rate (%)"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={String(field.value ?? '')}
                            placeholder="0.00"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>Percentage from 0 to 100.</p>
                        </section>
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="bankAccountName"
                      label="Bank account name"
                      render={({ field }) => (
                        <Input
                          type="text"
                          value={String(field.value ?? '')}
                          placeholder="e.g. Scouts Victoria - Operating Account"
                          onChange={(value) => {
                            field.onChange(value);
                            setServerCurrencyError(null);
                            setHasLocalEdits(true);
                          }}
                        />
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="bankBsb"
                      label="BSB"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="text"
                            value={String(field.value ?? '')}
                            placeholder="123-456"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>Six digits, with or without a hyphen between the third and fourth digit.</p>
                        </section>
                      )}
                    />

                    <FormField<OrganisationSettingsFormValues>
                      name="bankAccountNumber"
                      label="Bank account number"
                      render={({ field }) => (
                        <section className="grid gap-2">
                          <Input
                            type="text"
                            value={String(field.value ?? '')}
                            placeholder="12345678"
                            onChange={(value) => {
                              field.onChange(value);
                              setServerCurrencyError(null);
                              setHasLocalEdits(true);
                            }}
                          />
                          <p>Digits only, 4 to 20 characters.</p>
                        </section>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    {canShowSave ? (
                      <SaveActions
                        onCancel={() => {
                          setServerCurrencyError(null);
                          setFormDefaults(loadedValues);
                          setFormDefaultsSourceKey(loadedValuesSignature);
                          setFormResetNonce((previous) => previous + 1);
                          setHasLocalEdits(false);
                        }}
                        saveType="submit"
                        saveDisabled={saveDisabled}
                      />
                    ) : (
                      <fieldset className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setServerCurrencyError(null);
                            setFormDefaults(loadedValues);
                            setFormDefaultsSourceKey(loadedValuesSignature);
                            setFormResetNonce((previous) => previous + 1);
                            setHasLocalEdits(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </fieldset>
                    )}
                  </CardFooter>
                </>
              );
            }}
          </Form>
        ) : null}
      </Card>
      </section>
    </main>
  );
}

export function OrganisationSettingsPage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.orgSettings}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <OrganisationSettingsPageContent />
    </PagePermissionGuard>
  );
}
