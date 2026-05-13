'use client'

import { useEffect } from 'react'
import { MessageCircle, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TelegramOnboardingModalProps {
  state: 'idle' | 'connecting'
  onConnect: () => void
  /** When false, Connect is disabled (e.g. before localStorage hydration). */
  allowConnect?: boolean
}

export function TelegramOnboardingModal({
  state,
  onConnect,
  allowConnect = true,
}: TelegramOnboardingModalProps) {
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

          {/* Steps */}
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
                <p className="text-sm text-muted-foreground mt-1">Open Telegram on your device</p>
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
                <p className="font-medium text-foreground">Press Start in Telegram bot</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Message @StockAlertBot and press the Start button
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

          {/* Waiting state after Connect is clicked */}
          {state === 'connecting' && (
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
              <Loader className="w-5 h-5 text-primary animate-spin" />
              <p className="text-sm text-foreground">Connecting to Telegram...</p>
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
