import { describe, expect, it } from 'vitest';
import { runCardActivationUpdate, runIdentitySave } from './useMember360Data';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function buildSecureClient(responses: QueryResult[]) {
  const queue = [...responses];
  const calls: Array<{ table: string; payload: Record<string, unknown>; id: string | null }> = [];

  const createQuery = (table: string, payload: Record<string, unknown>) => {
    let whereId: string | null = null;
    return {
      eq(column: string, value: string) {
        if (column === 'id') {
          whereId = value;
        }
        return this;
      },
      select() {
        return this;
      },
      async single() {
        calls.push({ table, payload, id: whereId });
        const next = queue.shift() ?? { data: null, error: null };
        return next;
      },
    };
  };

  return {
    client: {
      from(table: string) {
        return {
          update(payload: Record<string, unknown>) {
            return createQuery(table, payload);
          },
        };
      },
    },
    calls,
  };
}

describe('useMember360Data mutation helpers', () => {
  it('runs identity save in order: core_person then core_member', async () => {
    const { client, calls } = buildSecureClient([
      { data: { id: 'person-1' }, error: null },
      { data: { id: 'member-1' }, error: null },
    ]);

    await runIdentitySave(client as never, {
      memberId: 'member-1',
      personId: 'person-1',
      firstName: 'Ava',
      lastName: 'Adams',
      preferredName: '',
      email: '',
      dateOfBirth: '',
      genderId: null,
      pronounId: null,
      membershipTypeId: null,
      membershipNumber: '',
      validFrom: '',
      validTo: '',
    });

    expect(calls.map((call) => call.table)).toEqual(['core_person', 'core_member']);
  });

  it('stops identity save when core_person update fails', async () => {
    const { client, calls } = buildSecureClient([
      { data: null, error: new Error('person denied') },
      { data: { id: 'member-1' }, error: null },
    ]);

    await expect(
      runIdentitySave(client as never, {
        memberId: 'member-1',
        personId: 'person-1',
        firstName: 'Ava',
        lastName: 'Adams',
        preferredName: '',
        email: '',
        dateOfBirth: '',
        genderId: null,
        pronounId: null,
        membershipTypeId: null,
        membershipNumber: '',
        validFrom: '',
        validTo: '',
      })
    ).rejects.toMatchObject({
      context: 'core_person',
    });

    expect(calls.map((call) => call.table)).toEqual(['core_person']);
  });

  it('honours last-write-wins behavior for concurrent identity saves', async () => {
    const state = { first_name: 'Start' };
    const client = {
      from() {
        return {
          update(payload: Record<string, unknown>) {
            return {
              eq() {
                return this;
              },
              select() {
                return this;
              },
              async single() {
                if ('first_name' in payload) {
                  state.first_name = String(payload.first_name);
                }
                return { data: { id: 'ok' }, error: null };
              },
            };
          },
        };
      },
    };

    await Promise.all([
      runIdentitySave(client as never, {
        memberId: 'member-1',
        personId: 'person-1',
        firstName: 'Alpha',
        lastName: 'Adams',
        preferredName: '',
        email: '',
        dateOfBirth: '',
        genderId: null,
        pronounId: null,
        membershipTypeId: null,
        membershipNumber: '',
        validFrom: '',
        validTo: '',
      }),
      runIdentitySave(client as never, {
        memberId: 'member-1',
        personId: 'person-1',
        firstName: 'Beta',
        lastName: 'Adams',
        preferredName: '',
        email: '',
        dateOfBirth: '',
        genderId: null,
        pronounId: null,
        membershipTypeId: null,
        membershipNumber: '',
        validFrom: '',
        validTo: '',
      }),
    ]);

    expect(['Alpha', 'Beta']).toContain(state.first_name);
  });

  it('returns contextual mutation error for card updates', async () => {
    const { client } = buildSecureClient([{ data: null, error: new Error('card denied') }]);

    await expect(runCardActivationUpdate(client as never, { cardId: 'card-1', isActive: false })).rejects.toMatchObject({
      context: 'core_member_card',
    });
  });
});
