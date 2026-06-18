import type { ReactNode } from 'react';
import {
  MockAlert,
  MockAlertDescription,
  MockAlertTitle,
  MockBadge,
  MockCard,
  MockCardContent,
  MockCardFooter,
  MockCardHeader,
  MockCardTitle,
  MockSaveActions,
} from '@/test-utils/paceCoreCardMocks';
import { MockDataTable, MockSelect, MockSelectContent, MockSelectItem, MockSelectTrigger, MockSelectValue } from '@/test-utils/paceCoreDataMocks';
import {
  MockConfirmationDialog,
  MockDialog,
  MockDialogBody,
  MockDialogContent,
  MockDialogDescription,
  MockDialogFooter,
  MockDialogHeader,
  MockDialogPortal,
  MockDialogTitle,
} from '@/test-utils/paceCoreDialogMocks';
import { MockForm, MockFormField } from '@/test-utils/paceCoreFormMocks';
import {
  MockButton,
  MockInput,
  MockLabel,
  MockLoadingSpinner,
  MockSwitch,
  MockTextarea,
} from '@/test-utils/paceCorePrimitives';

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
    CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    ConfirmationDialog: MockConfirmationDialog,
    DataTable: MockDataTable,
    EmptyState: ({ title, description }: { title: string; description?: ReactNode }) => (
      <section>
        <h2>{title}</h2>
        {description}
      </section>
    ),
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
    SaveActions: MockSaveActions,
    Select: MockSelect,
    SelectContent: MockSelectContent,
    SelectItem: MockSelectItem,
    SelectTrigger: MockSelectTrigger,
    SelectValue: MockSelectValue,
    Switch: MockSwitch,
    Textarea: MockTextarea,
    Tabs: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <section data-testid="tabs" data-value={value} onClick={() => onValueChange?.(value ?? '')}>
        {children}
      </section>
    ),
    TabsList: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: ReactNode;
      value?: string;
      count?: number;
    }) => <MockButton data-value={value}>{children}</MockButton>,
    TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    Avatar: ({ name }: { name: string }) => <span data-testid="avatar">{name}</span>,
    toast: toastFn,
  };
}
