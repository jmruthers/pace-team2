import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  LoadingSpinner,
} from '@solvera/pace-core/components';
import { useFileDisplay } from '@solvera/pace-core/hooks';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import {
  formatFileSize,
  formatUploadedDateTime,
  moderationStorageBucket,
  publicVisibilityLabel,
  toFileReference,
} from '@/lib/moderation/photoModeration.display';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

interface PhotoPreviewDialogProps {
  row: ModerationPhotoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  onRequestRemove: (row: ModerationPhotoRow) => void;
}

export function PhotoPreviewDialog({
  row,
  open,
  onOpenChange,
  canDelete,
  onRequestRemove,
}: PhotoPreviewDialogProps) {
  const secureClient = useSecureSupabase() as Parameters<typeof useFileDisplay>[1]['client'];
  const fileReference = row == null ? null : toFileReference(row);
  const { url, isLoading, error } = useFileDisplay(fileReference, {
    client: secureClient,
    bucket: row == null ? 'files' : moderationStorageBucket(row.is_public),
  });

  if (row == null) {
    return null;
  }

  const categoryLabel = row.file_metadata.category?.trim() ? row.file_metadata.category : '—';
  const uploadedByLabel = row.created_by_display_name?.trim() ? row.created_by_display_name : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent className="grid max-h-[80vh] w-full max-w-[80vw] gap-4 max-md:max-h-[95vh] max-md:max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>{row.member_display_name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid max-h-[70vh] gap-4 overflow-y-auto">
            {error != null ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load preview.</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <section className="grid place-items-center">
              {isLoading ? (
                <LoadingSpinner label="Loading preview" />
              ) : url != null ? (
                <img
                  src={url}
                  alt=""
                  className="max-h-[60vh] w-full object-contain"
                />
              ) : null}
            </section>
            <dl className="grid gap-2">
              <dt>Uploaded</dt>
              <dd>{formatUploadedDateTime(row.created_at)}</dd>
              <dt>Uploaded by</dt>
              <dd>{uploadedByLabel}</dd>
              <dt>File size</dt>
              <dd>{formatFileSize(row.file_metadata.fileSize)}</dd>
              <dt>File type</dt>
              <dd>{row.file_metadata.fileType ?? '—'}</dd>
              <dt>Public</dt>
              <dd>{publicVisibilityLabel(row.is_public)}</dd>
              <dt>Category</dt>
              <dd>{categoryLabel}</dd>
              <dt>Storage path id</dt>
              <dd>
                <code>{row.id}</code>
              </dd>
            </dl>
          </DialogBody>
          <DialogFooter className="text-right">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onRequestRemove(row)}
              >
                Remove
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
