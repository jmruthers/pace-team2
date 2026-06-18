// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SubOrganisationsPage } from './SubOrganisationsPage';

const DUPLICATE_NAME_MESSAGE =
  'An organisation with this name already exists. Names must be unique across the platform.';

let selectedOrganisation: { id: string; display_name?: string; name?: string } | null = {
  id: 'org-1',
  display_name: 'Parent Org',
};
let canCreate = true;
let canUpdate = true;
let mockIsValid = true;
let mockIsSubmitted = false;
let mockErrors: Record<string, unknown> = {};

const createSubOrganisationMock = vi.fn();
const updateSubOrganisationMock = vi.fn();
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: ({ message }: { message?: string }) => <p>{message ?? 'Denied'}</p>,
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  useResourcePermissions: () => ({
    canRead: true,
    canCreate,
    canUpdate,
    isLoading: false,
  }),
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unknown error',
  }),
}));

const useSubOrganisationsDataMock = vi.fn();

vi.mock('@/hooks/useSubOrganisationsData', () => ({
  useSubOrganisationsData: (...args: unknown[]) => useSubOrganisationsDataMock(...args),
}));

vi.mock('@/lib/settings/subOrganisations.validation', () => ({
  createSubOrganisationSchema: {},
  editSubOrganisationSchema: {},
  toCreateSubOrganisationInput: (values: {
    name: string;
    displayName: string;
    description: string;
    isActive: boolean;
  }, parentId: string) => ({
    name: values.name.trim(),
    displayName: values.displayName.trim(),
    description: values.description.trim().length === 0 ? null : values.description.trim(),
    parentId,
  }),
  toUpdateSubOrganisationInput: (values: {
    displayName: string;
    description: string;
    isActive: boolean;
  }) => ({
    displayName: values.displayName.trim(),
    description: values.description.trim().length === 0 ? null : values.description.trim(),
    isActive: values.isActive,
  }),
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildSubOrganisationsPageComponentsMock } = await import('@/test-utils/subOrganisationsPageMocks');
  return buildSubOrganisationsPageComponentsMock(toastMock, () => ({
    isValid: mockIsValid,
    isSubmitted: mockIsSubmitted,
    errors: mockErrors,
  }));
});

function buildDataState() {
  return {
    subOrganisations: [
      {
        id: 'org-child-1',
        name: 'scouts-north',
        displayName: 'Scouts North',
        description: 'District',
        isActive: true,
        parentId: 'org-1',
      },
    ],
    isLoading: false,
    loadErrorMessage: null,
    refetchSubOrganisations: vi.fn(),
    createSubOrganisation: createSubOrganisationMock,
    updateSubOrganisation: updateSubOrganisationMock,
    createPending: false,
    updatePending: false,
  };
}

function renderPage() {
  return render(<SubOrganisationsPage />);
}

describe('SubOrganisationsPage', () => {
  beforeEach(() => {
    cleanup();
    selectedOrganisation = { id: 'org-1', display_name: 'Parent Org' };
    canCreate = true;
    canUpdate = true;
    mockIsValid = true;
    mockIsSubmitted = false;
    mockErrors = {};
    toastMock.mockReset();
    createSubOrganisationMock.mockReset();
    updateSubOrganisationMock.mockReset();
    useSubOrganisationsDataMock.mockReturnValue(buildDataState());
  });

  it('hides create button when user lacks create permission', () => {
    canCreate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'New sub-organisation' })).toBeNull();
  });

  it('hides row edit action when user lacks update permission', () => {
    canUpdate = false;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows duplicate-name inline error for 23505 without destructive toast', async () => {
    const user = setupUser();
    createSubOrganisationMock.mockRejectedValue({
      code: '23505',
      message: 'duplicate',
      raw: { code: '23505' },
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));
    expect(screen.getByRole('heading', { name: 'Create sub-organisation' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(screen.getAllByText(DUPLICATE_NAME_MESSAGE)).toHaveLength(1);
    });

    expect(
      toastMock.mock.calls.some(
        (call) => (call[0] as { variant?: string })?.variant === 'destructive'
      )
    ).toBe(false);
  });

  it('submits create and update payloads with expected shapes', async () => {
    const user = setupUser();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));
    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(createSubOrganisationMock).toHaveBeenCalled();
    });
    expect(createSubOrganisationMock.mock.calls[0][0]).toEqual({
      name: '',
      displayName: '',
      description: null,
      parentId: 'org-1',
    });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateSubOrganisationMock).toHaveBeenCalled();
    });
    expect(updateSubOrganisationMock.mock.calls[0][0]).toEqual({
      id: 'org-child-1',
      input: {
        displayName: 'Scouts North',
        description: 'District',
        isActive: true,
      },
    });
  });

  it('shows validation alert and blocks submit when invalid', async () => {
    const user = setupUser();
    mockIsValid = false;
    mockIsSubmitted = true;
    mockErrors = { name: { message: 'Internal name is required.' } };

    renderPage();
    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));

    expect(screen.getByText('Please fix the errors below.')).toBeTruthy();
    const submitButton = screen.getByRole('button', { name: 'Create sub-organisation' });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(submitButton);
    expect(createSubOrganisationMock).not.toHaveBeenCalled();
  });

  it('shows destructive toast only for non-23505 save failures', async () => {
    const user = setupUser();
    createSubOrganisationMock.mockRejectedValue(new Error('network down'));

    renderPage();
    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));
    await user.click(screen.getByRole('button', { name: 'Create sub-organisation' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Could not save sub-organisation',
        description: 'network down',
        variant: 'destructive',
      });
    });
  });

  it('disables editable controls while mutation is pending', async () => {
    const user = setupUser();
    useSubOrganisationsDataMock.mockReturnValue({
      ...buildDataState(),
      createPending: true,
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));

    expect((screen.getByPlaceholderText('e.g. scouts-victoria-north') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Create sub-organisation/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes editor and shows default toast when organisation changes', async () => {
    const user = setupUser();
    const rendered = renderPage();

    await user.click(screen.getByRole('button', { name: 'New sub-organisation' }));
    expect(screen.getByRole('heading', { name: 'Create sub-organisation' })).toBeTruthy();

    selectedOrganisation = { id: 'org-2', display_name: 'Parent Org 2' };
    rendered.rerender(<SubOrganisationsPage />);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Create sub-organisation' })).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Editing cancelled — organisation changed.',
      variant: 'default',
    });
  });
});