import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  formatUploadedDate,
  moderationStorageBucket,
  parseModerationPhotoMetadata,
  toModerationPhotoTableRow,
} from '@/lib/moderation/photoModeration.display';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

const baseRow: ModerationPhotoRow = {
  id: 'photo-1',
  record_id: 'person-1',
  file_path: 'org/person/photo.jpg',
  is_public: false,
  file_metadata: { fileType: 'image/jpeg', fileSize: 126_976 },
  created_at: '2026-05-04T14:32:00.000Z',
  created_by: null,
  created_by_display_name: null,
  member_display_name: 'Alex Member',
  app_id: 'app-1',
};

describe('photoModeration.display', () => {
  it('selects storage bucket from is_public', () => {
    expect(moderationStorageBucket(false)).toBe('files');
    expect(moderationStorageBucket(true)).toBe('public-files');
  });

  it('formats uploaded date as dd MMM yyyy', () => {
    expect(formatUploadedDate('2026-05-04T14:32:00.000Z')).toMatch(/May 2026/);
  });

  it('formats file sizes in KB and MB', () => {
    expect(formatFileSize(126_976)).toBe('124 KB');
    expect(formatFileSize(4_718_592)).toBe('4.5 MB');
  });

  it('returns em dash for missing file size', () => {
    expect(formatFileSize(null)).toBe('—');
    expect(formatFileSize(undefined)).toBe('—');
  });

  it('flattens table row labels', () => {
    const tableRow = toModerationPhotoTableRow(baseRow);
    expect(tableRow.uploaded_by_label).toBe('—');
    expect(tableRow.public_label).toBe('Private');
    expect(tableRow.file_size).toBe(126_976);
  });

  it('drops invalid fileSize strings from metadata', () => {
    const metadata = parseModerationPhotoMetadata({
      fileName: 'photo.jpg',
      fileType: 'image/jpeg',
      fileSize: 'not-a-number',
      category: 'profile_photo',
      extraField: 'ignored',
    });
    expect(metadata.fileName).toBe('photo.jpg');
    expect(metadata.fileType).toBe('image/jpeg');
    expect(metadata.fileSize).toBeUndefined();
    expect(metadata.category).toBe('profile_photo');
    expect('extraField' in metadata).toBe(false);
  });
});
