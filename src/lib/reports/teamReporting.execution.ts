import type {
  ReportingExecutionAdapter,
  ReportingExecutionRequest,
  ReportingExecutionRow,
  ReportingFieldMeta,
  ReportingFilter,
  ReportingQueryPlan,
  ReportingSort,
} from '@solvera/pace-core/reporting';
import { createErrorResult, createSuccessResult } from '@solvera/pace-core/types';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import type { TeamReportingQueryBuilder, TeamReportingSecureClient } from './teamReporting.supabaseTypes';

const ROW_CAP = 10_000;

export function splitFieldKey(fieldKey: string): { table: string; column: string } {
  const i = fieldKey.indexOf('.');
  if (i <= 0 || i === fieldKey.length - 1) {
    throw new Error(`Invalid field key "${fieldKey}".`);
  }
  return { table: fieldKey.slice(0, i), column: fieldKey.slice(i + 1) };
}

function parseFieldKey(fieldKey: string): { table: string; column: string } | null {
  const i = fieldKey.indexOf('.');
  if (i <= 0 || i === fieldKey.length - 1) return null;
  return { table: fieldKey.slice(0, i), column: fieldKey.slice(i + 1) };
}

function collectColumnsForTable(plan: ReportingQueryPlan, table: string, baseCols: string[]): string[] {
  const cols = new Set<string>(baseCols);
  const consider = (fieldKey: string) => {
    const parsed = parseFieldKey(fieldKey);
    if (parsed != null && parsed.table === table) cols.add(parsed.column);
  };
  for (const field of plan.selectedFields) consider(field.fieldKey);
  for (const filter of plan.filters) consider(filter.fieldKey);
  for (const sort of plan.sorts) consider(sort.fieldKey);
  return Array.from(cols);
}

