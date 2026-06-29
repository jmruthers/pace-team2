import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommDraft, CommRbacContext, CommScheduleCompletePayload, CommSendResult, RecipientPoolDescriptor } from '@solvera/pace-core/comms';
import { CommComposer, useCommDraft, useCommSendAdapter, useResolvedPool } from '@solvera/pace-core/comms';
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
  PageHeader,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { useCommsLogRbac } from '@/hooks/useCommsLogRbac';
import { useActiveOrganisationMembershipTypes } from '@/hooks/useActiveOrganisationMembershipTypes';
import { usePumpEffectiveSenderIdentity } from '@/hooks/usePumpEffectiveSenderIdentity';
import { readManualPickInitialState, type CommsRecipientMode } from '@/lib/communications/commsManualPick';
import { buildOrgMembersPool } from '@/lib/communications/commsRecipientPool';
import { appendSendOutcomeDescription } from '@/lib/communications/communicationsSendOutcome';
import {
  createTeamCommSendAdapter,
  ZERO_RECIPIENT_MESSAGE,
} from '@/lib/communications/teamCommSendAdapter';
import {
  buildManualPickPayload,
  getManualPickStorageKey,
} from '@/lib/members/memberDirectory.picker';
import { buildPostSendDraftReset } from '@/pages/communications/communicationsDraftReset';

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

interface CommunicationsPageInnerProps {
  organisationId: string;
}

function CommunicationsPageInner({ organisationId }: CommunicationsPageInnerProps) {
  usePaceMain({ printTitle: 'Communications' });

  const navigate = useNavigate();

  const [handoff] = useState(() => readManualPickInitialState(organisationId));
  const [recipientMode, setRecipientMode] = useState<CommsRecipientMode>(() => handoff.recipientMode);
  const [manualMemberIds] = useState<string[]>(() => [...handoff.manualMemberIds]);
  const [selectedMembershipTypeIds, setSelectedMembershipTypeIds] = useState<Set<number>>(() => new Set());
  const [includeInactiveMembers, setIncludeInactiveMembers] = useState(false);

  const senderIdentitySeededRef = useRef(false);
  const rbacErrorToastedRef = useRef(false);

  const { memberTypes } = useActiveOrganisationMembershipTypes(organisationId);

  const commsRbac = useCommsLogRbac(organisationId);

  const senderIdentityQuery = usePumpEffectiveSenderIdentity(organisationId);

  const { draft, updateDraft, setDraft } = useCommDraft({
    channel: 'email',
    body_text: '',
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    reply_to: '',
  });

  const baseAdapter = useCommSendAdapter({ organisationId, sourceApp: 'team' });

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

  const resolvedPool = useResolvedPool({
    adapter: baseAdapter,
    recipientPool,
    organisationId,
    channel: draft.channel,
  });

  const estimatedRecipientCount =
    resolvedPool.preview != null && !resolvedPool.isLoading
      ? resolvedPool.preview.estimated_count
      : null;

  const adapter = useMemo(
    () =>
      createTeamCommSendAdapter(baseAdapter, {
        getEstimatedRecipientCount: () => estimatedRecipientCount,
        onZeroRecipientBlocked: () => {
          toast({ title: ZERO_RECIPIENT_MESSAGE, variant: 'destructive' });
        },
        onSendTestSuccess: () => {
          toast({ title: 'Test message sent.', variant: 'success' });
        },
      }),
    [baseAdapter, estimatedRecipientCount]
  );

  const rbac = useMemo(
    (): CommRbacContext =>
      commsRbac.hasPermissionError
        ? {
            canCompose: false,
            canSend: false,
            canSchedule: false,
            scopeType: 'organisation',
            scopeId: organisationId,
          }
        : {
            canCompose: !commsRbac.isLoading && commsRbac.canCompose,
            canSend: !commsRbac.isLoading && commsRbac.canSend,
            canSchedule: !commsRbac.isLoading && commsRbac.canSchedule,
            scopeType: 'organisation',
            scopeId: organisationId,
          },
    [commsRbac, organisationId]
  );

  useEffect(() => {
    if (!commsRbac.hasPermissionError || rbacErrorToastedRef.current) {
      return;
    }
    rbacErrorToastedRef.current = true;
    toast({
      title: 'Could not load permissions. Refresh to retry.',
      variant: 'destructive',
    });
  }, [commsRbac.hasPermissionError]);

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
  const recipientModeRadiosDisabled = commsRbac.isLoading;
  const showComposerLoading = commsRbac.isLoading || senderIdentityQuery.isPending;
  const showZeroRecipientCopy =
    !resolvedPool.isLoading &&
    resolvedPool.error == null &&
    resolvedPool.preview != null &&
    resolvedPool.preview.estimated_count === 0;

  return (
    <main className="grid gap-4 pb-28">
      <PageHeader
        title="Communications"
        subtitle="Compose and send email or SMS to members in your organisation."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/communications/log')}>
            Send log
          </Button>
        }
      />

      {showComposerLoading ? (
        <section className="grid place-items-center py-16">
          <LoadingSpinner aria-label="Loading communications composer" />
        </section>
      ) : (
        <>
          {showZeroRecipientCopy && <p>{ZERO_RECIPIENT_MESSAGE}</p>}
          <CommComposer
            adapter={adapter}
            blockSendOnUnresolvedTokens
            blockSendWhenPoolEmpty
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
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <fieldset className="grid gap-4">
            <legend className="sr-only">Recipient mode</legend>
            <section
              aria-label="Recipient mode"
              className="grid grid-flow-col auto-cols-max items-center gap-4"
              role="group"
            >
              <Button
                aria-pressed={recipientMode === 'org_members'}
                disabled={recipientModeRadiosDisabled}
                onClick={() => setRecipientMode('org_members')}
                type="button"
                variant={recipientMode === 'org_members' ? 'default' : 'outline'}
              >
                All organisation members
              </Button>
              <Button
                aria-pressed={recipientMode === 'manual'}
                disabled={recipientModeRadiosDisabled}
                onClick={() => setRecipientMode('manual')}
                type="button"
                variant={recipientMode === 'manual' ? 'default' : 'outline'}
              >
                Specific members
              </Button>
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

  return <CommunicationsPageInner key={organisationId} organisationId={organisationId} />;
}
