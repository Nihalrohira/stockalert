import { supabase } from '@/lib/supabase'
import { logSupabaseError } from '@/lib/supabase-errors'
import type { AlertCondition, DbAlertRow } from '@/types/alert'

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function isAlertCondition(v: unknown): v is AlertCondition {
  return v === 'above' || v === 'below'
}

function isAlertStatus(v: unknown): v is DbAlertRow['status'] {
  return v === 'active' || v === 'paused' || v === 'triggered'
}

function parseDbAlertRow(raw: unknown): DbAlertRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  if (typeof r.user_id !== 'string') return null
  if (typeof r.stock_symbol !== 'string') return null
  if (typeof r.stock_name !== 'string') return null
  if (typeof r.exchange !== 'string') return null
  const instrumentKey =
    typeof r.instrument_key === 'string' && r.instrument_key.trim() !== '' ? r.instrument_key.trim() : null
  const targetPrice = parseNum(r.target_price)
  const currentPrice = parseNum(r.current_price)
  if (targetPrice === null || currentPrice === null) return null
  if (!isAlertCondition(r.condition)) return null
  if (!isAlertStatus(r.status)) return null
  if (typeof r.created_at !== 'string') return null
  if (r.valid_until !== null && typeof r.valid_until !== 'string') return null
  if (r.triggered_at !== null && typeof r.triggered_at !== 'string') return null

  return {
    id: r.id,
    user_id: r.user_id,
    instrument_key: instrumentKey,
    stock_symbol: r.stock_symbol,
    stock_name: r.stock_name,
    exchange: r.exchange,
    current_price: currentPrice,
    target_price: targetPrice,
    condition: r.condition,
    valid_until: r.valid_until as string | null,
    status: r.status,
    created_at: r.created_at,
    triggered_at: r.triggered_at as string | null,
  }
}

export async function findOrCreateUserId(telegramChatId: string, telegramUsername: string): Promise<string> {
  const { data: found, error: findErr } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_chat_id', telegramChatId)
    .maybeSingle()

  if (findErr) {
    logSupabaseError('[users] findOrCreateUserId select', findErr)
    throw findErr
  }

  if (found && typeof found === 'object' && 'id' in found && typeof (found as { id: unknown }).id === 'string') {
    return (found as { id: string }).id
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('users')
    .insert({
      telegram_chat_id: telegramChatId,
      telegram_username: telegramUsername,
      telegram_connected: false,
    })
    .select('id')
    .single()

  if (!insertErr && inserted && typeof inserted === 'object' && 'id' in inserted) {
    const id = (inserted as { id: unknown }).id
    if (typeof id === 'string') return id
  }

  if (insertErr) {
    logSupabaseError('[users] findOrCreateUserId insert', insertErr)
    const { data: retry, error: retryErr } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', telegramChatId)
      .maybeSingle()

    if (retryErr) {
      logSupabaseError('[users] findOrCreateUserId select after insert failure', retryErr)
      throw insertErr
    }
    if (retry && typeof retry === 'object' && 'id' in retry && typeof (retry as { id: unknown }).id === 'string') {
      return (retry as { id: string }).id
    }
    throw insertErr
  }

  const err = new Error('[users] findOrCreateUserId: insert returned no id')
  logSupabaseError('[users] findOrCreateUserId', err)
  throw err
}

export async function fetchAlertsForTelegramUser(
  telegramChatId: string,
  telegramUsername: string
): Promise<DbAlertRow[]> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    logSupabaseError('[alerts] fetchAlertsForTelegramUser', error)
    throw error
  }

  return (data ?? []).map(parseDbAlertRow).filter((x): x is DbAlertRow => x !== null)
}

/** Active + paused rows (LTP refresh); the checker triggers only `active` rows. */
export async function fetchActiveAndPausedAlertsForUser(
  telegramChatId: string,
  telegramUsername: string
): Promise<DbAlertRow[]> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })

  if (error) {
    logSupabaseError('[alerts] fetchActiveAndPausedAlertsForUser', error)
    throw error
  }

  return (data ?? []).map(parseDbAlertRow).filter((x): x is DbAlertRow => x !== null)
}

export async function insertAlertForTelegramUser(
  telegramChatId: string,
  telegramUsername: string,
  input: {
    instrument_key: string
    stock_symbol: string
    stock_name: string
    exchange: 'NSE' | 'BSE'
    current_price: number
    target_price: number
    condition: AlertCondition
    valid_until: string | null
  }
): Promise<DbAlertRow> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      instrument_key: input.instrument_key,
      stock_symbol: input.stock_symbol,
      stock_name: input.stock_name,
      exchange: input.exchange,
      current_price: input.current_price,
      target_price: input.target_price,
      condition: input.condition,
      valid_until: input.valid_until,
      status: 'active',
      triggered_at: null,
    })
    .select('*')
    .single()

  if (error) {
    logSupabaseError('[alerts] insertAlertForTelegramUser', error)
    throw error
  }

  const parsed = parseDbAlertRow(data)
  if (!parsed) {
    const err = new Error('[alerts] insertAlertForTelegramUser: unparsable row')
    logSupabaseError('[alerts] insertAlertForTelegramUser parse', err)
    throw err
  }
  return parsed
}

export async function updateAlertPausedForTelegramUser(
  telegramChatId: string,
  telegramUsername: string,
  alertId: string,
  paused: boolean
): Promise<void> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)
  const status = paused ? 'paused' : 'active'

  const { error } = await supabase
    .from('alerts')
    .update({ status })
    .eq('id', alertId)
    .eq('user_id', userId)

  if (error) {
    logSupabaseError('[alerts] updateAlertPausedForTelegramUser', error)
    throw error
  }
}

export async function deleteAlertForTelegramUser(
  telegramChatId: string,
  telegramUsername: string,
  alertId: string
): Promise<void> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)

  const { error } = await supabase.from('alerts').delete().eq('id', alertId).eq('user_id', userId)

  if (error) {
    logSupabaseError('[alerts] deleteAlertForTelegramUser', error)
    throw error
  }
}

export async function markAlertTriggeredForTelegramUser(
  telegramChatId: string,
  telegramUsername: string,
  alertId: string
): Promise<void> {
  const userId = await findOrCreateUserId(telegramChatId, telegramUsername)
  const triggeredAt = new Date().toISOString()

  const { error } = await supabase
    .from('alerts')
    .update({
      status: 'triggered',
      triggered_at: triggeredAt,
    })
    .eq('id', alertId)
    .eq('user_id', userId)

  if (error) {
    logSupabaseError('[alerts] markAlertTriggeredForTelegramUser', error)
    throw error
  }
}
