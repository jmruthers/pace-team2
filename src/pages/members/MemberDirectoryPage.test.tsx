// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MemberDirectoryPage } from './MemberDirectoryPage';
import { toast } from '@solvera/pace-core/components';

let currentOrganisation: { id: string } | null = { id: 'org-1' };
let allowPageRead = true;
const useMemberDirectoryDataMock = vi.fn();

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation: currentOrganisation,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({
    children,
    fallback,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
  }) => (allowPageRead ? <>{children}</> : <>{fallback ?? null}</>),
}));

vi.mock('@solvera/pace-core/components', () => ({
  Alert: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  AlertTitle: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Label: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      data-button-type={type ?? 'button'}
    >
      {children}
    </div>
  ),
  Tabs: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TabsList: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <div role="button">{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <section>
      <p data-testid="membership-select-value">{value ?? ''}</p>
      <div role="button" onClick={() => onValueChange?.('1')}>
        mock-select-type-1
      </div>
      {children}
    </section>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ''}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DataTable: ({
    selection,
    onRowSelectionChange,
    description,
  }: {
    selection?: Record<string, boolean>;
    onRowSelectionChange?: (selection: Record<string, boolean>) => void;
    description: string;
  }) => (
    <section>
      <p>{description}</p>
      <p data-testid="selection-size">{Object.keys(selection ?? {}).length}</p>
      <div role="button" onClick={() => onRowSelectionChange?.({ 'member-1': true })}>
        mock-select-one
      </div>
    </section>
  ),
  toast: vi.fn(),
}));

vi.mock('@/lib/members/memberDirectory.columns', () => ({
  buildMemberColumns: () => [],
  buildPendingColumns: () => [],
}));

const sampleMemberRow = {
  id: 'member-1',
  personId: 'person-1',
  membershipNumber: 'A001',
  membershipStatus: 'Active',
  membershipTypeId: 1,
  membershipTypeName: 'Adult',
  organisationId: 'org-1',
  firstName: 'Ava',
  lastName: 'Adams',
  preferredName: null,
  email: 'ava@example.com',
};

function createMemberDirectoryDataReturn(overrides: Record<string, unknown> = {}) {
  return {
    memberTypes: [{ id: 1, name: 'Adult' }],
    members: [sampleMemberRow],
    pendingMembers: [],
    membersLoading: false,
    pendingLoading: false,
    membersErrorMessage: null,
    pendingErrorMessage: null,
    refetchMembers: vi.fn(),
    refetchPending: vi.fn(),
    ...overrides,
  };
}

let resolveMemberDirectoryData: () => ReturnType<typeof createMemberDirectoryDataReturn> = () =>
  createMemberDirectoryDataReturn();

vi.mock('@/hooks/useMemberDirectoryData', () => ({
  useMemberDirectoryData: (...args: unknown[]) => {
    useMemberDirectoryDataMock(...args);
    return resolveMemberDirectoryData();
  },
}));

vi.mock('@/lib/members/memberDirectory.picker', async () => {
  const actual = await vi.importActual<typeof import('@/lib/members/memberDirectory.picker')>(
    '@/lib/members/memberDirectory.picker'
  );
  return actual;
});

