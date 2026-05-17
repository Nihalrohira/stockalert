import { fetchUpstoxLtp } from '@/lib/upstox'
import {
  sendTelegramMessage,
  formatTriggeredAlertTelegramMessage,
  formatLocalDateTime,
} from '@/lib/telegram'
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
 * One pass: load active+paused alerts for the Telegram user, batch-fetch LTP from Upstox,
 * update `current_price` in Supabase, then mark `triggered` (+ `triggered_at`) when rules hit (active only).
 */
export async function runAlertCheckOnce(
  telegramChatId: string,
  telegramUsername: string,
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

  const instrumentByAlertId = new Map<string, string>()
  const skippedNoLtp: string[] = []

  for (const a of alerts) {
    const key = a.instrument_key?.trim()
    if (!key) {
      skippedNoLtp.push(`no-instrument-key:${a.stock_symbol}`)
      continue
    }
    instrumentByAlertId.set(a.id, key)
  }

  const keys = [...new Set([...instrumentByAlertId.values()])]
  const ltpMap = keys.length > 0 ? await fetchUpstoxLtp(keys) : {}

  let currentPriceUpdates = 0
  let triggered = 0

  for (const alert of alerts) {
    const upstoxKey = instrumentByAlertId.get(alert.id)
    if (!upstoxKey) {
      continue
    }

    const ltp = ltpMap[upstoxKey]
    if (ltp === undefined || Number.isNaN(ltp)) {
      skippedNoLtp.push(upstoxKey)
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

    try {
      const text = formatTriggeredAlertTelegramMessage({
        stockSymbol: alert.stock_symbol,
        condition: alert.condition,
        targetPrice: alert.target_price,
        currentPrice: ltp,
        triggeredAtLocal: formatLocalDateTime(new Date(triggeredAt)),
      })
      await sendTelegramMessage(telegramChatId, text)
    } catch (tgErr) {
      console.error('[alert-checker] Telegram send failed', tgErr)
    }
  }

  return {
    alertsConsidered: alerts.length,
    pricesFetched: Object.keys(ltpMap).length,
    currentPriceUpdates,
    triggered,
    skippedNoLtp,
  }
}
