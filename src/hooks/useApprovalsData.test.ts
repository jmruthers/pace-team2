import { describe, expect, it } from 'vitest';
import { applyClosedFilters, applyOpenCountFilters, applyOpenFilters } from '@/hooks/useApprovalsData';

class QueryBuilderMock {
  public calls: Array<{ method: string; args: unknown[] }> = [];

  eq(column: string, value: unknown): this {
    this.calls.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.calls.push({ method: 'in', args: [column, values] });
    return this;
  }

  order(column: string, options: unknown): this {
    this.calls.push({ method: 'order', args: [column, options] });
    return this;
  }
}

describe('useApprovalsData query contracts', () => {
  it('applies open-list filters for join/transfer and pending/on_hold', () => {
    const query = new QueryBuilderMock();
    applyOpenFilters(query as unknown as Parameters<typeof applyOpenFilters>[0], 'org-1', 'all');

    expect(query.calls).toEqual([
      { method: 'eq', args: ['organisation_id', 'org-1'] },
      { method: 'in', args: ['status', ['pending', 'on_hold']] },
      { method: 'in', args: ['request_type', ['join', 'transfer']] },
      { method: 'order', args: ['created_at', { ascending: true }] },
    ]);
  });

  it('applies closed-list filters for join/transfer and approved/rejected/withdrawn', () => {
    const query = new QueryBuilderMock();
    applyClosedFilters(query as unknown as Parameters<typeof applyClosedFilters>[0], 'org-2', 'all');

    expect(query.calls).toEqual([
      { method: 'eq', args: ['organisation_id', 'org-2'] },
      { method: 'in', args: ['status', ['approved', 'rejected', 'withdrawn']] },
      { method: 'in', args: ['request_type', ['join', 'transfer']] },
      { method: 'order', args: ['resolved_at', { ascending: false }] },
    ]);
  });

  it('applies open-count filters that exclude on_hold', () => {
    const query = new QueryBuilderMock();
    applyOpenCountFilters(query as unknown as Parameters<typeof applyOpenCountFilters>[0], 'org-9');

    expect(query.calls).toEqual([
      { method: 'eq', args: ['organisation_id', 'org-9'] },
      { method: 'eq', args: ['status', 'pending'] },
      { method: 'in', args: ['request_type', ['join', 'transfer']] },
    ]);
  });
});
