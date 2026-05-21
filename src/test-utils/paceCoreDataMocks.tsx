import * as React from 'react';
import type { ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCorePrimitives';

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
