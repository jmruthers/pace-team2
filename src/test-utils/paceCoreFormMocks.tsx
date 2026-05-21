import * as React from 'react';
import type { ReactNode } from 'react';

export function MockForm<T extends Record<string, unknown>>({
  defaultValues,
  onSubmit,
  children,
}: {
  defaultValues?: T;
  onSubmit: (values: T) => Promise<void> | void;
  children: (methods: {
    watch: (name: keyof T) => unknown;
    setValue: (name: keyof T, value: unknown) => void;
    formState: { isSubmitting: boolean; isDirty?: boolean };
    reset: (values?: T) => void;
  }) => ReactNode;
}) {
  const [values, setValues] = React.useState<T>((defaultValues ?? {}) as T);
  const methods = {
    watch: (name: keyof T) => values[name],
    setValue: (name: keyof T, value: unknown) => {
      setValues((previous) => ({ ...previous, [name]: value }));
    },
    formState: { isSubmitting: false, isDirty: false },
    reset: (next?: T) => setValues((next ?? defaultValues ?? {}) as T),
  };

  return React.createElement(
    'form',
    {
      onSubmit: (event: React.FormEvent) => {
        event.preventDefault();
        void onSubmit(values);
      },
    },
    children(methods)
  );
}

export function MockFormField<T extends Record<string, unknown>>({
  label,
  render,
}: {
  name: keyof T;
  label?: string;
  render?: (props: { field: { value: string; onChange: (value: string) => void } }) => ReactNode;
}) {
  const [value, setValue] = React.useState('');
  return React.createElement(
    'label',
    null,
    label,
    render
      ? render({ field: { value, onChange: setValue } })
      : React.createElement('input', {
          value,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
        })
  );
}
