'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { OPTION_UNDERLYING_SYMBOLS } from '@/lib/options-underlyings'
import { Spinner } from '@/components/ui/spinner'

export type NormalizedOptionContractClient = {
  underlyingSymbol: string
  expiryDate: string
  strikePrice: number
  optionType: 'CE' | 'PE'
  tradingSymbol: string
  instrumentKey: string
}

export interface OptionsAlertSelection {
  instrumentKey: string
  tradingSymbol: string
  stockName: string
  underlyingSymbol: string
  expiryDate: string
  strikePrice: number
  optionType: 'CE' | 'PE'
  currentPrice: number
}

interface OptionsAlertFieldsProps {
  disabled?: boolean
  onSelectionChange: (selection: OptionsAlertSelection | null) => void
}

function uniqueSorted<T>(items: T[], sort: (a: T, b: T) => number): T[] {
  return [...new Set(items)].sort(sort)
}

export function OptionsAlertFields({ disabled = false, onSelectionChange }: OptionsAlertFieldsProps) {
  const [underlying, setUnderlying] = useState<string>('NIFTY')
  const [contracts, setContracts] = useState<NormalizedOptionContractClient[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [contractsError, setContractsError] = useState<string | null>(null)
  const [expiry, setExpiry] = useState('')
  const [strike, setStrike] = useState('')
  const [optionType, setOptionType] = useState<'CE' | 'PE'>('CE')
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [loadingLtp, setLoadingLtp] = useState(false)
  const [ltpError, setLtpError] = useState<string | null>(null)

  const loadContracts = useCallback(
    async (underlyingSymbol: string) => {
      setLoadingContracts(true)
      setContractsError(null)
      setContracts([])
      setExpiry('')
      setStrike('')
      setLivePrice(null)
      onSelectionChange(null)

      try {
        const res = await fetch(
          `/api/options/contracts?underlying=${encodeURIComponent(underlyingSymbol)}`,
          { cache: 'no-store' },
        )
        const data = (await res.json()) as {
          ok?: boolean
          contracts?: NormalizedOptionContractClient[]
          error?: string
        }
        if (!res.ok || !data.contracts) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        setContracts(data.contracts)
        const expiries = uniqueSorted(
          data.contracts.map((c) => c.expiryDate),
          (a, b) => a.localeCompare(b),
        )
        if (expiries.length > 0) {
          setExpiry(expiries[0])
        }
      } catch (e) {
        setContractsError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoadingContracts(false)
      }
    },
    [onSelectionChange],
  )

  useEffect(() => {
    if (disabled) return
    void loadContracts(underlying)
  }, [underlying, disabled, loadContracts])

  const expiryOptions = useMemo(
    () =>
      uniqueSorted(
        contracts.map((c) => c.expiryDate),
        (a, b) => a.localeCompare(b),
      ),
    [contracts],
  )

  const strikeOptions = useMemo(() => {
    if (!expiry) return []
    return uniqueSorted(
      contracts.filter((c) => c.expiryDate === expiry).map((c) => c.strikePrice),
      (a, b) => a - b,
    )
  }, [contracts, expiry])

  useEffect(() => {
    if (strikeOptions.length === 0) {
      setStrike('')
      return
    }
    const strikeNum = Number(strike)
    if (!strikeOptions.includes(strikeNum)) {
      const mid = strikeOptions[Math.floor(strikeOptions.length / 2)]
      setStrike(String(mid))
    }
  }, [strikeOptions, strike])

  const selectedContract = useMemo(() => {
    if (!expiry || strike === '') return null
    const strikeNum = Number(strike)
    return (
      contracts.find(
        (c) => c.expiryDate === expiry && c.strikePrice === strikeNum && c.optionType === optionType,
      ) ?? null
    )
  }, [contracts, expiry, strike, optionType])

  const fetchLtp = useCallback(async (instrumentKey: string) => {
    setLoadingLtp(true)
    setLtpError(null)
    try {
      const res = await fetch(
        `/api/instruments/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`,
        { cache: 'no-store' },
      )
      const data = (await res.json()) as { ltp?: number; error?: string }
      if (!res.ok || data.ltp === undefined) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setLivePrice(data.ltp)
      return data.ltp
    } catch (e) {
      setLivePrice(null)
      setLtpError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLoadingLtp(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedContract || disabled) {
      setLivePrice(null)
      onSelectionChange(null)
      return
    }
    void (async () => {
      const ltp = await fetchLtp(selectedContract.instrumentKey)
      if (ltp === null) {
        onSelectionChange(null)
        return
      }
      const stockName = `${selectedContract.underlyingSymbol} ${selectedContract.expiryDate} ${selectedContract.strikePrice} ${selectedContract.optionType}`
      onSelectionChange({
        instrumentKey: selectedContract.instrumentKey,
        tradingSymbol: selectedContract.tradingSymbol,
        stockName,
        underlyingSymbol: selectedContract.underlyingSymbol,
        expiryDate: selectedContract.expiryDate,
        strikePrice: selectedContract.strikePrice,
        optionType: selectedContract.optionType,
        currentPrice: ltp,
      })
    })()
  }, [selectedContract, disabled, fetchLtp, onSelectionChange])

  const selectClass =
    'w-full h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground disabled:opacity-50'

  return (
    <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Underlying</Label>
          <select
            className={selectClass}
            value={underlying}
            disabled={disabled || loadingContracts}
            onChange={(e) => setUnderlying(e.target.value)}
          >
            {OPTION_UNDERLYING_SYMBOLS.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>
        </div>

        {loadingContracts && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="w-4 h-4" />
            Loading option contracts…
          </div>
        )}
        {contractsError && <p className="text-sm text-destructive">{contractsError}</p>}

        {!loadingContracts && contracts.length > 0 && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expiry</Label>
              <select
                className={selectClass}
                value={expiry}
                disabled={disabled}
                onChange={(e) => setExpiry(e.target.value)}
              >
                {expiryOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Strike</Label>
              <select
                className={selectClass}
                value={strike}
                disabled={disabled}
                onChange={(e) => setStrike(e.target.value)}
              >
                {strikeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Option type</Label>
              <div className="flex gap-2">
                {(['CE', 'PE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => setOptionType(t)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      optionType === t
                        ? 'bg-primary text-primary-foreground border border-primary'
                        : 'bg-muted/50 text-foreground border border-border hover:bg-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Live option price</p>
              {loadingLtp ? (
                <div className="flex items-center gap-2 mt-1">
                  <Spinner className="w-4 h-4" />
                  <span className="text-sm">Fetching LTP…</span>
                </div>
              ) : ltpError ? (
                <p className="text-sm text-destructive mt-1">{ltpError}</p>
              ) : livePrice != null ? (
                <p className="text-lg font-semibold text-foreground mt-0.5">₹{livePrice.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Select contract details</p>
              )}
              {selectedContract && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{selectedContract.tradingSymbol}</p>
              )}
            </div>
          </>
        )}
    </div>
  )
}
