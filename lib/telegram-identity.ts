export type TelegramFromUser = {
  username?: string
  first_name?: string
  last_name?: string
}

export type ResolvedTelegramIdentity = {
  /** Stored in DB and passed as telegramUsername (no leading @). */
  stored: string
  isTelegramUsername: boolean
}

/**
 * Resolves the identity string to store and whether it is a Telegram @username.
 * 1. username → stored without @, show with @
 * 2. else first_name + last_name
 * 3. else user_<chatId>
 */
export function resolveTelegramIdentity(
  from: TelegramFromUser | undefined,
  chatId: number | string,
): ResolvedTelegramIdentity {
  const chatIdStr = String(chatId)

  const tgUsername = from?.username?.trim()
  if (tgUsername) {
    return { stored: tgUsername, isTelegramUsername: true }
  }

  const first = from?.first_name?.trim() ?? ''
  const last = from?.last_name?.trim() ?? ''
  const displayName = [first, last].filter(Boolean).join(' ').trim()
  if (displayName) {
    return { stored: displayName, isTelegramUsername: false }
  }

  return { stored: `user_${chatIdStr}`, isTelegramUsername: false }
}

export function formatTelegramIdentityLabel(identity: ResolvedTelegramIdentity): string {
  if (identity.isTelegramUsername) {
    return `@${identity.stored}`
  }
  return identity.stored
}

/** For legacy localStorage rows without isTelegramUsername. */
export function inferIsTelegramUsername(stored: string, chatId: string): boolean {
  if (stored === `user_${chatId}`) return false
  if (/\s/.test(stored)) return false
  return true
}

export function formatTelegramUserLabel(
  stored: string,
  chatId: string,
  isTelegramUsername?: boolean,
): string {
  const isUser = isTelegramUsername ?? inferIsTelegramUsername(stored, chatId)
  if (isUser) return `@${stored}`
  return stored
}
