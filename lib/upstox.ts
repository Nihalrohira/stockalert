const UPSTOX_LTP_URL = 'https://api.upstox.com/v3/market-quote/ltp'
const RESPONSE_BODY_LOG_MAX = 4000
const ERROR_MESSAGE_BODY_MAX = 2000
/** Avoid oversized URLs; Upstox accepts comma-separated keys per request. */
const MAX_INSTRUMENT_KEYS_PER_REQUEST = 50

function getUpstoxAccessToken(): string {
  const token = process.env.UPSTOX_ACCESS_TOKEN?.trim() ?? ''
  if (!token) {
    throw new Error(
      'UPSTOX_ACCESS_TOKEN is missing. Set it in the server environment (e.g. .env.local). Do not use NEXT_PUBLIC_.',
    )
  }
  return token
}

function logUpstoxLtpFailure(httpStatus: number, responseBody: string): void {
  console.error('[upstox] LTP request failed', {
    requestUrl: UPSTOX_LTP_URL,
    httpStatus,
    responseBody: responseBody.slice(0, RESPONSE_BODY_LOG_MAX),
    UPSTOX_ACCESS_TOKEN_exists: Boolean(process.env.UPSTOX_ACCESS_TOKEN?.trim()),
  })
}

function parseLastPrice(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Merge LTP entries from `data` into `out`, using `instrument_token` as the map key when present.
 * Supports `data` as a record (keys may use `:`) or as an array of quote objects.
 */
function mergeLtpFromData(data: unknown, out: Record<string, number>): void {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const key = typeof o.instrument_token === 'string' ? o.instrument_token.trim() : ''
      const price = parseLastPrice(o.last_price)
      if (key && price !== null) {
        out[key] = price
      }
    }
    return
  }

  if (data && typeof data === 'object') {
    for (const item of Object.values(data as Record<string, unknown>)) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const key = typeof o.instrument_token === 'string' ? o.instrument_token.trim() : ''
      const price = parseLastPrice(o.last_price)
      if (key && price !== null) {
        out[key] = price
      }
    }
  }
}

async function fetchUpstoxLtpChunk(instrumentKeys: string[], accessToken: string): Promise<Record<string, number>> {
  const params = new URLSearchParams()
  params.set('instrument_key', instrumentKeys.join(','))

  const res = await fetch(`${UPSTOX_LTP_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const rawText = await res.text()

  if (!res.ok) {
    logUpstoxLtpFailure(res.status, rawText)
    const slice =
      rawText.length > ERROR_MESSAGE_BODY_MAX ? `${rawText.slice(0, ERROR_MESSAGE_BODY_MAX)}…` : rawText
    throw new Error(`Upstox LTP HTTP ${res.status}: ${slice}`)
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    logUpstoxLtpFailure(res.status, rawText)
    throw new Error(`Upstox LTP: non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 500)}`)
  }

  const root = json as { status?: string; data?: unknown; errors?: unknown }
  if (root.status && root.status !== 'success') {
    logUpstoxLtpFailure(res.status, rawText)
    throw new Error(`Upstox LTP API status ${root.status}: ${JSON.stringify(root.errors ?? json).slice(0, ERROR_MESSAGE_BODY_MAX)}`)
  }

  const out: Record<string, number> = {}
  mergeLtpFromData(root.data, out)
  return out
}

/**
 * Last traded prices from Upstox Market Quote LTP V3.
 * Keys in the result use `instrument_token` from each quote (e.g. `NSE_EQ|INE002A01018`).
 */
export async function fetchUpstoxLtp(instrumentKeys: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(instrumentKeys.map((k) => k.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return {}
  }

  const accessToken = getUpstoxAccessToken()
  const merged: Record<string, number> = {}

  for (let i = 0; i < unique.length; i += MAX_INSTRUMENT_KEYS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_INSTRUMENT_KEYS_PER_REQUEST)
    Object.assign(merged, await fetchUpstoxLtpChunk(chunk, accessToken))
  }

  return merged
}
