import { fetchGrowwLtp, toGrowwExchangeSymbol } from '@/lib/groww'
import { supabase } from '@/lib/supabase'
import { logSupabaseError } from '@/lib/supabase-errors'
import { fetchActiveAndPausedAlertsForUser } from '@/lib/alerts-repository'
import type { DbAlertRow } from '@/types/alert'

function conditionMet(alert: DbAlertRow, ltp: number): boolean {
  if (alert.condition === 'above') {
    return ltp >= alert.target_price
  }
  return ltp <= alert.target_price
}

export interface AlertCheckSummary {
  alertsConsidered: number
  pricesFetched: number
  currentPriceUpdates: number
  triggered: number
  skippedNoLtp: string[]
}

/**
 * One pass: load active+paused alerts for the Telegram user, batch-fetch LTP from Groww,
 * update `current_price` in Supabase, then mark `triggered` (+ `triggered_at`) when rules hit (active only).
 */
export async function runAlertCheckOnce(
  telegramChatId: string,
  telegramUsername: string
): Promise<AlertCheckSummary> {
  const alerts = await fetchActiveAndPausedAlertsForUser(telegramChatId, telegramUsername)
  if (alerts.length === 0) {
    return {
      alertsConsidered: 0,
      pricesFetched: 0,
      currentPriceUpdates: 0,
      triggered: 0,
      skippedNoLtp: [],
    }
  }

  const keys = [...new Set(alerts.map((a) => toGrowwExchangeSymbol(a.exchange, a.stock_symbol)))]
  const ltpMap = await fetchGrowwLtp(keys)

  const skippedNoLtp: string[] = []
  let currentPriceUpdates = 0
  let triggered = 0

  for (const alert of alerts) {
    const growwKey = toGrowwExchangeSymbol(alert.exchange, alert.stock_symbol)
    const ltp = ltpMap[growwKey]
    if (ltp === undefined || Number.isNaN(ltp)) {
      skippedNoLtp.push(growwKey)
      continue
    }

    const { error: priceErr } = await supabase
      .from('alerts')
      .update({ current_price: ltp })
      .eq('id', alert.id)
      .eq('user_id', alert.user_id)

    if (priceErr) {
      logSupabaseError(`[alert-checker] update current_price id=${alert.id}`, priceErr)
      continue
    }
    currentPriceUpdates += 1

    if (alert.status !== 'active') {
      continue
    }

    if (!conditionMet(alert, ltp)) {
      continue
    }

    const triggeredAt = new Date().toISOString()
    const { error: trigErr } = await supabase
      .from('alerts')
      .update({
        status: 'triggered',
        triggered_at: triggeredAt,
      })
      .eq('id', alert.id)
      .eq('user_id', alert.user_id)
      .eq('status', 'active')

    if (trigErr) {
      logSupabaseError(`[alert-checker] trigger alert id=${alert.id}`, trigErr)
      continue
    }
    triggered += 1
  }

  return {
    alertsConsidered: alerts.length,
    pricesFetched: Object.keys(ltpMap).length,
    currentPriceUpdates,
    triggered,
    skippedNoLtp,
  }
}
