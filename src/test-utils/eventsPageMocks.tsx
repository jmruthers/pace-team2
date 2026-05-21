import type { ReactNode } from 'react';
import { MockButton } from '@/test-utils/paceCoreMocks';

export function buildEventsListDataTableMock() {
  return {
    DataTable: ({
      columns,
      data,
      emptyState,
      initialSorting,
      onRowActivate,
    }: {
      columns: Array<{ header: string; hidden?: boolean }>;
      data: Array<{ event_name?: string }>;
      emptyState?: { title?: string; description?: string };
      initialSorting?: Array<{ id: string; desc: boolean }>;
      onRowActivate?: (row: { event_name?: string }) => void;
    }) => (
      <section data-testid="events-table">
        <p data-testid="column-headers">
          {columns.filter((column) => column.hidden !== true).map((column) => column.header).join('|')}
        </p>
        <p data-testid="initial-sort">{JSON.stringify(initialSorting)}</p>
        {data.length === 0 ? (
          <p>{emptyState?.title}</p>
        ) : (
          <MockButton type="button" onClick={() => onRowActivate?.(data[0]!)}>
            {data[0]?.event_name}
          </MockButton>
        )}
      </section>
    ),
    LoadingSpinner: ({ label }: { label?: string }) => <p>{label ?? 'Loading'}</p>,
  };
}

export function buildEventDetailDataTableMock() {
  return {
    DataTable: ({
      columns,
      data,
      initialSorting,
      onRowActivate,
    }: {
      columns: Array<{ header: string; hidden?: boolean }>;
      data: unknown[];
      initialSorting?: Array<{ id: string; desc: boolean }>;
      onRowActivate?: (row: unknown) => void;
    }) => (
      <section data-testid="attendees-table">
        <p data-testid="column-headers">
          {columns.filter((column) => column.hidden !== true).map((column) => column.header).join('|')}
        </p>
        <p data-testid="initial-sort">{JSON.stringify(initialSorting)}</p>
        <MockButton type="button" onClick={() => onRowActivate?.(data[0]!)}>
          Open attendee
        </MockButton>
      </section>
    ),
    LoadingSpinner: ({ label }: { label?: string }) => <p>{label ?? 'Loading'}</p>,
  };
}
