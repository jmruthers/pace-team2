// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { CommSendAdapter, RecipientPoolDescriptor } from '@solvera/pace-core/comms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildManualPickPayload,
  getManualPickStorageKey,
} from '@/lib/members/memberDirectory.picker';
import { CommunicationsPage } from '@/pages/communications/CommunicationsPage';

const toastSpy = vi.hoisted(() => vi.fn());

let capturedRecipientPool: RecipientPoolDescriptor | undefined;
let capturedBlockSendWhenPoolEmpty: boolean | undefined;
let pagePermissionGuardProps: Record<string, unknown> | undefined;

let selectedOrg: { id: string; display_name: string; name: string } | null = {
  id: 'org-a',
  display_name: 'Org A',
  name: 'Org A',
};

const commsRbacState = vi.hoisted(() => ({
  canCompose: true,
  canSend: true,
  canSchedule: true,
  isLoading: false,
  hasPermissionError: false,
}));

const resolvedPoolState = vi.hoisted(() => ({
  estimated_count: 1,
  isLoading: false,
}));

const baseAdapter = vi.hoisted(() => ({
  resolvePool: vi.fn(async () => ({
    ok: true as const,
    data: { estimated_count: 1, sample_names: [], warnings: [] },
  })),
  loadTemplates: vi.fn(async () => ({ ok: true as const, data: [] })),
  loadMergeFields: vi.fn(async () => ({ ok: true as const, data: [] })),
  send: vi.fn(),
  schedule: vi.fn(),
  sendTest: vi.fn(),
  saveDraft: vi.fn(async (next: unknown) => ({ ok: true as const, data: next })),
}));

let wrappedSend: CommSendAdapter['send'] | undefined;

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation: selectedOrg,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  PagePermissionGuard: (props: {
    children: ReactNode;
    pageName?: string;
    operation?: string;
    appName?: string;
    scope?: unknown;
  }) => {
    pagePermissionGuardProps = props;
    return <>{props.children}</>;
  },
  AccessDenied: () => <article>Denied</article>,
}));

vi.mock('@/hooks/useCommsLogRbac', () => ({
  useCommsLogRbac: () => ({ ...commsRbacState }),
}));

