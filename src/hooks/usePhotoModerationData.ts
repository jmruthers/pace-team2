import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { deleteAttachment } from '@solvera/pace-core/crud';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import {
  mapModerationPhotoRow,
  moderationStorageBucket,
  toModerationPhotoTableRow,
} from '@/lib/moderation/photoModeration.display';
import type {
  ModerationPhotoRow,
  ModerationPhotoTableRow,
  RemovePhotoResult,
} from '@/lib/moderation/photoModeration.types';

type RpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const PHOTO_MODERATION_QUERY_KEY = 'photo-moderation';

function coercePhotoList(data: unknown): ModerationPhotoRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapModerationPhotoRow(row));
}

export function usePhotoModerationData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as RpcClient | null;
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const organisationIdRef = useRef(organisationId);
  useEffect(() => {
    organisationIdRef.current = organisationId;
  }, [organisationId]);

  const photosQuery = useQuery({
    queryKey: [PHOTO_MODERATION_QUERY_KEY, organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<ModerationPhotoRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = await secureSupabase.rpc('data_moderation_photo_list', {
        p_organisation_id: organisationId,
      });

      if (error != null) {
        throw error;
      }

      return coercePhotoList(data);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({
      row,
      organisationIdAtStart,
    }: {
      row: ModerationPhotoRow;
      organisationIdAtStart: string;
    }): Promise<RemovePhotoResult> => {
      if (secureSupabase == null) {
        return { ok: false, message: 'Secure client is not available.' };
      }

      const result = await deleteAttachment({
        secureClient: secureSupabase,
        metadataId: row.id,
        filePath: row.file_path,
        adapter: {
          metadataTable: 'core_file_references',
          storageBucket: moderationStorageBucket(row.is_public),
        },
      });

      if (organisationIdRef.current !== organisationIdAtStart) {
        return { ok: false, message: '', suppressed: true };
      }

      if (result.ok === false) {
        return { ok: false, message: result.error.message };
      }

      return { ok: true };
    },
    onSuccess: (outcome, variables) => {
      if (outcome.ok) {
        setRemovedIds((previous) => {
          const next = new Set(previous);
          next.add(variables.row.id);
          return next;
        });
      }
    },
  });

  const photos = useMemo((): ModerationPhotoTableRow[] => {
    const rows = (photosQuery.data ?? []).filter((row) => !removedIds.has(row.id));
    return rows.map(toModerationPhotoTableRow);
  }, [photosQuery.data, removedIds]);

  const loadErrorMessage = useMemo(() => {
    if (!photosQuery.isError) {
      return null;
    }
    return HandleSupabaseError(photosQuery.error, 'data_moderation_photo_list').message;
  }, [photosQuery.error, photosQuery.isError]);

  const removePhoto = useCallback(
    async (row: ModerationPhotoRow, organisationIdAtStart: string): Promise<RemovePhotoResult> => {
      return removeMutation.mutateAsync({ row, organisationIdAtStart });
    },
    [removeMutation],
  );

  const clearLocalRemovals = useCallback(() => {
    setRemovedIds(new Set());
  }, []);

  return {
    photos,
    isLoading: photosQuery.isLoading,
    loadErrorMessage,
    refetchPhotos: photosQuery.refetch,
    removePhoto,
    removePending: removeMutation.isPending,
    clearLocalRemovals,
  };
}
