import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { Trash2 } from '@solvera/pace-core/icons';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { PhotoPreviewDialog } from '@/components/moderation/PhotoPreviewDialog';
import { PhotoThumbnailCell } from '@/components/moderation/PhotoThumbnailCell';
import { usePhotoModerationData } from '@/hooks/usePhotoModerationData';
import { formatFileSize, formatUploadedDate } from '@/lib/moderation/photoModeration.display';
import type { ModerationPhotoRow, ModerationPhotoTableRow } from '@/lib/moderation/photoModeration.types';

function PhotoModerationPageContent() {
  usePaceMain({ printTitle: 'Photo moderation', ariaLabel: 'Photo moderation' });

  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;

  const { canDelete: canDeletePermission, isLoading: permissionsLoading } =
    useResourcePermissions(PAGE_NAMES.moderationPhotos);
  const canDelete = canDeletePermission === true && permissionsLoading !== true;

  const {
    photos,
    isLoading,
    loadErrorMessage,
    refetchPhotos,
    removePhoto,
    removePending,
    clearLocalRemovals,
  } = usePhotoModerationData(organisationId);

  const [previewTarget, setPreviewTarget] = useState<ModerationPhotoRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ModerationPhotoRow | null>(null);
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  const openPreview = useCallback((row: ModerationPhotoRow) => {
    setPreviewTarget(row);
  }, []);

  const openRemoveConfirm = useCallback((row: ModerationPhotoRow) => {
    setRemoveTarget(row);
  }, []);

  useEffect(() => {
    const nextOrganisationId = organisationId;
    if (previousOrganisationIdRef.current === undefined) {
      previousOrganisationIdRef.current = nextOrganisationId;
      return;
    }
    if (previousOrganisationIdRef.current === nextOrganisationId) {
      return;
    }

    previousOrganisationIdRef.current = nextOrganisationId;
    const hadOpenDialog = previewTarget != null || removeTarget != null;
    clearLocalRemovals();
    setPreviewTarget(null);
    setRemoveTarget(null);
    if (hadOpenDialog) {
      toast({
        title: 'Editing cancelled — organisation changed.',
        variant: 'default',
      });
    }
  }, [clearLocalRemovals, organisationId, previewTarget, removeTarget]);

  const columns = useMemo<DataTableColumn<ModerationPhotoTableRow>[]>(
    () => [
      {
        id: 'thumbnail',
        header: 'Photo',
        sortable: false,
        cell: ({ row }) => (
          <PhotoThumbnailCell row={row} onOpenPreview={openPreview} />
        ),
      },
      {
        id: 'member_display_name',
        accessorKey: 'member_display_name',
        header: 'Member',
        sortable: true,
        searchable: true,
        cell: ({ row }) => (
          <Link to={`/members/${row.record_id}`}>{row.member_display_name}</Link>
        ),
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Uploaded',
        sortable: true,
        enableColumnFilter: true,
        filterType: 'date',
        cell: ({ row }) => formatUploadedDate(row.created_at),
      },
      {
        id: 'created_by_display_name',
        accessorKey: 'uploaded_by_label',
        header: 'Uploaded by',
        sortable: true,
        searchable: true,
        enableColumnFilter: true,
        filterType: 'text',
      },
      {
        id: 'file_size',
        accessorKey: 'file_size',
        header: 'File size',
        sortable: true,
        cell: ({ row }) => formatFileSize(row.file_size),
      },
      {
        id: 'file_type',
        accessorKey: 'file_type',
        header: 'File type',
        sortable: true,
        searchable: true,
        enableColumnFilter: true,
        filterType: 'text',
        cell: ({ row }) => row.file_type ?? '—',
      },
      {
        id: 'is_public',
        accessorKey: 'is_public',
        header: 'Public',
        sortable: true,
        enableColumnFilter: true,
        filterType: 'select',
        filterSelectOptions: [
          { value: 'true', label: 'Public' },
          { value: 'false', label: 'Private' },
        ],
        cell: ({ row }) => (
          <Badge variant={row.is_public ? 'soft-main-normal' : 'soft-sec-normal'}>
            {row.public_label}
          </Badge>
        ),
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        sortable: true,
        enableColumnFilter: true,
        filterType: 'text',
        cell: ({ row }) => row.category ?? '—',
      },
    ],
    [openPreview],
  );

  const actions = useMemo<DataTableAction<ModerationPhotoTableRow>[]>(
    () => [
      {
        label: 'Remove',
        icon: Trash2,
        variant: 'destructive',
        hidden: !canDelete,
        onClick: (row) => {
          openRemoveConfirm(row);
        },
      },
    ],
    [canDelete, openRemoveConfirm],
  );

  const handleConfirmRemove = async () => {
    if (removeTarget == null || organisationId == null) {
      return;
    }
    const target = removeTarget;
    const organisationIdAtStart = organisationId;
    const outcome = await removePhoto(target, organisationIdAtStart);

    if ('suppressed' in outcome && outcome.suppressed === true) {
      return;
    }

    if (outcome.ok === true) {
      setRemoveTarget(null);
      setPreviewTarget(null);
      toast({
        title: 'Photo removed.',
        variant: 'success',
      });
      return;
    }

    toast({
      title: 'Could not remove photo',
      description: outcome.message,
      variant: 'destructive',
    });
  };

  return (
    <main className="grid gap-4">
      <section className="grid gap-3">
        <h1>Photo moderation</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profile photos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadErrorMessage != null ? (
            <section className="grid gap-3">
              <Alert variant="destructive">
                <AlertTitle>Could not load profile photos.</AlertTitle>
                <AlertDescription>{loadErrorMessage}</AlertDescription>
              </Alert>
              <nav aria-label="Retry profile photos">
                <Button type="button" variant="outline" onClick={() => void refetchPhotos()}>
                  Retry
                </Button>
              </nav>
            </section>
          ) : (
            <DataTable<ModerationPhotoTableRow>
              data={photos}
              columns={columns}
              rbac={{ pageName: PAGE_NAMES.moderationPhotos }}
              title="Profile photos"
              isLoading={isLoading}
              loadingSpinnerLabel="Loading photos"
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'member_display_name', desc: false }]}
              emptyState={{
                title: 'No profile photos to review.',
                description: 'New photos appear here as members upload them through Portal.',
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
                editing: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <PhotoPreviewDialog
        row={previewTarget}
        open={previewTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTarget(null);
          }
        }}
        canDelete={canDelete}
        onRequestRemove={(row) => {
          openRemoveConfirm(row);
        }}
      />

      <ConfirmationDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
        title="Remove this photo?"
        description="This will permanently delete the photo and the underlying file. This cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={removePending}
        onConfirm={handleConfirmRemove}
      />
    </main>
  );
}

export function PhotoModerationPage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.moderationPhotos}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <PhotoModerationPageContent />
    </PagePermissionGuard>
  );
}
