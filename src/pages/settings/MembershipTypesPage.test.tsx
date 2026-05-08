// @vitest-environment jsdom
/* eslint-disable pace-core-compliance/prefer-pace-core-components */
/* eslint-disable pace-core-compliance/prefer-pace-core-form */
/* eslint-disable pace-core-compliance/persistence-save-placement */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as React from 'react';
import { MembershipTypesPage } from './MembershipTypesPage';

let selectedOrganisation: { id: string } | null = { id: 'org-1' };
let canCreate = true;
let canUpdate = true;

const createMembershipTypeMock = vi.fn();
const updateMembershipTypeMock = vi.fn();
const setMembershipTypeActiveMock = vi.fn();
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
  }),
}));

const useMembershipTypesDataMock = vi.fn();

vi.mock('@/hooks/useMembershipTypesData', () => ({
  useMembershipTypesData: (...args: unknown[]) => useMembershipTypesDataMock(...args),
}));

vi.mock('@/lib/settings/membershipTypes.validation', () => ({
  membershipTypeSchema: {},
  toMutationInput: (values: {
    name: string;
    minAge: string;
    maxAge: string;
    isActive: boolean;
  }) => ({
    name: values.name,
    minAge: values.minAge.length > 0 ? Number(values.minAge) : null,
    maxAge: values.maxAge.length > 0 ? Number(values.maxAge) : null,
    isActive: values.isActive,
  }),
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unknown error',
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
      formState: { isSubmitting: boolean };
    }) => ReactNode;
  }) {
    const [values, setValues] = React.useState<T>((defaultValues ?? {}) as T);
    const methods = {
      watch: (name: keyof T) => values[name],
      setValue: (name: keyof T, value: unknown) => {
        setValues((previous) => ({ ...previous, [name]: value }));
      },
      formState: { isSubmitting: false },
    };

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(values);
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
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({
      children,
      onClick,
      disabled,
      type,
      variant,
    }: {
      children: ReactNode;
      onClick?: () => void | Promise<void>;
      disabled?: boolean;
      type?: 'button' | 'submit';
      variant?: string;
    }) => (
      <button type={type ?? 'button'} onClick={() => void onClick?.()} disabled={disabled} data-variant={variant}>
        {children}
      </button>
    ),
    ConfirmationDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void | Promise<void> }) => (
      open
        ? (
          <section>
            <p>Deactivate membership type?</p>
            <button type="button" onClick={() => void onConfirm()}>Deactivate</button>
          </section>
          )
        : null
    ),
    DataTable: ({
      data,
      columns,
      onCreateRow,
      features,
      emptyState,
    }: {
      data: Array<Record<string, unknown>>;
      columns: Array<{ id?: string; accessorKey?: string; cell?: (info: { row: Record<string, unknown> }) => ReactNode }>;
      onCreateRow?: () => void | Promise<void>;
      features?: { creation?: boolean };
      emptyState?: { title?: string; description?: string };
    }) => (
      <section>
        {features?.creation !== false && (
          <button type="button" onClick={() => void onCreateRow?.()}>Create</button>
        )}
        {data.length === 0 ? (
          <>
            <p>{emptyState?.title}</p>
            <p>{emptyState?.description}</p>
          </>
        ) : (
          data.map((row, index) => (
            <article key={String(row.id ?? index)}>
              {columns.map((column, columnIndex) => {
                if (column.cell == null) {
                  return <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>{String(row[column.accessorKey ?? ''] ?? '')}</span>;
                }
                return <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>{column.cell({ row })}</span>;
              })}
            </article>
          ))
        )}
      </section>
    ),
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <section>{children}</section> : null),
    DialogPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogHeader: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogBody: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    Form,
    FormField,
    Input: ({
      value,
      onChange,
      placeholder,
      type,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      placeholder?: string;
      type?: string;
    }) => (
      <input
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        type={type ?? 'text'}
      />
    ),
    Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
    SaveActions: ({
      onCancel,
      saveDisabled,
    }: {
      onCancel?: () => void;
      saveDisabled?: boolean;
    }) => (
      <section>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saveDisabled}>Save</button>
      </section>
    ),
    Switch: ({
      checked,
      onChange,
    }: {
      checked?: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <button type="button" onClick={() => onChange?.(!(checked ?? false))}>
        Toggle
      </button>
    ),
    toast: (...args: unknown[]) => toastMock(...args),
  };
});

