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

export function MockButton({
  children,
  onClick,
  disabled,
  type,
  variant,
  'aria-pressed': ariaPressed,
  'aria-label': ariaLabel,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
}) {
  return React.createElement(
    'button',
    {
      type: type ?? 'button',
      onClick: () => void onClick?.(),
      disabled,
      'data-variant': variant,
      'aria-pressed': ariaPressed,
      'aria-label': ariaLabel,
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

export function MockDataTable({
  data,
  columns,
  onCreateRow,
  features,
  emptyState,
}: {
  data: Array<Record<string, unknown>>;
  columns: Array<{
    id?: string;
    accessorKey?: string;
    cell?: (info: { row: Record<string, unknown> }) => ReactNode;
  }>;
  onCreateRow?: () => void | Promise<void>;
  features?: { creation?: boolean };
  emptyState?: { title?: string; description?: string };
}) {
  return React.createElement(
    'section',
    null,
    features?.creation !== false
      ? React.createElement(MockButton, { type: 'button', onClick: () => void onCreateRow?.() }, 'Create')
      : null,
    data.length === 0
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement('p', null, emptyState?.title),
          React.createElement('p', null, emptyState?.description)
        )
      : data.map((row, index) =>
          React.createElement(
            'article',
            { key: String(row.id ?? index) },
            columns.map((column, columnIndex) => {
              const key = column.id ?? column.accessorKey ?? String(columnIndex);
              if (column.cell == null) {
                return React.createElement('span', { key }, String(row[column.accessorKey ?? ''] ?? ''));
              }
              return React.createElement('span', { key }, column.cell({ row }));
            })
          )
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

export function MockSelect({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockSelectTrigger({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockSelectValue({ placeholder }: { placeholder?: string }) {
  return React.createElement('span', null, placeholder);
}

export function MockSelectContent({ children }: { children: ReactNode }) {
  return React.createElement('section', null, children);
}

export function MockSelectItem({ children }: { children: ReactNode }) {
  return React.createElement('span', null, children);
}

/** Map pace-core component exports to test doubles (capitalized implementations). */
export function buildPaceCoreComponentsMock(toastFn: (...args: unknown[]) => unknown) {
  return {
    Alert: MockAlert,
    AlertDescription: MockAlertDescription,
    AlertTitle: MockAlertTitle,
    Badge: MockBadge,
    Button: MockButton,
    Card: MockCard,
    CardContent: MockCardContent,
    CardFooter: MockCardFooter,
    CardHeader: MockCardHeader,
    CardTitle: MockCardTitle,
    ConfirmationDialog: MockConfirmationDialog,
    DataTable: MockDataTable,
    Dialog: MockDialog,
    DialogBody: MockDialogBody,
    DialogContent: MockDialogContent,
    DialogDescription: MockDialogDescription,
    DialogFooter: MockDialogFooter,
    DialogHeader: MockDialogHeader,
    DialogPortal: MockDialogPortal,
    DialogTitle: MockDialogTitle,
    Form: MockForm,
    FormField: MockFormField,
    Input: MockInput,
    Label: MockLabel,
    LoadingSpinner: MockLoadingSpinner,
    SaveActions: MockSaveActions,
    Select: MockSelect,
    SelectContent: MockSelectContent,
    SelectItem: MockSelectItem,
    SelectTrigger: MockSelectTrigger,
    SelectValue: MockSelectValue,
    Switch: MockSwitch,
    Textarea: MockTextarea,
    toast: toastFn,
  };
}
