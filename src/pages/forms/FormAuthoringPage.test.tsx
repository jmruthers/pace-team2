// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { setupUser } from '@test-utils';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { WorkflowAuthoringState } from '@solvera/pace-core/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CoreFormDetailRaw } from '@/lib/forms/orgForms.types';

import { FormAuthoringPage } from '@/pages/forms/FormAuthoringPage';

const toastMock = vi.hoisted(() => vi.fn());
const navigateSpy = vi.hoisted(() => vi.fn());

let selectedOrganisation: { id: string; display_name: string; name: string } = {
  id: 'org-1',
  display_name: 'Org One',
  name: 'Org One',
};

let canUpdate = true;
let canCreate = true;
let capturedShellDisabled: boolean | undefined;

const authoringTestFlags = vi.hoisted(() => ({
  forceValidAuthoring: false,
}));

const updateFormAsyncMock = vi.fn();
const fetchFormDetailMock = vi.fn();
const createFormAsyncMock = vi.fn();

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

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
    canUpdate,
    canRead: true,
    canCreate,
    isLoading: false,
  }),
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: unknown) => ({
    message:
      error instanceof Error ? error.message : typeof error === 'object' && error != null && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Unknown error',
  }),
}));

const useOrgFormsDataMock = vi.fn();

vi.mock('@/hooks/useOrgFormsData', () => ({
  useOrgFormsData: (...args: unknown[]) => useOrgFormsDataMock(...args),
}));

vi.mock('@solvera/pace-core/forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solvera/pace-core/forms')>();
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  return {
    ...actual,
    validateWorkflowAuthoringState: (state: WorkflowAuthoringState) => {
      if (authoringTestFlags.forceValidAuthoring) {
        return { isValid: true, errors: [], warnings: [] };
      }
      return actual.validateWorkflowAuthoringState(state);
    },
    WorkflowFormAuthoringShell: (props: { disabled?: boolean; onSave?: () => Promise<void> | void }) => {
      capturedShellDisabled = props.disabled;
      return (
        <section data-testid="authoring-shell-mock">
          <MockButton data-testid="shell-save-trigger" onClick={() => void props.onSave?.()}>
            Save
          </MockButton>
        </section>
      );
    },
  };
});

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  return buildPaceCoreComponentsMock(toastMock);
});

function buildValid(orgId: string): WorkflowAuthoringState {
  return {
    metadata: {
      name: 'Signup',
      slug: 'signup-form',
      description: '',
      workflowType: 'org_signup',
      accessMode: 'authenticated_member',
      status: 'draft',
      opensAt: null,
      closesAt: null,
      workflowConfig: {},
      isActive: false,
      organisationId: orgId,
    },
    fields: [
      {
        id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
        fieldKey: 'core_person.email',
        fieldType: 'text',
        sortOrder: 1,
        isActive: true,
        isRequired: true,
      },
    ],
  };
}

const minimalDetailRow = {
  id: 'form-edit-id',
  name: 'Signup',
  slug: 'signup-form',
  organisation_id: 'org-1',
} as unknown as CoreFormDetailRaw;

function wireDefaultFetchByOrgState() {
  fetchFormDetailMock.mockImplementation(async () => {
    if (selectedOrganisation.id !== 'org-1') {
      return {
        authoring: null,
        row: null,
        priorFieldIds: [] as string[],
      };
    }
    return {
      authoring: {
        state: buildValid(selectedOrganisation.id),
        scheduleLimits: { maxSubmissionsInput: '', confirmationMessage: '', isRequired: false, isPrimaryEntrypoint: false },
      },
      row: minimalDetailRow,
      priorFieldIds: ['aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'],
    };
  });
}

function wireDefaultHookMocks() {
  useOrgFormsDataMock.mockImplementation(() => ({
    tableRows: [],
    rawCount: 0,
    isLoading: false,
    loadErrorMessage: null,
    refetchFormsList: vi.fn(),
    fetchFormDetail: (...args: [string]) => fetchFormDetailMock(...args),
    fetchResponseCount: vi.fn(async () => ({ ok: true as const, count: 0 })),
    createFormAsync: createFormAsyncMock,
    createPending: false,
    updateFormAsync: updateFormAsyncMock,
    updatePending: false,
    deleteFormAsync: vi.fn(),
    deletePending: false,
    queryClient: {},
  }));
}

