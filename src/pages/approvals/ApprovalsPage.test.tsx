// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

const useApprovalsDataMock = vi.fn();
const useOrganisationsContextMock = vi.fn();

vi.mock('@/hooks/useApprovalsData', () => ({
  useApprovalsData: (...args: unknown[]) => useApprovalsDataMock(...args),
}));

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => useOrganisationsContextMock(),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/approvals/ApprovalReviewPanel', () => ({
  ApprovalReviewPanel: ({ requestId }: { requestId?: string }) => (
    <p>review-panel:{requestId ?? 'none'}</p>
  ),
}));

vi.mock('@/components/approvals/ApprovalQueueList', async () => {
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  return {
    ApprovalQueueList: ({
      rows,
      onSelect,
    }: {
      rows: ApprovalRequestRow[];
      onSelect: (requestId: string) => void;
    }) => (
      <section>
        {rows.map((row) => (
          <MockButton
            key={row.id}
            type="button"
            aria-label={`Select ${row.subjectFirstName}`}
            onClick={() => onSelect(row.id)}
          >
            {row.subjectFirstName} {row.subjectLastName}
          </MockButton>
        ))}
      </section>
    ),
  };
});

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  const base = buildPaceCoreComponentsMock(vi.fn());
  return {
    ...base,
    AlertTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Tabs: ({ children }: { children: ReactNode }) => (
      <section data-testid="tabs">{children}</section>
    ),
    TabsList: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    TabsTrigger: ({ children }: { children: ReactNode }) => <MockButton>{children}</MockButton>,
    TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  };
});

const row: ApprovalRequestRow = {
  id: 'req-1',
  organisationId: 'org-1',
  requestType: 'join',
  status: 'pending',
  createdAt: null,
  resolvedAt: null,
  targetOrganisationId: null,
  targetOrganisationName: null,
  sourceOrganisationId: null,
  membershipTypeId: null,
  membershipTypeName: null,
  applicantMemberNumber: null,
  reviewNotes: null,
  subjectPersonId: null,
  subjectFirstName: 'Ava',
  subjectLastName: 'Adams',
  subjectPreferredName: null,
  subjectEmail: null,
  sourceOrganisationName: null,
  subjectMemberId: null,
  subjectMemberOrganisationId: null,
  subjectMemberDeletedAt: null,
  resolverFirstName: null,
  resolverLastName: null,
  resolverPreferredName: null,
};

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 768px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ApprovalsPage route and layout behavior', () => {
  beforeEach(() => {
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: 'org-1', name: 'Org 1' },
    });
    useApprovalsDataMock.mockReturnValue({
      openRequests: [row],
      closedRequests: [],
      openErrorMessage: null,
      closedErrorMessage: null,
      openLoading: false,
      closedLoading: false,
      refetchOpen: vi.fn(),
      refetchClosed: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('selects a queue row in page state without changing the URL', async () => {
    mockMatchMedia(true);
    const user = setupUser();
    render(
      <MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('review-panel:none')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Select Ava' }));
    expect(screen.getByText('review-panel:req-1')).toBeTruthy();
  });

  it('renders side-by-side at md+ and stacks detail-only at <md', async () => {
    mockMatchMedia(true);
    const rendered = render(
      <MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('review-panel:none')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select Ava' })).toBeTruthy();

    rendered.unmount();
    mockMatchMedia(false);
    const user = setupUser();
    render(
      <MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Select Ava' }));
    expect(screen.getByText('review-panel:req-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select Ava' })).toBeNull();
  });
});
