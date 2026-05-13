'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateAlertForm } from '@/components/create-alert-form'
import type { CreateAlertFormPayload } from '@/components/create-alert-form'
import { AlertsTable } from '@/components/alerts-table'
import { TelegramOnboardingModal } from '@/components/telegram-onboarding-modal'
import { EmptyState } from '@/components/empty-state'
import { Zap, Bell, LogOut } from 'lucide-react'
import type { Alert } from '@/types/alert'
import { readAlertsFromStorage, writeAlertsToStorage, createAlertId } from '@/lib/alert-storage'

const TELEGRAM_STORAGE_KEY = 'stockalert_telegram_user'

interface TelegramUser {
  username: string
  chatId: string
}

function readTelegramUserFromStorage(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'username' in parsed &&
      'chatId' in parsed &&
      typeof (parsed as TelegramUser).username === 'string' &&
      typeof (parsed as TelegramUser).chatId === 'string'
    ) {
      return { username: (parsed as TelegramUser).username, chatId: (parsed as TelegramUser).chatId }
    }
  } catch {
    // ignore invalid storage
  }
  return null
}

export default function Dashboard() {
  const [hydrated, setHydrated] = useState(false)
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connectModalState, setConnectModalState] = useState<'idle' | 'connecting'>('idle')
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const createSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTelegramUser(readTelegramUserFromStorage())
    setAlerts(readAlertsFromStorage())
    setHydrated(true)
    setAlertsLoaded(true)
  }, [])

  useEffect(() => {
    if (!alertsLoaded) return
    writeAlertsToStorage(alerts)
  }, [alerts, alertsLoaded])

  useEffect(() => {
    return () => {
      if (connectTimerRef.current != null) {
        clearTimeout(connectTimerRef.current)
      }
    }
  }, [])

  const telegramConnected = !!telegramUser
  const showTelegramModal = !hydrated || !telegramConnected

  const handleConnectTelegram = useCallback(() => {
    if (connectModalState === 'connecting') return
    if (connectTimerRef.current != null) return
    setConnectModalState('connecting')
    connectTimerRef.current = window.setTimeout(() => {
      connectTimerRef.current = null
      const user: TelegramUser = {
        username: 'john_trader',
        chatId: 'mock_telegram_chat_id',
      }
      try {
        localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(user))
      } catch {
        // ignore quota / private mode
      }
      setTelegramUser(user)
      setConnectModalState('idle')
    }, 1000)
  }, [connectModalState])

  const handleSignOut = useCallback(() => {
    if (connectTimerRef.current != null) {
      clearTimeout(connectTimerRef.current)
      connectTimerRef.current = null
    }
    try {
      localStorage.removeItem(TELEGRAM_STORAGE_KEY)
    } catch {
      // ignore
    }
    setTelegramUser(null)
    setConnectModalState('idle')
  }, [])

  const handleCreateAlert = useCallback(
    (data: CreateAlertFormPayload) => {
      if (!telegramUser) return
      const now = new Date().toISOString()
      const newAlert: Alert = {
        id: createAlertId(),
        telegramChatId: telegramUser.chatId,
        stockSymbol: data.stockSymbol,
        stockName: data.stockName,
        exchange: data.exchange,
        currentPrice: data.currentPrice,
        targetPrice: data.targetPrice,
        condition: data.condition,
        validUntil: data.validUntil,
        status: 'active',
        createdAt: now,
        triggeredAt: null,
      }
      setAlerts((prev) => [newAlert, ...prev])
    },
    [telegramUser]
  )

  const handlePauseAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id && a.status === 'active' ? { ...a, status: 'paused' as const } : a))
    )
  }, [])

  const handleResumeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id && a.status === 'paused' ? { ...a, status: 'active' as const } : a))
    )
  }, [])

  const handleDeleteAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSimulateTrigger = useCallback(() => {
    setAlerts((prev) => {
      const idx = prev.findIndex((a) => a.status === 'active')
      if (idx === -1) return prev
      const copy = [...prev]
      const hit = copy[idx]
      copy[idx] = {
        ...hit,
        status: 'triggered',
        triggeredAt: new Date().toISOString(),
      }
      return copy
    })
  }, [])

  const activeOrPausedAlerts = alerts.filter((a) => a.status === 'active' || a.status === 'paused')
  const triggeredAlerts = alerts.filter((a) => a.status === 'triggered')

  const scrollToCreate = () => {
    createSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-background">
      {showTelegramModal && (
        <TelegramOnboardingModal
          state={connectModalState}
          onConnect={handleConnectTelegram}
          allowConnect={hydrated}
        />
      )}

      <nav className="border-b border-border/50 bg-card/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">StockAlert</h1>
              <p className="text-xs text-muted-foreground">Indian Stock Price Alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {telegramConnected && telegramUser && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Connected as @{telegramUser.username}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div ref={createSectionRef} className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Create Alert</h2>
          <CreateAlertForm telegramConnected={telegramConnected} onSubmit={handleCreateAlert} />
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Active Alerts
              {activeOrPausedAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeOrPausedAlerts.length}
                </Badge>
              )}
            </h2>
          </div>
          {activeOrPausedAlerts.length > 0 ? (
            <AlertsTable
              variant="active"
              alerts={activeOrPausedAlerts}
              onPause={handlePauseAlert}
              onResume={handleResumeAlert}
              onDelete={handleDeleteAlert}
            />
          ) : (
            <EmptyState type="active" onCreateAlert={scrollToCreate} />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-chart-2" />
              Triggered Alerts
              {triggeredAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {triggeredAlerts.length}
                </Badge>
              )}
            </h2>
          </div>
          {triggeredAlerts.length > 0 ? (
            <AlertsTable variant="triggered" alerts={triggeredAlerts} />
          ) : (
            <EmptyState type="triggered" />
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-12 pt-6 border-t border-border/40 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground/80 font-normal h-8 px-2"
              onClick={handleSimulateTrigger}
            >
              Simulate Trigger
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
