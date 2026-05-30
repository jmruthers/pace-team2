// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReportBuilderHandle } from '@solvera/pace-core/reporting';
import { TeamReportTemplatesTable } from './TeamReportTemplatesTable';
import type { ReportsTemplatePanelRow } from '@/lib/reports/teamReporting.templatesPanel';

const toastMock = vi.hoisted(() => vi.fn());
const panelRows: ReportsTemplatePanelRow[] = [
  {
    id: 'tmpl-1',
    nameDisplay: 'My report',
    is_private: true,
    created_by: 'user-1',
    modifiedIso: '2026-01-02T00:00:00Z',
    modifiedLabel: '2 Jan 2026',
    ownerDisplay: 'You',
  },
  {
    id: 'tmpl-2',
    nameDisplay: 'Other report',
    is_private: false,
    created_by: 'user-2',
    modifiedIso: '2026-01-01T00:00:00Z',
    modifiedLabel: '1 Jan 2026',
    ownerDisplay: 'Peer',
  },
];

vi.mock('@/hooks/useTeamReportTemplatesPanel', () => ({
  useTeamReportTemplatesPanelQuery: () => ({
    data: panelRows,
    error: null,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  const { MockButton } = await import('@/test-utils/paceCorePrimitives');
  const base = buildPaceCoreComponentsMock(toastMock);

  return {
    ...base,
    DataTable: function TemplatesTestDataTable({
      data,
      actions,
    }: {
      data: ReportsTemplatePanelRow[];
      actions?: Array<{
        label: string;
        hidden?: (row: ReportsTemplatePanelRow) => boolean;
        onClick: (row: ReportsTemplatePanelRow) => void;
      }>;
    }) {
      return (
        <section data-testid="templates-table">
          {data.map((row) => (
            <article key={row.id}>
              <span>{row.nameDisplay}</span>
              {actions?.map((action) => {
                if (action.hidden?.(row)) {
                  return null;
                }
                return (
                  <MockButton key={action.label} type="button" onClick={() => action.onClick(row)}>
                    {action.label}
                  </MockButton>
                );
              })}
            </article>
          ))}
        </section>
      );
    },
  };
});

describe('TeamReportTemplatesTable (TM11)', () => {
  const deleteTemplate = vi.fn(async () => undefined);
  const notifyTemplateDeleted = vi.fn();
  const reportBuilderRef = createRef<ReportBuilderHandle | null>();

  beforeEach(() => {
    vi.clearAllMocks();
    toastMock.mockReset();
    reportBuilderRef.current = {
      reloadTemplatesCatalog: vi.fn(),
      loadTemplateById: vi.fn(async () => undefined),
      loadTemplateAndRun: vi.fn(async () => undefined),
      openDeleteDialogForActiveTemplate: vi.fn(),
      notifyTemplateDeleted,
    };
  });

  afterEach(() => {
    cleanup();
  });

  function renderTable(canDeleteTemplates: boolean) {
    return render(
      <TeamReportTemplatesTable
        organisationId="org-1"
        currentUserId="user-1"
        reportBuilderRef={reportBuilderRef}
        templateStore={{ deleteTemplate } as never}
        canDeleteTemplates={canDeleteTemplates}
        deleteDescription={(name) => `Delete "${name}"?`}
      />,
    );
  }

  it('TM11 S-19: hides Delete for rows not owned by current user', () => {
    renderTable(true);
    const myRow = screen.getByText('My report').closest('article');
    const otherRow = screen.getByText('Other report').closest('article');

    expect(within(myRow as HTMLElement).queryByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(within(otherRow as HTMLElement).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('TM11 S-19: hides Delete actions when canDeleteTemplates is false', () => {
    renderTable(false);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('TM11 S-10/S-11: confirm delete calls store and shows success toast', async () => {
    const user = setupUser();
    renderTable(true);

    const myRow = screen.getByText('My report').closest('article') as HTMLElement;
    await user.click(within(myRow).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete template?')).toBeTruthy();

    const dialogDelete = screen.getAllByRole('button', { name: 'Delete' }).at(-1);
    expect(dialogDelete).toBeTruthy();
    await user.click(dialogDelete as HTMLElement);

    await waitFor(() => {
      expect(deleteTemplate).toHaveBeenCalledWith('tmpl-1');
    });
    expect(notifyTemplateDeleted).toHaveBeenCalledWith('tmpl-1');
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', description: 'Template deleted.' }),
    );
  });
});
