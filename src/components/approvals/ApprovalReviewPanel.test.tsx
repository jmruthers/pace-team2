// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ApprovalReviewPanel } from '@/pages/approvals/ApprovalReviewPanel';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

const useApprovalRequestDetailMock = vi.fn();
const useResolveMemberRequestMock = vi.fn();
const useResourcePermissionsMock = vi.fn();

vi.mock('@/hooks/useApprovalRequestDetail', () => ({
  useApprovalRequestDetail: (...args: unknown[]) => useApprovalRequestDetailMock(...args),
}));

vi.mock('@/hooks/useResolveMemberRequest', () => ({
  useResolveMemberRequest: (...args: unknown[]) => useResolveMemberRequestMock(...args),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: () => <p>Denied</p>,
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  useResourcePermissions: () => useResourcePermissionsMock(),
}));

vi.mock('@/components/approvals/resolveDialogs', () => ({
  ApproveResolveDialog: () => null,
  RejectResolveDialog: () => null,
  HoldResolveDialog: () => null,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const base = buildPaceCoreComponentsMock(vi.fn());
  return {
    ...base,
    Avatar: ({ name }: { name: string }) => <span data-testid="avatar">{name}</span>,
    CardTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
    AlertTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

const baseRequest: ApprovalRequestRow = {
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

describe('ApprovalReviewPanel access and visibility', () => {
  beforeEach(() => {
    useResourcePermissionsMock.mockReturnValue({ canUpdate: false });
    useResolveMemberRequestMock.mockReturnValue({
      resolveRequest: vi.fn(async () => null),
      resolvePending: false,
    });
    useApprovalRequestDetailMock.mockReturnValue({
      request: baseRequest,
      requestLoading: false,
      requestErrorMessage: null,
      formResponses: [],
      formResponsesLoading: false,
      formResponseErrorMessage: null,
      refetchRequest: vi.fn(),
      refetchFormResponses: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hides action rail when update permission is denied', () => {
    render(
      <MemoryRouter>
        <ApprovalReviewPanel requestId="req-1" organisationId="org-1" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText('Read-only request')).toBeTruthy();
  });

  it('hides action rail when request is not pending', () => {
    useResourcePermissionsMock.mockReturnValue({ canUpdate: true });
    useApprovalRequestDetailMock.mockReturnValue({
      request: {
        ...baseRequest,
        status: 'approved' as const,
        resolvedAt: '2026-05-01T00:00:00.000Z',
        resolverFirstName: 'Alice',
        resolverLastName: 'Reviewer',
      },
      requestLoading: false,
      requestErrorMessage: null,
      formResponses: [],
      formResponsesLoading: false,
      formResponseErrorMessage: null,
      refetchRequest: vi.fn(),
      refetchFormResponses: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ApprovalReviewPanel requestId="req-1" organisationId="org-1" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText(/Approved by Alice Reviewer on/u)).toBeTruthy();
  });

  it('shows member 360 link only when subject member exists and is not deleted', () => {
    useResourcePermissionsMock.mockReturnValue({ canUpdate: true });
    useApprovalRequestDetailMock.mockReturnValue({
      request: {
        ...baseRequest,
        subjectMemberId: 'member-1',
        subjectMemberDeletedAt: null,
      },
      requestLoading: false,
      requestErrorMessage: null,
      formResponses: [],
      formResponsesLoading: false,
      formResponseErrorMessage: null,
      refetchRequest: vi.fn(),
      refetchFormResponses: vi.fn(),
    });

    const rendered = render(
      <MemoryRouter>
        <ApprovalReviewPanel requestId="req-1" organisationId="org-1" />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /View member 360/u })).toBeTruthy();

    useApprovalRequestDetailMock.mockReturnValue({
      request: {
        ...baseRequest,
        subjectMemberId: 'member-1',
        subjectMemberDeletedAt: '2026-01-01',
      },
      requestLoading: false,
      requestErrorMessage: null,
      formResponses: [],
      formResponsesLoading: false,
      formResponseErrorMessage: null,
      refetchRequest: vi.fn(),
      refetchFormResponses: vi.fn(),
    });

    rendered.rerender(
      <MemoryRouter>
        <ApprovalReviewPanel requestId="req-1" organisationId="org-1" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /View member 360/u })).toBeNull();
  });
});
