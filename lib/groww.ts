const GROWW_LTP_URL = 'https://api.groww.in/v1/live-data/ltp'
const MAX_SYMBOLS_PER_REQUEST = 50

function getGrowwAccessToken(): string {
  const token = process.env.GROWW_ACCESS_TOKEN
  if (!token || token.trim() === '') {
    throw new Error('GROWW_ACCESS_TOKEN is not set')
  }
  return token.trim()
}

/** e.g. NSE_RELIANCE, BSE_SENSEX */
export function toGrowwExchangeSymbol(exchange: string, stockSymbol: string): string {
  const ex = exchange.toUpperCase() === 'BSE' ? 'BSE' : 'NSE'
  return `${ex}_${stockSymbol.toUpperCase()}`
}

/**
 * Last traded prices from Groww. Pass Groww `exchange_symbols` keys (e.g. NSE_RELIANCE).
 * Batches up to 50 symbols per HTTP call per Groww docs.
 */
export async function fetchGrowwLtp(exchangeSymbols: string[]): Promise<Record<string, number>> {
  const token = getGrowwAccessToken()
  const unique = [...new Set(exchangeSymbols.map((s) => s.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return {}
  }

  const out: Record<string, number> = {}

  for (let i = 0; i < unique.length; i += MAX_SYMBOLS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_SYMBOLS_PER_REQUEST)
    const params = new URLSearchParams({
      segment: 'CASH',
      exchange_symbols: chunk.join(','),
    })

    const res = await fetch(`${GROWW_LTP_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-API-VERSION': '1.0',
      },
    })

    const rawText = await res.text()
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
      throw new Error(`Groww LTP unexpected body: ${JSON.stringify(body)}`)
    }

    for (const [key, value] of Object.entries(body.payload)) {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
      if (!Number.isNaN(n)) {
        out[key] = n
      }
    }
  }

  return out
}
