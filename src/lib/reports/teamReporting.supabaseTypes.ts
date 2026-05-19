/** Minimal PostgREST query builder surface for TEAM reporting adapters. */
export interface TeamReportingQueryBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string | number | boolean | null): TeamReportingQueryBuilder;
  neq(column: string, value: string | number | boolean | null): TeamReportingQueryBuilder;
  gt(column: string, value: string | number | boolean): TeamReportingQueryBuilder;
  gte(column: string, value: string | number | boolean): TeamReportingQueryBuilder;
  lt(column: string, value: string | number | boolean): TeamReportingQueryBuilder;
  lte(column: string, value: string | number | boolean): TeamReportingQueryBuilder;
  like(column: string, pattern: string): TeamReportingQueryBuilder;
  ilike(column: string, pattern: string): TeamReportingQueryBuilder;
  is(column: string, value: null): TeamReportingQueryBuilder;
  not(column: string, operator: string, value: unknown): TeamReportingQueryBuilder;
  in(column: string, values: (string | number | boolean)[]): TeamReportingQueryBuilder;
  contains(column: string, value: unknown): TeamReportingQueryBuilder;
  order(column: string, options: { ascending?: boolean; referencedTable?: string }): TeamReportingQueryBuilder;
  limit(n: number): TeamReportingQueryBuilder;
  single(): Promise<{ data: unknown; error: unknown }>;
  select(
    selection: string,
    options?: { count?: 'exact'; head?: boolean },
  ): TeamReportingQueryBuilder;
}

export interface TeamReportingTableClient {
  select(selection: string, options?: { count?: 'exact'; head?: boolean }): TeamReportingQueryBuilder;
  insert(payload: unknown): TeamReportingInsertBuilder;
  update(payload: Record<string, unknown>): TeamReportingUpdateBuilder;
  delete(): TeamReportingDeleteBuilder;
}

export interface TeamReportingInsertBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  select(columns: string): TeamReportingInsertBuilder;
  single(): Promise<{ data: unknown; error: unknown }>;
}

export interface TeamReportingUpdateBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string | number | boolean | null): TeamReportingUpdateBuilder;
  select(columns: string): TeamReportingUpdateBuilder;
  single(): Promise<{ data: unknown; error: unknown }>;
}

export interface TeamReportingDeleteBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string | number | boolean | null): TeamReportingDeleteBuilder;
}

export interface TeamReportingSecureClient {
  from(table: string): TeamReportingTableClient;
}