/** PostgREST select fragment for `team.participant` (member → person → profile → conditions). */
export function buildTeamParticipantSelect(plan: ReportingQueryPlan): string {
  const tables = plan.selectedTables;
  const needsPerson = tables.some((t) => t === 'core_person' || t === 'medi_profile' || t === 'medi_condition');
  const needsProfile = tables.some((t) => t === 'medi_profile' || t === 'medi_condition');
  const needsCondition = tables.some((t) => t === 'medi_condition');

  const memberCols = collectColumnsForTable(plan, 'core_member', ['id', 'person_id', 'organisation_id']);

  const parts: string[] = [memberCols.join(', ')];

  if (needsPerson) {
    const personCols = collectColumnsForTable(plan, 'core_person', ['id']);
    let innerPerson = personCols.join(', ');
    if (needsProfile) {
      const profileCols = collectColumnsForTable(plan, 'medi_profile', ['id']);
      let innerProfile = profileCols.join(', ');
      if (needsCondition) {
        const conditionCols = collectColumnsForTable(plan, 'medi_condition', ['id']);
        innerProfile += `, medi_condition(${conditionCols.join(', ')})`;
      }
      innerPerson += `, medi_profile(${innerProfile})`;
    }
    parts.push(`core_person!inner(${innerPerson})`);
  }

  return parts.join(', ');
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeMany<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

type RawMemberRow = Record<string, unknown> & {
  core_person?: Record<string, unknown> | Record<string, unknown>[] | null;
};

function flattenTeamParticipantRow(raw: RawMemberRow, plan: ReportingQueryPlan): ReportingExecutionRow {
  const person = normalizeOne(raw.core_person);
  const profile = person ? normalizeOne(person.medi_profile as Record<string, unknown> | Record<string, unknown>[] | null) : null;
  const conditions = profile ? normalizeMany(profile.medi_condition as Record<string, unknown> | null) : [];

  const out: ReportingExecutionRow = {};
  for (const field of plan.selectedFields) {
    const { table, column } = splitFieldKey(field.fieldKey);
    if (table === 'core_member') {
      out[field.fieldKey] = raw[column];
      continue;
    }
    if (table === 'core_person' && person != null) {
      out[field.fieldKey] = person[column];
      continue;
    }
    if (table === 'medi_profile' && profile != null) {
      out[field.fieldKey] = profile[column];
      continue;
    }
    if (table === 'medi_condition') {
      const agg = plan.aggregations.find((a) => a.fieldKey === field.fieldKey);
      if (agg?.strategy === 'string_agg') {
        const pieces = conditions
          .map((c) => c[column])
          .filter((v) => v != null && String(v).length > 0)
          .map((v) => String(v));
        out[field.fieldKey] = pieces.join('|');
      } else if (agg?.strategy === 'array_agg') {
        out[field.fieldKey] = conditions.map((c) => c[column]).filter((v) => v != null);
      } else if (agg?.strategy === 'count') {
        out[field.fieldKey] = conditions.length;
      } else {
        out[field.fieldKey] = conditions[0]?.[column] ?? null;
      }
    }
  }
  return out;
}

function filterColumnRef(table: string, column: string): string {
  return table === 'core_member' ? column : `${table}.${column}`;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  if (typeof value === 'string') return [value];
  return [];
}

function applyFilters(builder: TeamReportingQueryBuilder, filters: ReportingFilter[]): TeamReportingQueryBuilder {
  let q = builder;
  for (const filter of filters) {
    const { table, column } = splitFieldKey(filter.fieldKey);
    const colRef = filterColumnRef(table, column);
    const op: ReportingFilter['operator'] = filter.operator;
    const v = filter.value;

    switch (op) {
      case 'eq':
        q = q.eq(colRef, v as string | number | boolean | null);
        break;
      case 'neq':
        q = q.neq(colRef, v as string | number | boolean | null);
        break;
      case 'gt':
        q = q.gt(colRef, v as number | string | boolean);
        break;
      case 'gte':
        q = q.gte(colRef, v as number | string | boolean);
        break;
      case 'lt':
        q = q.lt(colRef, v as number | string | boolean);
        break;
      case 'lte':
        q = q.lte(colRef, v as number | string | boolean);
        break;
      case 'contains':
        q = q.ilike(colRef, `%${String(v ?? '')}%`);
        break;
      case 'starts_with':
        q = q.ilike(colRef, `${String(v ?? '')}%`);
        break;
      case 'ends_with':
        q = q.ilike(colRef, `%${String(v ?? '')}`);
        break;
      case 'like':
        q = q.like(colRef, String(v ?? ''));
        break;
      case 'ilike':
        q = q.ilike(colRef, String(v ?? ''));
        break;
      case 'is_null':
        q = q.is(colRef, null);
        break;
      case 'not_null':
        q = q.not(colRef, 'is', null);
        break;
      case 'in':
        q = q.in(colRef, asStringArray(v) as (string | number | boolean)[]);
        break;
      default:
        throw new Error(`Unsupported filter operator "${String(op)}".`);
    }
  }
  return q;
}

function applySorts(builder: TeamReportingQueryBuilder, sorts: ReportingSort[], fieldMap: Map<string, ReportingFieldMeta>): TeamReportingQueryBuilder {
  let q = builder;
  for (const sort of sorts) {
    const { table, column } = splitFieldKey(sort.fieldKey);
    if (!fieldMap.has(sort.fieldKey)) continue;
    q = q.order(column, {
      ascending: sort.direction === 'asc',
      referencedTable: table === 'core_member' ? undefined : table,
    });
  }
  return q;
}

export function createTeamReportingExecutionAdapter(
  getClient: () => TeamReportingSecureClient | null,
): ReportingExecutionAdapter {
  return {
    execute: async (request: ReportingExecutionRequest) => {
      const client = getClient();
      if (client == null) {
        return createErrorResult('NO_CLIENT', 'Reporting client is not available.');
      }

      const { plan } = request;
      if (plan.explore.key !== 'team.participant') {
        return createErrorResult('UNSUPPORTED_EXPLORE', `Explore "${plan.explore.key}" is not supported in TEAM reporting.`);
      }

      try {
        const select = buildTeamParticipantSelect(plan);
        let builder = client.from('core_member').select(select).eq(plan.scopeClause.column, plan.scopeClause.value) as TeamReportingQueryBuilder;
        builder = builder.is('deleted_at', null);
        builder = applyFilters(builder, plan.filters);

        const fieldMap = new Map(plan.selectedFields.map((f) => [f.fieldKey, f] as const));
        builder = applySorts(builder, plan.sorts, fieldMap);
        builder = builder.limit(ROW_CAP);

        const { data, error } = await builder;
        if (error != null) {
          return createErrorResult(
            'EXECUTION_FAILED',
            HandleSupabaseError(error, 'core_member').message,
          );
        }

        const rawRows = (data ?? []) as RawMemberRow[];
        const rows = rawRows.map((raw) => flattenTeamParticipantRow(raw, plan));
        return createSuccessResult({
          rows,
          totalCount: rows.length,
          truncated: rows.length === ROW_CAP,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to execute report.';
        return createErrorResult('EXECUTION_FAILED', message);
      }
    },
  };
}

export { ROW_CAP as TEAM_REPORTING_ROW_CAP };
