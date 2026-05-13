'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StockAutocomplete } from './stock-autocomplete'
import { Plus } from 'lucide-react'
import type { AlertCondition } from '@/types/alert'

interface Stock {
  symbol: string
  company: string
  exchange: 'NSE' | 'BSE'
  price: number
  change: number
}

export interface CreateAlertFormPayload {
  stockSymbol: string
  stockName: string
  exchange: 'NSE' | 'BSE'
  currentPrice: number
  targetPrice: number
  condition: AlertCondition
  validUntil: string | null
}

interface CreateAlertFormProps {
  telegramConnected: boolean
  onSubmit?: (data: CreateAlertFormPayload) => void | Promise<void>
}

export function CreateAlertForm({ telegramConnected, onSubmit }: CreateAlertFormProps) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [condition, setCondition] = useState<AlertCondition>('above')
  const [validUntil, setValidUntil] = useState('')

  const handleQuickTarget = (type: string) => {
    if (!selectedStock) return

    let price = 0
    switch (type) {
      case '+1%':
        price = selectedStock.price * 1.01
        break
      case '+2%':
        price = selectedStock.price * 1.02
        break
      case 'high':
        price = selectedStock.price * 1.05
        setCondition('above')
        break
      case 'low':
        price = selectedStock.price * 0.95
        setCondition('below')
        break
    }
    setTargetPrice(price.toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telegramConnected || !selectedStock || !targetPrice) return
    const parsedTarget = parseFloat(targetPrice)
    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) return

    const payload: CreateAlertFormPayload = {
      stockSymbol: selectedStock.symbol,
      stockName: selectedStock.company,
      exchange: selectedStock.exchange,
      currentPrice: selectedStock.price,
      targetPrice: parsedTarget,
      condition,
      validUntil: validUntil.trim() === '' ? null : validUntil.trim(),
    }

    try {
      await onSubmit?.(payload)
      setSelectedStock(null)
      setTargetPrice('')
      setCondition('above')
      setValidUntil('')
    } catch {
      // Parent logs; keep form values so the user can retry.
    }
  }

  const canSubmit = telegramConnected && selectedStock && targetPrice.length > 0

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4 border-b border-border">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Create Price Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {!telegramConnected && (
          <p className="text-sm text-muted-foreground mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2">
            Connect Telegram to create alerts. Alerts are tied to your Telegram account.
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Stock</Label>
            <StockAutocomplete onSelect={setSelectedStock} selectedStock={selectedStock} />
          </div>

          {selectedStock && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Targets</Label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickTarget('+1%')}
                    className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-colors border border-border"
                  >
                    +1%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTarget('+2%')}
                    className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-colors border border-border"
                  >
                    +2%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTarget('high')}
                    className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-colors border border-border"
                  >
                    Day High
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTarget('low')}
                    className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-colors border border-border"
                  >
                    Day Low
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Price</Label>
                  <Input
                    type="number"
                    placeholder="Enter target price"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="bg-input border-border"
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Condition</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCondition('above')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        condition === 'above'
                          ? 'bg-primary text-primary-foreground border border-primary'
                          : 'bg-muted/50 text-foreground border border-border hover:bg-muted'
                      }`}
                    >
                      Above
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondition('below')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        condition === 'below'
                          ? 'bg-primary text-primary-foreground border border-primary'
                          : 'bg-muted/50 text-foreground border border-border hover:bg-muted'
                      }`}
                    >
                      Below
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Valid Until (Optional)</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="bg-input border-border"
                />
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary text-primary-foreground hover:opacity-90 h-10 font-medium disabled:opacity-50"
              >
                Create Alert
              </Button>
            </>
          )}

          {!selectedStock && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Select a stock to create an alert</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
