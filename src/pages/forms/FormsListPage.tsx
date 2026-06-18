import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataTableAction, DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmationDialog,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  PageHeader,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { Copy, ExternalLink, Plus, SquarePen, Trash2 } from '@solvera/pace-core/icons';

import { formatFormsUpdatedCell, statusBadgeLabel } from '@/lib/forms/orgForms.display';
import type { OrgFormsTableRow } from '@/lib/forms/orgForms.types';
import { composePortalFormsUrl } from '@/lib/forms/orgForms.portalUrl';
import { useOrgFormsData } from '@/hooks/useOrgFormsData';

/** Remount forms list whenever the scoped organisation changes so dialogs and transient UI reset (TM09 F-59). */
function FormsListPageOrganisationScope() {
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationKey = selectedOrganisation?.id ?? 'none';
  return <FormsListPageContent key={organisationKey} />;
}

function FormsListPageContent() {
  usePaceMain({ printTitle: 'Forms' });

  const navigate = useNavigate();
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;

  const permissions = useResourcePermissions(PAGE_NAMES.forms) as {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    isLoading?: boolean;
  };

  const permissionsLoading = permissions.isLoading === true;
  const canCreate = permissions.canCreate && !permissionsLoading;
  const canUpdate = permissions.canUpdate && !permissionsLoading;
  const canDelete = permissions.canDelete && !permissionsLoading;

  const organisationName =
    selectedOrganisation?.display_name ?? selectedOrganisation?.name ?? 'Organisation';

  const {
    tableRows,
    rawCount,
    isLoading,
    loadErrorMessage,
    refetchFormsList,
    fetchResponseCount,
    deleteFormAsync,
    deletePending,
  } = useOrgFormsData(organisationId);

  const portalOrigin = typeof import.meta.env.VITE_FORM_PORTAL_URL === 'string'
    ? import.meta.env.VITE_FORM_PORTAL_URL
    : undefined;

  const [pendingResponseCountRowId, setPendingResponseCountRowId] = useState<string | null>(
    null,
  );
  const [destructiveDeleteTarget, setDestructiveDeleteTarget] = useState<OrgFormsTableRow | null>(
    null,
  );
  const [blockedDeleteDialog, setBlockedDeleteDialog] = useState<{ form: OrgFormsTableRow; count: number } | null>(
    null,
  );

  const openDeleteFlow = useCallback(
    async (row: OrgFormsTableRow) => {
      setPendingResponseCountRowId(row.id);
      const outcome = await fetchResponseCount(row.id);
      setPendingResponseCountRowId(null);
      if (outcome.ok === false) {
        toast({
          title: `Could not check responses: ${HandleSupabaseError(outcome.error, 'core_form_responses').message}.`,
          variant: 'destructive',
        });
        return;
      }
      const cnt = outcome.count;
      if (cnt > 0) {
        setBlockedDeleteDialog({ form: row, count: cnt });
        return;
      }
      setDestructiveDeleteTarget(row);
    },
    [fetchResponseCount],
  );

  const handleCopyPortalUrl = useCallback(
    async (row: OrgFormsTableRow) => {
      const built = composePortalFormsUrl(portalOrigin, row.slug);
      if (!built.ok || built.url == null) {
        toast({
          title: built.errorTitle ?? 'Portal origin not configured. Contact your administrator.',
          variant: 'destructive',
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(built.url);
        toast({
          title: 'Share URL copied to clipboard.',
          variant: 'success',
        });
      } catch (error: unknown) {
        toast({
          title: `Could not copy share URL: ${HandleSupabaseError(error, 'core_forms').message}.`,
          variant: 'destructive',
        });
      }
    },
    [portalOrigin],
  );

  const handleOpenPortal = useCallback(
    (row: OrgFormsTableRow) => {
      const built = composePortalFormsUrl(portalOrigin, row.slug);
      if (!built.ok || built.url == null) {
        toast({
          title: built.errorTitle ?? 'Portal origin not configured. Contact your administrator.',
          variant: 'destructive',
        });
        return;
      }
      window.open(built.url, '_blank', 'noopener,noreferrer');
    },
    [portalOrigin],
  );

  const columns = useMemo<DataTableColumn<OrgFormsTableRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        sortable: true,
        searchable: true,
      },
      {
        id: 'workflow_label',
        accessorKey: 'workflowTypeLabel',
        header: 'Workflow type',
        sortable: true,
        searchable: true,
      },
      {
        id: 'status_search',
        accessorKey: 'statusLabelTitleCase',
        header: 'Status',
        sortable: true,
        searchable: true,
        cell: ({ row }) => {
          const lbl = statusBadgeLabel(row.status);
          if (row.status === 'published') {
            return <Badge variant="soft-main-normal">{lbl}</Badge>;
          }
          if (row.status === 'closed') {
            return <Badge variant="soft-sec-normal">{lbl}</Badge>;
          }
          return <Badge variant="outline-sec-normal">{lbl}</Badge>;
        },
      },
      {
        id: 'is_active',
        accessorKey: 'is_active',
        header: 'Active',
        sortable: true,
        cell: ({ row }) =>
          row.is_active ? (
            <Badge variant="soft-main-normal">Active</Badge>
          ) : (
            <Badge variant="soft-sec-normal">Inactive</Badge>
          ),
      },
      {
        id: 'primary_rank',
        accessorKey: 'primarySortRank',
        header: 'Primary',
        sortable: true,
        cell: ({ row }) =>
          row.is_primary_entrypoint ? <Badge variant="outline-main-normal">Primary</Badge> : '—',
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: 'Updated',
        sortable: true,
        cell: ({ row }) => formatFormsUpdatedCell(row.updated_at),
      },
    ],
    [],
  );

  const actions = useMemo<DataTableAction<OrgFormsTableRow>[]>(
    () => [
      {
        label: 'Edit',
        icon: SquarePen,
        variant: 'outline',
        hidden: !canUpdate,
        testId: 'forms-edit',
        onClick: (row) => {
          navigate(`/forms/${row.id}`);
        },
      },
      {
        label: 'Copy share URL',
        icon: Copy,
        variant: 'outline',
        testId: 'forms-copy-url',
        onClick: (row) => {
          void handleCopyPortalUrl(row);
        },
      },
      {
        label: 'Open in new tab',
        icon: ExternalLink,
        variant: 'outline',
        testId: 'forms-open-portal',
        onClick: (row) => {
          handleOpenPortal(row);
        },
      },
      {
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        hidden: !canDelete,
        testId: 'forms-delete',
        loading: (row) => pendingResponseCountRowId === row.id,
        disabled: (row) =>
          pendingResponseCountRowId === row.id ||
          (deletePending === true &&
            destructiveDeleteTarget != null &&
            destructiveDeleteTarget.id === row.id),
        onClick: (row) => {
          void openDeleteFlow(row);
        },
      },
    ],
    [
      canDelete,
      canUpdate,
      deletePending,
      destructiveDeleteTarget,
      handleCopyPortalUrl,
      handleOpenPortal,
      navigate,
      openDeleteFlow,
      pendingResponseCountRowId,
    ],
  );

  return (
    <main className="grid gap-4">
      <PageHeader
        title="Forms"
        subtitle={`Manage org-scoped forms for ${organisationName}.`}
        actions={
          canCreate ? (
            <Button type="button" onClick={() => navigate('/forms/new')}>
              <Plus size={18} aria-hidden />
              {' '}
              New form
            </Button>
          ) : undefined
        }
      />

      {loadErrorMessage != null ? (
        <section className="grid gap-3">
          <Alert variant="destructive">
            <AlertTitle>Could not load forms</AlertTitle>
            <AlertDescription>{loadErrorMessage}</AlertDescription>
          </Alert>
          <nav aria-label="Retry forms list">
            <Button type="button" onClick={() => void refetchFormsList()}>
              Retry
            </Button>
          </nav>
        </section>
      ) : (
        <Card key={organisationId ?? 'none'}>
          <CardContent>
            <DataTable<OrgFormsTableRow>
              data={tableRows}
              columns={columns}
              rbac={{ pageName: PAGE_NAMES.forms }}
              description={`${rawCount} forms`}
              isLoading={isLoading}
              loadingSpinnerLabel="Loading forms"
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'updated_at', desc: true }]}
              emptyState={{
                title: 'No forms yet.',
                description: `Create your first form for ${organisationName}.`,
              }}
              actions={actions}
              features={{
                import: false,
                export: false,
                hierarchical: false,
                grouping: false,
                deletion: false,
                deleteSelected: false,
                selection: false,
                search: true,
                pagination: true,
                sorting: true,
                filtering: true,
                creation: false,
                editing: false,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={destructiveDeleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDestructiveDeleteTarget(null);
          }
        }}
        title={destructiveDeleteTarget != null ? `Delete '${destructiveDeleteTarget.name}'?` : ''}
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={deletePending}
        onConfirm={async () => {
          if (destructiveDeleteTarget == null || organisationId == null) {
            return;
          }
          const targetRow = destructiveDeleteTarget;
          try {
            await deleteFormAsync({ formId: targetRow.id });
            setDestructiveDeleteTarget(null);
            toast({
              title: `${targetRow.name} deleted.`,
              variant: 'success',
            });
          } catch (error: unknown) {
            setDestructiveDeleteTarget(null);
            toast({
              title: `Could not delete form: ${HandleSupabaseError(error, 'core_forms').message}.`,
              variant: 'destructive',
            });
          }
        }}
      />

      <Dialog
        open={blockedDeleteDialog != null}
        onOpenChange={(open) => {
          if (!open) {
            setBlockedDeleteDialog(null);
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cannot delete this form</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p>
                {blockedDeleteDialog?.count ?? 0} submitted response(s) reference this form. Forms with
                responses cannot be deleted.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="default" onClick={() => setBlockedDeleteDialog(null)}>
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </main>
  );
}

export function FormsListPage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.forms}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <FormsListPageOrganisationScope />
    </PagePermissionGuard>
  );
}
