import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveTelegramIdentity } from '@/lib/telegram-identity'
import { upsertTelegramUserConnected } from '@/lib/telegram-users'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TgUser = { id?: number; username?: string; first_name?: string; last_name?: string }
type TgChat = { id?: number; type?: string }

function extractPrivateMessage(update: unknown): {
  text: string
  chatId: number
  from: TgUser
} | null {
  if (!update || typeof update !== 'object') return null
  const u = update as Record<string, unknown>
  const raw = u.message ?? u.edited_message
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const chat = m.chat as TgChat | undefined
  if (!chat || typeof chat.id !== 'number') return null
  if (chat.type && chat.type !== 'private') return null
  const text = typeof m.text === 'string' ? m.text : ''
  const from = (m.from as TgUser) ?? {}
  return { text, chatId: chat.id, from }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Telegram delivers updates via POST to this URL.',
  })
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (secret) {
    const hdr = request.headers.get('x-telegram-bot-api-secret-token')
    if (hdr !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  let update: unknown
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const msg = extractPrivateMessage(update)
  if (!msg) {
    return NextResponse.json({ ok: true })
  }

  const parts = msg.text.trim().split(/\s+/)
  if (parts[0] !== '/start') {
    return NextResponse.json({ ok: true })
  }

  const deep = parts.length >= 2 ? parts[1].trim() : ''
  const { stored: username } = resolveTelegramIdentity(msg.from, msg.chatId)

  try {
    await upsertTelegramUserConnected(String(msg.chatId), username)
  } catch (e) {
    console.error('[api/telegram/webhook] upsert user failed', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if (deep.startsWith('connect_')) {
    const { error } = await supabase
      .from('telegram_link_poll')
      .update({
        status: 'connected',
        telegram_chat_id: String(msg.chatId),
        telegram_username: username,
        connected_at: new Date().toISOString(),
      })
      .eq('poll_key', deep)

    if (error) {
      console.error('[api/telegram/webhook] poll update failed', error)
    }
  }

  return NextResponse.json({ ok: true })
}
