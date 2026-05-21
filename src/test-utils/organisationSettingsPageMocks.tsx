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
import { MockButton, MockInput, MockLoadingSpinner } from '@/test-utils/paceCorePrimitives';

export function buildOrganisationSettingsPageComponentsMock(
  toastFn: (...args: unknown[]) => unknown
) {
  const FormContext = React.createContext<{
    values: Record<string, unknown>;
    setValue: (name: string, value: unknown) => void;
    formState: {
      isSubmitting: boolean;
      isValid: boolean;
      isDirty: boolean;
      isSubmitted: boolean;
      errors: Record<string, unknown>;
    };
  } | null>(null);

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
      formState: {
        isSubmitting: boolean;
        isValid: boolean;
        isDirty: boolean;
        isSubmitted: boolean;
        errors: Record<string, unknown>;
      };
    }) => ReactNode;
  }) {
    const [values, setValues] = React.useState<Record<string, unknown>>(
      (defaultValues ?? {}) as Record<string, unknown>
    );
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);

    const setValue = (name: string, value: unknown) => {
      setIsDirty(true);
      setValues((previous) => ({ ...previous, [name]: value }));
    };

    const formState = {
      isSubmitting: false,
      isValid: true,
      isDirty,
      isSubmitted,
      errors: {},
    };

    return (
      <FormContext.Provider value={{ values, setValue, formState }}>
        {React.createElement(
          'form',
          {
            onSubmit: (event: React.FormEvent) => {
              event.preventDefault();
              setIsSubmitted(true);
              void onSubmit(values as T);
            },
          },
          children({
            watch: (name: keyof T) => values[String(name)],
            setValue: (name: keyof T, value: unknown) => setValue(String(name), value),
            formState,
          })
        )}
      </FormContext.Provider>
    );
  }

  function FormField<T extends Record<string, unknown>>({
    name,
    label,
    render,
  }: {
    name: keyof T;
    label?: string;
    render: (props: { field: { value: string; onChange: (value: string) => void } }) => ReactNode;
  }) {
    const context = React.useContext(FormContext);
    const value = String(context?.values[String(name)] ?? '');

    return React.createElement(
      'label',
      null,
      label,
      render({
        field: {
          value,
          onChange: (nextValue) => {
            context?.setValue(String(name), nextValue);
          },
        },
      })
    );
  }

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value?: string) => void;
    children: ReactNode;
  }) {
    return React.createElement(
      'select',
      {
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(event.target.value),
      },
      children
    );
  }

  return {
    Alert: MockAlert,
    AlertDescription: MockAlertDescription,
    AlertTitle: MockAlertTitle,
    Button: MockButton,
    Card: MockCard,
    CardContent: MockCardContent,
    CardDescription: ({ children }: { children: ReactNode }) => React.createElement('p', null, children),
    CardFooter: ({ children }: { children: ReactNode }) => React.createElement('footer', null, children),
    CardHeader: MockCardHeader,
    CardTitle: MockCardTitle,
    Form,
    FormField,
    Input: MockInput,
    LoadingSpinner: MockLoadingSpinner,
    SaveActions: ({
      onCancel,
      saveDisabled,
    }: {
      onCancel?: () => void;
      saveDisabled?: boolean;
      saveType?: 'submit';
    }) => (
      <section>
        <MockButton type="button" onClick={onCancel}>
          Cancel
        </MockButton>
        <MockButton type="submit" disabled={saveDisabled}>
          Save
        </MockButton>
      </section>
    ),
    Select,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) =>
      React.createElement('option', { value }, children),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('option', { value: '' }, placeholder),
    toast: toastFn,
  };
}
