const UPSTOX_OPTION_CONTRACT_URL = 'https://api.upstox.com/v2/option/contract'

export type NormalizedOptionContract = {
  underlyingSymbol: string
  expiryDate: string
  strikePrice: number
  optionType: 'CE' | 'PE'
  tradingSymbol: string
  instrumentKey: string
}

function getUpstoxAccessToken(): string {
  const token = process.env.UPSTOX_ACCESS_TOKEN?.trim() ?? ''
  if (!token) {
    throw new Error(
      'UPSTOX_ACCESS_TOKEN is missing. Set it in the server environment (e.g. .env.local).',
    )
  }
  return token
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeOptionType(v: unknown): 'CE' | 'PE' | null {
  if (v == null) return null
  const s = String(v).trim().toUpperCase()
  if (s === 'CE' || s === 'CALL' || s.includes('CALL')) return 'CE'
  if (s === 'PE' || s === 'PUT' || s.includes('PUT')) return 'PE'
  return null
}

function normalizeExpiry(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const trimmed = v.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return trimmed
}

function normalizeContract(
  raw: Record<string, unknown>,
  fallbackUnderlying: string,
): NormalizedOptionContract | null {
  const instrumentKey =
    typeof raw.instrument_key === 'string'
      ? raw.instrument_key.trim()
      : typeof raw.instrumentKey === 'string'
        ? raw.instrumentKey.trim()
        : ''
  const tradingSymbol =
    typeof raw.trading_symbol === 'string'
      ? raw.trading_symbol.trim()
      : typeof raw.tradingSymbol === 'string'
        ? raw.tradingSymbol.trim()
        : typeof raw.symbol === 'string'
          ? raw.symbol.trim()
          : ''
  const strikePrice = parseNum(raw.strike_price ?? raw.strikePrice)
  const expiryDate = normalizeExpiry(raw.expiry ?? raw.expiry_date ?? raw.expiryDate)
  const optionType = normalizeOptionType(
    raw.instrument_type ?? raw.option_type ?? raw.optionType ?? raw.put_call,
  )
  const underlyingSymbol =
    typeof raw.underlying_symbol === 'string' && raw.underlying_symbol.trim() !== ''
      ? raw.underlying_symbol.trim().toUpperCase()
      : typeof raw.underlyingSymbol === 'string' && raw.underlyingSymbol.trim() !== ''
        ? raw.underlyingSymbol.trim().toUpperCase()
        : fallbackUnderlying.toUpperCase()

  if (!instrumentKey || !tradingSymbol || strikePrice === null || !expiryDate || !optionType) {
    return null
  }

  return {
    underlyingSymbol,
    expiryDate,
    strikePrice,
    optionType,
    tradingSymbol,
    instrumentKey,
  }
}

function extractContractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const key of ['contracts', 'option_contracts', 'options', 'data']) {
      const nested = o[key]
      if (Array.isArray(nested)) {
        return nested.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      }
    }
    return Object.values(o).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  }
  return []
}

/**
 * Fetches option contracts from Upstox for an underlying index instrument key.
 */
export async function fetchOptionContracts(
  underlyingInstrumentKey: string,
  expiryDate?: string,
  underlyingSymbol = 'NIFTY',
): Promise<NormalizedOptionContract[]> {
  const params = new URLSearchParams()
  params.set('instrument_key', underlyingInstrumentKey.trim())
  if (expiryDate?.trim()) {
    params.set('expiry_date', expiryDate.trim().slice(0, 10))
  }

  const accessToken = getUpstoxAccessToken()
  const res = await fetch(`${UPSTOX_OPTION_CONTRACT_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`Upstox option contracts HTTP ${res.status}: ${rawText.slice(0, 500)}`)
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error('Upstox option contracts: response was not JSON')
  }

  const root = json as { status?: string; data?: unknown; errors?: unknown }
  if (root.status && root.status !== 'success') {
    throw new Error(
      `Upstox option contracts API error: ${JSON.stringify(root.errors ?? json).slice(0, 500)}`,
    )
  }

  const rows = extractContractRows(root.data)
  const out: NormalizedOptionContract[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const c = normalizeContract(row, underlyingSymbol)
    if (!c) continue
    const dedupe = `${c.instrumentKey}|${c.expiryDate}|${c.strikePrice}|${c.optionType}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push(c)
  }

  out.sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate)
    if (a.strikePrice !== b.strikePrice) return a.strikePrice - b.strikePrice
    return a.optionType.localeCompare(b.optionType)
  })

  return out
}
