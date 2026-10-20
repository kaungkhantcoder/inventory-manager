'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/overlay'
import { Field, Select, TextInput } from '@/components/ui/fields'
import { ProductPicker } from '@/components/product-picker'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { fmtDate, fmtInt, todayISO } from '@/lib/calc'
import { fefoOrder, planIssue } from '@/lib/ops'
import type { Movement } from '@/lib/types'
import { cn } from '@/lib/utils'

const IN_REASONS = ['Supplier delivery', 'Production output', 'Customer return', 'Stock count adjustment']
const OUT_REASONS = ['Customer dispatch', 'Production use', 'Waste / spoilage', 'Stock count adjustment']

interface Props {
  initialType: 'in' | 'out'
  initialProductId?: string
  onClose: () => void
}

export function MovementModal({ initialType, initialProductId, onClose }: Props) {
  const { rows, data, receiveStock, issueStock } = useStore()
  const { toast } = useUI()

  const [type, setType] = useState<'in' | 'out'>(initialType)
  const [productId, setProductId] = useState<string | null>(initialProductId ?? null)
  const [qty, setQty] = useState('')
  const [batchMode, setBatchMode] = useState<'new' | 'existing'>('new')
  const [existingBatchId, setExistingBatchId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [supplier, setSupplier] = useState('')
  const [outBatch, setOutBatch] = useState('fefo')
  const [reason, setReason] = useState(initialType === 'in' ? IN_REASONS[0] : OUT_REASONS[0])
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Movement | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (productId) document.getElementById('mv-qty')?.focus()
  }, [productId])

  useEffect(() => {
    if (!saved) return
    const fadeTimer = window.setTimeout(() => setClosing(true), 750)
    const closeTimer = window.setTimeout(onClose, 980)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(closeTimer)
    }
  }, [saved, onClose])

  const row = productId ? rows.find((r) => r.product.id === productId) : undefined
  const product = row?.product
  const stock = row?.m.stock ?? 0
  const activeBatches = useMemo(() => (row ? fefoOrder(row.m.activeBatches) : []), [row])

  const quantity = Number(qty)
  const qtyValid = qty.trim() !== '' && Number.isFinite(quantity) && quantity > 0

  const plan = useMemo(() => {
    if (type !== 'out' || !product || !qtyValid) return null
    return planIssue(data, product.id, quantity, outBatch)
  }, [type, product, qtyValid, quantity, outBatch, data])

  const outAvailable = type === 'out' && product ? planIssue(data, product.id, 0, outBatch).available : stock

  const errors = {
    product: !product ? 'Select a product.' : null,
    qty: !qtyValid
      ? 'Enter a quantity greater than zero.'
      : type === 'out' && quantity > outAvailable
        ? `Only ${fmtInt(outAvailable)} ${product?.unit ?? ''} available${outBatch === 'fefo' ? '' : ' in this batch'}.`
        : null,
    expiry:
      type === 'in' && product?.tracksExpiry && batchMode === 'new'
        ? !expiry
          ? 'Expiry date is required for this product.'
          : expiry < todayISO()
            ? 'Expiry date is in the past.'
            : null
        : null,
    existing: type === 'in' && batchMode === 'existing' && !existingBatchId ? 'Choose a batch.' : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const show = (e: string | null) => (submitted ? e : null)

  const changeType = (t: 'in' | 'out') => {
    setType(t)
    setReason(t === 'in' ? IN_REASONS[0] : OUT_REASONS[0])
    setServerError(null)
  }

  const changeProduct = (id: string | null) => {
    setProductId(id)
    setBatchMode('new')
    setExistingBatchId('')
    setBatchNumber('')
    setExpiry('')
    setOutBatch('fefo')
    setServerError(null)
    const p = id ? rows.find((r) => r.product.id === id)?.product : undefined
    if (p && !supplier) setSupplier(p.supplier)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors || !product) return
    const common = { productId: product.id, quantity, reason, note }
    const res =
      type === 'in'
        ? receiveStock({
            ...common,
            batchId: batchMode === 'existing' ? existingBatchId : undefined,
            batchNumber,
            expiryDate: expiry || null,
            supplier,
          })
        : issueStock({ ...common, batchId: outBatch })
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    setSaved(res.movement)
    toast(`${type === 'in' ? 'Received' : 'Issued'} ${fmtInt(quantity)} ${product.unit} of ${product.name}.`)
  }

  const another = () => {
    setSaved(null)
    setClosing(false)
    setProductId(null)
    setQty('')
    setNote('')
    setBatchNumber('')
    setExpiry('')
    setExistingBatchId('')
    setBatchMode('new')
    setOutBatch('fefo')
    setSubmitted(false)
    setServerError(null)
  }

  if (saved) {
    return (
      <Drawer
        key="saved"
        open
        onClose={onClose}
        closing={closing}
        className="max-w-[680px]"
        backdropClassName="bg-navy/10"
        title={saved.type === 'in' ? 'Stock received' : 'Stock issued'}
        subtitle="Saved successfully"
        footer={
          <>
            <Button variant="outline" size="lg" onClick={onClose}>
              Done
            </Button>
            <Button size="lg" onClick={another} data-autofocus>
              Record another {saved.type === 'in' ? 'Stock In' : 'Stock Out'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-text">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{saved.productName}</p>
            <p className="text-xs text-muted-foreground">
              {saved.type === 'in' ? '+' : '−'}
              {fmtInt(saved.quantity)} {saved.unit} · Batch {saved.batchSummary}
            </p>
          </div>
          <div className="flex w-full items-center justify-center gap-4 rounded-lg bg-muted/60 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Previous stock</p>
              <p className="tabular text-xl font-semibold text-foreground">{fmtInt(saved.previousStock)}</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">New stock</p>
              <p className="tabular text-xl font-semibold text-foreground">{fmtInt(saved.newStock)}</p>
            </div>
          </div>
        </div>
      </Drawer>
    )
  }

  const newStock = product && qtyValid ? (type === 'in' ? stock + quantity : stock - quantity) : null
  const reasons = type === 'in' ? IN_REASONS : OUT_REASONS

  return (
    <Drawer
      key="form"
      open
      onClose={onClose}
      className="max-w-[680px]"
      backdropClassName="bg-navy/10"
      title="Stock In / Out"
      subtitle="Record stock received into, or leaving, the warehouse. Product details are reused automatically."
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="lg" type="submit" form="movement-form">
            {type === 'in' ? 'Save Stock In' : 'Save Stock Out'}
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={submit} noValidate className="flex flex-col gap-4 p-5 sm:p-6 lg:p-8">
        <div role="radiogroup" aria-label="Movement type" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['in', 'out'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => changeType(t)}
              className={cn(
                'flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors',
                type === t ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'in' ? <ArrowDownToLine className="size-4" aria-hidden="true" /> : <ArrowUpFromLine className="size-4" aria-hidden="true" />}
              {t === 'in' ? 'Stock In (receive)' : 'Stock Out (issue)'}
            </button>
          ))}
        </div>

        <Field label="Product" htmlFor="mv-product" error={show(errors.product)} hint="Barcode scanners that type into this field work: scan or type a SKU, then press Enter.">
          <ProductPicker id="mv-product" value={productId} onChange={changeProduct} invalid={!!show(errors.product)} autoFocus={!initialProductId} />
        </Field>

        {product ? (
          <>
            <Field label={`Quantity (${product.unit})`} htmlFor="mv-qty" error={show(errors.qty)}>
              <TextInput
                id="mv-qty"
                data-autofocus
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={qty}
                aria-invalid={!!show(errors.qty) || undefined}
                onChange={(e) => {
                  setQty(e.target.value.replace(/[^0-9.]/g, ''))
                  setServerError(null)
                }}
                className="tabular max-w-40"
              />
            </Field>

            {type === 'in' ? (
              <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Batch</legend>
                {activeBatches.length > 0 ? (
                  <div role="radiogroup" aria-label="Batch handling" className="flex gap-4 text-sm">
                    {(['new', 'existing'] as const).map((m) => (
                      <label key={m} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="batch-mode" checked={batchMode === m} onChange={() => setBatchMode(m)} className="accent-primary" />
                        {m === 'new' ? 'New batch' : 'Add to existing batch'}
                      </label>
                    ))}
                  </div>
                ) : null}

                {batchMode === 'new' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Batch number" htmlFor="mv-batch" hint="Leave blank to auto-generate.">
                      <TextInput id="mv-batch" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Auto" className="font-mono" />
                    </Field>
                    <Field
                      label={product.tracksExpiry ? 'Expiry date (required)' : 'Expiry date (optional)'}
                      htmlFor="mv-expiry"
                      error={show(errors.expiry)}
                    >
                      <TextInput id="mv-expiry" type="date" value={expiry} min={todayISO()} aria-invalid={!!show(errors.expiry) || undefined} onChange={(e) => setExpiry(e.target.value)} />
                    </Field>
                    <Field label="Supplier" htmlFor="mv-supplier" className="sm:col-span-2">
                      <TextInput id="mv-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" />
                    </Field>
                  </div>
                ) : (
                  <Field label="Existing batch" htmlFor="mv-existing" error={show(errors.existing)}>
                    <Select id="mv-existing" value={existingBatchId} aria-invalid={!!show(errors.existing) || undefined} onChange={(e) => setExistingBatchId(e.target.value)}>
                      <option value="">Select a batch…</option>
                      {activeBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} · {fmtInt(b.quantity)} {product.unit} · {b.expiryDate ? `exp ${fmtDate(b.expiryDate)}` : 'no expiry'}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </fieldset>
            ) : (
              <Field label="Take from" htmlFor="mv-out-batch" hint="FEFO uses the earliest-expiring batch first.">
                <Select id="mv-out-batch" value={outBatch} onChange={(e) => setOutBatch(e.target.value)}>
                  <option value="fefo">FEFO: earliest expiry first (recommended)</option>
                  {activeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} · {fmtInt(b.quantity)} {product.unit} · {b.expiryDate ? `exp ${fmtDate(b.expiryDate)}` : 'no expiry'}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Reason" htmlFor="mv-reason">
                <Select id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {reasons.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Note (optional)" htmlFor="mv-note">
                <TextInput id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="PO number, order ref…" />
              </Field>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3" aria-live="polite">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Review</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="tabular text-foreground">
                    {fmtInt(stock)} {product.unit}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className={cn('tabular font-semibold', newStock === null ? 'text-muted-foreground' : newStock < 0 ? 'text-danger-text' : 'text-foreground')}>
                    {newStock === null ? '—' : `${fmtInt(newStock)} ${product.unit}`}
                  </span>
                </div>
                {plan && plan.allocations.length > 0 && quantity <= plan.available ? (
                  <p className="text-xs text-muted-foreground">
                    From {plan.allocations.map((a) => `${a.batch.batchNumber} (${fmtInt(a.qty)})`).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {serverError ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
            {serverError}
          </p>
        ) : null}
      </form>
    </Drawer>
  )
}
