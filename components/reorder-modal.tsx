'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/overlay'
import { Field, TextInput } from '@/components/ui/fields'
import { Badge } from '@/components/ui/badges'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { fmtCover, fmtInt } from '@/lib/calc'
import { suggestedReorderQty } from '@/lib/calc'

interface Props {
  productId: string
  basis?: string
  qty?: number
  onClose: () => void
}

export function ReorderModal({ productId, basis, qty, onClose }: Props) {
  const { getRow, settings, data, createReorder } = useStore()
  const { toast } = useUI()
  const row = getRow(productId)
  const suggested = row ? qty ?? suggestedReorderQty(row.product, row.m.stock, settings) : 0
  const [value, setValue] = useState(suggested > 0 ? String(suggested) : '')
  const [error, setError] = useState<string | null>(null)

  if (!row) return null
  const { product, m } = row
  const open = data.reorders.filter((r) => r.productId === productId && r.status !== 'Cancelled' && r.status !== 'Ordered')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      setError('Enter a whole number greater than 0.')
      return
    }
    createReorder(productId, n, basis ?? 'Manual reorder request')
    toast(`Reorder request created: ${fmtInt(n)} ${product.unit} of ${product.name}. Stock levels are unchanged until it is received.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Reorder Request"
      description="A request records what to order. It does not change your stock until the delivery is received."
      footer={
        <>
          <Button variant="outline" size="lg" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" form="reorder-form">
            Create request
          </Button>
        </>
      }
    >
      <form id="reorder-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
            </div>
            <Badge tone={m.stockStatus === 'healthy' ? 'success' : m.stockStatus === 'low' ? 'warning' : 'danger'}>
              {m.stockStatus === 'healthy' ? 'Healthy' : m.stockStatus === 'low' ? 'Low stock' : 'Stockout risk'}
            </Badge>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-border border-t border-border text-sm">
            <Stat label="On hand (recorded)" value={`${fmtInt(m.stock)} ${product.unit}`} />
            <Stat label="Daily usage (set)" value={`${fmtInt(product.dailyUsage)}/day`} />
            <Stat label="Cover (estimate)" value={fmtCover(m.cover)} />
          </dl>
        </div>

        {open.length ? (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-text text-pretty">
            There {open.length === 1 ? 'is already 1 open request' : `are already ${open.length} open requests`} for this product ({open.map((r) => `${fmtInt(r.quantity)} ${r.unit}`).join(', ')}). Check before ordering more.
          </p>
        ) : null}

        <Field
          label={`Quantity to order (${product.unit})`}
          htmlFor="reorder-qty"
          error={error}
          hint={suggested > 0 ? `Suggested ${fmtInt(suggested)}: estimate to reach ${settings.targetCoverDays} days of cover at current usage.` : 'Stock is above target cover. Enter a quantity if you still want to order.'}
        >
          <TextInput
            id="reorder-qty"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            aria-invalid={!!error}
            className="tabular"
          />
        </Field>
        {basis ? <p className="text-xs text-muted-foreground text-pretty">Reason: {basis}</p> : null}
      </form>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}
