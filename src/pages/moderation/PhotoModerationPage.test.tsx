// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { setupUser } from '@test-utils';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoModerationPage } from '@/pages/moderation/PhotoModerationPage';
import type { ModerationPhotoTableRow } from '@/lib/moderation/photoModeration.types';

const usePhotoModerationDataMock = vi.fn();
const useOrganisationsContextMock = vi.fn();
const toastMock = vi.hoisted(() => vi.fn());

let pageGuardAllows = true;
let canDelete = true;
let organisationId = 'org-1';

const samplePhoto: ModerationPhotoTableRow = {
  id: 'photo-1',
  record_id: 'person-1',
  file_path: 'path/photo.jpg',
  is_public: false,
  file_metadata: { fileType: 'image/jpeg', fileSize: 1024 },
  created_at: '2026-05-04T14:32:00.000Z',
  created_by: 'user-1',
  created_by_display_name: 'Uploader',
  member_display_name: 'Alex Member',
  app_id: 'app-1',
  file_size: 1024,
  file_type: 'image/jpeg',
  category: 'profile_photo',
  uploaded_by_label: 'Uploader',
  public_label: 'Private',
};

vi.mock('@/hooks/usePhotoModerationData', () => ({
  usePhotoModerationData: (...args: unknown[]) => usePhotoModerationDataMock(...args),
}));

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
  useFileDisplay: () => ({ url: 'https://example.test/photo.jpg', isLoading: false, error: null }),
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => useOrganisationsContextMock(),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: ({ message }: { message?: string }) => (
    <p data-testid="access-denied">{message ?? 'Denied'}</p>
  ),
  PagePermissionGuard: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) =>
    pageGuardAllows ? <>{children}</> : <>{fallback}</>,
  useResourcePermissions: () => ({
    canDelete,
    isLoading: false,
  }),
  useSecureSupabase: () => ({}),
}));

vi.mock('@solvera/pace-core/components', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/components')>();
  const { buildPhotoModerationPageComponentsMock } = await import('@/test-utils/photoModerationPageMocks');
  return buildPhotoModerationPageComponentsMock(toastMock, actual);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PhotoModerationPage />
    </MemoryRouter>,
  );
}

describe('PhotoModerationPage', () => {
  beforeEach(() => {
    pageGuardAllows = true;
    canDelete = true;
    organisationId = 'org-1';
    toastMock.mockReset();
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: organisationId, name: 'Org One', display_name: 'Org One' },
    });
    usePhotoModerationDataMock.mockReturnValue({
      photos: [samplePhoto],
      isLoading: false,
      loadErrorMessage: null,
      refetchPhotos: vi.fn(),
      removePhoto: vi.fn().mockResolvedValue({ ok: true }),
      removePending: false,
      clearLocalRemovals: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders page title and profile photos table', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Photo moderation' })).toBeTruthy();
    expect(screen.getByTestId('photo-table')).toBeTruthy();
    expect(screen.getByText('Alex Member')).toBeTruthy();
  });

  it('renders access denied when page guard denies', () => {
    pageGuardAllows = false;
    renderPage();
    expect(screen.getByTestId('access-denied')).toBeTruthy();
  });

  it('hides Remove action when canDelete is false', () => {
    canDelete = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('shows empty state when there are no photos', () => {
    usePhotoModerationDataMock.mockReturnValue({
      photos: [],
      isLoading: false,
      loadErrorMessage: null,
      refetchPhotos: vi.fn(),
      removePhoto: vi.fn(),
      removePending: false,
      clearLocalRemovals: vi.fn(),
    });

    renderPage();
    expect(screen.getByText('No profile photos to review.')).toBeTruthy();
  });

  it('shows load error with Retry that refetches', async () => {
    const refetchPhotos = vi.fn();
    usePhotoModerationDataMock.mockReturnValue({
      photos: [],
      isLoading: false,
      loadErrorMessage: 'RPC failed',
      refetchPhotos,
      removePhoto: vi.fn(),
      removePending: false,
      clearLocalRemovals: vi.fn(),
    });

    const user = setupUser();
    renderPage();

    expect(screen.getByText('Could not load profile photos.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchPhotos).toHaveBeenCalled();
  });

  it('confirms remove and shows success toast', async () => {
    const removePhoto = vi.fn().mockResolvedValue({ ok: true });
    usePhotoModerationDataMock.mockReturnValue({
      photos: [samplePhoto],
      isLoading: false,
      loadErrorMessage: null,
      refetchPhotos: vi.fn(),
      removePhoto,
      removePending: false,
      clearLocalRemovals: vi.fn(),
    });

    const user = setupUser();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(1);
    });
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);

    await waitFor(() => {
      expect(removePhoto).toHaveBeenCalledWith(samplePhoto, 'org-1');
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Photo removed.', variant: 'success' }),
    );
  });

  it('shows destructive toast and keeps confirm open when remove fails', async () => {
    const removePhoto = vi.fn().mockResolvedValue({ ok: false, message: 'Storage delete failed' });
    usePhotoModerationDataMock.mockReturnValue({
      photos: [samplePhoto],
      isLoading: false,
      loadErrorMessage: null,
      refetchPhotos: vi.fn(),
      removePhoto,
      removePending: false,
      clearLocalRemovals: vi.fn(),
    });

    const user = setupUser();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(1);
    });
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Could not remove photo',
          description: 'Storage delete failed',
          variant: 'destructive',
        }),
      );
    });
    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(1);
  });

  it('fires org-change toast when organisation changes with open confirm dialog', async () => {
    const { rerender } = renderPage();
    const user = setupUser();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(1);

    organisationId = 'org-2';
    useOrganisationsContextMock.mockReturnValue({
      selectedOrganisation: { id: 'org-2', name: 'Org Two', display_name: 'Org Two' },
    });

    rerender(
      <MemoryRouter>
        <PhotoModerationPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Editing cancelled — organisation changed.',
          variant: 'default',
        }),
      );
    });
  });
});