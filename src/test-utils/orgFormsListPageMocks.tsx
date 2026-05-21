import { useEffect, type ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCorePrimitives';

export function buildOrgFormsListPageComponentsMock(toastFn: (...args: unknown[]) => unknown) {
  return {
    Alert: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    AlertTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: MockButton,
    Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
    CardContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    ConfirmationDialog: ({
      open,
      title,
      confirmLabel,
      cancelLabel,
      onConfirm,
      onOpenChange,
    }: {
      open: boolean;
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void | Promise<void>;
      onOpenChange?: (open: boolean) => void;
    }) => {
      useEffect(() => {
        if (!open) {
          return;
        }
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            onOpenChange?.(false);
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [open, onOpenChange]);
      return open ? (
        <section data-testid="confirm-delete-root">
          {title ? <h2>{title}</h2> : null}
          <MockButton data-testid="confirm-delete-cancel" onClick={() => onOpenChange?.(false)}>
            {cancelLabel ?? 'Cancel'}
          </MockButton>
          <MockButton data-testid="confirm-delete-submit" onClick={() => void onConfirm?.()}>
            {confirmLabel ?? 'Confirm'}
          </MockButton>
        </section>
      ) : null;
    },
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <section data-testid="blocked-dialog">{children}</section> : null,
    DialogPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
    DialogBody: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
    DataTable: <T extends Record<string, unknown>>({
      data,
      actions,
    }: {
      data: T[];
      actions?: Array<{
        label: string;
        testId?: string;
        loading?: boolean | ((row: T) => boolean);
        hidden?: boolean | ((row: T) => boolean);
        disabled?: boolean | ((row: T) => boolean);
        onClick: (row: T) => void;
      }>;
    }) => (
      <table>
        <tbody>
          {data.map((row) => (
            <tr key={String(row.id ?? '')}>
              {actions?.map((action, index) => {
                const hid =
                  typeof action.hidden === 'function' ? action.hidden(row) : action.hidden === true;
                const loading =
                  typeof action.loading === 'function' ? action.loading(row) : action.loading === true;
                const dis =
                  loading ||
                  (typeof action.disabled === 'function'
                    ? action.disabled(row)
                    : action.disabled === true);
                if (hid) {
                  return null;
                }
                return (
                  <td key={`${action.testId ?? action.label}-${index}`}>
                    <MockButton
                      disabled={dis}
                      data-testid={action.testId ?? action.label}
                      onClick={() => action.onClick(row)}
                    >
                      {loading ? '…' : action.label}
                    </MockButton>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    toast: toastFn,
  };
}
