import { gunzipSync } from 'zlib'

const INSTRUMENT_MASTER_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz'

const FETCH_HEADERS = {
  'User-Agent': 'StockAlert/1.0 (https://github.com/; Next.js server)',
  Accept: '*/*',
} as const

/** Normalized equity row for search / UI. */
export interface NormalizedInstrument {
  symbol: string
  name: string
  exchange: 'NSE' | 'BSE'
  instrumentKey: string
  isin: string
}

interface RawInstrument {
  segment?: string
  exchange?: string
  trading_symbol?: string
  name?: string
  isin?: string
  instrument_key?: string
  instrument_type?: string
}

let cachedInstruments: NormalizedInstrument[] | null = null
let loadPromise: Promise<NormalizedInstrument[]> | null = null

function normalizeRow(raw: RawInstrument): NormalizedInstrument | null {
  const seg = raw.segment ?? ''
  if (seg !== 'NSE_EQ' && seg !== 'BSE_EQ') return null

  const exchange = raw.exchange === 'BSE' ? 'BSE' : raw.exchange === 'NSE' ? 'NSE' : null
  if (exchange !== 'NSE' && exchange !== 'BSE') return null

  const symbol = typeof raw.trading_symbol === 'string' ? raw.trading_symbol.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const isin = typeof raw.isin === 'string' ? raw.isin.trim() : ''
  const instrumentKey = typeof raw.instrument_key === 'string' ? raw.instrument_key.trim() : ''
  if (!symbol || !instrumentKey) return null

  return {
    symbol,
    name: name || symbol,
    exchange,
    instrumentKey,
    isin,
  }
}

async function loadAndParseInstruments(): Promise<NormalizedInstrument[]> {
  const res = await fetch(INSTRUMENT_MASTER_URL, { headers: { ...FETCH_HEADERS } })
  if (!res.ok) {
    console.error('[upstox-instruments] fetch master failed', {
      httpStatus: res.status,
      url: INSTRUMENT_MASTER_URL,
    })
    throw new Error(`Instrument master fetch failed (HTTP ${res.status})`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  let text: string
  try {
    text = gunzipSync(buf).toString('utf8')
  } catch (e) {
    console.error('[upstox-instruments] gunzip failed', e)
    throw new Error('Instrument master: invalid gzip payload')
  }

  const parsed = JSON.parse(text) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Instrument master: expected top-level array')
  }

  const out: NormalizedInstrument[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const n = normalizeRow(row as RawInstrument)
    if (n) out.push(n)
  }
  return out
}

/**
 * Loads Upstox complete instrument master once (gzip), filters to NSE_EQ / BSE_EQ equity only,
 * and keeps results in memory for the lifetime of the Node process.
 */
export async function ensureUpstoxInstrumentsLoaded(): Promise<NormalizedInstrument[]> {
  if (cachedInstruments) return cachedInstruments
  if (!loadPromise) {
    loadPromise = loadAndParseInstruments()
      .then((data) => {
        cachedInstruments = data
        return data
      })
      .catch((err) => {
        loadPromise = null
        throw err
      })
  }
  return loadPromise
}

/** Clear cache (e.g. tests). Not used in production paths. */
export function clearUpstoxInstrumentsCache(): void {
  cachedInstruments = null
  loadPromise = null
}

type Scored = { inst: NormalizedInstrument; tier: number }

/**
 * Search cached instruments. `q` should already be trimmed (length >= 2).
 * Returns up to 20 results: exact symbol first, then prefix symbol, then substring / ISIN / name;
 * NSE before BSE for ties.
 */
export async function searchUpstoxInstruments(qRaw: string, limit = 20): Promise<NormalizedInstrument[]> {
  const instruments = await ensureUpstoxInstrumentsLoaded()
  const qu = qRaw.trim().toUpperCase()
  if (qu.length < 2) return []

  const scored: Scored[] = []
  for (const inst of instruments) {
    const symU = inst.symbol.toUpperCase()
    const nameU = inst.name.toUpperCase()
    const isinU = inst.isin.toUpperCase()

    let tier: number | null = null
    if (symU === qu) tier = 0
    else if (symU.startsWith(qu)) tier = 1
    else if (symU.includes(qu)) tier = 2
    else if (isinU.includes(qu)) tier = 3
    else if (nameU.includes(qu)) tier = 4

    if (tier !== null) {
      scored.push({ inst, tier })
    }
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    const nseFirst = (x: NormalizedInstrument) => (x.exchange === 'NSE' ? 0 : 1)
    const ex = nseFirst(a.inst) - nseFirst(b.inst)
    if (ex !== 0) return ex
    const symCmp = a.inst.symbol.localeCompare(b.inst.symbol)
    if (symCmp !== 0) return symCmp
    return a.inst.instrumentKey.localeCompare(b.inst.instrumentKey)
  })

  return scored.slice(0, limit).map((s) => s.inst)
}