function buildDataState() {
  return {
    membershipTypes: [
      {
        id: 1,
        name: 'Junior',
        minAge: 5,
        maxAge: 12,
        isActive: true,
        organisationId: 'org-1',
        membersCount: 3,
      },
    ],
    isLoading: false,
    loadErrorMessage: null,
    refetchMembershipTypes: vi.fn(),
    refetchMembersCount: vi.fn(),
    createMembershipType: createMembershipTypeMock,
    updateMembershipType: updateMembershipTypeMock,
    setMembershipTypeActive: setMembershipTypeActiveMock,
    createPending: false,
    updatePending: false,
    setActivePending: false,
  };
}

function buildInactiveDataState() {
  return {
    ...buildDataState(),
    membershipTypes: [
      {
        id: 2,
        name: 'Inactive Type',
        minAge: null,
        maxAge: null,
        isActive: false,
        organisationId: 'org-1',
        membersCount: 0,
      },
    ],
  };
}

function renderPage() {
  return render(<MembershipTypesPage />);
}

describe('MembershipTypesPage', () => {
  beforeEach(() => {
    cleanup();
    selectedOrganisation = { id: 'org-1' };
    canCreate = true;
    canUpdate = true;
    toastMock.mockReset();
    createMembershipTypeMock.mockReset();
    updateMembershipTypeMock.mockReset();
    setMembershipTypeActiveMock.mockReset();
    useMembershipTypesDataMock.mockReturnValue(buildDataState());
  });

  it('shows duplicate-name inline error for 23505 without destructive toast', async () => {
    const user = userEvent.setup();
    createMembershipTypeMock.mockRejectedValue({
      code: '23505',
      message: 'duplicate',
      raw: { code: '23505' },
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Create membership type')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('A membership type with this name already exists in this organisation.')).toBeTruthy();
    });

    expect(
      toastMock.mock.calls.some(
        (call) => (call[0] as { variant?: string })?.variant === 'destructive'
      )
    ).toBe(false);
  });

  it('closes editor and shows default toast when organisation changes', async () => {
    const user = userEvent.setup();
    const rendered = renderPage();

    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Create membership type')).toBeTruthy();

    selectedOrganisation = { id: 'org-2' };
    rendered.rerender(<MembershipTypesPage />);

    await waitFor(() => {
      expect(screen.queryByText('Create membership type')).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Editing cancelled — organisation changed.',
      variant: 'default',
    });
  });

  it('renders page title and empty state when there are no rows', () => {
    useMembershipTypesDataMock.mockReturnValue({
      ...buildDataState(),
      membershipTypes: [],
    });

    renderPage();
    expect(screen.getByText('Membership types')).toBeTruthy();
    expect(screen.getByText('No membership types yet.')).toBeTruthy();
    expect(screen.getByText('Create your first to start assigning members.')).toBeTruthy();
  });

  it('shows create success toast after save', async () => {
    const user = userEvent.setup();
    createMembershipTypeMock.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Membership type created.',
        variant: 'success',
      });
    });
  });

  it('shows update success toast after edit save', async () => {
    const user = userEvent.setup();
    updateMembershipTypeMock.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Membership type updated.',
        variant: 'success',
      });
    });
  });

  it('shows deactivate success toast after confirmation', async () => {
    const user = userEvent.setup();
    setMembershipTypeActiveMock.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[1]!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Junior deactivated.',
        variant: 'success',
      });
    });
  });

  it('shows reactivate success toast for inactive row action', async () => {
    const user = userEvent.setup();
    setMembershipTypeActiveMock.mockResolvedValue(undefined);
    useMembershipTypesDataMock.mockReturnValue(buildInactiveDataState());
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Reactivate' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Inactive Type reactivated.',
        variant: 'success',
      });
    });
  });

  it('hides create action when create permission is denied', () => {
    canCreate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('hides row actions when update permission is denied', () => {
    canUpdate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).toBeNull();
  });
});
