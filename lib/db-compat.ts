// Tolerance for a database that is still behind the code (migrations 026–032
// not applied yet). Server-side only.
//
// A "missing object" is a column / table / function / sequence that does not
// exist yet:
//   Postgres   42703 undefined_column, 42P01 undefined_table,
//              42883 undefined_function
//   PostgREST  PGRST204 (column not in schema cache), PGRST205 (table not in
//              schema cache), PGRST202 (function not in schema cache)
// plus the message forms both produce ("... does not exist",
// "Could not find the ... in the schema cache").

type DbErrorLike = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null | undefined

const MISSING_CODES = new Set(['42703', '42P01', '42883', 'PGRST204', 'PGRST205', 'PGRST202'])

export function isMissingDbObject(err: unknown): boolean {
  if (!err) return false
  const e = err as DbErrorLike
  const code = typeof e?.code === 'string' ? e.code : ''
  if (code && MISSING_CODES.has(code)) return true
  const text = [e?.message, e?.details, e?.hint]
    .filter(v => typeof v === 'string')
    .join(' ')
  if (!text && typeof err === 'string') return isMissingDbObject({ message: err })
  return /does not exist|could not find the .*schema cache/i.test(text)
}

/** Whether a missing-object error concerns `name` (column/table/function). */
export function isMissingDbObjectNamed(err: unknown, name: string): boolean {
  if (!isMissingDbObject(err)) return false
  const e = err as DbErrorLike
  const text = [e?.message, e?.details, e?.hint].filter(v => typeof v === 'string').join(' ')
  return text.toLowerCase().includes(name.toLowerCase())
}

const _warned = new Set<string>()

/** Logs one warning per process for each missing feature (keeps logs readable). */
export function warnMissingOnce(feature: string, err?: unknown): void {
  if (_warned.has(feature)) return
  _warned.add(feature)
  const msg = err && typeof (err as DbErrorLike)?.message === 'string' ? (err as { message: string }).message : ''
  console.warn(`[db-compat] ${feature} unavailable (migration not applied yet?) — using fallback.${msg ? ' ' + msg : ''}`)
}
