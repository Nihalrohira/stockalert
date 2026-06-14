'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ChevronDown, X } from 'lucide-react'
import type { InstrumentSearchResult, SelectedInstrumentStock } from '@/types/instrument'

interface StockAutocompleteProps {
  onSelect: (stock: SelectedInstrumentStock) => void
  selectedStock?: SelectedInstrumentStock | null
}

async function fetchSearchResults(q: string): Promise<InstrumentSearchResult[]> {
  const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) {
    return []
  }
  const data = (await res.json()) as { results?: InstrumentSearchResult[] }
  return Array.isArray(data.results) ? data.results : []
}

async function fetchLtpForInstrument(instrumentKey: string): Promise<number> {
  const res = await fetch(
    `/api/instruments/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`,
  )
  const data = (await res.json()) as { ltp?: number; error?: string }
  if (!res.ok || typeof data.ltp !== 'number' || Number.isNaN(data.ltp)) {
    throw new Error(data.error ?? 'Failed to load price')
  }
  return data.ltp
}

export function StockAutocomplete({ onSelect, selectedStock }: StockAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<InstrumentSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [resolvingKey, setResolvingKey] = useState<string | null>(null)
  const [ltpError, setLtpError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeqRef = useRef(0)

  const runSearch = useCallback(async (q: string, seq: number) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      if (seq === searchSeqRef.current) {
        setResults([])
        setSearchLoading(false)
      }
      return
    }
    setSearchLoading(true)
    try {
      const list = await fetchSearchResults(trimmed)
      if (seq !== searchSeqRef.current) return
      setResults(list)
    } finally {
      if (seq === searchSeqRef.current) {
        setSearchLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearchLoading(false)
      return
    }
    const seq = ++searchSeqRef.current
    setSearchLoading(true)
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed, seq)
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchQuery, runSearch])

  const handleSelect = async (inst: InstrumentSearchResult) => {
    setLtpError(null)
    setResolvingKey(inst.instrumentKey)
    try {
      const ltp = await fetchLtpForInstrument(inst.instrumentKey)
      onSelect({
        instrumentKey: inst.instrumentKey,
        symbol: inst.symbol,
        company: inst.name,
        exchange: inst.exchange,
        price: ltp,
      })
      setSearchQuery('')
      setResults([])
      setIsOpen(false)
    } catch (e) {
      setLtpError(e instanceof Error ? e.message : 'Could not load live price')
    } finally {
      setResolvingKey(null)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const showDropdown = isOpen && (searchQuery.trim().length > 0 || searchLoading)

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Search stock by symbol, name, or ISIN..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
            setLtpError(null)
          }}
          onFocus={() => setIsOpen(true)}
          className="bg-input border-border pr-10"
        />
        {isOpen && searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setResults([])
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {searchQuery.trim().length < 2 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          ) : searchLoading ? (
            <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              Searching…
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((inst) => (
                <button
                  key={inst.instrumentKey}
                  type="button"
                  disabled={resolvingKey !== null}
                  onClick={() => void handleSelect(inst)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between gap-3 disabled:opacity-60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{inst.symbol}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {inst.exchange}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{inst.name}</p>
                  </div>
                  {resolvingKey === inst.instrumentKey ? (
                    <Spinner className="size-5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>No stocks found</p>
            </div>
          )}
        </div>
      )}

      {ltpError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {ltpError}
        </p>
      )}

      {selectedStock && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{selectedStock.symbol}</h3>
                <Badge variant="outline" className="text-xs shrink-0">
                  {selectedStock.exchange}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedStock.company}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground">₹{selectedStock.price.toFixed(2)}</p>
              {selectedStock.change != null ? (
                <p
                  className={`text-sm font-medium ${selectedStock.change >= 0 ? 'text-chart-1' : 'text-destructive'}`}
                >
                  {selectedStock.change > 0 ? '+' : ''}
                  {selectedStock.change.toFixed(2)}%
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
