import * as React from 'react';
import type { ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCorePrimitives';

export function MockCardFooter({ children }: { children: ReactNode }) {
  return React.createElement('footer', { 'data-slot': 'card-footer' }, children);
}

export function MockSaveActions({
  onCancel,
  saveDisabled,
  saveType,
}: {
  onCancel?: () => void;
  saveDisabled?: boolean;
  saveType?: 'button' | 'submit';
}) {
  return React.createElement(
    MockCardFooter,
    null,
    React.createElement(MockButton, { type: 'button', onClick: onCancel }, 'Cancel'),
    React.createElement(
      MockButton,
      { type: saveType ?? 'submit', disabled: saveDisabled },
      'Save'
    )
  );
}

export function MockAlert({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockAlertDescription({ children }: { children: ReactNode }) {
  return React.createElement('p', null, children);
}

export function MockAlertTitle({ children }: { children: ReactNode }) {
  return React.createElement('p', null, children);
}

export function MockBadge({ children }: { children: ReactNode }) {
  return React.createElement('span', null, children);
}

export function MockCard({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockCardHeader({ children }: { children: ReactNode }) {
  return React.createElement('header', null, children);
}

export function MockCardTitle({ children }: { children: ReactNode }) {
  return React.createElement('h2', null, children);
}

export function MockCardContent({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}
