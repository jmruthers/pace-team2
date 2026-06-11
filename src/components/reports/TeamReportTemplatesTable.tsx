import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useMemo, useState, type ReactElement, type RefObject } from 'react';

import type { DataTableAction, DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  DataTable,
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import type { ReportBuilderHandle, ReportingTemplateStore } from '@solvera/pace-core/reporting';

import { useTeamReportTemplatesPanelQuery } from '@/hooks/useTeamReportTemplatesPanel';
import type { ReportsTemplatePanelRow } from '@/lib/reports/teamReporting.templatesPanel';

export interface TeamReportTemplatesTableProps {
  organisationId: string;
  currentUserId: string;
  reportBuilderRef: RefObject<ReportBuilderHandle | null>;
  templateStore: ReportingTemplateStore;
  canDeleteTemplates: boolean;
  deleteDescription: (templateDisplayName: string) => string;
  onCatalogChanged?: () => void;
}

function safeToast(options: Parameters<typeof toast>[0]) {
  try {
    toast(options);
  } catch (toastFault: unknown) {
    console.warn('[TeamReportTemplatesTable] toast unavailable', toastFault);
  }
}

export function TeamReportTemplatesTable({
  organisationId,
  currentUserId,
  reportBuilderRef,
  templateStore,
  canDeleteTemplates,
  deleteDescription,
  onCatalogChanged,
}: TeamReportTemplatesTableProps) {
  const queryResult = useTeamReportTemplatesPanelQuery(organisationId, currentUserId);

  const [pendingDeleteRow, setPendingDeleteRow] = useState<ReportsTemplatePanelRow | null>(null);
  const [pendingDeleteBusy, setPendingDeleteBusy] = useState(false);

  const {
    data: templatesRowsRaw,
    error: templatesRowsError,
    isPending,
    refetch: reloadTemplatesPanelQuery,
  } = queryResult;
  const resolvedRows = templatesRowsRaw ?? [];

  const templatesDescription = `${resolvedRows.length} templates`;

  const columns = useMemo<DataTableColumn<ReportsTemplatePanelRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'nameDisplay',
        header: 'Name',
        sortable: true,
        searchable: true,
        cell: ({ row }) => (
          <section className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start sm:justify-items-start">
            <strong>{row.nameDisplay}</strong>
            <Badge variant={row.is_private ? 'outline-sec-muted' : 'solid-main-normal'}>
              {row.is_private ? 'Private' : 'Org-shared'}
            </Badge>
          </section>
        ),
      },
      {
        id: 'modifiedIso',
        accessorKey: 'modifiedIso',
        header: 'Modified',
        sortable: true,
        cell: ({ row }) => row.modifiedLabel,
      },
      {
        id: 'ownerDisplay',
        accessorKey: 'ownerDisplay',
        header: 'Owner',
        sortable: true,
        searchable: true,
      },
    ],
    [],
  );

  const actions = useMemo<DataTableAction<ReportsTemplatePanelRow>[]>(
    () => [
      {
        label: 'Load',
        variant: 'ghost',
        onClick: async (templateRow) => {
          await reportBuilderRef.current?.loadTemplateById(templateRow.id);
        },
      },
      {
        label: 'Run',
        variant: 'ghost',
        onClick: async (templateRow) => {
          await reportBuilderRef.current?.loadTemplateAndRun(templateRow.id);
        },
      },
      {
        label: 'Delete',
        variant: 'outline',
        hidden: (templateRow) => !canDeleteTemplates || templateRow.created_by !== currentUserId,
        loading: pendingDeleteBusy,
        onClick: (templateRow) => {
          setPendingDeleteRow(templateRow);
        },
      },
    ],
    [canDeleteTemplates, currentUserId, pendingDeleteBusy, reportBuilderRef],
  );

  async function confirmDelete() {
    if (pendingDeleteRow == null) return;
    setPendingDeleteBusy(true);
    try {
      await templateStore.deleteTemplate(pendingDeleteRow.id);
      reportBuilderRef.current?.notifyTemplateDeleted(pendingDeleteRow.id);
      safeToast({ variant: 'success', description: 'Template deleted.' });
      setPendingDeleteRow(null);
      await onCatalogChanged?.();
    } catch (deleteError: unknown) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Could not delete template. Please try again.';
      safeToast({ variant: 'destructive', description: message });
    } finally {
      setPendingDeleteBusy(false);
    }
  }

  if (organisationId === '') {
    return null;
  }

  let panelInner: ReactElement | null = null;

  if (templatesRowsError != null) {
    panelInner = (
      <Alert variant="destructive">
        <AlertTitle>Could not load templates</AlertTitle>
        <AlertDescription>{(templatesRowsError as Error).message ?? 'Templates query failed.'}</AlertDescription>
        <Button type="button" variant="outline" onClick={() => void reloadTemplatesPanelQuery()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (isPending && templatesRowsRaw === undefined) {
    panelInner = (
      <section className="grid place-items-center py-16">
        <LoadingSpinner aria-label="Loading templates" />
      </section>
    );
  } else {
    panelInner = (
      <DataTable<ReportsTemplatePanelRow>
        data={resolvedRows}
        columns={columns}
        rbac={{ pageName: PAGE_NAMES.reports }}
        description={templatesDescription}
        initialPageSize={10}
        getRowId={(row) => row.id}
        initialSorting={[{ id: 'modifiedIso', desc: true }]}
        features={{
          import: false,
          export: false,
          hierarchical: false,
          grouping: false,
          creation: false,
          editing: false,
          deletion: false,
          deleteSelected: false,
          selection: false,
          search: true,
          pagination: true,
          sorting: true,
          filtering: false,
          columnVisibility: false,
          columnReordering: false,
        }}
        actions={actions}
        loadingSpinnerLabel="Loading table"
        isLoading={queryResult.isFetching && templatesRowsRaw !== undefined && resolvedRows.length > 0}
        emptyState={{
          title: 'No saved templates yet.',
          description: 'Saved templates appear here once you save a configuration.',
        }}
        onRowActivate={(row) => void reportBuilderRef.current?.loadTemplateById(row.id)}
      />
    );
  }

  const deleteNameForDialog = pendingDeleteRow == null ? '' : pendingDeleteRow.nameDisplay;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">{panelInner ?? null}</CardContent>
      </Card>
      <ConfirmationDialog
        open={pendingDeleteRow != null}
        onOpenChange={(open) => !open && setPendingDeleteRow(null)}
        title="Delete template?"
        description={pendingDeleteRow != null ? deleteDescription(deleteNameForDialog) : undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={pendingDeleteBusy}
        onConfirm={async () => {
          await confirmDelete();
        }}
      />
    </>
  );
}
