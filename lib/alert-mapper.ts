import type { Alert, DbAlertRow } from '@/types/alert'

export function dbAlertRowToUi(row: DbAlertRow, telegramChatId: string): Alert {
  const exchange: 'NSE' | 'BSE' = row.exchange === 'BSE' ? 'BSE' : 'NSE'
  return {
    id: row.id,
    telegramChatId,
    stockSymbol: row.stock_symbol,
    stockName: row.stock_name,
    exchange,
    currentPrice: row.current_price,
    targetPrice: row.target_price,
    condition: row.condition,
    validUntil: row.valid_until,
    status: row.status,
    createdAt: row.created_at,
    triggeredAt: row.status === 'triggered' ? row.triggered_at : null,
  }
}
