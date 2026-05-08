/* eslint-disable pace-core-compliance/prefer-pace-core-components */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApproveResolveDialog, HoldResolveDialog, RejectResolveDialog } from '@/components/approvals/resolveDialogs';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

vi.mock('@solvera/pace-core/components', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  ConfirmationDialog: ({
    open,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }) => (open ? <button type="button" onClick={onConfirm}>{confirmLabel}</button> : null),
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <section>{children}</section> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogBody: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogFooter: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
  Input: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
  }) => <input id={id} aria-label="input" value={value} onChange={(event) => onChange(event.target.value)} />,
  Textarea: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
  }) => <textarea id={id} aria-label="textarea" value={value} onChange={(event) => onChange(event.target.value)} />,
}));

const baseRequest: ApprovalRequestRow = {
  id: 'req-1',
  organisationId: 'org-1',
  requestType: 'join',
  status: 'pending',
  createdAt: null,
  resolvedAt: null,
  targetOrganisationId: null,
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

describe('resolve dialog validation rules', () => {
  afterEach(() => cleanup());

  it('disables Reject confirm when trimmed note is shorter than 10', async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    await user.type(screen.getByLabelText('input'), '   ');
    expect(approveButton.hasAttribute('disabled')).toBe(true);
    await user.clear(screen.getByLabelText('input'));
    await user.type(screen.getByLabelText('input'), 'TEAM-001');
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
    const user = userEvent.setup();
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
