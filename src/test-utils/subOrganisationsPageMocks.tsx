import * as React from 'react';
import type { ReactNode } from 'react';
import {
  MockAlert,
  MockAlertDescription,
  MockAlertTitle,
  MockCard,
  MockCardContent,
  MockCardHeader,
  MockCardTitle,
} from '@/test-utils/paceCoreCardMocks';
import {
  MockDialog,
  MockDialogBody,
  MockDialogContent,
  MockDialogFooter,
  MockDialogHeader,
  MockDialogPortal,
  MockDialogTitle,
} from '@/test-utils/paceCoreDialogMocks';
import {
  MockButton,
  MockInput,
  MockLabel,
  MockLoadingSpinner,
  MockSwitch,
  MockTextarea,
} from '@/test-utils/paceCorePrimitives';

export type SubOrgFormMockState = {
  isValid: boolean;
  isSubmitted: boolean;
  errors: Record<string, unknown>;
};

export function buildSubOrganisationsPageComponentsMock(
  toastFn: (...args: unknown[]) => unknown,
  getFormState: () => SubOrgFormMockState
) {
  function Form<T extends Record<string, unknown>>({
    defaultValues,
    onSubmit,
    children,
  }: {
    defaultValues?: T;
    onSubmit: (values: T) => Promise<void> | void;
    children: (methods: {
      watch: (name: keyof T) => unknown;
      setValue: (name: keyof T, value: unknown) => void;
      clearErrors: (name: keyof T) => void;
      setError: (name: keyof T, options: { type?: string; message?: string }) => void;
      formState: {
        isSubmitting: boolean;
        isValid: boolean;
        isSubmitted: boolean;
        errors: Record<string, unknown>;
      };
    }) => ReactNode;
  }) {
    const [values, setValues] = React.useState<T>((defaultValues ?? {}) as T);
    const liveFormState = getFormState();
    const methods = {
      watch: (name: keyof T) => values[name],
      setValue: (name: keyof T, value: unknown) => {
        setValues((previous) => ({ ...previous, [name]: value }));
      },
      clearErrors: () => undefined,
      setError: () => undefined,
      formState: {
        isSubmitting: false,
        isValid: liveFormState.isValid,
        isSubmitted: liveFormState.isSubmitted,
        errors: liveFormState.errors,
      },
    };

    return React.createElement(
      'form',
      {
        onSubmit: (event: React.FormEvent) => {
          event.preventDefault();
          if (getFormState().isValid) {
            void onSubmit(values);
          }
        },
      },
      children(methods)
    );
  }

  function FormField<T extends Record<string, unknown>>({
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

  return {
    Alert: MockAlert,
    AlertDescription: MockAlertDescription,
    AlertTitle: MockAlertTitle,
    Button: MockButton,
    Card: MockCard,
    CardHeader: MockCardHeader,
    CardTitle: MockCardTitle,
    CardContent: MockCardContent,
    DataTable: ({
      data,
      columns,
      actions,
    }: {
      data: Array<Record<string, unknown>>;
      columns: Array<{
        id?: string;
        accessorKey?: string;
        cell?: (info: { row: Record<string, unknown> }) => ReactNode;
      }>;
      actions?: Array<{ label: string; onClick: (row: Record<string, unknown>) => void }>;
    }) => (
      <section>
        {data.map((row, index) => (
          <article key={String(row.id ?? index)}>
            {columns.map((column, columnIndex) => {
              if (column.cell == null) {
                return (
                  <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>
                    {String(row[column.accessorKey ?? ''] ?? '')}
                  </span>
                );
              }
              return (
                <span key={`${column.id ?? column.accessorKey ?? columnIndex}`}>
                  {column.cell({ row })}
                </span>
              );
            })}
            {actions?.map((action) => (
              <MockButton key={action.label} type="button" onClick={() => action.onClick(row)}>
                {action.label}
              </MockButton>
            ))}
          </article>
        ))}
      </section>
    ),
    Dialog: MockDialog,
    DialogPortal: MockDialogPortal,
    DialogContent: MockDialogContent,
    DialogHeader: MockDialogHeader,
    DialogTitle: MockDialogTitle,
    DialogBody: MockDialogBody,
    DialogFooter: MockDialogFooter,
    Form,
    FormField,
    Input: MockInput,
    Label: MockLabel,
    LoadingSpinner: MockLoadingSpinner,
    Switch: MockSwitch,
    Textarea: MockTextarea,
    PageHeader: ({
      title,
      subtitle,
      actions,
    }: {
      title: string;
      subtitle?: string;
      actions?: ReactNode;
    }) => (
      <header>
        <h1>{title}</h1>
        {subtitle != null ? <p>{subtitle}</p> : null}
        {actions}
      </header>
    ),
    toast: toastFn,
  };
}
