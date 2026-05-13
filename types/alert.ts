export type AlertCondition = 'above' | 'below'

export type AlertStatus = 'active' | 'paused' | 'triggered'

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
