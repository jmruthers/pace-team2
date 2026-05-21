// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MemberRolesPage } from './MemberRolesPage';

let selectedOrganisation: { id: string } | null = { id: 'org-1' };
let canUpdate = true;

const useMemberRolesDataMock = vi.fn();

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  useResourcePermissions: () => ({ canRead: true, canUpdate }),
}));

vi.mock('@/hooks/useMemberRolesData', () => ({
  useMemberRolesData: (...args: unknown[]) => useMemberRolesDataMock(...args),
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@solvera/pace-core/icons', () => ({
  ChevronLeft: () => <span aria-hidden>left</span>,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  const base = buildPaceCoreComponentsMock(toastMock);
  return {
    ...base,
    DatePickerWithTimezone: () => null,
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
      emptyState?: { title?: string; description?: string };
    }) => (
      <section>
        {data.length === 0 ? (
          <>
            <p>{emptyState?.title}</p>
            <p>{emptyState?.description}</p>
          </>
        ) : (
          data.map((row, index) => (
            <article key={String(row.id ?? index)}>
              {columns.map((column) => (
                <span key={column.id ?? column.accessorKey ?? column.header}>
                  {column.cell
                    ? column.cell({
                        row,
                        getValue: () => row[column.accessorKey ?? ''],
                        index,
                      })
                    : String(row[column.accessorKey ?? ''] ?? '')}
                </span>
              ))}
            </article>
          ))
        )}
      </section>
    ),
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <section data-testid="mock-select" data-value={value} onChangeCapture={() => undefined}>
        {children}
        <MockButton onClick={() => onValueChange?.('role-1')}>pick</MockButton>
      </section>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  };
});

function buildHookState() {
  return {
    member: {
      id: 'member-1',
      organisationId: 'org-1',
      firstName: 'Sam',
      lastName: 'Taylor',
      preferredName: null,
    },
    memberLoading: false,
    memberErrorMessage: null,
    refetchMember: vi.fn(),
    roles: [
      {
        id: 'role-active',
        memberId: 'member-1',
        roleId: 1,
        organisationId: 'org-1',
        startDate: '2026-05-01',
        endDate: null,
        roleName: 'Leader',
      },
      {
        id: 'role-ended',
        memberId: 'member-1',
        roleId: 2,
        organisationId: 'org-1',
        startDate: '2026-04-01',
        endDate: '2026-05-03',
        roleName: 'Support',
      },
    ],
    rolesLoading: false,
    rolesErrorMessage: null,
    refetchRoles: vi.fn(),
    roleTypes: [{ id: 1, name: 'Leader' }],
    roleTypesLoading: false,
    roleTypesErrorMessage: null,
    refetchRoleTypes: vi.fn(),
    addRole: vi.fn(),
    addRolePending: false,
    addRoleError: null,
    resetAddRole: vi.fn(),
    endRole: vi.fn(),
    endRolePending: false,
    endRoleErrorMessage: null,
    resetEndRole: vi.fn(),
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/members/member-1/roles']}>
      <Routes>
        <Route path="/members/:memberId/roles" element={<MemberRolesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MemberRolesPage', () => {
  beforeEach(() => {
    cleanup();
    selectedOrganisation = { id: 'org-1' };
    canUpdate = true;
    toastMock.mockReset();
    const state = buildHookState();
    useMemberRolesDataMock.mockReturnValue(state);
  });

  it('renders not found state when member is null', () => {
    useMemberRolesDataMock.mockReturnValue({
      ...buildHookState(),
      member: null,
    });
    renderPage();
    expect(screen.getByText('Member not found')).toBeTruthy();
  });

  it('renders org mismatch alert', () => {
    useMemberRolesDataMock.mockReturnValue({
      ...buildHookState(),
      member: {
        ...buildHookState().member,
        organisationId: 'org-2',
      },
    });
    renderPage();
    expect(screen.getByText('This member is not in the current organisation')).toBeTruthy();
  });

  it('hides add role button when update permission is denied', () => {
    canUpdate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Add role' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End role' })).toBeNull();
  });

  it('shows disabled add role helper text when no role types exist', () => {
    useMemberRolesDataMock.mockReturnValue({
      ...buildHookState(),
      roleTypes: [],
    });
    renderPage();
    expect(screen.getByText('No role types configured for this organisation. Contact your administrator.')).toBeTruthy();
  });

  it('opens add role modal from header action', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add role' }));
    expect(screen.getByText('Record a new standing role for this member.')).toBeTruthy();
  });

  it('renders End role action only for active rows', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: 'End role' })).toHaveLength(1);
  });

  it('closes End role dialog when mutation fails', async () => {
    const user = userEvent.setup();
    const endRole = vi.fn().mockRejectedValue(new Error('rls denied'));
    useMemberRolesDataMock.mockReturnValue({
      ...buildHookState(),
      endRole,
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: 'End role' }));
    expect(screen.getByText('End role?')).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'End role' })[1]!);
    expect(screen.queryByText('End role?')).toBeNull();
  });
});
