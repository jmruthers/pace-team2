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
