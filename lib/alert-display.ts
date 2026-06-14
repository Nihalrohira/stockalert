import type { Alert } from '@/types/alert'

/** Primary label: e.g. "NIFTY 23000 CE" for options, or stock symbol for equity. */
export function getAlertPrimaryLabel(alert: Alert): string {
  if (
    alert.marketType === 'option' &&
    alert.underlyingSymbol &&
    alert.strikePrice != null &&
    alert.optionType
  ) {
    const strike =
      alert.strikePrice % 1 === 0 ? String(alert.strikePrice) : alert.strikePrice.toFixed(2)
    return `${alert.underlyingSymbol} ${strike} ${alert.optionType}`
  }
  return alert.stockSymbol
}

export function getAlertSecondaryLabel(alert: Alert): string {
  if (alert.marketType === 'option' && alert.expiryDate) {
    const expiry = formatExpiryDate(alert.expiryDate)
    return expiry ? `Expiry ${expiry}` : alert.stockName
  }
  return alert.stockName
}

export function formatExpiryDate(isoOrYmd: string | null): string {
  if (!isoOrYmd) return ''
  const d = new Date(isoOrYmd)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return isoOrYmd
}
