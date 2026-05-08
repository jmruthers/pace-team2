import { describe, expect, it } from 'vitest';
import { isActiveDuplicateRoleError, runAddMemberRole, runEndMemberRole } from './useMemberRolesData';

function createMockSecureClient(error: unknown = null) {
  const tableClient = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'new-id' }, error }),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: () => ({
          is: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'updated-id' }, error }),
            }),
          }),
        }),
      }),
    }),
  };

  return {
    from: () => tableClient,
  };
}

describe('useMemberRolesData helpers', () => {
  it('inserts a member role successfully', async () => {
    const client = createMockSecureClient() as never;
    await expect(
      runAddMemberRole(client, {
        memberId: 'member-1',
        roleId: 2,
        organisationId: 'org-1',
        startDate: '2026-05-08',
      })
    ).resolves.toMatchObject({ ok: true });
  });

  it('returns failure result when add role insert fails', async () => {
    const client = createMockSecureClient(new Error('insert failed')) as never;
    const result = await runAddMemberRole(client, {
      memberId: 'member-1',
      roleId: 2,
      organisationId: 'org-1',
      startDate: '2026-05-08',
    });
    expect(result.ok).toBe(false);
  });

  it('updates end date successfully', async () => {
    const client = createMockSecureClient() as never;
    await expect(
      runEndMemberRole(client, {
        roleEntryId: 'role-entry-1',
        organisationId: 'org-1',
        endDate: '2026-05-08',
      })
    ).resolves.toMatchObject({ ok: true });
  });

  it('returns failure result when end role update fails', async () => {
    const client = createMockSecureClient(new Error('update failed')) as never;
    const result = await runEndMemberRole(client, {
      roleEntryId: 'role-entry-1',
      organisationId: 'org-1',
      endDate: '2026-05-08',
    });
    expect(result.ok).toBe(false);
  });

  it('detects active duplicate unique-index errors', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "core_member_role_active_unique"',
    };
    expect(isActiveDuplicateRoleError(error)).toBe(true);
  });
});
