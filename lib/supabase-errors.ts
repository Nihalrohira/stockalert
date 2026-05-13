/**
 * PostgREST / Supabase errors are plain objects; `console.error(err)` often prints `{}`.
 * Use this helper for actionable logs + RLS hint.
 */
export function logSupabaseError(context: string, error: unknown): void {
  const e = error as {
    message?: string
    code?: string
    details?: string
    hint?: string
  }

  const message = e?.message ?? '(no message)'
  const code = e?.code ?? '(no code)'
  const details = e?.details ?? '(no details)'
  const hint = e?.hint ?? '(no hint)'

  let fullJson = '(could not stringify)'
  try {
    fullJson = JSON.stringify(error, Object.getOwnPropertyNames(Object(error)))
  } catch {
    try {
      fullJson = JSON.stringify({ message, code, details, hint })
    } catch {
      fullJson = String(error)
    }
  }

  console.error(context, {
    message,
    code,
    details,
    hint,
    full: fullJson,
  })

  const m = message.toLowerCase()
  if (
    code === '42501' ||
    code === 'PGRST301' ||
    m.includes('row-level security') ||
    m.includes('rls') ||
    m.includes('permission denied') ||
    m.includes('violates row-level security')
  ) {
    console.error('Supabase RLS policy missing or blocking this query.')
  }
}
