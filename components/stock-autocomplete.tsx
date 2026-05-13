'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, X } from 'lucide-react'

interface Stock {
  symbol: string
  company: string
  exchange: 'NSE' | 'BSE'
  price: number
  change: number
}

const MOCK_STOCKS: Stock[] = [
  { symbol: 'RELIANCE', company: 'Reliance Industries', exchange: 'NSE', price: 3150, change: 2.5 },
  { symbol: 'INFY', company: 'Infosys Limited', exchange: 'NSE', price: 1920, change: -1.2 },
  { symbol: 'TCS', company: 'Tata Consultancy Services', exchange: 'NSE', price: 4150, change: 1.8 },
  { symbol: 'WIPRO', company: 'Wipro Limited', exchange: 'NSE', price: 485, change: -0.5 },
  { symbol: 'BAJAJFINSV', company: 'Bajaj Finserv', exchange: 'NSE', price: 1850, change: 3.2 },
  { symbol: 'HDFCBANK', company: 'HDFC Bank', exchange: 'NSE', price: 2680, change: 1.5 },
  { symbol: 'ICICIBANK', company: 'ICICI Bank', exchange: 'NSE', price: 1220, change: 0.8 },
  { symbol: 'LT', company: 'Larsen & Toubro', exchange: 'NSE', price: 3400, change: 2.1 },
]

interface StockAutocompleteProps {
  onSelect: (stock: Stock) => void
  selectedStock?: Stock | null
}

export function StockAutocomplete({ onSelect, selectedStock }: StockAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_STOCKS
    return MOCK_STOCKS.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.company.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  const handleSelect = (stock: Stock) => {
    onSelect(stock)
    setSearchQuery('')
    setIsOpen(false)
  }

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Handle click outside
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

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Search stock by symbol or name..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="bg-input border-border pr-10"
        />
        {isOpen && searchQuery ? (
          <button
            onClick={() => {
              setSearchQuery('')
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

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {filteredStocks.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredStocks.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{stock.symbol}</span>
                      <Badge variant="outline" className="text-xs">
                        {stock.exchange}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stock.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">₹{stock.price.toFixed(2)}</p>
                    <p className={`text-xs font-medium ${stock.change >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                      {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p>No stocks found</p>
            </div>
          )}
        </div>
      )}

      {selectedStock && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{selectedStock.symbol}</h3>
                <Badge variant="outline" className="text-xs">
                  {selectedStock.exchange}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{selectedStock.company}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">₹{selectedStock.price.toFixed(2)}</p>
              <p className={`text-sm font-medium ${selectedStock.change >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {selectedStock.change > 0 ? '+' : ''}{selectedStock.change.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
