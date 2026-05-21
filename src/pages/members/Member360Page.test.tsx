// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Member360Page } from './Member360Page';

const launchMemberProfileMock = vi.fn();
const toastMock = vi.hoisted(() => vi.fn());
const deactivateOrReactivateCardMock = vi.fn();
const saveIdentityMock = vi.fn();
const fetchContactDetailsMock = vi.fn();
let formIsDirty = false;

let currentUserId = 'user-1';
let selectedOrganisation: { id: string } | null = { id: 'org-1' };
let memberPermissionCanUpdate = true;
let portalPermissionCanRead = true;
let portalPermissionCanUpdate = true;

const useMember360DataMock = vi.fn();

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
  useUnifiedAuth: () => ({
    user: { id: currentUserId },
  }),
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation,
  }),
}));

let allowMembersPageRead = true;

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    allowMembersPageRead ? <>{children}</> : <>{fallback ?? null}</>,
  useResourcePermissions: (resource: string) => {
    if (resource === 'members') {
      return { canUpdate: memberPermissionCanUpdate, canRead: true };
    }
    return { canRead: portalPermissionCanRead, canUpdate: portalPermissionCanUpdate };
  },
}));

vi.mock('@solvera/pace-core/member-profile-launch', () => ({
  launchMemberProfile: (...args: unknown[]) => launchMemberProfileMock(...args),
}));

vi.mock('@solvera/pace-core/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solvera/pace-core/utils')>();
  return {
    ...actual,
    HandleSupabaseError: (error: unknown) => ({
      message: error instanceof Error ? error.message : 'error',
    }),
  };
});

vi.mock('@solvera/pace-core/icons', () => ({
  ChevronLeft: () => <span aria-hidden>left</span>,
  ChevronRight: () => <span aria-hidden>right</span>,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock, MockButton, MockCardFooter, MockSaveActions } = await import(
    '@/test-utils/paceCoreMocks'
  );
  const base = buildPaceCoreComponentsMock(toastMock);
  return {
    ...base,
    Avatar: ({ name }: { name: string }) => <p>{name}</p>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    ConfirmationDialog: ({
      open,
      title,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      title: string;
      confirmLabel?: string;
      onConfirm: () => void;
    }) =>
      open ? (
        <section>
          <p>{title}</p>
          <MockButton onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</MockButton>
        </section>
      ) : null,
    DataTable: ({
      data,
      columns,
      emptyState,
    }: {
      data: Array<Record<string, unknown>>;
      columns: Array<{
        id?: string;
        accessorKey?: string;
        header: string;
        cell?: (info: { row: Record<string, unknown>; getValue: () => unknown; index: number }) => ReactNode;
      }>;
      emptyState?: { title?: string };
    }) => (
      <section>
        {data.length === 0 ? (
          <p>{emptyState?.title}</p>
        ) : (
          data.map((row, index) => (
            <article key={String(row.id ?? index)}>
              {columns.map((column) => (
                <span key={column.id ?? column.accessorKey ?? column.header}>
                  {column.cell
                    ? column.cell({ row, getValue: () => row[column.accessorKey ?? ''], index })
                    : String(row[column.accessorKey ?? ''] ?? '')}
                </span>
              ))}
            </article>
          ))
        )}
      </section>
    ),
    DatePickerWithTimezone: () => null,
    DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
    Form: ({ children }: { children: (methods: unknown) => ReactNode }) => (
      <section>
        {children({
          formState: { isDirty: formIsDirty, isSubmitting: false },
          handleSubmit: (fn: unknown) => fn,
          setError: vi.fn(),
          reset: vi.fn(),
        })}
      </section>
    ),
    FormField: ({ label }: { label?: string }) => <span>{label}</span>,
    SaveActions: MockSaveActions,
    CardFooter: MockCardFooter,
  };
});

vi.mock('@/hooks/useMember360Data', () => ({
  useMember360Data: (...args: unknown[]) => useMember360DataMock(...args),
}));

