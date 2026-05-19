import { Badge, Button, LoadingSpinner } from '@solvera/pace-core/components';
import { useFileDisplay } from '@solvera/pace-core/hooks';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import {
  moderationStorageBucket,
  toFileReference,
} from '@/lib/moderation/photoModeration.display';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

interface PhotoThumbnailCellProps {
  row: ModerationPhotoRow;
  onOpenPreview: (row: ModerationPhotoRow) => void;
}

export function PhotoThumbnailCell({ row, onOpenPreview }: PhotoThumbnailCellProps) {
  const secureClient = useSecureSupabase() as Parameters<typeof useFileDisplay>[1]['client'];
  const fileReference = toFileReference(row);
  const { url, isLoading, error } = useFileDisplay(fileReference, {
    client: secureClient,
    bucket: moderationStorageBucket(row.is_public),
  });

  if (isLoading) {
    return <LoadingSpinner label="Loading thumbnail" className="inline-block size-4" />;
  }

  if (error != null || url == null) {
    return <Badge variant="outline-acc-normal">Image unavailable</Badge>;
  }

  return (
    <section className="inline-grid size-12 rounded-md border ring-offset-background hover:ring-2 focus-within:ring-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenPreview(row)}
        aria-label={`Preview photo for ${row.member_display_name}`}
      >
        <img
          src={url}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-md object-cover"
        />
      </Button>
    </section>
  );
}
