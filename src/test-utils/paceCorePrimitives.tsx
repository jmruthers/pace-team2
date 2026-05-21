import * as React from 'react';
import type { ReactNode } from 'react';

export function MockButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
  }
) {
  const { children, variant, ...rest } = props;
  return React.createElement(
    'button',
    {
      type: rest.type ?? 'button',
      'data-variant': variant,
      ...rest,
    },
    children
  );
}

export function MockTextarea({
  id,
  value,
  onChange,
}: {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return React.createElement('textarea', {
    id,
    'aria-label': 'textarea',
    value: value ?? '',
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
  });
}

export function MockInput({
  value,
  onChange,
  placeholder,
  type,
  id,
  disabled,
  ...rest
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  id?: string;
  disabled?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return React.createElement('input', {
    id,
    value: value ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value),
    placeholder,
    type: type ?? 'text',
    disabled,
    ...rest,
  });
}

export function MockLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return React.createElement('label', { htmlFor }, children);
}

export function MockSwitch({
  checked,
  onChange,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return React.createElement(
    MockButton,
    { type: 'button', onClick: () => onChange?.(!(checked ?? false)) },
    'Toggle'
  );
}

export function MockLoadingSpinner({ label }: { label?: string }) {
  return React.createElement('p', null, label ?? 'Loading');
}
