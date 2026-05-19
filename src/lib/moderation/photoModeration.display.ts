import type { FileReference } from '@solvera/pace-core/types';
import type {
  ModerationPhotoFileMetadata,
  ModerationPhotoRow,
  ModerationPhotoTableRow,
} from '@/lib/moderation/photoModeration.types';

const EM_DASH = '—';
const UPLOADED_LOCALE = 'en-GB';

export function moderationStorageBucket(isPublic: boolean): 'files' | 'public-files' {
  return isPublic ? 'public-files' : 'files';
}

export function parseModerationPhotoMetadata(raw: unknown): ModerationPhotoFileMetadata {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const fileSize = record.fileSize;
  return {
    fileName: typeof record.fileName === 'string' ? record.fileName : undefined,
    fileType: typeof record.fileType === 'string' ? record.fileType : undefined,
    fileSize: typeof fileSize === 'number' && Number.isFinite(fileSize) ? fileSize : undefined,
    category: typeof record.category === 'string' ? record.category : undefined,
    bucket: typeof record.bucket === 'string' ? record.bucket : undefined,
  };
}

export function mapModerationPhotoRow(raw: Record<string, unknown>): ModerationPhotoRow {
  const metadata = parseModerationPhotoMetadata(raw.file_metadata);
  return {
    id: String(raw.id ?? ''),
    record_id: String(raw.record_id ?? ''),
    file_path: String(raw.file_path ?? ''),
    is_public: raw.is_public === true,
    file_metadata: metadata,
    created_at: String(raw.created_at ?? ''),
    created_by: raw.created_by == null ? null : String(raw.created_by),
    created_by_display_name:
      raw.created_by_display_name == null ? null : String(raw.created_by_display_name),
    member_display_name: String(raw.member_display_name ?? ''),
    app_id: String(raw.app_id ?? ''),
  };
}

export function toModerationPhotoTableRow(row: ModerationPhotoRow): ModerationPhotoTableRow {
  const fileSize = row.file_metadata.fileSize ?? null;
  const fileType = row.file_metadata.fileType ?? null;
  const category = row.file_metadata.category ?? null;
  return {
    ...row,
    file_size: fileSize,
    file_type: fileType,
    category,
    uploaded_by_label: row.created_by_display_name?.trim() ? row.created_by_display_name : EM_DASH,
    public_label: row.is_public ? 'Public' : 'Private',
  };
}

export function toFileReference(row: ModerationPhotoRow): FileReference {
  const bucket = moderationStorageBucket(row.is_public);
  return {
    id: row.id,
    table_name: 'core_person',
    record_id: row.record_id,
    file_path: row.file_path,
    file_metadata: {
      fileName: row.file_metadata.fileName ?? 'photo',
      fileType: row.file_metadata.fileType ?? 'image/jpeg',
      bucket,
      fileSize: row.file_metadata.fileSize,
      category: row.file_metadata.category,
    },
    app_id: row.app_id,
    is_public: row.is_public,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

export function formatUploadedDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return EM_DASH;
    }
    return new Intl.DateTimeFormat(UPLOADED_LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return EM_DASH;
  }
}

export function formatUploadedDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return EM_DASH;
    }
    return new Intl.DateTimeFormat(UPLOADED_LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return EM_DASH;
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return EM_DASH;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    const rounded = kb >= 100 ? Math.round(kb) : Math.round(kb * 10) / 10;
    return `${rounded} KB`;
  }
  const mb = kb / 1024;
  const roundedMb = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${roundedMb} MB`;
}

export function publicVisibilityLabel(isPublic: boolean): string {
  return isPublic ? 'Public' : 'Private';
}