vi.mock('@/hooks/usePumpEffectiveSenderIdentity', () => ({
  usePumpEffectiveSenderIdentity: () => ({
    data: null,
    isSuccess: false,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/useActiveOrganisationMembershipTypes', () => ({
  useActiveOrganisationMembershipTypes: () => ({
    memberTypes: [
      { id: 1, name: 'Junior' },
      { id: 2, name: 'Senior' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@solvera/pace-core/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solvera/pace-core/components')>();
  return {
    ...actual,
    toast: toastSpy,
  };
});

vi.mock('@solvera/pace-core/comms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solvera/pace-core/comms')>();
  const { createTeamCommSendAdapter } = await import('@/lib/communications/teamCommSendAdapter');

  return {
    ...actual,
    CommComposer: (props: {
      recipientPool: RecipientPoolDescriptor;
      blockSendWhenPoolEmpty?: boolean;
      adapter: CommSendAdapter;
    }) => {
      capturedRecipientPool = props.recipientPool;
      capturedBlockSendWhenPoolEmpty = props.blockSendWhenPoolEmpty;
      wrappedSend = props.adapter.send;
      return <aside data-testid="composer-mock">Composer fixture</aside>;
    },
    useCommDraft: () => ({
      draft: {
        channel: 'email' as const,
        body_text: '',
        sender_name: '',
        sender_email: '',
        sender_phone: '',
        reply_to: '',
      },
      updateDraft: vi.fn(),
      setDraft: vi.fn(),
    }),
    useCommSendAdapter: () => baseAdapter,
    useResolvedPool: () => ({
      preview:
        resolvedPoolState.isLoading
          ? null
          : {
              estimated_count: resolvedPoolState.estimated_count,
              sample_names: [],
              warnings: [],
            },
      isLoading: resolvedPoolState.isLoading,
      error: null,
      refetch: vi.fn(),
    }),
    createTeamCommSendAdapter,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CommunicationsPage />
    </MemoryRouter>
  );
}

describe('CommunicationsPage', () => {
  beforeEach(() => {
    capturedRecipientPool = undefined;
    capturedBlockSendWhenPoolEmpty = undefined;
    pagePermissionGuardProps = undefined;
    wrappedSend = undefined;
    selectedOrg = { id: 'org-a', display_name: 'Org A', name: 'Org A' };
    commsRbacState.canCompose = true;
    commsRbacState.canSend = true;
    commsRbacState.canSchedule = true;
    commsRbacState.isLoading = false;
    commsRbacState.hasPermissionError = false;
    resolvedPoolState.estimated_count = 1;
    resolvedPoolState.isLoading = false;
    window.sessionStorage.clear();
    toastSpy.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('wraps content with PagePermissionGuard for CommsLog read without appName or scope', () => {
    renderPage();
    expect(pagePermissionGuardProps?.pageName).toBe('CommsLog');
    expect(pagePermissionGuardProps?.operation).toBe('read');
    expect(pagePermissionGuardProps).not.toHaveProperty('appName');
    expect(pagePermissionGuardProps).not.toHaveProperty('scope');
  });

  it('hydrates manual pick from sessionStorage and clears the key (matching org)', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(
      key,
      JSON.stringify(buildManualPickPayload('org-a', ['m1', 'm2']))
    );
    renderPage();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(capturedRecipientPool).toEqual({ type: 'manual', member_ids: ['m1', 'm2'] });
    expect(screen.getByTestId('composer-mock')).toBeTruthy();
  });

  it('enters manual mode with empty member list when picker returns same org with no ids', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(key, JSON.stringify(buildManualPickPayload('org-a', [])));
    renderPage();
    expect(capturedRecipientPool).toEqual({ type: 'manual', member_ids: [] });
    expect(screen.getByText('Choose members…')).toBeTruthy();
  });

  it('clears sessionStorage payload for mismatched organisation and stays on org_members pool', () => {
    const key = getManualPickStorageKey();
    window.sessionStorage.setItem(
      key,
      JSON.stringify(buildManualPickPayload('other-org', ['m99']))
    );
    renderPage();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(capturedRecipientPool).toEqual({
      type: 'org_members',
      organisation_id: 'org-a',
    });
  });

  it('toasts TM13 stale-org guard copy when selected organisation changes', () => {
    const view = renderPage();
    expect(toastSpy).not.toHaveBeenCalled();
    selectedOrg = { id: 'org-b', display_name: 'Org B', name: 'Org B' };
    view.rerender(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>
    );
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Manual recipients cleared — organisation changed.',
      variant: 'default',
      duration: 5000,
    });
  });

  it('rebuilds recipientPool when membership-type chip is toggled', async () => {
    renderPage();
    expect(capturedRecipientPool).toEqual({
      type: 'org_members',
      organisation_id: 'org-a',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Junior' }));

    await waitFor(() => {
      expect(capturedRecipientPool).toEqual({
        type: 'org_members',
        organisation_id: 'org-a',
        filters: { member_type_ids: ['1'] },
      });
    });
  });

  it('rebuilds recipientPool when include-inactive is toggled', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Include inactive members'));

    await waitFor(() => {
      expect(capturedRecipientPool).toEqual({
        type: 'org_members',
        organisation_id: 'org-a',
        filters: { include_inactive: true },
      });
    });
  });

  it('rebuilds recipientPool when switching to specific members mode', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Specific members' }));

    await waitFor(() => {
      expect(capturedRecipientPool).toEqual({ type: 'manual', member_ids: [] });
    });
  });

  it('shows zero-recipient copy and enables blockSendWhenPoolEmpty on composer', () => {
    resolvedPoolState.estimated_count = 0;
    renderPage();
    expect(screen.getByText('No recipients match these filters.')).toBeTruthy();
    expect(capturedBlockSendWhenPoolEmpty).toBe(true);
  });

  it('toasts RBAC permission error when useCommsLogRbac reports failure', async () => {
    commsRbacState.hasPermissionError = true;
    renderPage();
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Could not load permissions. Refresh to retry.',
        variant: 'destructive',
      });
    });
  });

  it('blocks adapter send with zero recipients and surfaces toast', async () => {
    resolvedPoolState.estimated_count = 0;
    renderPage();

    expect(wrappedSend).toBeDefined();
    const result = await wrappedSend?.({
      organisation_id: 'org-a',
      channel: 'email',
      body_text: 'Hi',
      sender_name: 'Org',
      source_app: 'team',
    });

    expect(result?.ok).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'No recipients match these filters.',
      variant: 'destructive',
    });
    expect(baseAdapter.send).not.toHaveBeenCalled();
  });
});
