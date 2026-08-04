import type { DbRow, DbValue } from '../types/admin'

/** What the mask renders as. Must match DatabaseAdminService::MASK. */
export const DB_MASK = '••••••••'

export type CellKind = 'null' | 'empty' | 'masked' | 'binary' | 'value'

/**
 * Classify a cell so the grid can style NULL, '' and hidden values distinctly
 * instead of rendering all three as blank space.
 */
export function cellKind(
  value: DbValue,
  column: string,
  masked: string[],
  binary: string[],
): CellKind {
  if (value === null) return 'null'
  if (masked.includes(column)) return 'masked'
  if (binary.includes(column)) return 'binary'
  if (value === '') return 'empty'
  return 'value'
}

/** Printable form of a cell value — never truncated here, only styled. */
export function cellText(value: DbValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/** Stable React key / identity label for a row, from its key columns. */
export function keyOf(row: DbRow, keyColumns: string[]): string {
  return keyColumns.map((c) => String(row[c])).join(' · ')
}

/** The {key: value} object the row endpoints expect in the request body. */
export function keyPayload(row: DbRow, keyColumns: string[]): DbRow {
  const key: DbRow = {}
  for (const column of keyColumns) key[column] = row[column]
  return key
}

/**
 * Leading-keyword guess used ONLY to colour the Run button and decide whether
 * to show a confirmation. It is deliberately naive and must never be treated as
 * a security control — the backend gate in DatabaseAdminService is the one that
 * decides what runs.
 */
export function classifySql(sql: string): 'read' | 'write' | 'blocked' | 'unknown' {
  const bare = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(--|#)[^\n]*/g, ' ')
    .replace(/^[\s(]+/, '')

  const match = /^([a-z_]+)/i.exec(bare)
  if (!match) return 'unknown'

  const keyword = match[1].toLowerCase()
  if (['select', 'show', 'explain', 'describe', 'desc', 'with'].includes(keyword)) {
    return 'read'
  }
  if (['insert', 'update', 'delete', 'replace'].includes(keyword)) return 'write'
  return 'blocked'
}

/** True when an UPDATE/DELETE would hit every row — worth a louder warning. */
export function isUnfiltered(sql: string): boolean {
  const bare = sql.replace(/^[\s(]+/, '')
  return /^(update|delete)\b/i.test(bare) && !/\bwhere\b/i.test(bare)
}

/** Compact byte size for the table rail. */
export function fmtBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