function baseHookState() {
  return {
    member: {
      id: 'member-1',
      personId: 'person-1',
      organisationId: 'org-1',
      firstName: 'Ava',
      lastName: 'Adams',
      preferredName: null,
      email: 'ava@example.com',
      dateOfBirth: null,
      genderId: null,
      genderName: null,
      pronounId: null,
      pronounName: null,
      userId: 'target-user',
      membershipTypeId: null,
      membershipTypeName: null,
      membershipNumber: null,
      membershipStatus: 'Active',
      validFrom: null,
      validTo: null,
      residentialAddressId: null,
      residentialAddress: null,
      postalAddressId: null,
      postalAddress: null,
    },
    memberLoading: false,
    memberErrorMessage: null,
    refetchMember: vi.fn(),
    memberPhones: [],
    memberPhonesLoading: false,
    memberPhonesErrorMessage: null,
    refetchMemberPhones: vi.fn(),
    contacts: [],
    contactsLoading: false,
    contactsErrorMessage: null,
    refetchContacts: vi.fn(),
    cards: [{ id: 'card-1', memberId: 'member-1', cardIdentifier: 'PACE-123', isActive: true, createdAt: '2026-05-01' }],
    cardsLoading: false,
    cardsErrorMessage: null,
    refetchCards: vi.fn(),
    applications: [],
    applicationsLoading: false,
    applicationsErrorMessage: null,
    refetchApplications: vi.fn(),
    genderTypes: [],
    pronounTypes: [],
    membershipTypes: [],
    saveIdentity: saveIdentityMock,
    saveIdentityPending: false,
    deactivateOrReactivateCard: deactivateOrReactivateCardMock,
    cardMutationPending: false,
    fetchContactDetails: fetchContactDetailsMock,
  };
}

function renderPage(initialPath = '/members/member-1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/members/:memberId" element={<Member360Page />} />
        <Route path="/members/:memberId/roles" element={<article>Standing roles route</article>} />
        <Route path="/members" element={<article>Members directory route</article>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Member360Page', () => {
  beforeEach(() => {
    cleanup();
    currentUserId = 'user-1';
    selectedOrganisation = { id: 'org-1' };
    memberPermissionCanUpdate = true;
    portalPermissionCanRead = true;
    portalPermissionCanUpdate = true;
    allowMembersPageRead = true;
    formIsDirty = false;
    launchMemberProfileMock.mockReset();
    toastMock.mockReset();
    deactivateOrReactivateCardMock.mockReset();
    saveIdentityMock.mockReset();
    fetchContactDetailsMock.mockReset();
    useMember360DataMock.mockImplementation(() => baseHookState());
  });

  it('renders member not found state when member query returns null', () => {
    useMember360DataMock.mockImplementation(() => ({
      ...baseHookState(),
      member: null,
    }));

    renderPage();

    expect(screen.getByText('Member not found')).toBeTruthy();
  });

  it('hides portal CTA when acting user is target member', () => {
    currentUserId = 'target-user';
    renderPage();

    expect(screen.queryByRole('button', { name: 'Edit in Portal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View in Portal' })).toBeNull();
  });

  it('shows edit portal CTA and launches edit mode URL helper', async () => {
    const user = userEvent.setup();
    portalPermissionCanUpdate = true;
    portalPermissionCanRead = true;

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Edit in Portal' }));

    expect(launchMemberProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        memberId: 'member-1',
      })
    );
  });

  it('shows view portal CTA when update is denied but read is granted', async () => {
    const user = userEvent.setup();
    portalPermissionCanUpdate = false;
    portalPermissionCanRead = true;

    renderPage();
    await user.click(screen.getByRole('button', { name: 'View in Portal' }));

    expect(launchMemberProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'view',
        memberId: 'member-1',
      })
    );
  });

  it('shows deactivate action when member update permission is granted', () => {
    memberPermissionCanUpdate = true;
    renderPage();

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeTruthy();
  });

  it('renders org-mismatch alert when loaded member org differs from selected org', () => {
    useMember360DataMock.mockImplementation(() => ({
      ...baseHookState(),
      member: {
        ...baseHookState().member,
        organisationId: 'org-2',
      },
    }));

    renderPage();

    expect(screen.getByText('This member is not in the current organisation')).toBeTruthy();
  });

  it('shows destructive toast when card mutation fails', async () => {
    const user = userEvent.setup();
    deactivateOrReactivateCardMock.mockRejectedValueOnce(new Error('card denied'));

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[1]!);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'card denied',
        variant: 'destructive',
      })
    );
  });

  it('opens discard dialog when cancelling a dirty edit form', async () => {
    const user = userEvent.setup();
    formIsDirty = true;

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
  });

  it('shows applications empty-state copy when no rows are returned', () => {
    useMember360DataMock.mockImplementation(() => ({
      ...baseHookState(),
      applications: [],
    }));

    renderPage();

    expect(screen.getByText('No applications recorded.')).toBeTruthy();
  });

  it('navigates to standing roles route when View roles is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /View roles/u }));

    expect(screen.getByText('Standing roles route')).toBeTruthy();
  });

  it('navigates to members directory when Back to members is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Back to members/u }));

    expect(screen.getByText('Members directory route')).toBeTruthy();
  });

  it('shows access denied fallback when members page guard denies read', () => {
    allowMembersPageRead = false;
    renderPage();

    expect(screen.getByText('Denied')).toBeTruthy();
    expect(screen.queryByText(/Ava Adams/)).toBeNull();
  });
});
