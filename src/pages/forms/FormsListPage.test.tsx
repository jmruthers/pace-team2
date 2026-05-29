// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { setupUser } from '@test-utils';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgFormsTableRow } from '@/lib/forms/orgForms.types';

import type { OrgFormsResponseCountOutcome } from '@/hooks/useOrgFormsData';

import { FormsListPage } from './FormsListPage';

const toastMock = vi.hoisted(() => vi.fn());
const navigateSpy = vi.hoisted(() => vi.fn());

let canCreate = true;
let canUpdate = true;
let canDelete = true;
let formsPageReadAllowed = true;

function buildFixtureRow(): OrgFormsTableRow {
  return {
    id: 'form-uuid-aa',
    name: 'Signup',
    slug: 'signup-draft',
    workflow_type: 'org_signup',
    status: 'draft',
    is_active: false,
    is_primary_entrypoint: false,
    updated_at: '2026-01-15T10:05:12.000Z',
    workflowTypeLabel: 'Org signup',
    statusLabelTitleCase: 'Draft',
    primarySortRank: 100,
  };
}

let fetchResponseCountFn = vi.fn(async (formId: string): Promise<OrgFormsResponseCountOutcome> => {
  void formId;
  return { ok: true, count: 0 };
});
const deleteFormAsyncMock = vi.fn(async () => ({}));

const useOrgFormsDataMock = vi.fn();

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

const orgHarness = vi.hoisted(() => ({
  organisation: { id: 'org-1', display_name: 'Org One', name: 'Org One' },
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation: orgHarness.organisation,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  AccessDenied: ({ message }: { message?: string }) => (
    <p data-testid="access-denied">{message ?? 'Denied'}</p>
  ),
  PagePermissionGuard: ({
    children,
    fallback,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
  }) => (formsPageReadAllowed ? <>{children}</> : <>{fallback}</>),
  useResourcePermissions: () => ({
    canRead: true,
    canCreate,
    canUpdate,
    canDelete,
    isLoading: false,
  }),
}));

vi.mock('@solvera/pace-core/utils', () => ({
  HandleSupabaseError: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unknown error',
  }),
}));

vi.mock('@/hooks/useOrgFormsData', () => ({
  useOrgFormsData: (...args: unknown[]) => useOrgFormsDataMock(...args),
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildOrgFormsListPageComponentsMock } = await import('@/test-utils/orgFormsListPageMocks');
  return buildOrgFormsListPageComponentsMock(toastMock);
});

function injectDataState(row: OrgFormsTableRow) {
  useOrgFormsDataMock.mockImplementation(() => ({
    tableRows: [row],
    rawCount: 1,
    isLoading: false,
    loadErrorMessage: null,
    refetchFormsList: vi.fn(),
    fetchFormDetail: vi.fn(),
    fetchResponseCount: (formId: string) => fetchResponseCountFn(formId),
    createFormAsync: vi.fn(),
    createPending: false,
    updateFormAsync: vi.fn(),
    updatePending: false,
    deleteFormAsync: deleteFormAsyncMock,
    deletePending: false,
    queryClient: {},
  }));
}

