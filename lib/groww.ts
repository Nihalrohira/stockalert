import { createHash } from 'crypto'

const GROWW_TOKEN_URL = 'https://api.groww.in/v1/token/api/access'
const GROWW_LTP_URL = 'https://api.groww.in/v1/live-data/ltp'
const MAX_SYMBOLS_PER_REQUEST = 50
const RESPONSE_BODY_LOG_MAX = 4000
const ERROR_MESSAGE_BODY_MAX = 2500
const DEFAULT_TOKEN_TTL_MS = 4 * 60 * 60 * 1000

/** SHA256(GROWW_API_SECRET + timestamp) as lowercase hex (Groww approval checksum). */
function buildApprovalChecksum(apiSecret: string, timestamp: string): string {
  return createHash('sha256').update(`${apiSecret}${timestamp}`, 'utf8').digest('hex')
}

/** Epoch seconds string (same value in body and checksum input). */
function epochSecondsString(): string {
  return String(Math.floor(Date.now() / 1000))
}

function envCredentialFlags(): { GROWW_API_KEY_exists: boolean; GROWW_API_SECRET_exists: boolean } {
  return {
    GROWW_API_KEY_exists: Boolean(process.env.GROWW_API_KEY?.trim()),
    GROWW_API_SECRET_exists: Boolean(process.env.GROWW_API_SECRET?.trim()),
  }
}

function logGrowwTokenFailure(
  context: string,
  params: {
    httpStatus: number
    responseBody: string
    timestampUsed?: string
    extra?: Record<string, unknown>
  },
): void {
  console.error(`[groww] ${context}`, {
    requestUrl: GROWW_TOKEN_URL,
    requestMethod: 'POST',
    httpStatus: params.httpStatus,
    timestampUsed: params.timestampUsed,
    responseBody: params.responseBody.slice(0, RESPONSE_BODY_LOG_MAX),
    ...envCredentialFlags(),
    ...params.extra,
  })
}

function logGrowwLtpFailure(context: string, params: { httpStatus: number; responseBody: string }): void {
  console.error(`[groww] ${context}`, {
    requestUrl: GROWW_LTP_URL,
    httpStatus: params.httpStatus,
    responseBody: params.responseBody.slice(0, RESPONSE_BODY_LOG_MAX),
    ...envCredentialFlags(),
  })
}

function getApiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.GROWW_API_KEY?.trim() ?? ''
  const apiSecret = process.env.GROWW_API_SECRET?.trim() ?? ''
  if (!apiKey || !apiSecret) {
    logGrowwTokenFailure('missing credentials', {
      httpStatus: 0,
      responseBody: '',
      extra: { message: 'GROWW_API_KEY and GROWW_API_SECRET must both be set' },
    })
    throw new Error(
      'GROWW_API_KEY and GROWW_API_SECRET must be set in the server environment (e.g. .env.local).',
    )
  }
  return { apiKey, apiSecret }
}

/** Token access response: top-level `token` and optional `expiry` (Groww docs). */
function extractTokenAndExpiry(json: unknown): { token: string; expiryIso?: string } {
  if (!json || typeof json !== 'object') {
    throw new Error('Groww token: invalid JSON shape')
  }
  const o = json as Record<string, unknown>
  if (typeof o.token !== 'string') {
    throw new Error(`Groww token: missing top-level token field: ${JSON.stringify(json).slice(0, 800)}`)
  }
  return {
    token: o.token,
    expiryIso: typeof o.expiry === 'string' ? o.expiry : undefined,
  }
}

function expiresAtFromResponse(expiryIso: string | undefined): number {
  const defaultExpiry = Date.now() + DEFAULT_TOKEN_TTL_MS
  if (!expiryIso) return defaultExpiry
  const t = Date.parse(expiryIso)
  if (Number.isNaN(t)) return defaultExpiry
  return Math.max(Date.now() + 60_000, t - 60_000)
}

/** In-memory cache (server process only). */
let accessTokenCache: { token: string; expiresAtMs: number } | null = null

function clearAccessTokenCache(): void {
  accessTokenCache = null
}

/**
 * POST /v1/token/api/access (approval flow). Token curl in Groww docs does not use X-API-VERSION.
 */