function Harness() {
  return (
    <MemoryRouter initialEntries={['/forms/form-edit-id']}>
      <Routes>
        <Route path="/forms/new" element={<FormAuthoringPage />} />
        <Route path="/forms/:formId" element={<FormAuthoringPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function HarnessNew() {
  return (
    <MemoryRouter initialEntries={['/forms/new']}>
      <Routes>
        <Route path="/forms/new" element={<FormAuthoringPage />} />
        <Route path="/forms/:formId" element={<FormAuthoringPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('FormAuthoringPage', () => {
  beforeEach(() => {
    selectedOrganisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    canUpdate = true;
    canCreate = true;
    authoringTestFlags.forceValidAuthoring = false;
    capturedShellDisabled = undefined;
    navigateSpy.mockReset();
    toastMock.mockReset();
    fetchFormDetailMock.mockReset();
    updateFormAsyncMock.mockReset().mockResolvedValue(undefined);
    createFormAsyncMock.mockReset();

    wireDefaultFetchByOrgState();
    wireDefaultHookMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('disables authoring shell during edit while user cannot update even if authoring is valid', async () => {
    canUpdate = false;
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('authoring-shell-mock')).toBeTruthy();
    });
    expect(capturedShellDisabled).toBe(true);
  });

  it('disables authoring shell on create while user cannot create when authoring is valid', async () => {
    canCreate = false;
    authoringTestFlags.forceValidAuthoring = true;
    render(<HarnessNew />);

    await waitFor(() => {
      expect(screen.getByTestId('authoring-shell-mock')).toBeTruthy();
    });
    expect(capturedShellDisabled).toBe(true);
  });

  it('navigates to list with switched-organisation toast when detail is empty after org change', async () => {
    const view = render(<Harness />);

    await waitFor(() => {
      expect(fetchFormDetailMock).toHaveBeenCalled();
    });

    selectedOrganisation = { id: 'org-2', display_name: 'Org Two', name: 'Org Two' };
    view.rerender(<Harness />);

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/forms');
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Switched organisations'),
        }),
      );
    });
  });

  it('navigates to list with form-not-found toast on first edit load when absent', async () => {
    fetchFormDetailMock.mockImplementation(async () => ({
      authoring: null,
      row: null,
      priorFieldIds: [],
    }));
    render(<Harness />);

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/forms');
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Form not found/i),
        }),
      );
    });
  });

  it('keeps authoring shell enabled when validation fails on create so authors can correct fields', async () => {
    render(<HarnessNew />);

    await waitFor(() => {
      expect(screen.getByTestId('authoring-shell-mock')).toBeTruthy();
    });
    expect(capturedShellDisabled).toBe(false);
  });

  it('silent rehydrates edit page after org switch when detail fetch returns authoring', async () => {
    fetchFormDetailMock.mockImplementation(async () => {
      const oid = selectedOrganisation.id;
      return {
        authoring: {
          state: buildValid(oid),
          scheduleLimits: { maxSubmissionsInput: '', confirmationMessage: '', isRequired: false, isPrimaryEntrypoint: false },
        },
        row: { ...minimalDetailRow, organisation_id: oid },
        priorFieldIds: ['aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'],
      };
    });

    const view = render(<Harness />);

    await waitFor(() => {
      expect(fetchFormDetailMock).toHaveBeenCalled();
    });

    navigateSpy.mockClear();

    selectedOrganisation = { id: 'org-2', display_name: 'Org Two', name: 'Org Two' };
    view.rerender(<Harness />);

    await waitFor(() => expect(fetchFormDetailMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows destructive toast and keeps authoring shell visible when save fails with unique violation', async () => {
    const user = setupUser();
    updateFormAsyncMock.mockRejectedValueOnce({ code: '23505', message: 'Duplicate slug' });

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('authoring-shell-mock')).toBeTruthy();
    });

    await user.click(screen.getByTestId('shell-save-trigger'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
    expect(screen.getByTestId('authoring-shell-mock')).toBeTruthy();
  });
});