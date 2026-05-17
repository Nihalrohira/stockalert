import { resolveTelegramIdentity } from '@/lib/telegram-identity'

type TelegramUpdate = Record<string, unknown>

function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing (required for getUpdates).')
  }
  return token
}

/** Fetches recent updates from Telegram (long-polling API, offset not advanced). */
export async function fetchTelegramGetUpdates(limit = 100): Promise<TelegramUpdate[]> {
  const token = requireBotToken()
  const url = `https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`
  const res = await fetch(url)
  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`Telegram getUpdates HTTP ${res.status}: ${rawText.slice(0, 400)}`)
  }
  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error('Telegram getUpdates: response was not JSON')
  }
  const o = json as { ok?: boolean; result?: unknown; description?: string }
  if (o.ok !== true) {
    throw new Error(`Telegram getUpdates API error: ${o.description ?? 'unknown'}`)
  }
  const result = o.result
  if (!Array.isArray(result)) {
    return []
  }
  return result as TelegramUpdate[]
}

/**
 * Finds a private chat message whose text exactly matches `exactText` (after trim on message text only).
 */
export function findPrivateMessageExactText(
  updates: TelegramUpdate[],
  exactText: string,
): { chatId: number; username: string; isTelegramUsername: boolean } | null {
  const want = exactText.trim()
  for (const upd of updates) {
    const msg = upd.message as Record<string, unknown> | undefined
    if (!msg || typeof msg !== 'object') continue
    const rawText = typeof msg.text === 'string' ? msg.text.trim() : ''
    if (rawText !== want) continue
    const chat = msg.chat as { id?: number; type?: string } | undefined
    if (!chat || typeof chat.id !== 'number') continue
    if (chat.type && chat.type !== 'private') continue
    const from = msg.from as
      | { username?: string; first_name?: string; last_name?: string; id?: number }
      | undefined
    const identity = resolveTelegramIdentity(from, chat.id)
    return {
      chatId: chat.id,
      username: identity.stored,
      isTelegramUsername: identity.isTelegramUsername,
    }
  }
  return null
}