async function fetchGrowwApprovalAccessToken(): Promise<{ token: string; expiresAtMs: number }> {
  const { apiKey, apiSecret } = getApiCredentials()
  const timestamp = epochSecondsString()
  const checksum = buildApprovalChecksum(apiSecret, timestamp)

  const res = await fetch(GROWW_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key_type: 'approval',
      checksum,
      timestamp,
    }),
  })

  const rawText = await res.text()

  if (!res.ok) {
    logGrowwTokenFailure('access token HTTP error', {
      httpStatus: res.status,
      responseBody: rawText,
      timestampUsed: timestamp,
    })
    const slice =
      rawText.length > ERROR_MESSAGE_BODY_MAX ? `${rawText.slice(0, ERROR_MESSAGE_BODY_MAX)}…` : rawText
    throw new Error(`Groww token HTTP ${res.status}: ${slice}`)
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    logGrowwTokenFailure('access token non-JSON body', {
      httpStatus: res.status,
      responseBody: rawText,
      timestampUsed: timestamp,
    })
    throw new Error(`Groww token: expected JSON (HTTP ${res.status}): ${rawText.slice(0, ERROR_MESSAGE_BODY_MAX)}`)
  }

  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>
    if (o.status === 'FAILURE') {
      logGrowwTokenFailure('access token API FAILURE', {
        httpStatus: res.status,
        responseBody: rawText,
        timestampUsed: timestamp,
      })
      const errPayload = JSON.stringify(o.error ?? o)
      throw new Error(`Groww token API failure: ${errPayload}`)
    }
  }

  try {
    const { token, expiryIso } = extractTokenAndExpiry(json)
    return { token, expiresAtMs: expiresAtFromResponse(expiryIso) }
  } catch (parseErr) {
    logGrowwTokenFailure('access token parse error', {
      httpStatus: res.status,
      responseBody: rawText,
      timestampUsed: timestamp,
      extra: { parseError: parseErr instanceof Error ? parseErr.message : String(parseErr) },
    })
    throw new Error(
      `Groww token: invalid response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)} | body: ${rawText.slice(0, ERROR_MESSAGE_BODY_MAX)}`,
    )
  }
}

/**
 * Short-lived access token for live-data and other Trading APIs (Bearer on requests + X-API-VERSION).
 * Cached until `expiry` from the token response (minus skew), with a default TTL if absent.
 */
export async function getGrowwAccessToken(): Promise<string> {
  const now = Date.now()
  const refreshSkewMs = 60_000
  if (accessTokenCache && accessTokenCache.expiresAtMs > now + refreshSkewMs) {
    return accessTokenCache.token
  }
  const fresh = await fetchGrowwApprovalAccessToken()
  accessTokenCache = fresh
  return fresh.token
}

/** e.g. NSE_RELIANCE, BSE_SENSEX */
export function toGrowwExchangeSymbol(exchange: string, stockSymbol: string): string {
  const ex = exchange.toUpperCase() === 'BSE' ? 'BSE' : 'NSE'
  return `${ex}_${stockSymbol.toUpperCase()}`
}

async function fetchLtpChunk(accessToken: string, chunk: string[]): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    segment: 'CASH',
    exchange_symbols: chunk.join(','),
  })

  const res = await fetch(`${GROWW_LTP_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-API-VERSION': '1.0',
    },
  })

  const rawText = await res.text()

  if (!res.ok) {
    logGrowwLtpFailure('LTP HTTP error', { httpStatus: res.status, responseBody: rawText })
  }

  if (res.status === 401 || res.status === 403) {
    const err = new Error(`Groww LTP unauthorized (HTTP ${res.status})`)
    ;(err as Error & { statusCode?: number }).statusCode = res.status
    throw err
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error(`Groww LTP: non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 500)}`)
  }

  if (!res.ok) {
    throw new Error(`Groww LTP HTTP ${res.status}: ${rawText.slice(0, 800)}`)
  }

  const body = json as { status?: string; payload?: Record<string, unknown> }
  if (body.status !== 'SUCCESS' || !body.payload || typeof body.payload !== 'object') {
    logGrowwLtpFailure('LTP unexpected body', { httpStatus: res.status, responseBody: rawText })
    throw new Error(`Groww LTP unexpected body: ${JSON.stringify(body)}`)
  }

  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(body.payload)) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
    if (!Number.isNaN(n)) {
      out[key] = n
    }
  }
  return out
}

/**
 * Last traded prices from Groww. Uses API key + secret approval token (cached), then LTP (batched, max 50 symbols).
 */
export async function fetchGrowwLtp(exchangeSymbols: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(exchangeSymbols.map((s) => s.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return {}
  }

  const out: Record<string, number> = {}

  for (let i = 0; i < unique.length; i += MAX_SYMBOLS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_SYMBOLS_PER_REQUEST)
    let accessToken = await getGrowwAccessToken()
    try {
      Object.assign(out, await fetchLtpChunk(accessToken, chunk))
    } catch (first) {
      const code = (first as Error & { statusCode?: number }).statusCode
      if (code === 401 || code === 403) {
        clearAccessTokenCache()
        accessToken = await getGrowwAccessToken()
        Object.assign(out, await fetchLtpChunk(accessToken, chunk))
      } else {
        throw first
      }
    }
  }

  return out
}
