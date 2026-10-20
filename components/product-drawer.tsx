'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/overlay'
import { Field, Select, TextInput } from '@/components/ui/fields'
import { ExpiryBadge, StockBadge } from '@/components/ui/badges'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { batchExpiry, fmtCover, fmtDate, fmtDateTime, fmtInt } from '@/lib/calc'
import { fefoOrder } from '@/lib/ops'
import { buildInsights } from '@/lib/insights'
import { CATEGORIES, UNITS, type Product } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'batches' | 'history' | 'edit'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'batches', label: 'Batches' },
  { id: 'history', label: 'Movements' },
  { id: 'edit', label: 'Edit details' },
]

export function ProductDrawer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { getRow, data, settings, rows } = useStore()
  const { openMovement, openReorder, openBatchReview } = useUI()
  const [tab, setTab] = useState<Tab>('overview')
  const row = getRow(productId)

  const history = useMemo(
    () => data.movements.filter((m) => m.productId === productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.movements, productId],
  )
  const alerts = useMemo(() => buildInsights(rows, settings).filter((i) => i.productId === productId), [rows, settings, productId])

  if (!row) return null
  const { product, m } = row
  const batches = fefoOrder(m.activeBatches)

  return (
    <Drawer
      open
      onClose={onClose}
      title={product.name}
      subtitle={
        <>
          <span className="font-mono text-xs">{product.sku}</span>
          <span aria-hidden="true">·</span>
          <span>{product.category}</span>
          <StockBadge status={m.stockStatus} cover={m.cover} />
        </>
      }
      footer={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => openMovement('in', productId)}>
            <ArrowDownToLine aria-hidden="true" />
            Stock In
          </Button>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => openMovement('out', productId)}>
            <ArrowUpFromLine aria-hidden="true" />
            Stock Out
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label="Product sections" className="sticky top-0 z-10 flex gap-1 border-b border-border bg-card px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px h-10 border-b-2 px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5">
        {tab === 'overview' ? (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <Fact label="Current stock" value={`${fmtInt(m.stock)} ${product.unit}`} strong />
              <Fact label="Days of cover" value={fmtCover(m.cover)} hint={m.cover === null ? 'No daily usage set' : 'Estimate from daily usage'} />
              <Fact label="Reorder point" value={`${fmtInt(product.reorderPoint)} ${product.unit}`} />
              <Fact label="Daily usage" value={`${fmtInt(product.dailyUsage)} ${product.unit}/day`} />
              <Fact label="Supplier" value={product.supplier || 'Not set'} />
              <Fact label="Next expiry" value={m.nextExpiry ? fmtDate(m.nextExpiry.date) : product.tracksExpiry ? 'No stock on hand' : 'Not tracked'} />
            </dl>

            <section aria-labelledby="alerts-h">
              <h3 id="alerts-h" className="mb-2 text-sm font-semibold text-foreground">
                Related alerts
              </h3>
              {alerts.length ? (
                <ul className="flex flex-col gap-2">
                  {alerts.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{a.summary}</p>
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (a.action.type === 'reorder') openReorder(product.id, { basis: a.title, qty: a.suggestedQty })
                            else if (a.action.type === 'review-batch' && a.batchId) openBatchReview(a.batchId)
                            else setTab('batches')
                          }}
                        >
                          {a.action.label}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  No active alerts for this product.
                </p>
              )}
            </section>

            <section aria-labelledby="recent-h">
              <h3 id="recent-h" className="mb-2 text-sm font-semibold text-foreground">
                Latest movements
              </h3>
              <MovementList items={history.slice(0, 3)} unit={product.unit} />
              {history.length > 3 ? (
                <button type="button" onClick={() => setTab('history')} className="mt-2 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  View all {history.length} movements
                </button>
              ) : null}
            </section>
          </div>
        ) : null}

        {tab === 'batches' ? (
          batches.length ? (
            <div>
              <p className="mb-3 text-xs text-muted-foreground text-pretty">Listed in FEFO order (first expired, first out). Stock Out uses this order by default.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">Batch</th>
                    <th scope="col" className="py-2 text-right font-medium">Remaining</th>
                    <th scope="col" className="py-2 pl-4 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const info = batchExpiry(b, settings)
                    return (
                      <tr key={b.id} className="border-b border-border last:border-0">
                        <td className="py-2.5">
                          <button type="button" onClick={() => openBatchReview(b.id)} className="rounded font-mono text-xs text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                            {b.batchNumber}
                          </button>
                          <span className="block text-xs text-muted-foreground">Received {fmtDate(b.receivedAt)}</span>
                        </td>
                        <td className="tabular py-2.5 text-right">{fmtInt(b.quantity)}</td>
                        <td className="py-2.5 pl-4">
                          <span className="block text-xs text-muted-foreground">{b.expiryDate ? fmtDate(b.expiryDate) : ''}</span>
                          <ExpiryBadge status={info.status} days={info.days} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No batches on hand. Use Stock In to receive a new batch.</p>
          )
        ) : null}

        {tab === 'history' ? <MovementList items={history} unit={product.unit} emptyText="No movements recorded for this product yet." /> : null}

        {tab === 'edit' ? <EditForm key={product.updatedAt} product={product} onSaved={() => setTab('overview')} /> : null}
      </div>
    </Drawer>
  )
}

