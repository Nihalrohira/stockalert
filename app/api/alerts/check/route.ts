import { NextResponse } from 'next/server'
import { runAlertCheckOnce } from '@/lib/alert-checker'
import { supabase } from '@/lib/supabase'
import { logSupabaseError } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function cronAuthFailure(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return null

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return null

  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
}

async function checkAlertsForUser(telegramChatId: string, telegramUsername: string) {
  const summary = await runAlertCheckOnce(telegramChatId, telegramUsername)
  return { telegramChatId, telegramUsername, summary }
}

export async function GET(request: Request) {
  const denied = cronAuthFailure(request)
  if (denied) return denied

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('telegram_chat_id, telegram_username')
      .eq('telegram_connected', true)

    if (error) {
      logSupabaseError('[api/alerts/check] GET list users', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const rows = (users ?? []) as { telegram_chat_id: string | null; telegram_username: string | null }[]
    const results: Awaited<ReturnType<typeof checkAlertsForUser>>[] = []

    for (const row of rows) {
      const chatId = row.telegram_chat_id?.trim()
      const username = row.telegram_username?.trim()
      if (!chatId || !username) continue
      results.push(await checkAlertsForUser(chatId, username))
    }

    return NextResponse.json({
      ok: true,
      usersChecked: results.length,
      results,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/alerts/check] GET', message, e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { telegramChatId?: string; telegramUsername?: string }
    const telegramChatId = body.telegramChatId?.trim()
    const telegramUsername = body.telegramUsername?.trim()

    if (!telegramChatId || !telegramUsername) {
      return NextResponse.json({ error: 'telegramChatId and telegramUsername are required' }, { status: 400 })
    }

    const summary = await runAlertCheckOnce(telegramChatId, telegramUsername)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/alerts/check] POST', message, e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