function renderPickerRoute() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/members', state: { intent: 'commsManualPick' } }]}>
      <Routes>
        <Route path="/members" element={<MemberDirectoryPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderRoute(pathname: string, state?: unknown) {
  const [pathOnly, search = ''] = pathname.split('?');
  return render(
    <MemoryRouter initialEntries={[{ pathname: pathOnly ?? pathname, search: search ? `?${search}` : '', state }]}>
      <Routes>
        <Route path="/members" element={<MemberDirectoryPage />} />
        <Route path="/communications" element={<p>Communications Route</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MemberDirectoryPage picker mode', () => {
  beforeEach(() => {
    cleanup();
    allowPageRead = true;
    currentOrganisation = { id: 'org-1' };
    resolveMemberDirectoryData = () => createMemberDirectoryDataReturn();
    useMemberDirectoryDataMock.mockReset();
    window.sessionStorage.clear();
    vi.mocked(toast).mockClear();
  });

  it('hydrates selected ids when payload org matches current org', async () => {
    window.sessionStorage.setItem(
      'pace:team:comms:manual-pick',
      JSON.stringify({
        organisationId: 'org-1',
        memberIds: ['member-1'],
        updatedAt: Date.now(),
      })
    );

    renderPickerRoute();

    await waitFor(() => {
      expect(screen.getByTestId('selection-size').textContent).toBe('1');
    });
  });

  it('clears picker selection and toasts when org changes', async () => {
    const user = userEvent.setup();
    const rendered = renderPickerRoute();

    await user.click(screen.getByRole('button', { name: 'mock-select-one' }));
    expect(screen.getByTestId('selection-size').textContent).toBe('1');

    currentOrganisation = { id: 'org-2' };
    rendered.rerender(
      <MemoryRouter initialEntries={[{ pathname: '/members', state: { intent: 'commsManualPick' } }]}>
        <Routes>
          <Route path="/members" element={<MemberDirectoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('selection-size').textContent).toBe('0');
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Selection cleared — organisation changed.',
        variant: 'default',
      })
    );
  });

  it('writes picker payload and navigates on Done', async () => {
    const user = userEvent.setup();
    renderRoute('/members', { intent: 'commsManualPick' });

    await user.click(screen.getByRole('button', { name: 'mock-select-one' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('Communications Route')).toBeTruthy();
    const payload = window.sessionStorage.getItem('pace:team:comms:manual-pick');
    expect(payload).not.toBeNull();
    expect(payload).toContain('"organisationId":"org-1"');
    expect(payload).toContain('"memberIds":["member-1"]');
  });

  it('navigates on Cancel without overwriting existing payload', async () => {
    const user = userEvent.setup();
    const existingPayload = JSON.stringify({
      organisationId: 'org-1',
      memberIds: ['member-9'],
      updatedAt: 123,
    });
    window.sessionStorage.setItem('pace:team:comms:manual-pick', existingPayload);

    renderRoute('/members', { intent: 'commsManualPick' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Communications Route')).toBeTruthy();
    expect(window.sessionStorage.getItem('pace:team:comms:manual-pick')).toBe(existingPayload);
  });

  it('does not enable picker mode for query string only entry', () => {
    renderRoute('/members?pick=comms');
    expect(screen.getByRole('button', { name: 'Pending' })).toBeTruthy();
    expect(screen.queryByText('Selecting members for a comms send')).toBeNull();
  });

  it('renders access denied when read permission is blocked', () => {
    allowPageRead = false;
    renderRoute('/members');
    expect(screen.getByText('Denied')).toBeTruthy();
  });

  it('passes selected membership type into data hook for server-side refetch contract', async () => {
    const user = userEvent.setup();
    renderRoute('/members');

    await user.click(screen.getByRole('button', { name: 'mock-select-type-1' }));

    const lastCall = useMemberDirectoryDataMock.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    expect(lastCall?.[0]).toBe('org-1');
    expect(lastCall?.[1]).toBe(1);
  });
});

describe('MemberDirectoryPage members fetch error', () => {
  beforeEach(() => {
    cleanup();
    allowPageRead = true;
    currentOrganisation = { id: 'org-1' };
    useMemberDirectoryDataMock.mockReset();
    window.sessionStorage.clear();
    vi.mocked(toast).mockClear();
  });

  it('renders Retry and calls refetchMembers when Retry is clicked', async () => {
    const user = userEvent.setup();
    const refetchMembers = vi.fn();
    resolveMemberDirectoryData = () =>
      createMemberDirectoryDataReturn({
        membersErrorMessage: 'Query failed',
        members: [],
        refetchMembers,
      });

    renderRoute('/members');

    expect(screen.getByText('Could not load members')).toBeTruthy();
    expect(screen.getByText('Query failed')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetchMembers).toHaveBeenCalled();
  });

  afterEach(() => {
    resolveMemberDirectoryData = () => createMemberDirectoryDataReturn();
  });
});
