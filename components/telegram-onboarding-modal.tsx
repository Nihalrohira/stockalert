'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Loader, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TelegramConnectSessionProps {
  pollKey: string
  startCommand: string
  telegramWebUrl: string
}

interface TelegramOnboardingModalProps {
  state: 'idle' | 'connecting'
  onConnect: () => void
  /** When false, Connect is disabled (e.g. before localStorage hydration). */
  allowConnect?: boolean
  /** Bot username without @ (from NEXT_PUBLIC_TELEGRAM_BOT_USERNAME). */
  telegramBotUsername?: string
  /** After prepare succeeds: command and Telegram Web URL from the API. */
  connectSession?: TelegramConnectSessionProps | null
}

export function TelegramOnboardingModal({
  state,
  onConnect,
  allowConnect = true,
  telegramBotUsername,
  connectSession = null,
}: TelegramOnboardingModalProps) {
  const botDisplay = (telegramBotUsername ?? 'your_bot').replace(/^@/, '')
  const startCommand = connectSession?.startCommand ?? ''
  const telegramWebUrl = connectSession?.telegramWebUrl ?? ''
  const [copyHint, setCopyHint] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    setCopyHint('idle')
  }, [connectSession?.pollKey])

  // Prevent body scroll when modal is visible
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Prevent escape key from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCopyCommand = async () => {
    if (!startCommand) return
    try {
      await navigator.clipboard.writeText(startCommand)
      setCopyHint('copied')
      window.setTimeout(() => setCopyHint('idle'), 2000)
    } catch {
      setCopyHint('error')
      window.setTimeout(() => setCopyHint('idle'), 2500)
    }
  }

  const showCommandInstructions = state === 'connecting' && connectSession
  const showPreparing = state === 'connecting' && !connectSession

  return (
    <>
      {/* Blurred backdrop — above app chrome; no click handler (does not close). */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" aria-hidden />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full space-y-6 p-8 pointer-events-auto">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Connect Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Telegram is required to receive instant stock price alerts
            </p>
          </div>

          {showCommandInstructions ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">Send this command to the bot:</p>
              <pre className="text-left text-sm font-mono bg-muted/80 border border-border rounded-md px-3 py-2 break-all whitespace-pre-wrap">
                {startCommand}
              </pre>
              <p className="text-xs text-muted-foreground">
                In Telegram Web, open a private chat with{' '}
                <span className="font-mono text-foreground">@{botDisplay}</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleCopyCommand()}
                >
                  <Copy className="w-4 h-4 mr-2 shrink-0" />
                  Copy Command
                </Button>
                <Button type="button" variant="secondary" size="sm" className="flex-1" asChild>
                  <a href={telegramWebUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2 shrink-0" />
                    Open Telegram Web
                  </a>
                </Button>
              </div>
              {copyHint === 'copied' && (
                <p className="text-xs text-green-600 dark:text-green-400">Copied to clipboard</p>
              )}
              {copyHint === 'error' && (
                <p className="text-xs text-destructive">Could not copy — select and copy manually</p>
              )}
            </div>
          ) : showPreparing ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                <Loader className="w-5 h-5 text-primary animate-spin shrink-0" />
                <p className="text-sm text-foreground">Preparing your Telegram link…</p>
              </div>
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
                  <p className="font-medium text-foreground">Click Connect Telegram</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We will show you the exact <span className="font-mono text-foreground">/start …</span>{' '}
                    command to paste in Telegram Web
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
                  <p className="font-medium text-foreground">Use Telegram Web</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open Telegram Web, find <span className="font-mono text-foreground">@{botDisplay}</span>, and
                    send the command we show you
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
                  <p className="font-medium text-foreground">Return here and continue</p>
                  <p className="text-sm text-muted-foreground mt-1">Connection will be confirmed automatically</p>
                </div>
              </div>
            </div>
          )}

          {state === 'connecting' && connectSession && (
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
              <Loader className="w-5 h-5 text-primary animate-spin shrink-0" />
              <p className="text-sm text-foreground">Waiting for your /start message in Telegram…</p>
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
                Please wait...
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
