import { Bell, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  type: 'active' | 'triggered'
  onCreateAlert?: () => void
}

export function EmptyState({ type, onCreateAlert }: EmptyStateProps) {
  if (type === 'active') {
    return (
      <div className="py-16 px-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Bell className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Active Alerts</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Create your first alert rule to start monitoring the market.
        </p>
        <Button
          onClick={onCreateAlert}
          className="bg-primary text-primary-foreground hover:opacity-90"
        >
          Create First Alert Rule
        </Button>
      </div>
    )
  }

  return (
    <div className="py-16 px-4 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
          <Zap className="w-6 h-6 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Triggered Alerts</h3>
      <p className="text-sm text-muted-foreground">
        Triggered alerts from 915 Stock Alerts appear here in real time.
      </p>
    </div>
  )
}
