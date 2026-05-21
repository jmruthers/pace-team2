import type { ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCoreMocks';

export function buildPhotoModerationPageComponentsMock(
  toastFn: (...args: unknown[]) => unknown,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...overrides,
    toast: toastFn,
    DataTable: ({
      data,
      actions,
      emptyState,
      isLoading,
    }: {
      data: Array<{ member_display_name?: string }>;
      actions?: Array<{
        label: string;
        hidden?: boolean;
        onClick: (row: { member_display_name?: string }) => void;
      }>;
      emptyState?: { title?: string };
      isLoading?: boolean;
    }) => {
      if (isLoading) {
        return <p>Loading photos</p>;
      }
      if (data.length === 0) {
        return <p>{emptyState?.title ?? 'Empty'}</p>;
      }
      const visibleActions = (actions ?? []).filter((action) => action.hidden !== true);
      return (
        <section data-testid="photo-table">
          <p>{data[0]?.member_display_name}</p>
          {visibleActions.map((action) => (
            <MockButton key={action.label} type="button" onClick={() => action.onClick(data[0]!)}>
              {action.label}
            </MockButton>
          ))}
        </section>
      );
    },
    ConfirmationDialog: ({
      open,
      onConfirm,
      confirmLabel,
    }: {
      open: boolean;
      onConfirm: () => void | Promise<void>;
      confirmLabel?: string;
    }) =>
      open ? (
        <MockButton type="button" onClick={() => void onConfirm()}>
          {confirmLabel ?? 'Confirm'}
        </MockButton>
      ) : null,
  };
}
