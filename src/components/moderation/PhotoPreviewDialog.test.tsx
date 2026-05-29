// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoPreviewDialog } from '@/components/moderation/PhotoPreviewDialog';
import type { ModerationPhotoRow } from '@/lib/moderation/photoModeration.types';

const useFileDisplayMock = vi.fn();

const paceCoreComponentMocks = vi.hoisted(() => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('section', null, children) : null,
  DialogPortal: ({ children }: { children: ReactNode }) => createElement('section', null, children),
  DialogContent: ({ children }: { children: ReactNode }) => createElement('section', null, children),
  DialogHeader: ({ children }: { children: ReactNode }) => createElement('header', null, children),
  DialogTitle: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
  DialogBody: ({ children }: { children: ReactNode }) => createElement('section', null, children),
  DialogFooter: ({ children }: { children: ReactNode }) => createElement('footer', null, children),
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
  }) => createElement('button', { type: type ?? 'button', onClick }, children),
  Alert: ({ children }: { children: ReactNode }) => createElement('section', null, children),
  AlertTitle: ({ children }: { children: ReactNode }) => createElement('p', null, children),
  AlertDescription: ({ children }: { children: ReactNode }) => createElement('p', null, children),
  LoadingSpinner: ({ label }: { label?: string }) => createElement('p', null, label ?? 'Loading'),
}));

vi.mock('@solvera/pace-core/hooks', () => ({
  useFileDisplay: (...args: unknown[]) => useFileDisplayMock(...args),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  useSecureSupabase: () => ({}),
}));

vi.mock('@solvera/pace-core/components', () => paceCoreComponentMocks);

const sampleRow: ModerationPhotoRow = {
  id: 'file-ref-1',
  record_id: 'person-1',
  file_path: 'path/photo.jpg',
  is_public: true,
  file_metadata: { fileType: 'image/jpeg', fileSize: 2048, category: 'profile_photo' },
  created_at: '2026-05-04T14:32:00.000Z',
  created_by: 'user-1',
  created_by_display_name: 'Uploader',
  member_display_name: 'Alex Member',
  app_id: 'app-1',
};

describe('PhotoPreviewDialog', () => {
  beforeEach(() => {
    useFileDisplayMock.mockReturnValue({ url: null, isLoading: false, error: null });
  });

  afterEach(() => {
    cleanup();
    useFileDisplayMock.mockReset();
  });

  it('renders nothing when row is null', () => {
    const { container } = render(
      <PhotoPreviewDialog
        row={null}
        open
        onOpenChange={vi.fn()}
        canDelete={false}
        onRequestRemove={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows preview error when file display fails', () => {
    useFileDisplayMock.mockReturnValue({
      url: null,
      isLoading: false,
      error: new Error('storage denied'),
    });
    render(
      <PhotoPreviewDialog
        row={sampleRow}
        open
        onOpenChange={vi.fn()}
        canDelete={false}
        onRequestRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Could not load preview.')).toBeTruthy();
    expect(screen.getByText('storage denied')).toBeTruthy();
  });

  it('requests remove when operator confirms from preview', async () => {
    const onRequestRemove = vi.fn();
    useFileDisplayMock.mockReturnValue({
      url: 'https://example.test/preview.jpg',
      isLoading: false,
      error: null,
    });
    const user = setupUser();
    render(
      <PhotoPreviewDialog
        row={sampleRow}
        open
        onOpenChange={vi.fn()}
        canDelete
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRequestRemove).toHaveBeenCalledWith(sampleRow);
  });
});
