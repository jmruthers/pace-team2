// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApproveResolveDialog, HoldResolveDialog, RejectResolveDialog } from '@/components/approvals/ResolveDialogs';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  const base = buildPaceCoreComponentsMock(vi.fn());
  return {
    ...base,
    ConfirmationDialog: ({
      open,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      confirmLabel: string;
      onConfirm: () => void;
    }) => (open ? <MockButton onClick={onConfirm}>{confirmLabel}</MockButton> : null),
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
  subjectMemberOrganisationId: null,
  subjectMemberDeletedAt: null,
  resolverFirstName: null,
  resolverLastName: null,
  resolverPreferredName: null,
};

describe('resolve dialog validation rules', () => {
  afterEach(() => cleanup());

  it('disables Reject confirm when trimmed note is shorter than 10', async () => {
    const user = setupUser();
    render(
      <RejectResolveDialog
        request={baseRequest}
        open
        onOpenChange={() => undefined}
        pending={false}
        onSubmit={async () => true}
      />
    );

    const rejectButton = screen.getByRole('button', { name: 'Reject' });
    expect(rejectButton.hasAttribute('disabled')).toBe(true);
    await user.type(screen.getByLabelText('textarea'), 'too short');
    expect(rejectButton.hasAttribute('disabled')).toBe(true);
    await user.clear(screen.getByLabelText('textarea'));
    await user.type(screen.getByLabelText('textarea'), 'long enough text');
    expect(rejectButton.hasAttribute('disabled')).toBe(false);
  });

  it('disables Approve-with-input confirm when trimmed member number is empty', async () => {
    const user = setupUser();
    render(
      <ApproveResolveDialog
        request={baseRequest}
        open
        onOpenChange={() => undefined}
        pending={false}
        onSubmit={async () => true}
      />
    );

    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect(approveButton.hasAttribute('disabled')).toBe(true);
    const memberNumberInput = screen.getByPlaceholderText('Member number');
    await user.type(memberNumberInput, '   ');
    expect(approveButton.hasAttribute('disabled')).toBe(true);
    await user.clear(memberNumberInput);
    await user.type(memberNumberInput, 'TEAM-001');
    expect(approveButton.hasAttribute('disabled')).toBe(false);
  });

  it('keeps Put on hold confirm enabled with empty textarea', () => {
    render(
      <HoldResolveDialog
        request={baseRequest}
        open
        onOpenChange={() => undefined}
        pending={false}
        onSubmit={async () => true}
      />
    );

    expect(screen.getByRole('button', { name: 'Put on hold' }).hasAttribute('disabled')).toBe(false);
  });

  it('sends null member number when applicant already has one', async () => {
    const user = setupUser();
    const onSubmit = vi.fn(async () => true);
    render(
      <ApproveResolveDialog
        request={{ ...baseRequest, applicantMemberNumber: 'ABC-123' }}
        open
        onOpenChange={() => undefined}
        pending={false}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onSubmit).toHaveBeenCalledWith({ memberNumber: null });
  });
});
