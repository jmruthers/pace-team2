// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MembershipTypesPage } from './MembershipTypesPage';

let selectedOrganisation: { id: string } | null = { id: 'org-1' };
let canCreate = true;
let canUpdate = true;

const createMembershipTypeMock = vi.fn();
const updateMembershipTypeMock = vi.fn();
const setMembershipTypeActiveMock = vi.fn();
const toastMock = vi.hoisted(() => vi.fn());

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

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  return buildPaceCoreComponentsMock(toastMock);
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