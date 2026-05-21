import * as React from 'react';
import type { ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCorePrimitives';

export function MockConfirmationDialog({
  open,
  onConfirm,
  title,
  confirmLabel,
}: {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
}) {
  if (!open) {
    return null;
  }
  return React.createElement(
    'section',
    null,
    title != null ? React.createElement('p', null, title) : null,
    React.createElement(
      MockButton,
      { type: 'button', onClick: () => void onConfirm() },
      confirmLabel ?? 'Confirm'
    )
  );
}

export function MockDialog({ open, children }: { open: boolean; children: ReactNode }) {
  return open ? React.createElement('section', null, children) : null;
}

export function MockDialogPortal({ children }: { children: ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function MockDialogContent({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockDialogHeader({ children }: { children: ReactNode }) {
  return React.createElement('header', null, children);
}

export function MockDialogTitle({ children }: { children: ReactNode }) {
  return React.createElement('h2', null, children);
}

export function MockDialogBody({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockDialogFooter({ children }: { children: ReactNode }) {
  return React.createElement('footer', null, children);
}

export function MockDialogDescription({ children }: { children: ReactNode }) {
  return React.createElement('p', null, children);
}