function Fact({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('tabular mt-0.5 text-foreground', strong ? 'text-xl font-semibold' : 'text-sm font-medium')}>{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function MovementList({ items, unit, emptyText }: { items: ReturnType<typeof useStore>['data']['movements']; unit: string; emptyText?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText ?? 'No movements yet.'}</p>
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((mv) => (
        <li key={mv.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              <span className={mv.type === 'in' ? 'text-success-text' : 'text-foreground'}>
                {mv.type === 'in' ? '+' : '-'}
                {fmtInt(mv.quantity)} {unit}
              </span>
              <span className="font-normal text-muted-foreground"> · {mv.reason}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {mv.batchSummary} · {fmtDateTime(mv.createdAt)}
            </p>
          </div>
          <p className="tabular shrink-0 text-xs text-muted-foreground">
            {fmtInt(mv.previousStock)} → {fmtInt(mv.newStock)}
          </p>
        </li>
      ))}
    </ul>
  )
}

function EditForm({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const { updateProduct } = useStore()
  const { toast } = useUI()
  const [f, setF] = useState({
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    reorderPoint: String(product.reorderPoint),
    dailyUsage: String(product.dailyUsage),
    supplier: product.supplier,
    tracksExpiry: product.tracksExpiry,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!f.name.trim()) next.name = 'Name is required.'
    if (!f.sku.trim()) next.sku = 'SKU is required.'
    const reorder = Number(f.reorderPoint)
    const usage = Number(f.dailyUsage)
    if (f.reorderPoint.trim() === '' || !Number.isFinite(reorder) || reorder < 0) next.reorderPoint = 'Enter 0 or more.'
    if (f.dailyUsage.trim() === '' || !Number.isFinite(usage) || usage < 0) next.dailyUsage = 'Enter 0 or more.'
    if (Object.keys(next).length) {
      setErrors(next)
      return
    }
    const res = updateProduct(product.id, {
      name: f.name.trim(),
      sku: f.sku,
      category: f.category,
      unit: f.unit,
      reorderPoint: reorder,
      dailyUsage: usage,
      supplier: f.supplier.trim(),
      tracksExpiry: f.tracksExpiry,
    })
    if (!res.ok) {
      setErrors({ sku: res.error ?? 'Could not save.' })
      return
    }
    toast(`${f.name.trim()} updated.`)
    onSaved()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
        Editing updates this product record only. Stock quantities and past movements are not changed.
      </p>
      <Field label="Product name" htmlFor="e-name" error={errors.name}>
        <TextInput id="e-name" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" htmlFor="e-sku" error={errors.sku}>
          <TextInput id="e-sku" value={f.sku} onChange={(e) => set('sku', e.target.value)} aria-invalid={!!errors.sku} className="font-mono uppercase" />
        </Field>
        <Field label="Supplier" htmlFor="e-sup">
          <TextInput id="e-sup" value={f.supplier} onChange={(e) => set('supplier', e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="e-cat">
          <Select id="e-cat" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" htmlFor="e-unit">
          <Select id="e-unit" value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reorder point" htmlFor="e-rp" error={errors.reorderPoint}>
          <TextInput id="e-rp" inputMode="decimal" value={f.reorderPoint} onChange={(e) => set('reorderPoint', e.target.value)} aria-invalid={!!errors.reorderPoint} className="tabular" />
        </Field>
        <Field label="Daily usage" htmlFor="e-du" error={errors.dailyUsage} hint="Average units used or sold per day.">
          <TextInput id="e-du" inputMode="decimal" value={f.dailyUsage} onChange={(e) => set('dailyUsage', e.target.value)} aria-invalid={!!errors.dailyUsage} className="tabular" />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={f.tracksExpiry} onChange={(e) => set('tracksExpiry', e.target.checked)} className="size-4 accent-primary" />
        This product has expiry dates
      </label>
      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Save changes
        </Button>
      </div>
    </form>
  )
}
