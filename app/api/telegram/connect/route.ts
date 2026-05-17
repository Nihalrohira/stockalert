import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase'
import { upsertTelegramUserConnected } from '@/lib/telegram-users'
import { inferIsTelegramUsername } from '@/lib/telegram-identity'
import { fetchTelegramGetUpdates, findPrivateMessageExactText } from '@/lib/telegram-get-updates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getPublicBotUsername(): string | null {
  const u = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
  return u || null
}

export async function GET(request: Request) {
  let pathname = ''
  let search = ''
  try {
    const url = new URL(request.url)
    pathname = url.pathname
    search = url.search
    const prepare = url.searchParams.get('prepare')
    const pollKeyParam = url.searchParams.get('poll_key')
    const telegramUsername = url.searchParams.get('telegram_username')?.trim()
    const chatId = url.searchParams.get('chat_id')?.trim()

    if (prepare === '1') {
      const bot = getPublicBotUsername()
      if (!bot) {
        console.error(
          '[api/telegram/connect] prepare=1 blocked: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not set',
        )
        return NextResponse.json(
          {
            error:
              'Server misconfiguration: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is required for Telegram Web URL.',
          },
          { status: 500 },
        )
      }

      const pollKey = `connect_${randomBytes(16).toString('hex')}`
      const { error } = await supabase.from('telegram_link_poll').insert({
        poll_key: pollKey,
        status: 'pending',
      })
      if (error) {
        console.error('[api/telegram/connect] prepare insert failed', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const startCommand = `/start ${pollKey}`
      const telegramWebUrl = `https://web.telegram.org/k/#@${bot}`
      return NextResponse.json({
        ok: true,
        pollKey,
        startCommand,
        telegramWebUrl,
      })
    }

    if (pollKeyParam) {
      const pollKey = pollKeyParam.trim()
      if (!pollKey) {
        return NextResponse.json({ error: 'poll_key is empty' }, { status: 400 })
      }

      const { data: existing, error: existingErr } = await supabase
        .from('telegram_link_poll')
        .select('telegram_chat_id, telegram_username, status')
        .eq('poll_key', pollKey)
        .maybeSingle()

      if (existingErr) {
        console.error('[api/telegram/connect] poll select failed', existingErr)
        return NextResponse.json({ error: existingErr.message }, { status: 500 })
      }

      const row0 = existing as {
        telegram_chat_id: string | null
        telegram_username: string | null
        status: string | null
      } | null

      if (
        row0 &&
        row0.status === 'connected' &&
        row0.telegram_chat_id &&
        row0.telegram_username
      ) {
        return NextResponse.json({
          ok: true,
          connected: true,
          user: {
            telegramChatId: row0.telegram_chat_id,
            telegramUsername: row0.telegram_username,
            isTelegramUsername: inferIsTelegramUsername(
              row0.telegram_username,
              row0.telegram_chat_id,
            ),
          },
        })
      }

      if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
        console.error('[api/telegram/connect] poll: TELEGRAM_BOT_TOKEN missing')
        return NextResponse.json(
          { ok: false, error: 'TELEGRAM_BOT_TOKEN is required for getUpdates polling.' },
          { status: 500 },
        )
      }

      const exactCommand = `/start ${pollKey}`

      let updates: Awaited<ReturnType<typeof fetchTelegramGetUpdates>>
      try {
        updates = await fetchTelegramGetUpdates(100)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[api/telegram/connect] getUpdates failed', message, e)
        return NextResponse.json({ ok: false, error: message }, { status: 502 })
      }

      const match = findPrivateMessageExactText(updates, exactCommand)
      if (!match) {
        return NextResponse.json({ ok: true, connected: false })
      }

      const nowIso = new Date().toISOString()
      const { error: updErr } = await supabase
        .from('telegram_link_poll')
        .update({
          status: 'connected',
          telegram_chat_id: String(match.chatId),
          telegram_username: match.username,
          connected_at: nowIso,
        })
        .eq('poll_key', pollKey)

      if (updErr) {
        console.error('[api/telegram/connect] poll row update failed', updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      try {
        await upsertTelegramUserConnected(String(match.chatId), match.username)
      } catch (upErr) {
        console.error('[api/telegram/connect] upsert user after getUpdates match failed', upErr)
        const message = upErr instanceof Error ? upErr.message : String(upErr)
        return NextResponse.json({ error: message }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        connected: true,
        user: {
          telegramChatId: String(match.chatId),
          telegramUsername: match.username,
          isTelegramUsername: match.isTelegramUsername,
        },
      })
    }

    if (telegramUsername && chatId) {
      try {
        await upsertTelegramUserConnected(chatId, telegramUsername)
      } catch (upErr) {
        console.error('[api/telegram/connect] manual upsert failed', upErr)
        const message = upErr instanceof Error ? upErr.message : String(upErr)
        return NextResponse.json({ error: message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, telegram_connected: true })
    }

    console.error('[api/telegram/connect] bad query', { pathname, search })
    return NextResponse.json(
      {
        error:
          'Invalid query. Use prepare=1, poll_key=..., or both telegram_username and chat_id.',
      },
      { status: 400 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/telegram/connect] unhandled error', { pathname, search, message, e })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
