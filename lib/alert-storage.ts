import type { Alert, AlertCondition, AlertStatus } from '@/types/alert'

export const ALERTS_STORAGE_KEY = 'stockalert_alerts'

export function createAlertId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function isAlertCondition(x: unknown): x is AlertCondition {
  return x === 'above' || x === 'below'
}

function isAlertStatus(x: unknown): x is AlertStatus {
  return x === 'active' || x === 'paused' || x === 'triggered'
}

function isExchange(x: unknown): x is 'NSE' | 'BSE' {
  return x === 'NSE' || x === 'BSE'
}

function parseAlert(x: unknown): Alert | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  if (typeof o.telegramChatId !== 'string') return null
  if (typeof o.stockSymbol !== 'string') return null
  if (typeof o.stockName !== 'string') return null
  if (!isExchange(o.exchange)) return null
  if (typeof o.currentPrice !== 'number' || Number.isNaN(o.currentPrice)) return null
  if (typeof o.targetPrice !== 'number' || Number.isNaN(o.targetPrice)) return null
  if (!isAlertCondition(o.condition)) return null
  if (o.validUntil !== null && typeof o.validUntil !== 'string') return null
  if (!isAlertStatus(o.status)) return null
  if (typeof o.createdAt !== 'string') return null
  if (o.triggeredAt !== null && typeof o.triggeredAt !== 'string') return null
  return {
    id: o.id,
    telegramChatId: o.telegramChatId,
    stockSymbol: o.stockSymbol,
    stockName: o.stockName,
    exchange: o.exchange,
    currentPrice: o.currentPrice,
    targetPrice: o.targetPrice,
    condition: o.condition,
    validUntil: o.validUntil as string | null,
    status: o.status,
    createdAt: o.createdAt,
    triggeredAt: o.triggeredAt as string | null,
  }
}

export function readAlertsFromStorage(): Alert[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseAlert).filter((a): a is Alert => a !== null)
  } catch {
    return []
  }
}

export function writeAlertsToStorage(alerts: Alert[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts))
  } catch {
    // ignore quota / private mode
  }
}
