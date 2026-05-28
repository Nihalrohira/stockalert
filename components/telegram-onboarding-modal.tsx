'use client'

import { useEffect } from 'react'
import { MessageCircle, Loader, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TelegramConnectSessionProps {
  pollKey: string
  deepLinkUrl: string
  telegramWebUrl?: string
}

interface TelegramOnboardingModalProps {
  state: 'idle' | 'connecting'
  onConnect: () => void
  allowConnect?: boolean
  telegramBotUsername?: string
  connectSession?: TelegramConnectSessionProps | null
}

export function TelegramOnboardingModal({
  state,
  onConnect,
  allowConnect = true,
  telegramBotUsername,
  connectSession = null,
}: TelegramOnboardingModalProps) {
  const botDisplay = (telegramBotUsername ?? 'stock915_bot').replace(/^@/, '')
  const deepLinkUrl = connectSession?.deepLinkUrl ?? ''
  const telegramWebUrl =
    connectSession?.telegramWebUrl ?? `https://web.telegram.org/k/#@${botDisplay}`

  const openDeepLink = () => {
    if (!deepLinkUrl) return
    window.open(deepLinkUrl, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const showConnecting = state === 'connecting' && connectSession
  const showPreparing = state === 'connecting' && !connectSession

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" aria-hidden />

      <div className="fixed inset-0 z-[101] flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full space-y-6 p-8 pointer-events-auto">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Connect Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Connect Telegram to receive instant stock alerts.
            </p>
          </div>

          {showConnecting ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground text-center">
                Telegram opens next. Choose OPEN IN WEB, then tap Start in the bot chat.
              </p>
              <Button type="button" variant="secondary" className="w-full" onClick={openDeepLink}>
                Open Telegram Again
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Prefer Telegram Web?{' '}
                <a
                  href={telegramWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Open @{botDisplay} in Telegram Web
                </a>
              </p>
            </div>
          ) : showPreparing ? (
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
              <Loader className="w-5 h-5 text-primary animate-spin shrink-0" />
              <p className="text-sm text-foreground">Opening Telegram...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div className="w-0.5 h-12 bg-border mt-2" />
                </div>
                <div className="pt-1">
                  <p className="font-medium text-foreground">Open Telegram</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We open the <span className="font-mono text-foreground">@{botDisplay}</span> chat so you can
                    securely link your account.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div className="w-0.5 h-12 bg-border mt-2" />
                </div>
                <div className="pt-1">
                  <p className="font-medium text-foreground">OPEN IN WEB, then Start</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    On Telegram, choose OPEN IN WEB, then press Start in the chat with{' '}
                    <span className="font-mono text-foreground">@{botDisplay}</span>.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                </div>
                <div className="pt-1">
                  <p className="font-medium text-foreground">Return to 915 Stock Alerts</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connection completes automatically right after you press Start.
                  </p>
                </div>
              </div>
            </div>
          )}

          {state === 'connecting' && connectSession && (
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
              <Loader className="w-5 h-5 text-primary animate-spin shrink-0" />
              <p className="text-sm text-foreground">Confirming your connection...</p>
            </div>
          )}

          <Button
            onClick={onConnect}
            disabled={state === 'connecting' || !allowConnect}
            className="w-full bg-primary text-primary-foreground hover:opacity-90 h-11 font-medium"
          >
            {state === 'connecting' ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Telegram'
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
