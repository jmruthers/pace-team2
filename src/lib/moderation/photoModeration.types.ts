/** Parsed file_metadata from `data_moderation_photo_list` rows. */
export interface ModerationPhotoFileMetadata {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  category?: string;
  bucket?: string;
}

/** Row shape returned by `data_moderation_photo_list`. */
export interface ModerationPhotoRow {
  id: string;
  record_id: string;
  file_path: string;
  is_public: boolean;
  file_metadata: ModerationPhotoFileMetadata;
  created_at: string;
  created_by: string | null;
  created_by_display_name: string | null;
  member_display_name: string;
  app_id: string;
}

/** Flattened row for DataTable sort/filter accessors (Record index required by DataTable generics). */
export interface ModerationPhotoTableRow extends ModerationPhotoRow, Record<string, unknown> {
  file_size: number | null;
  file_type: string | null;
  category: string | null;
  uploaded_by_label: string;
  public_label: string;
}

export type RemovePhotoResult =
  | { ok: true }
  | { ok: false; message: string; suppressed?: boolean };
