// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAttachment } from '@solvera/pace-core/crud';
import { usePhotoModerationData } from '@/hooks/usePhotoModerationData';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

const rpcMock = vi.fn();
const deleteAttachmentMock = vi.mocked(deleteAttachment);

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

vi.mock('@solvera/pace-core/crud', () => ({
  deleteAttachment: vi.fn(),
}));

const sampleRow: ModerationPhotoRow = {
  id: 'photo-1',
  record_id: 'person-1',
  file_path: 'path/photo.jpg',
  is_public: false,
  file_metadata: { fileType: 'image/jpeg' },
  created_at: '2026-05-04T14:32:00.000Z',
  created_by: 'user-1',
  created_by_display_name: 'Uploader',
  member_display_name: 'Alex Member',
  app_id: 'app-1',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePhotoModerationData', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    deleteAttachmentMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [
        {
          id: sampleRow.id,
          record_id: sampleRow.record_id,
          file_path: sampleRow.file_path,
          is_public: false,
          file_metadata: sampleRow.file_metadata,
          created_at: sampleRow.created_at,
          created_by: sampleRow.created_by,
          created_by_display_name: sampleRow.created_by_display_name,
          member_display_name: sampleRow.member_display_name,
          app_id: sampleRow.app_id,
        },
      ],
      error: null,
    });
  });

  it('loads photos via data_moderation_photo_list RPC', async () => {
    const { result } = renderHook(() => usePhotoModerationData('org-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(rpcMock).toHaveBeenCalledWith('data_moderation_photo_list', {
      p_organisation_id: 'org-1',
    });
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.photos[0]?.member_display_name).toBe('Alex Member');
  });

  it('removePhoto calls deleteAttachment and drops row on success', async () => {
    deleteAttachmentMock.mockResolvedValue({ ok: true, data: undefined });

    const { result } = renderHook(() => usePhotoModerationData('org-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(1);
    });

    const outcome = await result.current.removePhoto(sampleRow, 'org-1');

    expect(outcome).toEqual({ ok: true });
    expect(deleteAttachmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataId: 'photo-1',
        filePath: 'path/photo.jpg',
        adapter: {
          metadataTable: 'core_file_references',
          storageBucket: 'files',
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(0);
    });
  });

  it('removePhoto returns failure message when deleteAttachment fails', async () => {
    deleteAttachmentMock.mockResolvedValue({
      ok: false,
      error: { code: 'ATTACHMENT_STORAGE_DELETE_FAILED', message: 'Storage delete failed' },
    });

    const { result } = renderHook(() => usePhotoModerationData('org-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(1);
    });

    const outcome = await result.current.removePhoto(sampleRow, 'org-1');

    expect(outcome).toEqual({ ok: false, message: 'Storage delete failed' });
    expect(result.current.photos).toHaveLength(1);
  });
});
