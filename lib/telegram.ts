function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing. Add it to the server environment (e.g. .env.local) for Telegram messaging.',
    )
  }
  return token
}

async function readTelegramJson(method: string, init: RequestInit): Promise<unknown> {
  const token = requireBotToken()
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, init)
  const rawText = await res.text()

  if (!res.ok) {
    const preview = rawText.length > 500 ? `${rawText.slice(0, 500)}…` : rawText
    throw new Error(`Telegram HTTP ${res.status} for ${method}: ${preview}`)
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error(`Telegram ${method}: response was not JSON: ${rawText.slice(0, 200)}`)
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`Telegram ${method}: invalid JSON envelope`)
  }

  const o = json as { ok?: boolean; description?: string }
  if (o.ok !== true) {
    throw new Error(`Telegram API error (${method}): ${o.description ?? JSON.stringify(json).slice(0, 300)}`)
  }

  return json
}

/**
 * Registers the bot webhook URL with Telegram (server-side only).
 * Optionally sets `secret_token` from `TELEGRAM_WEBHOOK_SECRET` for `X-Telegram-Bot-Api-Secret-Token` verification.
 */
export async function setTelegramWebhookUrl(webhookUrl: string): Promise<unknown> {
  const token = requireBotToken()
  const body: Record<string, unknown> = { url: webhookUrl }
  const sec = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (sec) {
    body.secret_token = sec
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`Telegram setWebhook HTTP ${res.status}: ${rawText.slice(0, 500)}`)
  }
  const j = JSON.parse(rawText) as { ok?: boolean; description?: string; result?: unknown }
  if (j.ok !== true) {
    throw new Error(`Telegram setWebhook API error: ${j.description ?? rawText.slice(0, 300)}`)
  }
  return j
}

/**
 * Sends a message to a Telegram chat (server-side only).
 * Uses HTML parse mode; escape user-controlled text before interpolating into `text`.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const trimmed = chatId.trim()
  if (!trimmed) {
    throw new Error('sendTelegramMessage: chatId is empty')
  }

  await readTelegramJson('sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: trimmed,
      text,
      parse_mode: 'HTML',
    }),
  })
}

export function escapeHtmlForTelegram(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM-DD HH:mm:ss` in the runtime default timezone. */
export function formatLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function formatTriggeredAlertTelegramMessage(params: {
  stockSymbol: string
  condition: 'above' | 'below'
  targetPrice: number
  currentPrice: number
  triggeredAtLocal: string
}): string {
  const stock = escapeHtmlForTelegram(params.stockSymbol)
  const cond = params.condition === 'above' ? 'ABOVE' : 'BELOW'
  const target = params.targetPrice.toFixed(2)
  const cur = params.currentPrice.toFixed(2)
  const when = escapeHtmlForTelegram(params.triggeredAtLocal)
  return [
    '🚨 <b>Stock Alert Triggered</b>',
    '',
    `<b>Stock:</b> ${stock}`,
    `<b>Condition:</b> ${cond}`,
    `<b>Target:</b> ₹${target}`,
    `<b>Current Price:</b> ₹${cur}`,
    '',
    '<b>Triggered At:</b>',
    when,
  ].join('\n')
}
