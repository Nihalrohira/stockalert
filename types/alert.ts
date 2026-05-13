export type AlertCondition = 'above' | 'below'

export type AlertStatus = 'active' | 'paused' | 'triggered'

/** Supabase `public.users` row (snake_case). */
export interface DbUserRow {
  id: string
  telegram_chat_id: string
  telegram_username: string
  created_at: string
}

/** Supabase `public.alerts` row (snake_case). */
export interface DbAlertRow {
  id: string
  user_id: string
  stock_symbol: string
  stock_name: string
  exchange: string
  current_price: number
  target_price: number
  condition: AlertCondition
  valid_until: string | null
  status: AlertStatus
  created_at: string
  triggered_at: string | null
}

/** UI model used by existing tables (unchanged). */
export interface Alert {
  id: string
  telegramChatId: string
  stockSymbol: string
  stockName: string
  exchange: 'NSE' | 'BSE'
  currentPrice: number
  targetPrice: number
  condition: AlertCondition
  validUntil: string | null
  status: AlertStatus
  createdAt: string
  triggeredAt: string | null
}
