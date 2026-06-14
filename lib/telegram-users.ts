import { supabase } from '@/lib/supabase'
import { logSupabaseError } from '@/lib/supabase-errors'

/**
 * Create or update a user row by Telegram chat id and mark them as connected.
 */
export async function upsertTelegramUserConnected(
  telegramChatId: string,
  telegramUsername: string,
): Promise<void> {
  const chatId = telegramChatId.trim()
  const username = telegramUsername.trim() || 'user'

  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (findErr) {
    logSupabaseError('[telegram-users] upsert select', findErr)
    throw findErr
  }

  if (existing && typeof existing === 'object' && 'id' in existing) {
    const { error: updErr } = await supabase
      .from('users')
      .update({
        telegram_username: username,
        telegram_connected: true,
      })
      .eq('telegram_chat_id', chatId)

    if (updErr) {
      logSupabaseError('[telegram-users] upsert update', updErr)
      throw updErr
    }
    return
  }

  const { error: insErr } = await supabase.from('users').insert({
    telegram_chat_id: chatId,
    telegram_username: username,
    telegram_connected: true,
  })

  if (insErr) {
    logSupabaseError('[telegram-users] upsert insert', insErr)
    throw insErr
  }
}
