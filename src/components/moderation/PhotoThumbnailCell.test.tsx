// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoThumbnailCell } from '@/components/moderation/PhotoThumbnailCell';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

const useFileDisplayMock = vi.fn();

vi.mock('@solvera/pace-core/hooks', () => ({
  useFileDisplay: (...args: unknown[]) => useFileDisplayMock(...args),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () => ({}),
}));

const sampleRow: ModerationPhotoRow = {
  id: 'file-ref-1',
  record_id: 'person-1',
  file_path: 'path/photo.jpg',
  is_public: false,
  file_metadata: { fileType: 'image/jpeg', fileSize: 1024, category: 'profile_photo' },
  created_at: '2026-05-04T14:32:00.000Z',
  created_by: 'user-1',
  created_by_display_name: 'Uploader',
  member_display_name: 'Alex Member',
  app_id: 'app-1',
};

describe('PhotoThumbnailCell', () => {
  afterEach(() => {
    cleanup();
    useFileDisplayMock.mockReset();
  });

  it('shows loading spinner while thumbnail URL resolves', () => {
    useFileDisplayMock.mockReturnValue({ url: null, isLoading: true, error: null });
    render(<PhotoThumbnailCell row={sampleRow} onOpenPreview={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading thumbnail' })).toBeTruthy();
  });

  it('shows unavailable badge when preview URL fails', () => {
    useFileDisplayMock.mockReturnValue({
      url: null,
      isLoading: false,
      error: new Error('denied'),
    });
    render(<PhotoThumbnailCell row={sampleRow} onOpenPreview={vi.fn()} />);
    expect(screen.getByText('Image unavailable')).toBeTruthy();
  });

  it('opens preview when thumbnail is clicked', async () => {
    const onOpenPreview = vi.fn();
    useFileDisplayMock.mockReturnValue({
      url: 'https://example.test/thumb.jpg',
      isLoading: false,
      error: null,
    });
    const user = setupUser();
    render(<PhotoThumbnailCell row={sampleRow} onOpenPreview={onOpenPreview} />);

    await user.click(screen.getByRole('button', { name: 'Preview photo for Alex Member' }));
    expect(onOpenPreview).toHaveBeenCalledWith(sampleRow);
  });
});
