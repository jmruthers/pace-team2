// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { RecipientPoolDescriptor } from '@solvera/pace-core/comms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildManualPickPayload,
  getManualPickStorageKey,
} from '@/lib/members/memberDirectory.picker';
import { CommunicationsPage } from '@/pages/communications/CommunicationsPage';

const toastSpy = vi.hoisted(() => vi.fn());

let capturedRecipientPool: RecipientPoolDescriptor | undefined;

let selectedOrg: { id: string; display_name: string; name: string } | null = {
  id: 'org-a',
  display_name: 'Org A',
  name: 'Org A',
};

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/providers', () => ({
  useOrganisationsContext: () => ({
    selectedOrganisation: selectedOrg,
  }),
}));

vi.mock('@solvera/pace-core/rbac', () => ({
  PagePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  AccessDenied: () => <article>Denied</article>,
  useCan: () => ({
    can: true,
    isLoading: false,
  }),
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
    memberTypes: [],
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

vi.mock('@solvera/pace-core/comms', () => ({
  CommComposer: (props: { recipientPool: RecipientPoolDescriptor }) => {
    capturedRecipientPool = props.recipientPool;
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
  useCommSendAdapter: () => ({
    resolvePool: vi.fn(async () => ({ ok: true, data: { estimated_count: 0, sample_names: [], warnings: [] } })),
    loadTemplates: vi.fn(async () => ({ ok: true, data: [] })),
    loadMergeFields: vi.fn(async () => ({ ok: true, data: [] })),
    send: vi.fn(),
    schedule: vi.fn(),
    sendTest: vi.fn(),
    saveDraft: vi.fn(async (next: unknown) => ({ ok: true, data: next })),
  }),
}));

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
    selectedOrg = { id: 'org-a', display_name: 'Org A', name: 'Org A' };
    window.sessionStorage.clear();
    toastSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
});
