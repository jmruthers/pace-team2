// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

vi.mock('@/pages/approvals/ApprovalReviewPanel', () => ({
  ApprovalReviewPanel: ({ requestId }: { requestId?: string }) => <p>review-panel:{requestId ?? 'none'}</p>,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  const base = buildPaceCoreComponentsMock(vi.fn());
  return {
    ...base,
    AlertTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DataTable: ({
      columns,
      data,
      onRowActivate,
    }: {
      columns: Array<{ cell?: (info: { row: ApprovalRequestRow; getValue: () => unknown; index: number }) => ReactNode }>;
      data: ApprovalRequestRow[];
      onRowActivate?: (row: ApprovalRequestRow) => void;
    }) => {
      if (data.length === 0) {
        return <section />;
      }
      const primaryCell = columns[0]?.cell;
      const renderedCell = primaryCell?.({
        row: data[0]!,
        getValue: () => data[0]?.subjectLastName,
        index: 0,
      });
      return (
        <section>
          <MockButton aria-label="Activate queue row" onClick={() => onRowActivate?.(data[0]!)} />
          {renderedCell ?? null}
        </section>
      );
    },
    Tabs: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    TabsList: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    TabsTrigger: ({ children }: { children: ReactNode }) => <MockButton>{children}</MockButton>,
    TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
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
  subjectMemberDeletedAt: null,
  resolverFirstName: null,
  resolverLastName: null,
  resolverPreferredName: null,
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

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

  it('navigates to /approvals/:requestId when a queue row is activated', async () => {
    mockMatchMedia(true);
    const user = setupUser();
    render(
      <MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route path="/approvals" element={<><ApprovalsPage /><LocationProbe /></>} />
          <Route path="/approvals/:requestId" element={<><ApprovalsPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Activate queue row' }));
    expect(screen.getByTestId('location').textContent).toBe('/approvals/req-1');
  });

  it('renders side-by-side at md+ and stacks detail-only at <md', () => {
    mockMatchMedia(true);
    const rendered = render(
      <MemoryRouter initialEntries={['/approvals']}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/approvals/:requestId" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('review-panel:none')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ava Adams' })).toBeTruthy();

    rendered.unmount();
    mockMatchMedia(false);
    render(
      <MemoryRouter initialEntries={['/approvals/req-1']}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/approvals/:requestId" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('review-panel:req-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ava Adams' })).toBeNull();
  });
});
