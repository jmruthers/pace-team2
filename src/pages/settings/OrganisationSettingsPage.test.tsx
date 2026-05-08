// @vitest-environment jsdom
/* eslint-disable pace-core-compliance/prefer-pace-core-components */
/* eslint-disable pace-core-compliance/prefer-pace-core-form */
/* eslint-disable pace-core-compliance/persistence-save-placement */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as React from 'react';
import { OrganisationSettingsPage } from './OrganisationSettingsPage';

let selectedOrganisation: { id: string } | null = { id: 'org-1' };
let canCreate = true;
let canUpdate = true;
let permissionsLoading = false;

const toastMock = vi.fn();
const saveOrganisationSettingsMock = vi.fn();
const refetchOrganisationSettingsMock = vi.fn();
const useOrganisationSettingsDataMock = vi.fn();

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: ({ message }: { message?: string }) => <p>{message ?? 'Denied'}</p>,
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  useResourcePermissions: () => ({
    canRead: true,
    canCreate,
    canUpdate,
    isLoading: permissionsLoading,
  }),
}));

vi.mock('@/hooks/useOrganisationSettingsData', () => ({
  useOrganisationSettingsData: (...args: unknown[]) => useOrganisationSettingsDataMock(...args),
}));

vi.mock('@/lib/settings/organisationSettings.validation', () => ({
  organisationSettingsSchema: {},
  toFormValues: (row: {
    baseCurrency?: string;
    joiningFee?: number | null;
    recurringFee?: number | null;
    feeRecurrenceDays?: number | null;
    taxRate?: number | null;
    bankAccountName?: string | null;
    bankBsb?: string | null;
    bankAccountNumber?: string | null;
  } | null) => ({
    baseCurrencySelection: row?.baseCurrency ?? 'AUD',
    baseCurrencyOther: '',
    joiningFee: row?.joiningFee == null ? '' : String(row.joiningFee),
    recurringFee: row?.recurringFee == null ? '' : String(row.recurringFee),
    feeRecurrenceDays: row?.feeRecurrenceDays == null ? '' : String(row.feeRecurrenceDays),
    taxRate: row?.taxRate == null ? '' : String(row.taxRate),
    bankAccountName: row?.bankAccountName ?? '',
    bankBsb: row?.bankBsb ?? '',
    bankAccountNumber: row?.bankAccountNumber ?? '',
  }),
  toMutationInput: (values: Record<string, unknown>, organisationId: string) => ({
    organisationId,
    ...values,
  }),
}));

vi.mock('@solvera/pace-core/components', () => {
  const FormContext = React.createContext<{
    values: Record<string, unknown>;
    setValue: (name: string, value: unknown) => void;
    formState: {
      isSubmitting: boolean;
      isValid: boolean;
      isDirty: boolean;
      isSubmitted: boolean;
      errors: Record<string, unknown>;
    };
  } | null>(null);

  function Form<T extends Record<string, unknown>>({
    defaultValues,
    onSubmit,
    children,
  }: {
    defaultValues?: T;
    onSubmit: (values: T) => Promise<void> | void;
    children: (methods: {
      watch: (name: keyof T) => unknown;
      setValue: (name: keyof T, value: unknown) => void;
      formState: {
        isSubmitting: boolean;
        isValid: boolean;
        isDirty: boolean;
        isSubmitted: boolean;
        errors: Record<string, unknown>;
      };
    }) => ReactNode;
  }) {
    const [values, setValues] = React.useState<Record<string, unknown>>((defaultValues ?? {}) as Record<string, unknown>);
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);

    const setValue = (name: string, value: unknown) => {
      setIsDirty(true);
      setValues((previous) => ({ ...previous, [name]: value }));
    };

    const formState = {
      isSubmitting: false,
      isValid: true,
      isDirty,
      isSubmitted,
      errors: {},
    };

    return (
      <FormContext.Provider value={{ values, setValue, formState }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setIsSubmitted(true);
            void onSubmit(values as T);
          }}
        >
          {children({
            watch: (name: keyof T) => values[String(name)],
            setValue: (name: keyof T, value: unknown) => setValue(String(name), value),
            formState,
          })}
        </form>
      </FormContext.Provider>
    );
  }

  function FormField<T extends Record<string, unknown>>({
    name,
    label,
    render,
  }: {
    name: keyof T;
    label?: string;
    render: (props: { field: { value: string; onChange: (value: string) => void } }) => ReactNode;
  }) {
    const context = React.useContext(FormContext);
    const value = String(context?.values[String(name)] ?? '');

    return (
      <label>
        {label}
        {render({
          field: {
            value,
            onChange: (nextValue) => {
              context?.setValue(String(name), nextValue);
            },
          },
        })}
      </label>
    );
  }

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value?: string) => void;
    children: ReactNode;
  }) {
    return (
      <select value={value ?? ''} onChange={(event) => onValueChange?.(event.target.value)}>
        {children}
      </select>
    );
  }

  return {
    Alert: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    AlertTitle: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    Button: ({
      children,
      type,
      onClick,
      disabled,
    }: {
      children: ReactNode;
      type?: 'button' | 'submit';
      onClick?: () => void;
      disabled?: boolean;
      variant?: string;
    }) => (
      <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
    CardContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    CardFooter: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardHeader: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Form,
    FormField,
    Input: ({
      value,
      onChange,
      onBlur,
      placeholder,
      type,
      step,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      onBlur?: () => void;
      placeholder?: string;
      type?: string;
      step?: string;
    }) => (
      <input
        type={type ?? 'text'}
        value={value ?? ''}
        placeholder={placeholder}
        step={step}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={onBlur}
      />
    ),
    LoadingSpinner: () => <span>Loading</span>,
    SaveActions: ({
      onCancel,
      saveDisabled,
    }: {
      onCancel?: () => void;
      saveDisabled?: boolean;
      saveType?: 'submit';
    }) => (
      <section>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saveDisabled}>Save</button>
      </section>
    ),
    Select,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
    toast: (...args: unknown[]) => toastMock(...args),
  };
});

