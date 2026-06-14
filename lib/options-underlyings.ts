/** Query param `underlying` → Upstox index instrument key. */
export const OPTION_UNDERLYING_INSTRUMENT_KEYS: Record<string, string> = {
  NIFTY: 'NSE_INDEX|Nifty 50',
  BANKNIFTY: 'NSE_INDEX|Nifty Bank',
  FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
  MIDCPNIFTY: 'NSE_INDEX|Nifty Midcap Select',
}

export const OPTION_UNDERLYING_SYMBOLS = Object.keys(OPTION_UNDERLYING_INSTRUMENT_KEYS) as Array<
  keyof typeof OPTION_UNDERLYING_INSTRUMENT_KEYS
>

export function resolveUnderlyingInstrumentKey(underlying: string): string | null {
  const key = underlying.trim().toUpperCase()
  return OPTION_UNDERLYING_INSTRUMENT_KEYS[key] ?? null
}
