'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateAlertForm } from '@/components/create-alert-form'
import type { CreateAlertFormPayload } from '@/components/create-alert-form'
import { AlertsTable } from '@/components/alerts-table'
import { TelegramOnboardingModal } from '@/components/telegram-onboarding-modal'
import { EmptyState } from '@/components/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { Zap, Bell, LogOut } from 'lucide-react'
import type { Alert } from '@/types/alert'
import { dbAlertRowToUi } from '@/lib/alert-mapper'
import {
  deleteAlertForTelegramUser,
  fetchAlertsForTelegramUser,
  insertAlertForTelegramUser,
  markAlertTriggeredForTelegramUser,
  updateAlertPausedForTelegramUser,
} from '@/lib/alerts-repository'
import { logSupabaseError } from '@/lib/supabase-errors'
import { supabase } from '@/lib/supabase'

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
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [connectModalState, setConnectModalState] = useState<'idle' | 'connecting'>('idle')
  const connectTimerRef = useRef<number | null>(null)
  const createSectionRef = useRef<HTMLDivElement>(null)
  const [supabaseTest, setSupabaseTest] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    message?: string
  }>({ status: 'idle' })

  const loadAlerts = useCallback(
    async (showLoading: boolean) => {
      if (!telegramUser) {
        setAlerts([])
        return
      }
      if (showLoading) {
        setAlertsLoading(true)
      }
      try {
        const rows = await fetchAlertsForTelegramUser(telegramUser.chatId, telegramUser.username)
        setAlerts(rows.map((r) => dbAlertRowToUi(r, telegramUser.chatId)))
      } catch (e) {
        logSupabaseError('[dashboard] loadAlerts failed', e)
        setAlerts([])
      } finally {
        if (showLoading) {
          setAlertsLoading(false)
        }
      }
    },
    [telegramUser]
  )

  useEffect(() => {
    setTelegramUser(readTelegramUserFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    if (!telegramUser) {
      setAlerts([])
      setAlertsLoading(false)
      return
    }
    void loadAlerts(true)
  }, [hydrated, telegramUser, loadAlerts])

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
    const timerId = window.setTimeout(() => {
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
    connectTimerRef.current = timerId
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
    async (data: CreateAlertFormPayload) => {
      if (!telegramUser) return
      try {
        await insertAlertForTelegramUser(telegramUser.chatId, telegramUser.username, {
          stock_symbol: data.stockSymbol,
          stock_name: data.stockName,
          exchange: data.exchange,
          current_price: data.currentPrice,
          target_price: data.targetPrice,
          condition: data.condition,
          valid_until: data.validUntil,
        })
        await loadAlerts(false)
      } catch (e) {
        logSupabaseError('[dashboard] create alert failed', e)
        throw e
      }
    },
    [telegramUser, loadAlerts]
  )

  const handlePauseAlert = useCallback(
    async (id: string) => {
      if (!telegramUser) return
      try {
        await updateAlertPausedForTelegramUser(telegramUser.chatId, telegramUser.username, id, true)
        await loadAlerts(false)
      } catch (e) {
        logSupabaseError('[dashboard] pause alert failed', e)
      }
    },
    [telegramUser, loadAlerts]
  )

  const handleResumeAlert = useCallback(
    async (id: string) => {
      if (!telegramUser) return
      try {
        await updateAlertPausedForTelegramUser(telegramUser.chatId, telegramUser.username, id, false)
        await loadAlerts(false)
      } catch (e) {
        logSupabaseError('[dashboard] resume alert failed', e)
      }
    },
    [telegramUser, loadAlerts]
  )

  const handleDeleteAlert = useCallback(
    async (id: string) => {
      if (!telegramUser) return
      try {
        await deleteAlertForTelegramUser(telegramUser.chatId, telegramUser.username, id)
        await loadAlerts(false)
      } catch (e) {
        logSupabaseError('[dashboard] delete alert failed', e)
      }
    },
    [telegramUser, loadAlerts]
  )

  const handleSimulateTrigger = useCallback(async () => {
    if (!telegramUser) return
    const firstActive = alerts.find((a) => a.status === 'active')
    if (!firstActive) return
    try {
      await markAlertTriggeredForTelegramUser(telegramUser.chatId, telegramUser.username, firstActive.id)
      await loadAlerts(false)
    } catch (e) {
      logSupabaseError('[dashboard] simulate trigger failed', e)
    }
  }, [alerts, telegramUser, loadAlerts])

  const handleTestSupabase = useCallback(async () => {
    setSupabaseTest({ status: 'loading' })
    const { error } = await supabase
      .from('users')
      .select('id, telegram_username, created_at')
      .limit(1)
    if (error) {
      logSupabaseError('[dashboard] Test Supabase users query', error)
      setSupabaseTest({ status: 'error', message: error.message })
    } else {
      setSupabaseTest({ status: 'ok', message: 'Supabase connected' })
    }
  }, [])

  const handleCheckAlertsNow = useCallback(async () => {
    if (!telegramUser) return
    try {
      const res = await fetch('/api/alerts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: telegramUser.chatId,
          telegramUsername: telegramUser.username,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; summary?: unknown }
      if (!res.ok || !data.ok) {
        console.error('[dashboard] Check Alerts Now failed', data.error ?? res.statusText, data)
        return
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[dashboard] Check Alerts Now summary', data.summary)
      }
      await loadAlerts(false)
    } catch (e) {
      console.error('[dashboard] Check Alerts Now failed', e)
    }
  }, [telegramUser, loadAlerts])

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

        {telegramConnected && alertsLoading && (
          <div
            className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground mb-4"
            aria-live="polite"
          >
            <Spinner className="size-5" />
            Loading alerts…
          </div>
        )}

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
              onPause={(id) => void handlePauseAlert(id)}
              onResume={(id) => void handleResumeAlert(id)}
              onDelete={(id) => void handleDeleteAlert(id)}
            />
          ) : (
            !alertsLoading && <EmptyState type="active" onCreateAlert={scrollToCreate} />
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
            !alertsLoading && <EmptyState type="triggered" />
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-12 pt-6 border-t border-border/40 flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/80 font-normal h-8 px-2"
                disabled={supabaseTest.status === 'loading'}
                onClick={() => void handleTestSupabase()}
              >
                {supabaseTest.status === 'loading' ? 'Testing…' : 'Test Supabase'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/80 font-normal h-8 px-2"
                onClick={() => void handleCheckAlertsNow()}
              >
                Check Alerts Now
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/80 font-normal h-8 px-2"
                onClick={() => void handleSimulateTrigger()}
              >
                Simulate Trigger
              </Button>
            </div>
            {supabaseTest.status === 'ok' && (
              <p className="text-xs text-green-500/90 max-w-md text-right">{supabaseTest.message}</p>
            )}
            {supabaseTest.status === 'error' && (
              <p className="text-xs text-destructive max-w-md text-right break-words">{supabaseTest.message}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
