'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, StockBadge } from '@/components/ui/badges'
import { EmptyState, KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Th } from '@/components/page-kit'
import { useInsightAction } from '@/components/insights/use-insight-action'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { buildInsights, type Insight } from '@/lib/insights'
import { summarize, summaryItems } from '@/lib/summary'
import { fmtCover, fmtDateTime, fmtInt } from '@/lib/calc'
import { cn } from '@/lib/utils'

const HREFS = { all: '/inventory', low: '/inventory?status=low', expiring: '/inventory?expiry=expiring', stockout: '/inventory?status=stockout' }

const KIND_BADGE: Record<Insight['kind'], { tone: 'danger' | 'warning' | 'expiry'; label: string }> = {
  stockout: { tone: 'danger', label: 'Stockout risk' },
  low: { tone: 'warning', label: 'Low stock' },
  expiry: { tone: 'expiry', label: 'Expiry' },
}

export function DashboardView() {
  const { ready, rows, data, settings } = useStore()
  const { openBulk, openMovement, openProduct } = useUI()
  const runAction = useInsightAction()

  const summary = useMemo(() => summarize(rows), [rows])
  const insights = useMemo(() => buildInsights(rows, settings), [rows, settings])
  const attention = useMemo(
    () => rows.filter((r) => r.m.stockStatus !== 'healthy').sort((a, b) => (a.m.cover ?? 0) - (b.m.cover ?? 0)),
    [rows],
  )
  const recent = data.movements.slice(0, 6)

  if (!ready) return <PageSkeleton />

  const total = Math.max(1, rows.length)
  const healthy = rows.length - summary.low - summary.stockout
  const segments = [
    { label: 'Healthy', count: healthy, bar: 'bg-success', href: '/inventory?status=healthy' },
    { label: 'Low stock', count: summary.low, bar: 'bg-warning', href: '/inventory?status=low' },
    { label: 'Stockout risk', count: summary.stockout, bar: 'bg-danger', href: '/inventory?status=stockout' },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today's warehouse position and the actions that need you."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => openMovement('in')}>
              <ArrowLeftRight aria-hidden="true" />
              Stock In / Out
            </Button>
            <Button size="lg" onClick={() => openBulk()}>
              <Plus aria-hidden="true" />
              Add Products
            </Button>
          </>
        }
      />

      <KpiStrip items={summaryItems(summary, (key) => ({ href: HREFS[key] }))} size="lg" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Inventory status" description={`${fmtInt(rows.length)} products`} />
          <div className="p-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.count} ${s.label}`).join(', ')}>
              {segments.map((s) => (
                <div key={s.label} className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">
              {segments.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex h-10 items-center gap-2 rounded outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn('size-2 rounded-full', s.bar)} aria-hidden="true" />
                    <span className="text-foreground">{s.label}</span>
                    <span className="tabular ml-auto font-mono text-foreground">{fmtInt(s.count)}</span>
                    <span className="tabular w-10 text-right text-xs text-muted-foreground">{Math.round((s.count / total) * 100)}%</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/expiry" className="flex h-10 items-center gap-2 rounded outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="size-2 rounded-full bg-expiry" aria-hidden="true" />
                  <span className="text-foreground">Products with expiry risk</span>
                  <span className="tabular ml-auto font-mono text-foreground">{fmtInt(summary.expiring)}</span>
                  <span className="w-10" />
                </Link>
              </li>
            </ul>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Prioritized actions"
            description="Ordered by urgency. Figures marked estimated are calculated from recorded usage."
            actions={
              <Link href="/insights" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All insights <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {insights.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="No stockout, low-stock or near-expiry risks were found in your recorded inventory." />
          ) : (
            <ol className="divide-y divide-border">
              {insights.slice(0, 5).map((i, n) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{n + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{i.title}</p>
                      <Badge tone={KIND_BADGE[i.kind].tone}>{KIND_BADGE[i.kind].label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{i.summary}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => runAction(i)}>
                    {i.action.label}
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Items requiring attention" description="Low stock and stockout risks, shortest cover first." />
          {attention.length === 0 ? (
            <EmptyState title="All products are healthy" description="Every product is above its reorder point." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th align="right">Stock</Th>
                    <Th align="right">Daily usage</Th>
                    <Th align="right">Cover</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {attention.slice(0, 6).map(({ product, m }) => (
                    <tr key={product.id} onClick={() => openProduct(product.id)} className="h-12 cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProduct(product.id)
                          }}
                          className="rounded font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {product.name}
                        </button>
                      </td>
                      <td className="tabular px-3 text-right font-mono">
                        {fmtInt(m.stock)} <span className="text-xs text-muted-foreground">{product.unit}</span>
                      </td>
                      <td className="tabular px-3 text-right font-mono text-muted-foreground">{fmtInt(product.dailyUsage)}</td>
                      <td className="tabular px-3 text-right font-mono text-muted-foreground">{fmtCover(m.cover)}</td>
                      <td className="px-3">
                        <StockBadge status={m.stockStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent stock movements"
            actions={
              <Link href="/movements" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState title="No movements yet" description="Stock in and out entries will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((mv) => (
                <li key={mv.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Badge tone={mv.type === 'in' ? 'success' : 'neutral'} dot={false} className="w-11 justify-center">
                    {mv.type === 'in' ? 'In' : 'Out'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{mv.productName}</p>
                    <p className="tabular text-xs text-muted-foreground">{fmtDateTime(mv.createdAt)}</p>
                  </div>
                  <span className="tabular font-mono text-sm text-foreground">
                    {mv.type === 'in' ? '+' : '−'}
                    {fmtInt(mv.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
