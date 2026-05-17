import { useMemo, useState } from 'react';
import {
  Button,
  ConfirmationDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@solvera/pace-core/components';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

interface ResolveDialogProps {
  request: ApprovalRequestRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (payload: { reviewNotes?: string | null; memberNumber?: string | null }) => Promise<boolean>;
}

function buildApplicantName(request: ApprovalRequestRow): string {
  const firstName = request.subjectPreferredName ?? request.subjectFirstName ?? '';
  const lastName = request.subjectLastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName.length > 0) {
    return fullName;
  }
  return 'this applicant';
}

export function ApproveResolveDialog({ request, open, onOpenChange, pending, onSubmit }: ResolveDialogProps) {
  const hasMemberNumber = (request.applicantMemberNumber ?? '').trim().length > 0;
  const [memberNumber, setMemberNumber] = useState('');
  const canSubmit = memberNumber.trim().length > 0;

  if (hasMemberNumber) {
    const applicant = buildApplicantName(request);
    const num = request.applicantMemberNumber ?? '';
    return (
      <ConfirmationDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Approve request?"
        description={`${applicant} will become an active member with member number ${num}.`}
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onConfirm={async () => {
          const shouldClose = await onSubmit({ memberNumber: null });
          if (shouldClose) {
            onOpenChange(false);
          }
        }}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setMemberNumber('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve request?</DialogTitle>
          <DialogDescription>Enter a member number for this approval.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor="approval-member-number">
            Member number
            <Input
              id="approval-member-number"
              value={memberNumber}
              onChange={(value) => setMemberNumber(value)}
              placeholder="Member number"
            />
            <p>Required. Must be unique within this organisation.</p>
          </Label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const shouldClose = await onSubmit({ memberNumber: memberNumber.trim() });
              if (shouldClose) {
                onOpenChange(false);
                setMemberNumber('');
              }
            }}
            disabled={!canSubmit || pending}
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectResolveDialog({ request, open, onOpenChange, pending, onSubmit }: ResolveDialogProps) {
  const [notes, setNotes] = useState('');
  const canSubmit = useMemo(() => notes.trim().length >= 10, [notes]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setNotes('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject request?</DialogTitle>
          <DialogDescription>A rejection reason is required for audit.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor={`reject-note-${request.id}`}>
            Reason for rejection (visible to admins only)
            <Textarea
              id={`reject-note-${request.id}`}
              value={notes}
              onChange={(value) => setNotes(value)}
              placeholder="Reason for rejection"
            />
            <p>At least 10 characters.</p>
          </Label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const shouldClose = await onSubmit({ reviewNotes: notes.trim() });
              if (shouldClose) {
                onOpenChange(false);
                setNotes('');
              }
            }}
            disabled={!canSubmit || pending}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HoldResolveDialog({ request, open, onOpenChange, pending, onSubmit }: ResolveDialogProps) {
  const [notes, setNotes] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setNotes('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Put request on hold?</DialogTitle>
          <DialogDescription>You can add context for other reviewers.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor={`hold-note-${request.id}`}>
            Note (optional)
            <Textarea
              id={`hold-note-${request.id}`}
              value={notes}
              onChange={(value) => setNotes(value)}
              placeholder="Optional note"
            />
            <p>Visible to admins only.</p>
          </Label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const shouldClose = await onSubmit({ reviewNotes: notes.trim() || null });
              if (shouldClose) {
                onOpenChange(false);
                setNotes('');
              }
            }}
            disabled={pending}
          >
            Put on hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
