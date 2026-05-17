import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommDraft, CommScheduleCompletePayload, CommSendResult, RecipientPoolDescriptor } from '@solvera/pace-core/comms';
import { CommComposer, useCommDraft, useCommSendAdapter } from '@solvera/pace-core/comms';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useCan } from '@solvera/pace-core/rbac';
import { useActiveOrganisationMembershipTypes } from '@/hooks/useActiveOrganisationMembershipTypes';
import { usePumpEffectiveSenderIdentity } from '@/hooks/usePumpEffectiveSenderIdentity';
import {
  buildManualPickPayload,
  getManualPickStorageKey,
  readManualPickPayload,
} from '@/lib/members/memberDirectory.picker';
import { buildPostSendDraftReset } from '@/pages/communications/communicationsDraftReset';

type RecipientMode = 'org_members' | 'manual';

function appendSendOutcomeDescription(result: CommSendResult): string | undefined {
  const fragments: string[] = [];
  if (result.suppression_skipped > 0) {
    fragments.push(`${result.suppression_skipped} skipped (suppression).`);
  }
  if (result.warnings.length > 0) {
    fragments.push('Some recipients had unresolved tokens; check delivery in PUMP.');
  }
  if (fragments.length === 0) {
    return undefined;
  }
  return fragments.join(' ');
}

