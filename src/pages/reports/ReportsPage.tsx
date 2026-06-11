import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@solvera/pace-core/components';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { ReportBuilder } from '@solvera/pace-core/reporting';
import type { ReportingExecutionRequest, ReportBuilderHandle } from '@solvera/pace-core/reporting';

import { useTeamReportingAdapters } from '@/hooks/useTeamReportingAdapters';
import { reportsTemplatesPanelQueryKey } from '@/lib/reports/teamReporting.templatesPanel';
import { TeamReportTemplatesTable } from '@/components/reports/TeamReportTemplatesTable';

export function ReportsPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.reports} operation="read" fallback={<AccessDenied />}>
      <ReportsPageOrganisationScope />
    </PagePermissionGuard>
  );
}

/** Remount page state when org changes (TM11 BR-ORG-SWITCH / AC-23). */
function ReportsPageOrganisationScope() {
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationKey = selectedOrganisation?.id ?? 'none';
  return <ReportsPageContent key={organisationKey} />;
}

function ReportsPageContent() {
  usePaceMain({ printTitle: 'Reports' });

  const queryClient = useQueryClient();
  const reportBuilderRef = useRef<ReportBuilderHandle | null>(null);

  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const { user } = useUnifiedAuth();
  const userId = user?.id ?? null;

  const permissions = useResourcePermissions(PAGE_NAMES.reports) as {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canExport: boolean;
    isLoading?: boolean;
  };
  const permissionsLoading = permissions.isLoading === true;
  const canCreateTemplates =
    (permissions.canCreate || permissions.canUpdate) && !permissionsLoading;
  const canDeleteTemplates = permissions.canDelete && !permissionsLoading;

  const { metadataProvider, templateStore, baseExecutionAdapter } = useTeamReportingAdapters(
    organisationId,
    userId,
  );

  const [rowCapReachedByOrgId, setRowCapReachedByOrgId] = useState<Record<string, boolean>>({});

  const truncated =
    organisationId != null ? (rowCapReachedByOrgId[organisationId] ?? false) : false;

  const onTemplatesPersisted = useCallback(async () => {
    reportBuilderRef.current?.reloadTemplatesCatalog();
    if (organisationId != null) {
      await queryClient.invalidateQueries({
        queryKey: reportsTemplatesPanelQueryKey(organisationId),
        exact: true,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['reports'], exact: false });
  }, [organisationId, queryClient]);

  const executionAdapter = useMemo(
    () => ({
      execute: async (request: ReportingExecutionRequest) => {
        const result = await baseExecutionAdapter.execute(request);
        if (organisationId != null && result.ok) {
          setRowCapReachedByOrgId((prev) => ({
            ...prev,
            [organisationId]: result.data.truncated === true,
          }));
        }
        return result;
      },
    }),
    [baseExecutionAdapter, organisationId],
  );

  if (organisationId == null || userId == null) {
    return null;
  }

  return (
    <main className="grid gap-4">
      <section className="grid gap-3">
        <h1>Reports</h1>
      </section>

      {truncated ? (
        <Alert variant="default">
          <AlertTitle>Result truncated</AlertTitle>
          <AlertDescription>
            Result truncated at 10,000 rows. Add filters to narrow results.
          </AlertDescription>
        </Alert>
      ) : null}

      <ReportBuilder
        ref={reportBuilderRef}
        metadataProvider={metadataProvider}
        executionAdapter={executionAdapter}
        templateStore={templateStore ?? undefined}
        currentUserId={userId}
        initialExploreKey="team.participant"
        scopeValue={organisationId}
        availableExploreKeys={['team.participant']}
        visibilityLabels={{
          private: 'Private template',
          shared: 'Event-shared template',
        }}
        visibilityMode="checkbox"
        sortDirectionCompact
        sharedTemplateBadgeLabel="Org-shared"
        deleteTemplateConfirmation={{
          title: 'Delete template?',
          description: (templateName: string) => {
            const displayName = templateName.trim() === '' ? 'Untitled template' : templateName;
            return `This permanently deletes the template '${displayName}'. This cannot be undone.`;
          },
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        }}
        reportResultsRbac={{ pageName: PAGE_NAMES.reports }}
        canCreateTemplates={canCreateTemplates}
        canDeleteTemplates={canDeleteTemplates}
        suppressInlineSavedTemplates
        alwaysShowResults
        showTemplateFooterCancel={false}
        onTemplatesPersisted={onTemplatesPersisted}
      />

      {templateStore != null ? (
        <TeamReportTemplatesTable
          organisationId={organisationId}
          currentUserId={userId}
          reportBuilderRef={reportBuilderRef}
          templateStore={templateStore}
          canDeleteTemplates={canDeleteTemplates}
          deleteDescription={(templateDisplayName: string) => {
            const displayName =
              templateDisplayName.trim() === '' ? 'Untitled template' : templateDisplayName.trim();
            return `This permanently deletes the template '${displayName}'. This cannot be undone.`;
          }}
          onCatalogChanged={onTemplatesPersisted}
        />
      ) : null}
    </main>
  );
}
