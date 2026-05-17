// @vitest-environment jsdom
/* eslint-disable pace-core-compliance/prefer-pace-core-components */
/* eslint-disable pace-core-compliance/prefer-pace-core-form */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as React from 'react';
import { SubOrganisationsPage } from './SubOrganisationsPage';

const DUPLICATE_NAME_MESSAGE =
  'An organisation with this name already exists. Names must be unique across the platform.';

let selectedOrganisation: { id: string; display_name?: string; name?: string } | null = {
  id: 'org-1',
  display_name: 'Parent Org',
};
let canCreate = true;
let canUpdate = true;
let mockIsValid = true;
let mockIsSubmitted = false;
let mockErrors: Record<string, unknown> = {};

const createSubOrganisationMock = vi.fn();
const updateSubOrganisationMock = vi.fn();
const toastMock = vi.fn();

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
    isLoading: false,
  }),
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unknown error',
  }),
}));

const useSubOrganisationsDataMock = vi.fn();

vi.mock('@/hooks/useSubOrganisationsData', () => ({
  useSubOrganisationsData: (...args: unknown[]) => useSubOrganisationsDataMock(...args),
}));

vi.mock('@/lib/settings/subOrganisations.validation', () => ({
  createSubOrganisationSchema: {},
  editSubOrganisationSchema: {},
  toCreateSubOrganisationInput: (values: {
    name: string;
    displayName: string;
    description: string;
    isActive: boolean;
  }, parentId: string) => ({
    name: values.name.trim(),
    displayName: values.displayName.trim(),
    description: values.description.trim().length === 0 ? null : values.description.trim(),
    parentId,
  }),
  toUpdateSubOrganisationInput: (values: {
    displayName: string;
    description: string;
    isActive: boolean;
  }) => ({
    displayName: values.displayName.trim(),
    description: values.description.trim().length === 0 ? null : values.description.trim(),
    isActive: values.isActive,
  }),
}));

vi.mock('@solvera/pace-core/components', () => {
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
      clearErrors: (name: keyof T) => void;
      setError: (name: keyof T, options: { type?: string; message?: string }) => void;
      formState: { isSubmitting: boolean; errors: Record<string, unknown> };
    }) => ReactNode;
  }) {
    const [values, setValues] = React.useState<T>((defaultValues ?? {}) as T);
    const methods = {
      watch: (name: keyof T) => values[name],
      setValue: (name: keyof T, value: unknown) => {
        setValues((previous) => ({ ...previous, [name]: value }));
      },
      clearErrors: () => undefined,
      setError: () => undefined,
      formState: {
        isSubmitting: false,
        isValid: mockIsValid,
        isSubmitted: mockIsSubmitted,
        errors: mockErrors,
      },
    };

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (mockIsValid) {
            void onSubmit(values);
          }
        }}
      >
        {children(methods)}
      </form>
    );
  }

  function FormField<T extends Record<string, unknown>>({
    label,
    render,
  }: {
    name: keyof T;
    label?: string;
    render?: (props: { field: { value: string; onChange: (value: string) => void } }) => ReactNode;
  }) {
    const [value, setValue] = React.useState('');
    return (
      <label>
        {label}
        {render
          ? render({ field: { value, onChange: setValue } })
          : <input value={value} onChange={(event) => setValue(event.target.value)} />}
      </label>
    );
  }

  return {
    Alert: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    AlertTitle: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    Button: ({
      children,
      onClick,
      disabled,
      type,
    }: {
      children: ReactNode;
      onClick?: () => void | Promise<void>;
      disabled?: boolean;
      type?: 'button' | 'submit';
      variant?: string;
    }) => (
      <button type={type ?? 'button'} onClick={() => void onClick?.()} disabled={disabled}>
        {children}
      </button>
    ),
    Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
    CardHeader: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    CardContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DataTable: ({
      data,
      columns,
      actions,
    }: {
      data: Array<Record<string, unknown>>;
      columns: Array<{ id?: string; accessorKey?: string; cell?: (info: { row: Record<string, unknown> }) => ReactNode }>;
      actions?: Array<{ label: string; onClick: (row: Record<string, unknown>) => void }>;
    }) => (
      <section>
        {data.map((row, index) => (
          <article key={String(row.id ?? index)}>
            {columns.map((column, columnIndex) => {
              if (column.cell == null) {
                return <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>{String(row[column.accessorKey ?? ''] ?? '')}</span>;
              }
              return <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>{column.cell({ row })}</span>;
            })}
            {actions?.map((action) => (
              <button key={action.label} type="button" onClick={() => action.onClick(row)}>
                {action.label}
              </button>
            ))}
          </article>
        ))}
      </section>
    ),
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <section>{children}</section> : null),
    DialogPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogHeader: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
    DialogBody: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogFooter: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    Form,
    FormField,
    Input: ({
      value,
      onChange,
      placeholder,
      type,
      disabled,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      placeholder?: string;
      type?: string;
      disabled?: boolean;
    }) => (
      <input
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        type={type ?? 'text'}
        disabled={disabled}
      />
    ),
    Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
    LoadingSpinner: () => <span>Loading</span>,
    Switch: ({
      checked,
      onChange,
      disabled,
    }: {
      checked?: boolean;
      onChange?: (checked: boolean) => void;
      id?: string;
      disabled?: boolean;
    }) => (
      <button type="button" disabled={disabled} onClick={() => onChange?.(!(checked ?? false))}>
        Toggle
      </button>
    ),
    Textarea: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      placeholder?: string;
    }) => (
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
      />
    ),
    toast: (...args: unknown[]) => toastMock(...args),
  };
});

