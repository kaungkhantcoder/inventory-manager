'use client'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/overlay'
import { ExpiryBadge } from '@/components/ui/badges'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { batchExpiry, batchRecommendation, fmtDate, fmtInt, fmtMoney } from '@/lib/calc'

export function BatchReviewModal({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { data, settings, setDispatchPriority } = useStore()
  const { openMovement, openProduct, toast } = useUI()
  const batch = data.batches.find((b) => b.id === batchId)
  const product = batch ? data.products.find((p) => p.id === batch.productId) : undefined
  if (!batch || !product) return null

  const info = batchExpiry(batch, settings)
  const recommendation = batchRecommendation(info, settings)
  const daysLeft = info.days ?? 0
  const expectedUse = Math.min(batch.quantity, Math.max(0, product.dailyUsage * Math.max(daysLeft, 0)))
  const unsold = Math.max(0, Math.round(batch.quantity - expectedUse))

  const togglePriority = () => {
    setDispatchPriority(batch.id, !batch.dispatchPriority)
    toast(batch.dispatchPriority ? `Dispatch priority removed from batch ${batch.batchNumber}.` : `Batch ${batch.batchNumber} marked as dispatch first. No stock was changed.`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Review Batch"
      description="Reviewing a batch never changes quantities. Use Stock Out to record stock leaving."
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              onClose()
              openProduct(product.id)
            }}
          >
            View product
          </Button>
          <Button
            size="lg"
            onClick={() => {
              onClose()
              openMovement('out', product.id)
            }}
          >
            Record Stock Out
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{product.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Batch {batch.batchNumber} · {product.sku}
            </p>
          </div>
          <ExpiryBadge status={info.status} days={info.days} />
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
          <Item label="Quantity remaining" value={`${fmtInt(batch.quantity)} ${product.unit}`} />
          <Item label="Expiry date" value={batch.expiryDate ? fmtDate(batch.expiryDate) : 'None'} />
          <Item label="Received" value={fmtDate(batch.receivedAt)} />
          <Item label="Stock value" value={product.unitCost > 0 ? fmtMoney(batch.quantity * product.unitCost) : 'Not set'} />
        </dl>

        <section className="rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold text-foreground">Recommendation</h3>
          <p className="mt-1 text-sm text-foreground">{recommendation}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
            <li>Recorded: {fmtInt(batch.quantity)} {product.unit} remain, expiring {batch.expiryDate ? fmtDate(batch.expiryDate) : 'never'}.</li>
            {info.status === 'expiring' ? (
              <li>
                Estimate: about {fmtInt(Math.round(expectedUse))} {product.unit} used before expiry at {fmtInt(product.dailyUsage)}/day, leaving roughly {fmtInt(unsold)} {product.unit} at risk (assumes this batch ships first).
              </li>
            ) : null}
            <li>FEFO means shipping the earliest-expiring batch first. Nothing is removed automatically.</li>
          </ul>
        </section>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <input type="checkbox" checked={batch.dispatchPriority} onChange={togglePriority} className="mt-0.5 size-4 accent-primary" />
          <span>
            Mark as dispatch first
            <span className="block text-xs text-muted-foreground">A reminder flag for the warehouse team. It does not move or reduce stock.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}
