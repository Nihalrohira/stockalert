import { NextResponse } from 'next/server'
import { runAlertCheckOnce } from '@/lib/alert-checker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { telegramChatId?: string; telegramUsername?: string }
    const telegramChatId = body.telegramChatId
    const telegramUsername = body.telegramUsername

    if (!telegramChatId || !telegramUsername) {
      return NextResponse.json({ error: 'telegramChatId and telegramUsername are required' }, { status: 400 })
    }

    const summary = await runAlertCheckOnce(telegramChatId, telegramUsername)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/alerts/check]', message, e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