function formsHarnessUi() {
  return (
    <MemoryRouter initialEntries={['/forms']}>
      <Routes>
        <Route path="/forms" element={<FormsListPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderFlat() {
  return render(formsHarnessUi());
}

describe('FormsListPage', () => {
  beforeEach(() => {
    canCreate = true;
    canUpdate = true;
    canDelete = true;
    formsPageReadAllowed = true;
    navigateSpy.mockReset();
    toastMock.mockReset();
    deleteFormAsyncMock.mockReset().mockResolvedValue({});
    orgHarness.organisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 0 }));
    injectDataState(buildFixtureRow());
    vi.stubEnv('VITE_FORM_PORTAL_URL', 'https://portal.example');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders AccessDenied when read permission is denied', () => {
    formsPageReadAllowed = false;
    renderFlat();
    expect(screen.getByTestId('access-denied').textContent).toContain(
      'You do not have permission to view this page.',
    );
  });

  it('renders error alert with Retry when list query fails and Retry refetches', async () => {
    const user = setupUser();
    const refetchFormsList = vi.fn();
    useOrgFormsDataMock.mockImplementation(() => ({
      tableRows: [],
      rawCount: 0,
      isLoading: false,
      loadErrorMessage: 'connection lost',
      refetchFormsList,
      fetchFormDetail: vi.fn(),
      fetchResponseCount: vi.fn(async () => ({ ok: true as const, count: 0 })),
      createFormAsync: vi.fn(),
      createPending: false,
      updateFormAsync: vi.fn(),
      updatePending: false,
      deleteFormAsync: deleteFormAsyncMock,
      deletePending: false,
      queryClient: {},
    }));
    renderFlat();
    expect(screen.getByRole('heading', { name: /Could not load forms/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetchFormsList).toHaveBeenCalledTimes(1);
  });

  it('does not delete when user cancels destructive dialog', async () => {
    const user = setupUser();
    orgHarness.organisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 0 }));
    renderFlat();
    await user.click(screen.getByTestId('forms-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-root')).toBeTruthy();
    });
    await user.click(screen.getByTestId('confirm-delete-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-delete-root')).toBeNull();
    });
    expect(deleteFormAsyncMock).not.toHaveBeenCalled();
  });

  it('closes destructive dialog on Escape without delete', async () => {
    const user = setupUser();
    orgHarness.organisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 0 }));
    renderFlat();
    await user.click(screen.getByTestId('forms-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-root')).toBeTruthy();
    });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-delete-root')).toBeNull();
    });
    expect(deleteFormAsyncMock).not.toHaveBeenCalled();
  });

  it('shows Create form in header only when canCreate', () => {
    canCreate = false;
    renderFlat();
    expect(screen.queryByRole('button', { name: /Create form/i })).toBeNull();
    cleanup();
    canCreate = true;
    injectDataState(buildFixtureRow());
    renderFlat();
    expect(screen.getByRole('button', { name: /Create form/i })).toBeTruthy();
  });

  it('routes Create form to /forms/new', async () => {
    const user = setupUser();
    renderFlat();
    await user.click(screen.getByRole('button', { name: /Create form/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/forms/new');
  });

  it('omits Edit/Delete actions when rbac disallows updates or deletes but keeps Copy and Open', () => {
    canUpdate = false;
    canDelete = false;
    renderFlat();
    expect(screen.queryByTestId('forms-edit')).toBeNull();
    expect(screen.queryByTestId('forms-delete')).toBeNull();
    expect(screen.getByTestId('forms-copy-url')).toBeTruthy();
    expect(screen.getByTestId('forms-open-portal')).toBeTruthy();
  });

  it('toasts destructive when portal URL is unset and Copy URL runs', async () => {
    const user = setupUser();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FORM_PORTAL_URL', '');
    renderFlat();
    await user.click(screen.getByTestId('forms-copy-url'));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      }),
    );
  });

  it('opens confirmation dialog when deleting with zero responses and calls delete mutation', async () => {
    const user = setupUser();
    orgHarness.organisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 0 }));
    renderFlat();

    await user.click(screen.getByTestId('forms-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-root')).toBeTruthy();
    });

    await user.click(screen.getByTestId('confirm-delete-submit'));

    await waitFor(() => {
      expect(deleteFormAsyncMock).toHaveBeenCalledWith({ formId: 'form-uuid-aa' });
    });
  });

  it('toasts success with form name when delete confirms', async () => {
    const user = setupUser();
    orgHarness.organisation = { id: 'org-1', display_name: 'Org One', name: 'Org One' };
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 0 }));
    renderFlat();
    await user.click(screen.getByTestId('forms-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-root')).toBeTruthy();
    });
    await user.click(screen.getByTestId('confirm-delete-submit'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Signup deleted.', variant: 'success' }),
      );
    });
  });

  it('shows blocked dialog when responses exist', async () => {
    const user = setupUser();
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 3 }));
    renderFlat();

    await user.click(screen.getByTestId('forms-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('blocked-dialog')).toBeTruthy();
      expect(screen.getByText(/3 submitted response\(s\) reference this form/i)).toBeTruthy();
    });
  });

  it('closes blocked delete dialog when organisation context switches (F-59)', async () => {
    const user = setupUser();
    fetchResponseCountFn = vi.fn(async () => ({ ok: true as const, count: 3 }));
    const view = renderFlat();

    await user.click(screen.getByTestId('forms-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('blocked-dialog')).toBeTruthy();
    });

    orgHarness.organisation = { id: 'org-2', display_name: 'Org Two', name: 'Org Two' };
    view.rerender(formsHarnessUi());

    await waitFor(() => {
      expect(screen.queryByTestId('blocked-dialog')).toBeNull();
    });
  });

  it('toasts destructive when response-count lookup fails before delete (F-17)', async () => {
    const user = setupUser();
    fetchResponseCountFn = vi.fn(async (): Promise<OrgFormsResponseCountOutcome> => ({
      ok: false as const,
      error: new Error('count query failed'),
    }));
    renderFlat();

    await user.click(screen.getByTestId('forms-delete'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: expect.stringMatching(/Could not check responses:/),
        }),
      );
    });
  });

  it('closes delete confirmation after failed DELETE mutation (F-19)', async () => {
    const user = setupUser();
    deleteFormAsyncMock.mockRejectedValueOnce(new Error('RLS deny'));
    renderFlat();

    await user.click(screen.getByTestId('forms-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-root')).toBeTruthy();
    });
    await user.click(screen.getByTestId('confirm-delete-submit'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-delete-root')).toBeNull();
    });
  });

  it('copies portal URL when env is configured and shows success toast (AC-18)', async () => {
    const user = setupUser();
    const writeText = vi.fn(async () => undefined);
    const prevDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    try {
      renderFlat();

      await user.click(screen.getByTestId('forms-copy-url'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('https://portal.example/forms/signup-draft');
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Share URL copied to clipboard.', variant: 'success' }),
        );
      });
    } finally {
      if (prevDesc !== undefined) {
        Object.defineProperty(navigator, 'clipboard', prevDesc);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });
});