function buildDataState() {
  return {
    subOrganisations: [
      {
        id: 'org-child-1',
        name: 'scouts-north',
        displayName: 'Scouts North',
        description: 'District',
        isActive: true,
        parentId: 'org-1',
      },
    ],
    isLoading: false,
    loadErrorMessage: null,
    refetchSubOrganisations: vi.fn(),
    createSubOrganisation: createSubOrganisationMock,
    updateSubOrganisation: updateSubOrganisationMock,
    createPending: false,
    updatePending: false,
  };
}

function renderPage() {
  return render(<SubOrganisationsPage />);
}

describe('SubOrganisationsPage', () => {
  beforeEach(() => {
    cleanup();
    selectedOrganisation = { id: 'org-1', display_name: 'Parent Org' };
    canCreate = true;
    canUpdate = true;
    mockIsValid = true;
    mockIsSubmitted = false;
    mockErrors = {};
    toastMock.mockReset();
    createSubOrganisationMock.mockReset();
    updateSubOrganisationMock.mockReset();
    useSubOrganisationsDataMock.mockReturnValue(buildDataState());
  });

  it('hides create button when user lacks create permission', () => {
    canCreate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: '+ New sub-organisation' })).toBeNull();
  });

  it('hides row edit action when user lacks update permission', () => {
    canUpdate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows duplicate-name inline error for 23505 without destructive toast', async () => {
    const user = userEvent.setup();
    createSubOrganisationMock.mockRejectedValue({
      code: '23505',
      message: 'duplicate',
      raw: { code: '23505' },
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));
    expect(screen.getByRole('heading', { name: 'Create sub-organisation' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(screen.getAllByText(DUPLICATE_NAME_MESSAGE)).toHaveLength(1);
    });

    expect(
      toastMock.mock.calls.some(
        (call) => (call[0] as { variant?: string })?.variant === 'destructive'
      )
    ).toBe(false);
  });

  it('submits create and update payloads with expected shapes', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));
    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(createSubOrganisationMock).toHaveBeenCalled();
    });
    expect(createSubOrganisationMock.mock.calls[0][0]).toEqual({
      name: '',
      displayName: '',
      description: null,
      parentId: 'org-1',
    });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateSubOrganisationMock).toHaveBeenCalled();
    });
    expect(updateSubOrganisationMock.mock.calls[0][0]).toEqual({
      id: 'org-child-1',
      input: {
        displayName: 'Scouts North',
        description: 'District',
        isActive: true,
      },
    });
  });

  it('shows validation alert and blocks submit when invalid', async () => {
    const user = userEvent.setup();
    mockIsValid = false;
    mockIsSubmitted = true;
    mockErrors = { name: { message: 'Internal name is required.' } };

    renderPage();
    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));

    expect(screen.getByText('Please fix the errors below.')).toBeTruthy();
    const submitButton = screen.getByRole('button', { name: 'Create sub-organisation' });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(submitButton);
    expect(createSubOrganisationMock).not.toHaveBeenCalled();
  });

  it('shows destructive toast only for non-23505 save failures', async () => {
    const user = userEvent.setup();
    createSubOrganisationMock.mockRejectedValue(new Error('network down'));

    renderPage();
    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));
    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Could not save sub-organisation',
        description: 'network down',
        variant: 'destructive',
      });
    });
  });

  it('disables editable controls while mutation is pending', async () => {
    const user = userEvent.setup();
    useSubOrganisationsDataMock.mockReturnValue({
      ...buildDataState(),
      createPending: true,
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));

    expect((screen.getByPlaceholderText('e.g. scouts-victoria-north') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Create sub-organisation/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes editor and shows default toast when organisation changes', async () => {
    const user = userEvent.setup();
    const rendered = renderPage();

    await user.click(screen.getByRole('button', { name: '+ New sub-organisation' }));
    expect(screen.getByRole('heading', { name: 'Create sub-organisation' })).toBeTruthy();

    selectedOrganisation = { id: 'org-2', display_name: 'Parent Org 2' };
    rendered.rerender(<SubOrganisationsPage />);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Create sub-organisation' })).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Editing cancelled — organisation changed.',
      variant: 'default',
    });
  });
});
