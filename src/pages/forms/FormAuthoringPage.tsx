import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import type { WorkflowAuthoringState } from '@solvera/pace-core/forms';
import {
  WorkflowFormAuthoringShell,
  defaultWorkflowFieldCatalogueLoader,
  validateWorkflowAuthoringState,
} from '@solvera/pace-core/forms';

import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import { ScheduleLimitsCard } from '@/components/org-forms/ScheduleLimitsCard';
import type { ApiResult } from '@/lib/apiResult';
import { fetchScopedAuthoringDetailSnapshot } from '@/lib/forms/formAuthoringScopedDetail';
import type { OrgFormScheduleLimitsInput } from '@/lib/forms/orgForms.types';
import { createEmptyAuthoringState, defaultScheduleLimits } from '@/lib/forms/orgForms.mappers.authoring';
import { useOrgFormsData } from '@/hooks/useOrgFormsData';

const TEAM_WORKFLOW_TYPES = ['org_signup', 'information_collection', 'consent_capture', 'generic'] as const;

/** Keep org-scoped authoring metadata aligned with the selected workspace (TM09 BR-L). */
function mergeOrganisationContext(
  organisationId: string | null,
  next: WorkflowAuthoringState,
): WorkflowAuthoringState {
  const oid = organisationId ?? next.metadata.organisationId ?? '';
  if (next.metadata.organisationId === oid) {
    return next;
  }
  return {
    ...next,
    metadata: {
      ...next.metadata,
      organisationId: oid,
    },
  };
}

function FormAuthoringPageContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formId } = useParams();

  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const organisationName =
    selectedOrganisation?.display_name ?? selectedOrganisation?.name ?? 'Organisation';

  const isCreate = location.pathname.endsWith('/new');
  const effectiveFormId = formId ?? null;

  const detailEligible = !isCreate && organisationId != null && effectiveFormId != null;

  const permissions = useResourcePermissions(PAGE_NAMES.forms) as {
    canCreate: boolean;
    canUpdate: boolean;
    isLoading?: boolean;
  };
  const rbacLoading = permissions.isLoading === true;
  const canCreate = permissions.canCreate && !rbacLoading;
  const canUpdate = permissions.canUpdate && !rbacLoading;

  const {
    fetchFormDetail,
    createFormAsync,
    updateFormAsync,
    createPending,
    updatePending,
  } = useOrgFormsData(organisationId);

  const lastOrgIdRef = useRef<string | null | undefined>(undefined);
  const switchedOrganisationFlagRef = useRef(false);

  const [state, setState] = useState<WorkflowAuthoringState>(() =>
    createEmptyAuthoringState(organisationId ?? ''),
  );
  const [scheduleLimits, setScheduleLimits] = useState<OrgFormScheduleLimitsInput>(() =>
    defaultScheduleLimits(),
  );
  const [priorFieldIds, setPriorFieldIds] = useState<string[]>([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRetryNonce, setDetailRetryNonce] = useState(0);
  const [detailFetchError, setDetailFetchError] = useState<unknown | null>(null);

  const validation = useMemo(() => validateWorkflowAuthoringState(state), [state]);
  const savePending = createPending || updatePending;

  const shellDisabled = savePending || (isCreate && !canCreate) || (!isCreate && !canUpdate);

  const handleAuthoringStateChange = useCallback(
    (next: WorkflowAuthoringState) => {
      setState(mergeOrganisationContext(organisationId, next));
    },
    [organisationId],
  );

  const heading = useMemo(() => {
    return isCreate ? 'Create form' : state.metadata.name;
  }, [isCreate, state.metadata.name]);

  const subHeading = useMemo(() => {
    return isCreate
      ? `Define an org-scoped form for ${organisationName}.`
      : `Edit form for ${organisationName}.`;
  }, [isCreate, organisationName]);

  const printTitle =
    isCreate
      ? 'Create form'
      : detailEligible && detailLoading
        ? 'Edit form'
        : state.metadata.name || 'Edit form';
  usePaceMain({ printTitle });

  useEffect(() => {
    const next = organisationId ?? null;
    if (lastOrgIdRef.current === undefined) {
      lastOrgIdRef.current = next;
      return;
    }
    if (lastOrgIdRef.current !== next) {
      switchedOrganisationFlagRef.current = true;
      lastOrgIdRef.current = next;
    }
  }, [organisationId]);

  useEffect(() => {
    if (!isCreate || organisationId == null) {
      return;
    }
    const scopeId = organisationId;
    queueMicrotask(() => {
      setState((previous) => mergeOrganisationContext(scopeId, previous));
    });
  }, [organisationId, isCreate]);

  useEffect(() => {
    let cancelled = false;
    const isStale = (): boolean => cancelled;

    async function runDetailHydration(): Promise<ApiResult<void>> {
      await Promise.resolve();
      if (isStale()) {
        return { ok: true, data: undefined };
      }

      if (!detailEligible || effectiveFormId == null) {
        setDetailLoading(false);
        setDetailFetchError(null);
        return { ok: true, data: undefined };
      }

      const switched = switchedOrganisationFlagRef.current;
      switchedOrganisationFlagRef.current = false;

      setDetailLoading(true);
      setDetailFetchError(null);

      const result = await fetchScopedAuthoringDetailSnapshot({
        isStale,
        detailEligible,
        effectiveFormId,
        switchedOrganisation: switched,
        fetchFormDetail,
      });

      if (isStale()) {
        return { ok: true, data: undefined };
      }

      if (result.ok === false) {
        setDetailFetchError(result.error.cause ?? result.error);
        setDetailLoading(false);
        return { ok: false, error: result.error };
      }

      const snapshot = result.data;

      switch (snapshot.kind) {
        case 'abort':
          return { ok: true, data: undefined };

        case 'ineligible':
          setDetailLoading(false);
          setDetailFetchError(null);
          return { ok: true, data: undefined };

        case 'missing': {
          if (snapshot.switchedOrganisation) {
            toast({
              title: `Switched organisations. Showing forms for ${organisationName}.`,
              variant: 'default',
            });
          } else {
            toast({
              title: 'Form not found in this organisation.',
              variant: 'default',
            });
          }
          navigate('/forms');
          setDetailLoading(false);
          return { ok: true, data: undefined };
        }

        case 'ready': {
          const { authoring, priorFieldIds: ids } = snapshot;
          setState(mergeOrganisationContext(organisationId, authoring.state));
          setScheduleLimits({
            maxSubmissionsInput: authoring.scheduleLimits.maxSubmissionsInput,
            confirmationMessage: authoring.scheduleLimits.confirmationMessage,
            isRequired: authoring.scheduleLimits.isRequired,
          });
          setPriorFieldIds(ids);
          setDetailLoading(false);
          return { ok: true, data: undefined };
        }
      }
    }

    void runDetailHydration();

    return () => {
      cancelled = true;
    };
  }, [
    detailEligible,
    fetchFormDetail,
    effectiveFormId,
    organisationId,
    organisationName,
    isCreate,
    navigate,
    detailRetryNonce,
  ]);

  const retryDetail = useCallback(() => {
    setDetailRetryNonce((previous) => previous + 1);
  }, []);

  const handleSave = useCallback(async () => {
    if (!validation.isValid || organisationId == null) {
      return;
    }
    try {
      if (isCreate) {
        const newId = await createFormAsync({
          state: mergeOrganisationContext(organisationId, state),
          scheduleLimits,
        });
        toast({ title: 'Form created.', variant: 'success' });
        navigate(`/forms/${newId}`);
        return;
      }
      if (effectiveFormId == null) {
        return;
      }
      await updateFormAsync({
        formId: effectiveFormId,
        state: mergeOrganisationContext(organisationId, state),
        scheduleLimits,
        priorDbFieldIds: priorFieldIds,
      });
      toast({ title: 'Form saved.', variant: 'success' });

      const { authoring, priorFieldIds: nextIds } = await fetchFormDetail(effectiveFormId);
      if (authoring != null) {
        setState(mergeOrganisationContext(organisationId, authoring.state));
        setScheduleLimits({
          maxSubmissionsInput: authoring.scheduleLimits.maxSubmissionsInput,
          confirmationMessage: authoring.scheduleLimits.confirmationMessage,
          isRequired: authoring.scheduleLimits.isRequired,
        });
        setPriorFieldIds(nextIds);
      }
    } catch (error: unknown) {
      toast({
        title: `Could not save form: ${HandleSupabaseError(error, 'core_forms').message}.`,
        variant: 'destructive',
      });
    }
  }, [
    createFormAsync,
    effectiveFormId,
    fetchFormDetail,
    isCreate,
    navigate,
    organisationId,
    priorFieldIds,
    scheduleLimits,
    state,
    updateFormAsync,
    validation.isValid,
  ]);

  if (detailEligible && detailLoading) {
    return (
      <main className="grid min-h-[50vh] place-items-center" aria-busy="true">
        <LoadingSpinner decorative />
      </main>
    );
  }

  if (detailEligible && detailFetchError != null) {
    return (
      <main className="grid gap-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load form</AlertTitle>
          <AlertDescription>{HandleSupabaseError(detailFetchError, 'core_forms').message}</AlertDescription>
        </Alert>
        <nav aria-label="Retry form load">
          <Button type="button" onClick={retryDetail}>
            Retry
          </Button>
        </nav>
      </main>
    );
  }

  const middleContent = (
    <ScheduleLimitsCard
      disabled={shellDisabled}
      opensAtIso={state.metadata.opensAt ?? null}
      closesAtIso={state.metadata.closesAt ?? null}
      onOpensAtIsoChange={(iso) => {
        setState((previous) =>
          mergeOrganisationContext(organisationId, {
            ...previous,
            metadata: {
              ...previous.metadata,
              opensAt: iso,
            },
          }),
        );
      }}
      onClosesAtIsoChange={(iso) => {
        setState((previous) =>
          mergeOrganisationContext(organisationId, {
            ...previous,
            metadata: {
              ...previous.metadata,
              closesAt: iso,
            },
          }),
        );
      }}
      scheduleLimits={scheduleLimits}
      onScheduleLimitsChange={setScheduleLimits}
    />
  );

  return (
    <main className="grid gap-6">
      <WorkflowFormAuthoringShell
        heading={heading}
        subheading={subHeading}
        state={state}
        onStateChange={handleAuthoringStateChange}
        onSave={handleSave}
        allowedWorkflowTypes={[...TEAM_WORKFLOW_TYPES]}
        middleContent={middleContent}
        eventSlug={null}
        slugReadOnly={!isCreate}
        disabled={shellDisabled}
        fieldCatalogueLoader={defaultWorkflowFieldCatalogueLoader}
      />
    </main>
  );
}

export function FormAuthoringPage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.forms}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <FormAuthoringPageContent />
    </PagePermissionGuard>
  );
}