function formatScheduledDatetimeForToast(scheduledAtIso: string): string {
  const d = new Date(scheduledAtIso);
  if (Number.isNaN(d.getTime())) {
    return scheduledAtIso;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

function readManualPickInitialState(organisationId: string): {
  recipientMode: RecipientMode;
  manualMemberIds: string[];
} {
  if (typeof window === 'undefined') {
    return { recipientMode: 'org_members', manualMemberIds: [] };
  }

  const key = getManualPickStorageKey();
  const raw = window.sessionStorage.getItem(key);
  if (raw == null) {
    return { recipientMode: 'org_members', manualMemberIds: [] };
  }

  window.sessionStorage.removeItem(key);
  const ids = readManualPickPayload(raw, organisationId);
  if (ids.length > 0) {
    return { recipientMode: 'manual', manualMemberIds: ids };
  }

  return { recipientMode: 'org_members', manualMemberIds: [] };
}

function buildOrgMembersPool(
  organisationId: string,
  memberTypeStringIds: string[],
  includeInactive: boolean
): RecipientPoolDescriptor {
  const filters: {
    member_type_ids?: string[];
    include_inactive?: boolean;
  } = {};

  if (memberTypeStringIds.length > 0) {
    filters.member_type_ids = [...memberTypeStringIds];
  }
  if (includeInactive) {
    filters.include_inactive = true;
  }

  const hasFilters = Object.keys(filters).length > 0;

  return {
    type: 'org_members',
    organisation_id: organisationId,
    ...(hasFilters ? { filters } : {}),
  };
}

interface CommunicationsPageInnerProps {
  organisationId: string;
}

function CommunicationsPageInner({ organisationId }: CommunicationsPageInnerProps) {
  usePaceMain({ printTitle: 'Communications' });

  const navigate = useNavigate();

  const [handoff] = useState(() => readManualPickInitialState(organisationId));
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(() => handoff.recipientMode);
  const [manualMemberIds] = useState<string[]>(() => [...handoff.manualMemberIds]);
  const [selectedMembershipTypeIds, setSelectedMembershipTypeIds] = useState<Set<number>>(() => new Set());
  const [includeInactiveMembers, setIncludeInactiveMembers] = useState(false);

  const senderIdentitySeededRef = useRef(false);

  const { memberTypes } = useActiveOrganisationMembershipTypes(organisationId);

  const scopeArgs = { organisationId };
  const composeCheck = useCan('create:page.CommsLog', scopeArgs);
  const sendCheck = useCan('update:page.CommsLog', scopeArgs);
  const scheduleCheck = useCan('update:page.CommsLog', scopeArgs);

  const rbacBusy =
    composeCheck.isLoading ||
    sendCheck.isLoading ||
    scheduleCheck.isLoading;

  const senderIdentityQuery = usePumpEffectiveSenderIdentity(organisationId);

  const { draft, updateDraft, setDraft } = useCommDraft({
    channel: 'email',
    body_text: '',
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    reply_to: '',
  });

  const adapter = useCommSendAdapter({ organisationId, sourceApp: 'team' });

  const rbac = useMemo(
    () =>
      ({
        canCompose: !rbacBusy && composeCheck.can,
        canSend: !rbacBusy && sendCheck.can,
        canSchedule: !rbacBusy && scheduleCheck.can,
        scopeType: 'organisation' as const,
        scopeId: organisationId,
      }),
    [composeCheck.can, rbacBusy, scheduleCheck.can, organisationId, sendCheck.can]
  );

  useEffect(() => {
    if (!senderIdentityQuery.isError) {
      return;
    }
    toast({
      title: 'Could not resolve sender identity. Set the sender details before sending.',
      variant: 'destructive',
    });
  }, [senderIdentityQuery.isError]);

  useEffect(() => {
    const row = senderIdentityQuery.data;
    if (row == null || senderIdentitySeededRef.current || !senderIdentityQuery.isSuccess) {
      return;
    }
    senderIdentitySeededRef.current = true;
    updateDraft({
      sender_name: row.senderName ?? '',
      sender_email: row.fromAddress ?? '',
      reply_to: row.replyToAddress ?? '',
      sender_phone: row.senderPhone ?? '',
    });
  }, [senderIdentityQuery.data, senderIdentityQuery.isSuccess, updateDraft]);

  const memberTypeIdsForPool = useMemo(
    () => [...selectedMembershipTypeIds].sort((left, right) => left - right).map(String),
    [selectedMembershipTypeIds]
  );

  const recipientPool = useMemo((): RecipientPoolDescriptor => {
    if (recipientMode === 'manual') {
      return { type: 'manual', member_ids: [...manualMemberIds] };
    }
    return buildOrgMembersPool(organisationId, memberTypeIdsForPool, includeInactiveMembers);
  }, [
    recipientMode,
    organisationId,
    manualMemberIds,
    memberTypeIdsForPool,
    includeInactiveMembers,
  ]);

  const toggleMembershipType = useCallback((id: number) => {
    setSelectedMembershipTypeIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const navigateToManualPicker = useCallback(() => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(
      key,
      JSON.stringify(buildManualPickPayload(organisationId, manualMemberIds))
    );
    void navigate('/members', { state: { intent: 'commsManualPick' } });
  }, [organisationId, manualMemberIds, navigate]);

  const onDraftChange = useCallback(
    (nextDraft: CommDraft) => {
      setDraft(nextDraft);
    },
    [setDraft]
  );

  const onSendComplete = useCallback(
    (result: CommSendResult) => {
      const title = `Message sent to ${result.total_recipients} recipients.`;
      const description = appendSendOutcomeDescription(result);
      toast({
        title,
        ...(description !== undefined ? { description } : {}),
        variant: 'success',
      });
      setDraft((previous) => ({ ...previous, ...buildPostSendDraftReset(previous) }));
    },
    [setDraft]
  );

  const onSendError = useCallback((message: string) => {
    toast({ title: message, variant: 'destructive' });
  }, []);

  const onScheduleComplete = useCallback(
    (payload: CommScheduleCompletePayload) => {
      const when = formatScheduledDatetimeForToast(payload.scheduledAtIso);
      toast({
        title: `Message scheduled for ${when}.`,
        variant: 'success',
      });
      setDraft((previous) => ({ ...previous, ...buildPostSendDraftReset(previous) }));
    },
    [setDraft]
  );

  const onCancel = useCallback(() => {
    void navigate('/');
  }, [navigate]);

  const manualRecipientCount = manualMemberIds.length;
  const recipientModeRadiosDisabled = rbacBusy;

  const showComposerLoading = rbacBusy || senderIdentityQuery.isPending;

  return (
    <main className="grid gap-4 pb-28">
      <h1>Communications</h1>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <fieldset className="grid gap-4">
            <legend className="sr-only">Recipient mode</legend>
            <section className="grid grid-flow-col auto-cols-max items-center gap-4">
              <Label htmlFor="comms-recipient-org">
                {/* eslint-disable-next-line pace-core-compliance/prefer-pace-core-components -- pace-core Input always binds string `value`; radios require `checked`. */}
                <input
                  aria-label="All organisation members"
                  checked={recipientMode === 'org_members'}
                  disabled={recipientModeRadiosDisabled}
                  id="comms-recipient-org"
                  name="recipient-mode"
                  onChange={() => setRecipientMode('org_members')}
                  type="radio"
                />
                All organisation members
              </Label>
              <Label htmlFor="comms-recipient-manual">
                {/* eslint-disable-next-line pace-core-compliance/prefer-pace-core-components -- pace-core Input always binds string `value`; radios require `checked`. */}
                <input
                  aria-label="Specific members"
                  checked={recipientMode === 'manual'}
                  disabled={recipientModeRadiosDisabled}
                  id="comms-recipient-manual"
                  name="recipient-mode"
                  onChange={() => setRecipientMode('manual')}
                  type="radio"
                />
                Specific members
              </Label>
            </section>
          </fieldset>

          {recipientMode === 'org_members' && (
            <>
              <p>Send to filtered organisation membership</p>
              {memberTypes.length > 0 && (
                <section className="grid gap-2">
                  <p>Membership types</p>
                  <nav aria-label="Membership type filters" className="grid gap-2">
                    <ul className="grid grid-flow-col auto-cols-max gap-2">
                      {memberTypes.map((membershipType) => {
                        const isSelected = selectedMembershipTypeIds.has(membershipType.id);
                        return (
                          <li key={membershipType.id}>
                            <Button
                              aria-pressed={isSelected}
                              onClick={() => toggleMembershipType(membershipType.id)}
                              title={membershipType.name ?? undefined}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                            >
                              {membershipType.name ?? `Type ${membershipType.id}`}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </section>
              )}
              <Label htmlFor="comms-include-inactive">
                <Checkbox
                  aria-label="Include inactive members"
                  checked={includeInactiveMembers}
                  disabled={recipientModeRadiosDisabled}
                  id="comms-include-inactive"
                  onChange={(checked) => setIncludeInactiveMembers(checked)}
                />
                Include inactive members
              </Label>
            </>
          )}

          {recipientMode === 'manual' && manualRecipientCount === 0 && (
            <section className="grid gap-2">
              <p>Pick members from the directory</p>
              <Button onClick={() => navigateToManualPicker()} type="button">
                Choose members…
              </Button>
            </section>
          )}
        </CardContent>
        {recipientMode === 'manual' && manualRecipientCount > 0 && (
          <CardFooter className="grid grid-flow-col auto-cols-max items-center gap-3">
            <Badge variant="outline-sec-normal">{`${manualRecipientCount} members selected`}</Badge>
            <Button onClick={() => navigateToManualPicker()} type="button" variant="outline">
              Choose again
            </Button>
          </CardFooter>
        )}
      </Card>

      {showComposerLoading ? (
        <section className="grid place-items-center py-16">
          <LoadingSpinner aria-label="Loading communications composer" />
        </section>
      ) : (
        <CommComposer
          adapter={adapter}
          blockSendOnUnresolvedTokens
          draft={draft}
          onDraftChange={onDraftChange}
          onCancel={onCancel}
          onScheduleComplete={onScheduleComplete}
          onSendComplete={onSendComplete}
          onSendError={onSendError}
          organisationId={organisationId}
          rbac={rbac}
          recipientPool={recipientPool}
          sourceApp="team"
        />
      )}
    </main>
  );
}

export function CommunicationsPage() {
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const previousOrganisationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const next = organisationId ?? undefined;
    if (previousOrganisationIdRef.current === undefined) {
      previousOrganisationIdRef.current = next;
      return;
    }
    if (previousOrganisationIdRef.current === next) {
      return;
    }
    previousOrganisationIdRef.current = next;
    toast({
      title: 'Manual recipients cleared — organisation changed.',
      variant: 'default',
      duration: 5000,
    });
  }, [organisationId]);

  if (organisationId == null) {
    return null;
  }

  return (
    <PagePermissionGuard pageName="CommsLog" operation="read" fallback={<AccessDenied />}>
      <CommunicationsPageInner key={organisationId} organisationId={organisationId} />
    </PagePermissionGuard>
  );
}
