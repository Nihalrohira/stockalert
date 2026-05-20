'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StockAutocomplete } from './stock-autocomplete'
import { OptionsAlertFields, type OptionsAlertSelection } from './options-alert-fields'
import { Plus } from 'lucide-react'
import type { AlertCondition, MarketType, OptionType } from '@/types/alert'
import type { SelectedInstrumentStock } from '@/types/instrument'

export interface CreateAlertFormPayload {
  instrumentKey: string
  stockSymbol: string
  stockName: string
  exchange: 'NSE' | 'BSE'
  currentPrice: number
  targetPrice: number
  condition: AlertCondition
  validUntil: string | null
  marketType?: MarketType
  underlyingSymbol?: string | null
  expiryDate?: string | null
  strikePrice?: number | null
  optionType?: OptionType | null
  alertType?: 'price'
}

interface CreateAlertFormProps {
  telegramConnected: boolean
  onSubmit?: (data: CreateAlertFormPayload) => void | Promise<void>
}

export function CreateAlertForm({ telegramConnected, onSubmit }: CreateAlertFormProps) {
  const [marketTab, setMarketTab] = useState<'stocks' | 'options'>('stocks')
  const [selectedStock, setSelectedStock] = useState<SelectedInstrumentStock | null>(null)
  const [optionSelection, setOptionSelection] = useState<OptionsAlertSelection | null>(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [condition, setCondition] = useState<AlertCondition>('above')
  const [validUntil, setValidUntil] = useState('')

  const handleOptionSelectionChange = useCallback((sel: OptionsAlertSelection | null) => {
    setOptionSelection(sel)
  }, [])

  const handleQuickTarget = (type: string, basePrice: number) => {
    let price = 0
    switch (type) {
      case '+1%':
        price = basePrice * 1.01
        break
      case '+2%':
        price = basePrice * 1.02
        break
      case 'high':
        price = basePrice * 1.05
        setCondition('above')
        break
      case 'low':
        price = basePrice * 0.95
        setCondition('below')
        break
    }
    setTargetPrice(price.toFixed(2))
  }

  const resetForm = () => {
    setSelectedStock(null)
    setOptionSelection(null)
    setTargetPrice('')
    setCondition('above')
    setValidUntil('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telegramConnected || !targetPrice) return
    const parsedTarget = parseFloat(targetPrice)
    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) return

    let payload: CreateAlertFormPayload | null = null

    if (marketTab === 'stocks') {
      if (!selectedStock) return
      payload = {
        instrumentKey: selectedStock.instrumentKey,
        stockSymbol: selectedStock.symbol,
        stockName: selectedStock.company,
        exchange: selectedStock.exchange,
        currentPrice: selectedStock.price,
        targetPrice: parsedTarget,
        condition,
        validUntil: validUntil.trim() === '' ? null : validUntil.trim(),
        marketType: 'equity',
      }
    } else {
      if (!optionSelection) return
      payload = {
        instrumentKey: optionSelection.instrumentKey,
        stockSymbol: optionSelection.tradingSymbol,
        stockName: optionSelection.stockName,
        exchange: 'NSE',
        currentPrice: optionSelection.currentPrice,
        targetPrice: parsedTarget,
        condition,
        validUntil: validUntil.trim() === '' ? null : validUntil.trim(),
        marketType: 'option',
        underlyingSymbol: optionSelection.underlyingSymbol,
        expiryDate: optionSelection.expiryDate,
        strikePrice: optionSelection.strikePrice,
        optionType: optionSelection.optionType,
        alertType: 'price',
      }
    }

    try {
      await onSubmit?.(payload)
      resetForm()
    } catch {
      // Parent logs; keep form values so the user can retry.
    }
  }

  const stockReady = marketTab === 'stocks' && selectedStock
  const optionReady = marketTab === 'options' && optionSelection
  const canSubmit = telegramConnected && (stockReady || optionReady) && targetPrice.length > 0
  const quickBasePrice =
    marketTab === 'stocks' ? selectedStock?.price : optionSelection?.currentPrice

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
          <Tabs
            value={marketTab}
            onValueChange={(v) => {
              setMarketTab(v as 'stocks' | 'options')
              setTargetPrice('')
            }}
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="stocks" className="w-full">
                Stocks
              </TabsTrigger>
              <TabsTrigger value="options" className="w-full">
                Options
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stocks" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Stock</Label>
                <StockAutocomplete onSelect={setSelectedStock} selectedStock={selectedStock} />
              </div>
            </TabsContent>

            <TabsContent value="options" className="mt-4">
              <OptionsAlertFields
                disabled={!telegramConnected}
                onSelectionChange={handleOptionSelectionChange}
              />
            </TabsContent>
          </Tabs>

          {(stockReady || optionReady) && quickBasePrice != null && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Targets</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['+1%', '+2%', 'high', 'low'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleQuickTarget(t, quickBasePrice)}
                      className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-colors border border-border"
                    >
                      {t === 'high' ? 'Day High' : t === 'low' ? 'Day Low' : t}
                    </button>
                  ))}
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

          {!stockReady && !optionReady && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                {marketTab === 'stocks'
                  ? 'Select a stock to create an alert'
                  : 'Select underlying, expiry, strike, and CE/PE'}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
