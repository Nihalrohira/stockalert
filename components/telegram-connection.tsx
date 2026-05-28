'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Check, AlertCircle, Loader } from 'lucide-react'

type TelegramState = 'not_connected' | 'connecting' | 'connected'

interface TelegramConnectionProps {
  state?: TelegramState
  onConnect?: () => void
  onDisconnect?: () => void
}

export function TelegramConnection({ 
  state = 'not_connected', 
  onConnect, 
  onDisconnect 
}: TelegramConnectionProps) {
  const [showConnectFlow, setShowConnectFlow] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  if (state === 'connected') {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-5 h-5 text-primary" />
              Telegram Connected
            </CardTitle>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <p>915 Stock Alerts sends alerts to your Telegram account.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (state === 'connecting') {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-5 h-5 text-chart-2" />
              Connecting...
            </CardTitle>
            <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30 flex items-center gap-1">
              <Loader className="w-3 h-3 animate-spin" />
              Connecting
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Waiting for Telegram connection confirmation...</p>
        </CardContent>
      </Card>
    )
  }

  // Not Connected state
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            Connect Telegram
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showConnectFlow ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connect Telegram to receive instant stock alerts.
            </p>
            <Button
              onClick={() => setShowConnectFlow(true)}
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
            >
              Connect Telegram
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/30 p-3 rounded-lg border border-border">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-chart-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-foreground">Steps to connect:</p>
                  <ol className="space-y-1 text-muted-foreground list-decimal list-inside text-xs">
                    <li>Open Telegram and search for @stock915_bot</li>
                    <li>Send /start to the bot</li>
                    <li>Open the connection link from the bot</li>
                    <li>You&apos;re all set!</li>
                  </ol>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConnectFlow(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
                disabled={isConnecting}
                onClick={() => {
                  setIsConnecting(true)
                  // Simulate connection delay
                  setTimeout(() => {
                    onConnect?.()
                    setShowConnectFlow(false)
                    setIsConnecting(false)
                  }, 1500)
                }}
              >
                {isConnecting ? 'Connecting...' : 'Finish Connection'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
