export type SupabaseQueryResult<T> = { data: T; error: unknown };

export type MemberFetchRaw = Record<string, unknown>;

export interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  is(column: string, value: null): SupabaseQueryBuilderLike;
  in(column: string, value: string[]): SupabaseQueryBuilderLike;
  neq(column: string, value: string): SupabaseQueryBuilderLike;
  order(column: string, options?: { ascending?: boolean; referencedTable?: string }): SupabaseQueryBuilderLike;
  select(selection?: string): SupabaseQueryBuilderLike;
  maybeSingle(): Promise<unknown>;
  single(): Promise<unknown>;
}

export interface SupabaseTableClientLike {
  select(selection: string): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
}

export interface SecureSupabaseClientLike {
  from(table: string): SupabaseTableClientLike;
}