function buildDataState(overrides?: Partial<ReturnType<typeof useOrganisationSettingsDataMock>>) {
  return {
    organisationSettings: null,
    hasExistingRow: false,
    isLoading: false,
    loadErrorMessage: null,
    refetchOrganisationSettings: refetchOrganisationSettingsMock,
    saveOrganisationSettings: saveOrganisationSettingsMock,
    savePending: false,
    ...overrides,
  };
}

function renderPage() {
  return render(<OrganisationSettingsPage />);
}

describe('OrganisationSettingsPage', () => {
  beforeEach(() => {
    cleanup();
    selectedOrganisation = { id: 'org-1' };
    canCreate = true;
    canUpdate = true;
    permissionsLoading = false;
    toastMock.mockReset();
    saveOrganisationSettingsMock.mockReset();
    refetchOrganisationSettingsMock.mockReset();
    useOrganisationSettingsDataMock.mockReturnValue(buildDataState());
  });

  it('renders first-time defaults with save visible when create is allowed', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Organisation settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Financial' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('shows loading spinner and no footer actions while loading', () => {
    useOrganisationSettingsDataMock.mockReturnValue(
      buildDataState({
        isLoading: true,
      })
    );
    renderPage();
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('hides save when create is denied for first-time row', () => {
    canCreate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('hides save when update is denied for existing row', () => {
    canUpdate = false;
    useOrganisationSettingsDataMock.mockReturnValue(
      buildDataState({
        hasExistingRow: true,
        organisationSettings: {
          id: 'settings-1',
          organisationId: 'org-1',
          joiningFee: 10,
          recurringFee: 5,
          feeRecurrenceDays: 30,
          taxRate: 10,
          baseCurrency: 'AUD',
          bankAccountName: null,
          bankBsb: null,
          bankAccountNumber: null,
        },
      })
    );
    renderPage();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('prefills form values from an existing row', () => {
    useOrganisationSettingsDataMock.mockReturnValue(
      buildDataState({
        hasExistingRow: true,
        organisationSettings: {
          id: 'settings-1',
          organisationId: 'org-1',
          joiningFee: 25,
          recurringFee: 10,
          feeRecurrenceDays: 30,
          taxRate: 10,
          baseCurrency: 'AUD',
          bankAccountName: 'Operating account',
          bankBsb: '123-456',
          bankAccountNumber: '12345678',
        },
      })
    );
    renderPage();
    expect(screen.getByDisplayValue('25')).toBeTruthy();
    expect(screen.getAllByDisplayValue('10').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('30')).toBeTruthy();
    expect(screen.getByDisplayValue('Operating account')).toBeTruthy();
    expect(screen.getByDisplayValue('123-456')).toBeTruthy();
  });

  it('shows success toast after save', async () => {
    const user = userEvent.setup();
    saveOrganisationSettingsMock.mockResolvedValue({
      id: 'settings-1',
      organisationId: 'org-1',
      joiningFee: 12.5,
      recurringFee: null,
      feeRecurrenceDays: null,
      taxRate: null,
      baseCurrency: 'AUD',
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null,
    });
    renderPage();

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Organisation settings saved.',
        variant: 'success',
      });
    });
  });

  it('shows inline 23514 currency alert and does not show destructive toast', async () => {
    const user = userEvent.setup();
    saveOrganisationSettingsMock.mockRejectedValue({
      code: '23514',
      message: 'check violation',
      raw: { code: '23514' },
    });
    renderPage();

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Currency must be a 3-letter ISO code, e.g. AUD.')).toBeTruthy();
    });

    expect(
      toastMock.mock.calls.some((call) => (call[0] as { variant?: string })?.variant === 'destructive')
    ).toBe(false);
  });

  it('shows destructive toast for 42501 save denial', async () => {
    const user = userEvent.setup();
    saveOrganisationSettingsMock.mockRejectedValue({
      code: '42501',
      message: 'permission denied',
      raw: { code: '42501' },
    });
    renderPage();

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Could not save organisation settings',
        description: 'permission denied',
        variant: 'destructive',
      });
    });
  });

  it('sends payload with current organisation id', async () => {
    const user = userEvent.setup();
    saveOrganisationSettingsMock.mockResolvedValue({
      id: 'settings-1',
      organisationId: 'org-1',
      joiningFee: 12.5,
      recurringFee: null,
      feeRecurrenceDays: null,
      taxRate: null,
      baseCurrency: 'AUD',
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null,
    });
    renderPage();

    await user.type(screen.getAllByPlaceholderText('0.00')[0], '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveOrganisationSettingsMock).toHaveBeenCalled();
    });
    expect(saveOrganisationSettingsMock.mock.calls[0][0]).toMatchObject({
      organisationId: 'org-1',
    });
  });

  it('shows org-switch toast when user has unsaved edits', async () => {
    const user = userEvent.setup();
    const rendered = renderPage();
    const joiningFeeInput = screen.getAllByPlaceholderText('0.00')[0];
    await user.type(joiningFeeInput, '1');

    selectedOrganisation = { id: 'org-2' };
    rendered.rerender(<OrganisationSettingsPage />);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Editing cancelled — organisation changed.',
        variant: 'default',
      });
    });
  });
});
