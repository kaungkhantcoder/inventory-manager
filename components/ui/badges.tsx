import { cn } from '@/lib/utils'
import { fmtCover } from '@/lib/calc'
import type { ExpiryStatus, StockStatus } from '@/lib/types'

type Tone = 'success' | 'warning' | 'danger' | 'expiry' | 'neutral' | 'primary'

const TONES: Record<Tone, { chip: string; dot: string }> = {
  success: { chip: 'bg-success-soft text-success-text', dot: 'bg-success' },
  warning: { chip: 'bg-warning-soft text-warning-text', dot: 'bg-warning' },
  danger: { chip: 'bg-danger-soft text-danger-text', dot: 'bg-danger' },
  expiry: { chip: 'bg-expiry-soft text-expiry-text', dot: 'bg-expiry' },
  neutral: { chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  primary: { chip: 'bg-primary-soft text-primary', dot: 'bg-primary' },
}

export function Badge({ tone = 'neutral', dot = true, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  const t = TONES[tone]
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', t.chip, className)}>
      {dot ? <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export function StockBadge({ status, cover }: { status: StockStatus; cover?: number | null }) {
  if (status === 'healthy') return <Badge tone="success">Healthy</Badge>
  if (status === 'low') return <Badge tone="warning">Low stock</Badge>
  return <Badge tone="danger">Stockout risk{cover !== undefined && cover !== null && cover > 0 ? ` · ${fmtCover(cover)}` : ''}</Badge>
}

export function ExpiryBadge({ status, days }: { status: ExpiryStatus; days?: number | null }) {
  if (status === 'expired') return <Badge tone="expiry">Expired</Badge>
  if (status === 'expiring') {
    return <Badge tone="expiry">{days === 0 ? 'Expires today' : days === 1 ? '1 day left' : `${days} days left`}</Badge>
  }
  if (status === 'ok') return <Badge tone="neutral" dot={false}>OK</Badge>
  return <span className="text-muted-foreground">No expiry</span>
}
