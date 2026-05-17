import { NextResponse } from 'next/server'
import { setTelegramWebhookUrl } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getPublicAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) {
    return explicit.replace(/\/$/, '')
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return `https://${vercel.replace(/\/$/, '')}`
  }
  throw new Error(
    'Set NEXT_PUBLIC_APP_URL to your public site origin (e.g. https://myapp.vercel.app), or deploy on Vercel so VERCEL_URL is set.',
  )
}

export async function POST() {
  try {
    const base = getPublicAppBaseUrl()
    const webhookUrl = `${base}/api/telegram/webhook`
    const telegramResponse = await setTelegramWebhookUrl(webhookUrl)
    return NextResponse.json({ ok: true, webhookUrl, telegram: telegramResponse })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/telegram/set-webhook]', message, e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
