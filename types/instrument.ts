/** Row returned by `GET /api/instruments/search` (matches `NormalizedInstrument`). */
export interface InstrumentSearchResult {
  symbol: string
  name: string
  exchange: 'NSE' | 'BSE'
  instrumentKey: string
  isin: string
}

/** Stock chosen for alert creation (includes live LTP). */
export interface SelectedInstrumentStock {
  instrumentKey: string
  symbol: string
  company: string
  exchange: 'NSE' | 'BSE'
  price: number
  /** Optional day change % — omitted when not available from Upstox LTP. */
  change?: number
}
