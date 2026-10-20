'use client'

import { useMemo, useState } from 'react'
import { ArrowUp, Bot, ChevronDown, PanelRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badges'
import { Select } from '@/components/ui/fields'
import { EmptyState, PageHeader, PageSkeleton } from '@/components/page-kit'
import { useInsightAction } from '@/components/insights/use-insight-action'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { answerQuestion, attentionCount, buildInsights, type Insight, type InsightKind } from '@/lib/insights'
import { fmtCover, fmtDateTime, fmtInt, suggestedReorderQty } from '@/lib/calc'
import type { ReorderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const KIND_BADGE: Record<InsightKind, { tone: 'danger' | 'warning' | 'expiry'; label: string }> = {
  stockout: { tone: 'danger', label: 'Stockout risk' },
  low: { tone: 'warning', label: 'Low stock' },
  expiry: { tone: 'expiry', label: 'Expiry' },
}

const FILTERS: { key: 'all' | InsightKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stockout', label: 'Stockout' },
  { key: 'low', label: 'Low stock' },
  { key: 'expiry', label: 'Expiry' },
]

const SUGGESTIONS = ['What needs my attention today?', 'What should I reorder?', 'Which batches expire soon?', 'What may run out?']
const REORDER_STATUSES: ReorderStatus[] = ['Requested', 'Ordered', 'Cancelled']

export function InsightsView() {
  const { ready, rows, data, settings, setReorderStatus } = useStore()
  const { openProduct, openReorder, toast } = useUI()
  const runAction = useInsightAction()
  const [filter, setFilter] = useState<'all' | InsightKind>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState('')
  const [asked, setAsked] = useState('')
  const [showRecommendations, setShowRecommendations] = useState(false)

  const insights = useMemo(() => buildInsights(rows, settings), [rows, settings])
  const answer = useMemo(() => (asked ? answerQuestion(asked, insights, rows, settings) : null), [asked, insights, rows, settings])
  const shown = filter === 'all' ? insights : insights.filter((i) => i.kind === filter)
  const reorderCandidates = useMemo(
    () =>
      rows
        .map((r) => ({ r, qty: suggestedReorderQty(r.product, r.m.stock, settings) }))
        .filter((x) => x.r.m.stockStatus !== 'healthy' && x.qty > 0)
        .sort((a, b) => (a.r.m.cover ?? 0) - (b.r.m.cover ?? 0)),
    [rows, settings],
  )

  if (!ready) return <PageSkeleton />

  const count = (k: InsightKind) => insights.filter((i) => i.kind === k).length
  const openReorders = data.reorders.filter((r) => r.status === 'Requested').length

  const ask = (text: string) => {
    const t = text.trim()
    if (!t) return
    setAsked(t)
    setDraft('')
  }

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <>
      <PageHeader
        title="AI Insights"
        description="Ask questions about your inventory and get clear, explainable answers from your recorded data."
        actions={
          <button
            type="button"
            role="switch"
            aria-checked={showRecommendations}
            onClick={() => setShowRecommendations((value) => !value)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', showRecommendations ? 'bg-primary' : 'bg-muted-foreground/35')}
              aria-hidden="true"
            >
              <span className={cn('size-4 rounded-full bg-white shadow-sm transition-transform', showRecommendations ? 'translate-x-4' : 'translate-x-0.5')} />
            </span>
            <PanelRight className="size-4 text-muted-foreground" aria-hidden="true" />
            Recommendations
          </button>
        }
      />

      <div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', showRecommendations && 'xl:grid xl:grid-cols-[minmax(0,1fr)_390px]')}>
        <section className="flex min-h-[680px] flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">StockSense AI</h2>
              <p className="truncate text-xs text-muted-foreground">Your inventory copilot · rule-based answers</p>
            </div>
            <div className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              <span>{fmtInt(attentionCount(insights))} items need attention</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-7">
              {!asked ? (
                <div className="flex flex-col items-center pt-12 text-center sm:pt-20">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-sm">
                    <Bot className="size-7" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">How can I help with your inventory?</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Ask about stock levels, expiring batches, or reorders. I’ll explain the numbers behind every answer.
                  </p>
                  <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <PromptButton key={suggestion} label={suggestion} onClick={() => ask(suggestion)} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm sm:max-w-[70%]">
                      {asked}
                    </div>
                  </div>
                  {answer ? (
                    <div className="flex gap-3" aria-live="polite">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Sparkles className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 max-w-2xl pt-1">
                        <p className="text-base font-semibold text-foreground">{answer.heading}</p>
                        <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-foreground">
                          {answer.lines.map((line) => <li key={line} className="text-pretty">{line}</li>)}
                        </ul>
                        {answer.actions.length ? (
                          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-3">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Suggested next steps</p>
                            <ul className="mt-2 flex flex-col gap-1.5">
                              {answer.actions.map((action) => (
                                <li key={action.label}>
                                  <button type="button" onClick={() => openProduct(action.productId)} className="rounded text-left text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                                    {action.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="mt-7 flex flex-wrap gap-2">
                          {SUGGESTIONS.filter((suggestion) => suggestion !== asked).map((suggestion) => (
                            <PromptButton key={suggestion} label={suggestion} onClick={() => ask(suggestion)} compact />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="border-t border-border px-4 py-4 sm:px-8">
            <form
              className="mx-auto max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault()
                ask(draft)
              }}
            >
              <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <textarea
                  aria-label="Ask a question about your inventory"
                  rows={1}
                  placeholder="Message StockSense AI"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      ask(draft)
                    }
                  }}
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <button type="submit" aria-label="Send message" disabled={!draft.trim()} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">StockSense AI can make mistakes. Check important inventory decisions against your records.</p>
            </form>
          </div>
        </section>

        {showRecommendations ? (
          <aside className="flex max-h-[900px] min-h-0 flex-col border-t border-border bg-muted/20 xl:border-t-0 xl:border-l" aria-label="Recommendations sidebar">
            <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">Recommendations</h2>
                <p className="text-xs text-muted-foreground">Prioritized from your inventory data</p>
              </div>
              <button type="button" aria-label="Hide recommendations" onClick={() => setShowRecommendations(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring xl:hidden">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 border-b border-border p-4">
                <InsightStat label="Needs attention" value={fmtInt(attentionCount(insights))} />
                <InsightStat label="Stockout risks" value={fmtInt(count('stockout'))} tone={count('stockout') ? 'danger' : undefined} />
                <InsightStat label="Near expiry" value={fmtInt(count('expiry'))} tone={count('expiry') ? 'expiry' : undefined} />
                <InsightStat label="Open reorders" value={fmtInt(openReorders)} />
              </div>

              <div className="border-b border-border">
                <div className="flex gap-1 overflow-x-auto px-3 py-3" role="tablist" aria-label="Filter recommendations">
                  {FILTERS.map((item) => (
                    <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={cn('h-8 shrink-0 rounded-md px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring', filter === item.key ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                      {item.label}<span className="tabular ml-1.5">{item.key === 'all' ? insights.length : count(item.key)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {shown.length === 0 ? (
                <EmptyState title="Nothing to review here" description="No risks of this type were found in your recorded inventory." />
              ) : (
                <ul className="divide-y divide-border">
                  {shown.map((insight) => (
                    <InsightRow key={insight.id} insight={insight} expanded={open.has(insight.id)} onToggle={() => toggle(insight.id)} onAction={() => runAction(insight)} />
                  ))}
                </ul>
              )}

              <div className="border-t border-border bg-card">
                <div className="px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Suggested reorders</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Targeting {settings.targetCoverDays} days of cover</p>
                </div>
                {reorderCandidates.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">All products are above their reorder point.</p>
                ) : (
                  <ul className="divide-y divide-border border-t border-border">
                    {reorderCandidates.map(({ r, qty }) => (
                      <li key={r.product.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => openProduct(r.product.id)} className="truncate text-left text-sm font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{r.product.name}</button>
                          <p className="tabular text-xs text-muted-foreground">{fmtInt(r.m.stock)} {r.product.unit} on hand · {fmtCover(r.m.cover)} cover</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openReorder(r.product.id, { basis: `Stock ${fmtInt(r.m.stock)} ${r.product.unit}, ${fmtCover(r.m.cover)} of cover`, qty })}>Reorder</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-border bg-card">
                <div className="px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Reorder requests</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Track requests you have created</p>
                </div>
                {data.reorders.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">No reorder requests yet.</p>
                ) : (
                  <ul className="divide-y divide-border border-t border-border">
                    {data.reorders.map((reorder) => (
                      <li key={reorder.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{reorder.productName}</p>
                          <p className="tabular text-xs text-muted-foreground">{fmtInt(reorder.quantity)} {reorder.unit} · {fmtDateTime(reorder.createdAt)}</p>
                        </div>
                        <Select aria-label={`Status of reorder for ${reorder.productName}`} value={reorder.status} onChange={(event) => {
                          setReorderStatus(reorder.id, event.target.value as ReorderStatus)
                          toast(`Reorder for ${reorder.productName} marked ${event.target.value.toLowerCase()}.`)
                        }} wrapperClassName="w-28 shrink-0">
                          {REORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </Select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  )
}

function PromptButton({ label, onClick, compact = false }: { label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-xl border border-border bg-card text-left text-sm text-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-ring', compact ? 'px-3 py-2 text-xs text-muted-foreground' : 'px-3.5 py-3')}>
      {label}
    </button>
  )
}

function InsightStat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'expiry' }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('tabular mt-0.5 text-lg font-semibold tracking-tight', tone === 'danger' ? 'text-danger-text' : tone === 'expiry' ? 'text-expiry-text' : 'text-foreground')}>{value}</p>
    </div>
  )
}

function InsightRow({ insight: i, expanded, onToggle, onAction }: { insight: Insight; expanded: boolean; onToggle: () => void; onAction: () => void }) {
  const panelId = `why-${i.id}`
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{i.title}</p>
            <Badge tone={KIND_BADGE[i.kind].tone}>{KIND_BADGE[i.kind].label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{i.summary}</p>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={onToggle}
            className="mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Why this?
            <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onAction}>
          {i.action.label}
        </Button>
      </div>
      {expanded ? (
        <div id={panelId} className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recorded facts</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
              {i.recorded.map((r) => (
                <li key={r} className="text-pretty">{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimates</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
              {i.estimated.map((r) => (
                <li key={r} className="text-pretty">{r}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Recommendation: {i.recommendation} Nothing changes until you confirm an action.</p>
        </div>
      ) : null}
    </li>
  )
}
