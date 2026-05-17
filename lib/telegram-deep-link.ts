/** t.me deep link that sends /start <pollKey> to the bot when the user taps START. */
export function buildTelegramBotDeepLink(pollKey: string, botUsername: string): string {
  const bot = botUsername.trim().replace(/^@/, '')
  return `https://t.me/${bot}?start=${encodeURIComponent(pollKey)}`
}

export function buildTelegramWebUrl(botUsername: string): string {
  const bot = botUsername.trim().replace(/^@/, '')
  return `https://web.telegram.org/k/#@${bot}`
}
