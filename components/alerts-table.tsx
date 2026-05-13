'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Trash2, PauseCircle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Alert } from '@/types/alert'

function formatDisplayDate(isoOrYmd: string | null): string {
  if (!isoOrYmd) return '—'
  const d = new Date(isoOrYmd)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return isoOrYmd
}

function formatTriggeredAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface ActiveAlertsTableProps {
  variant: 'active'
  alerts: Alert[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
}

interface TriggeredAlertsTableProps {
  variant: 'triggered'
  alerts: Alert[]
}

type AlertsTableProps = ActiveAlertsTableProps | TriggeredAlertsTableProps

export function AlertsTable(props: AlertsTableProps) {
  const { alerts } = props
  if (alerts.length === 0) {
    return null
  }

  if (props.variant === 'triggered') {
    return (
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 border-b border-border z-20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Trigger Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Target Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Triggered At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="font-semibold text-foreground text-sm">{alert.stockSymbol}</span>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{alert.stockName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-foreground text-sm">₹{alert.currentPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-foreground text-sm font-medium">₹{alert.targetPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ConditionCell condition={alert.condition} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-muted-foreground text-sm">{formatTriggeredAt(alert.triggeredAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { onPause, onResume, onDelete } = props

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-muted/50 border-b border-border z-20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{alert.stockSymbol}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {alert.exchange}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">{alert.stockName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-foreground text-sm">₹{alert.currentPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-foreground text-sm font-medium">₹{alert.targetPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ConditionCell condition={alert.condition} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-muted-foreground text-sm">{formatDisplayDate(alert.validUntil)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {alert.status === 'active' ? (
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Paused
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {alert.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPause(alert.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          title="Pause alert"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onResume(alert.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          title="Resume alert"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(alert.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ConditionCell({ condition }: { condition: Alert['condition'] }) {
  return (
    <div className="flex items-center gap-2">
      {condition === 'above' ? (
        <>
          <div className="w-2 h-2 rounded-full bg-chart-1" />
          <span className="text-sm text-chart-1 font-medium">Above</span>
          <TrendingUp className="w-4 h-4 text-chart-1 opacity-60" />
        </>
      ) : (
        <>
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive font-medium">Below</span>
          <TrendingDown className="w-4 h-4 text-destructive opacity-60" />
        </>
      )}
    </div>
  )
}
