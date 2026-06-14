import { NextResponse } from 'next/server'
import { runAlertCheckOnce, type AlertCheckSummary } from '@/lib/alert-checker'
import { supabase } from '@/lib/supabase'
import { logSupabaseError } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ConnectedUser = {
  telegram_chat_id: string
  telegram_username: string
}

type UserCheckResult = {
  telegramChatId: string
  telegramUsername: string
  summary: AlertCheckSummary
}

async function fetchConnectedUsers(): Promise<ConnectedUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_chat_id, telegram_username')
    .eq('telegram_connected', true)

  if (error) {
    logSupabaseError('[api/alerts/check] list connected users', error)
    throw error
  }

  const rows = (data ?? []) as { telegram_chat_id: string | null; telegram_username: string | null }[]
  const users: ConnectedUser[] = []
  for (const row of rows) {
    const telegram_chat_id = row.telegram_chat_id?.trim()
    const telegram_username = row.telegram_username?.trim()
    if (telegram_chat_id && telegram_username) {
      users.push({ telegram_chat_id, telegram_username })
    }
  }
  return users
}

/** Runs alert checks for every Telegram-connected user (cron / GET). */
async function runAlertCheckForAllConnectedUsers(): Promise<{
  results: UserCheckResult[]
  checked: number
  triggered: number
}> {
  const users = await fetchConnectedUsers()
  const results: UserCheckResult[] = []
  let checked = 0
  let triggered = 0

  for (const user of users) {
    const summary = await runAlertCheckOnce(user.telegram_chat_id, user.telegram_username)
    results.push({
      telegramChatId: user.telegram_chat_id,
      telegramUsername: user.telegram_username,
      summary,
    })
    checked += summary.alertsConsidered
    triggered += summary.triggered
  }

  return { results, checked, triggered }
}

/** Runs alert check for one user (dashboard / POST). */
async function runAlertCheckForUser(
  telegramChatId: string,
  telegramUsername: string,
): Promise<AlertCheckSummary> {
  return runAlertCheckOnce(telegramChatId, telegramUsername)
}

export async function GET() {
  try {
    const { results, checked, triggered } = await runAlertCheckForAllConnectedUsers()

    return NextResponse.json(
      {
        success: true,
        checked,
        triggered,
        ok: true,
        usersChecked: results.length,
        results,
      },
      { status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/alerts/check] GET', message, e)
    return NextResponse.json({ success: false, ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { telegramChatId?: string; telegramUsername?: string }
    const telegramChatId = body.telegramChatId?.trim()
    const telegramUsername = body.telegramUsername?.trim()

    if (!telegramChatId || !telegramUsername) {
      return NextResponse.json(
        { success: false, ok: false, error: 'telegramChatId and telegramUsername are required' },
        { status: 400 },
      )
    }

    const summary = await runAlertCheckForUser(telegramChatId, telegramUsername)
    return NextResponse.json(
      {
        success: true,
        checked: summary.alertsConsidered,
        triggered: summary.triggered,
        ok: true,
        summary,
      },
      { status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/alerts/check] POST', message, e)
    return NextResponse.json({ success: false, ok: false, error: message }, { status: 500 })
  }
}
