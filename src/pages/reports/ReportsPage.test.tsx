// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSuccessResult } from '@solvera/pace-core/types';

import { ReportsPage } from './ReportsPage';

const reportBuilderCalls = vi.hoisted(() => [] as Record<string, unknown>[]);

let mockExecuteResult = createSuccessResult({ rows: [] as Record<string, unknown>[], totalCount: 0 });

let canCreate = true;
let canUpdate = true;
let canDelete = true;

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
  useUnifiedAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation: { id: 'org-1', display_name: 'Org One', name: 'Org One' },
  }),
}));

function createSecureSupabaseMock() {
  const templatesSelectResolve = vi.fn(async () => ({
    data: [] as Record<string, unknown>[],
    error: null as unknown,
  }));
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'core_report_template') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: templatesSelectResolve,
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }),
  };
  return client;
}

const secureSupabaseMock = vi.hoisted(() => ({ current: createSecureSupabaseMock() }));

vi.mock('@solvera/pace-core/rbac', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/rbac')>();
  return {
    ...actual,
    useResourcePermissions: () => ({
      canRead: true,
      canCreate,
      canUpdate,
      canDelete,
      canExport: true,
      isLoading: false,
    }),
    useSecureSupabase: () => secureSupabaseMock.current,
  };
});

vi.mock('@solvera/pace-core/components', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/components')>();
  return {
    ...actual,
    /** Avoid DataTable's live RBAC wiring in shallow page smoke tests */
    DataTable: function ReportsPageTestMockDataTable(props: { description?: unknown }) {
      return <p data-testid="reports-templates-table-desc">{String(props.description ?? '')}</p>;
    },
  };
});

vi.mock('@/hooks/useTeamReportingAdapters', () => ({
  useTeamReportingAdapters: () => ({
    metadataProvider: { getFields: async () => [] },
    templateStore: {
      listTemplates: async () => [],
      saveTemplate: async () => {
        throw new Error('unused');
      },
      loadTemplate: async () => null,
      deleteTemplate: async () => undefined,
    },
    baseExecutionAdapter: {
      execute: async () => mockExecuteResult,
    },
  }),
}));

vi.mock('@solvera/pace-core/reporting', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/reporting')>();
  const MockReportBuilder = forwardRef<
    Record<string, unknown>,
    Record<string, unknown>
  >(function MockReportBuilder(props: Record<string, unknown>, forwardedRef) {
    reportBuilderCalls.push(props);
    useImperativeHandle(forwardedRef, () => ({
      reloadTemplatesCatalog: vi.fn(),
      loadTemplateById: vi.fn(),
      loadTemplateAndRun: vi.fn(),
      notifyTemplateDeleted: vi.fn(),
      openDeleteDialogForActiveTemplate: vi.fn(),
    }));
    return <div data-testid="report-builder-mock" />;
  });
  return {
    ...actual,
    ReportBuilder: MockReportBuilder,
  };
});

function renderReportsRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsPage', () => {
  afterEach(() => {
    cleanup();
    reportBuilderCalls.length = 0;
    mockExecuteResult = createSuccessResult({ rows: [], totalCount: 0 });
    canCreate = true;
    canUpdate = true;
    canDelete = true;
    secureSupabaseMock.current = createSecureSupabaseMock();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes deleteTemplateConfirmation copy per TM11', () => {
    renderReportsRoute();
    const props = reportBuilderCalls[0] as {
      deleteTemplateConfirmation?: { description?: (name: string) => string };
    };
    expect(props?.deleteTemplateConfirmation?.description?.('My report')).toBe(
      "This permanently deletes the template 'My report'. This cannot be undone.",
    );
    expect(props?.deleteTemplateConfirmation?.description?.('')).toContain('Untitled template');
  });

  it('sets canCreateTemplates from create or update permission', () => {
    canCreate = false;
    canUpdate = false;
    renderReportsRoute();
    const props = reportBuilderCalls[0] as { canCreateTemplates?: boolean };
    expect(props.canCreateTemplates).toBe(false);
  });

  it('passes canDeleteTemplates from report delete permission', () => {
    canDelete = false;
    renderReportsRoute();
    const props = reportBuilderCalls[0] as { canDeleteTemplates?: boolean };
    expect(props.canDeleteTemplates).toBe(false);
  });

  it('suppresses inline saved templates list and keeps results visible', () => {
    renderReportsRoute();
    const props = reportBuilderCalls[0] as {
      suppressInlineSavedTemplates?: boolean;
      alwaysShowResults?: boolean;
    };
    expect(props.suppressInlineSavedTemplates).toBe(true);
    expect(props.alwaysShowResults).toBe(true);
  });

  it('renders TEAM templates DataTable panel', async () => {
    renderReportsRoute();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Templates' })).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('reports-templates-table-desc').textContent ?? '').toContain('0 templates');
    });
  });

  it('shows truncation banner when execution returns truncated flag', async () => {
    mockExecuteResult = createSuccessResult({
      rows: Array.from({ length: 10_000 }, () => ({ 'core_member.id': 'm1' })),
      totalCount: 10_000,
      truncated: true,
    });
    renderReportsRoute();
    const props = reportBuilderCalls[0] as {
      executionAdapter?: { execute: (req: unknown) => Promise<unknown> };
    };
    await props.executionAdapter?.execute({ plan: {} });

    await waitFor(() => {
      expect(screen.getByText('Result truncated')).toBeTruthy();
    });
    expect(screen.getByText(/10,000 rows/).textContent).toContain('10,000');
  });
});
