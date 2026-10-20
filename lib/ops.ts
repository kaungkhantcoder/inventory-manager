import { toISODate } from './calc'
import type { Batch, Data, Movement, Product } from './types'

export function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

export function stockOf(batches: Batch[], productId: string): number {
  return batches.filter((b) => b.productId === productId).reduce((s, b) => s + b.quantity, 0)
}

export function normalizeSku(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '-')
}

export function generateSku(name: string, category: string, taken: Set<string>): string {
  const letters = name.replace(/[^a-zA-Z ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  let prefix = letters.length > 1 ? letters[0][0] + letters[1][0] : (letters[0] ?? category).slice(0, 2)
  prefix = prefix.toUpperCase().padEnd(2, 'X')
  let n = 1000
  while (taken.has(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

export function uniqueSkuVariant(sku: string, taken: Set<string>): string {
  const base = sku.replace(/-\d+$/, '') || 'SKU'
  let n = 2
  const match = sku.match(/-(\d+)$/)
  if (match) {
    let next = Number(match[1]) + 1
    while (taken.has(`${base}-${next}`)) next += 1
    return `${base}-${next}`
  }
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export function generateBatchNumber(product: Product, batches: Batch[], date = new Date()): string {
  const stamp = toISODate(date).slice(5).replace('-', '')
  const base = `L${stamp}-${product.sku.replace(/-/g, '')}`
  const used = new Set(batches.filter((b) => b.productId === product.id).map((b) => b.batchNumber))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export interface ProductInput {
  name: string
  sku: string
  category: string
  unit: string
  reorderPoint: number
  dailyUsage?: number
  unitCost?: number
  supplier?: string
  tracksExpiry: boolean
}

export function createProductOp(data: Data, input: ProductInput): { data: Data; product: Product } {
  const now = new Date().toISOString()
  const product: Product = {
    id: uid('p'),
    name: input.name.trim(),
    sku: normalizeSku(input.sku),
    category: input.category,
    unit: input.unit,
    reorderPoint: input.reorderPoint,
    dailyUsage: input.dailyUsage ?? 0,
    unitCost: input.unitCost ?? 0,
    supplier: input.supplier?.trim() ?? '',
    tracksExpiry: input.tracksExpiry,
    createdAt: now,
    updatedAt: now,
  }
  return { data: { ...data, products: [product, ...data.products] }, product }
}

export interface ReceiveInput {
  productId: string
  quantity: number
  batchNumber?: string
  expiryDate?: string | null
  /** When set, quantity is added to this existing batch instead of creating a new one. */
  batchId?: string
  supplier?: string
  reason?: string
  note?: string
}

export type OpResult = { ok: true; data: Data; movement: Movement } | { ok: false; error: string }

export function receiveOp(data: Data, input: ReceiveInput): OpResult {
  const product = data.products.find((p) => p.id === input.productId)
  if (!product) return { ok: false, error: 'Product not found.' }
  if (!(input.quantity > 0)) return { ok: false, error: 'Quantity must be greater than zero.' }

  const previous = stockOf(data.batches, product.id)
  const now = new Date().toISOString()
  let batches = data.batches
  let batchLabel: string

  if (input.batchId) {
    const existing = data.batches.find((b) => b.id === input.batchId && b.productId === product.id)
    if (!existing) return { ok: false, error: 'Batch not found.' }
    batchLabel = existing.batchNumber
    batches = data.batches.map((b) =>
      b.id === existing.id ? { ...b, quantity: b.quantity + input.quantity, receivedQty: b.receivedQty + input.quantity } : b,
    )
  } else {
    const number = input.batchNumber?.trim() || generateBatchNumber(product, data.batches)
    batchLabel = number
    const batch: Batch = {
      id: uid('b'),
      productId: product.id,
      batchNumber: number,
      quantity: input.quantity,
      receivedQty: input.quantity,
      expiryDate: input.expiryDate || null,
      receivedAt: now,
      supplier: input.supplier?.trim() || product.supplier,
      dispatchPriority: false,
    }
    batches = [...data.batches, batch]
  }

  const movement: Movement = {
    id: uid('m'),
    type: 'in',
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    unit: product.unit,
    quantity: input.quantity,
    previousStock: previous,
    newStock: previous + input.quantity,
    batchSummary: batchLabel,
    reason: input.reason ?? 'Supplier delivery',
    note: input.note ?? '',
    createdAt: now,
  }

  const products = data.products.map((p) => (p.id === product.id ? { ...p, updatedAt: now } : p))
  return { ok: true, data: { ...data, products, batches, movements: [movement, ...data.movements] }, movement }
}

export interface IssueInput {
  productId: string
  quantity: number
  /** 'fefo' allocates earliest-expiry first; otherwise a specific batch id. */
  batchId: 'fefo' | string
  reason?: string
  note?: string
}

export function fefoOrder(batches: Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) {
      if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
    } else if (a.expiryDate) return -1
    else if (b.expiryDate) return 1
    return a.receivedAt < b.receivedAt ? -1 : 1
  })
}

export function planIssue(
  data: Data,
  productId: string,
  quantity: number,
  batchId: 'fefo' | string,
): { allocations: { batch: Batch; qty: number }[]; available: number } {
  const active = data.batches.filter((b) => b.productId === productId && b.quantity > 0)
  const pool = batchId === 'fefo' ? fefoOrder(active) : active.filter((b) => b.id === batchId)
  const available = pool.reduce((s, b) => s + b.quantity, 0)
  const allocations: { batch: Batch; qty: number }[] = []
  let remaining = quantity
  for (const batch of pool) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantity, remaining)
    allocations.push({ batch, qty: take })
    remaining -= take
  }
  return { allocations, available }
}

export function issueOp(data: Data, input: IssueInput): OpResult {
  const product = data.products.find((p) => p.id === input.productId)
  if (!product) return { ok: false, error: 'Product not found.' }
  if (!(input.quantity > 0)) return { ok: false, error: 'Quantity must be greater than zero.' }

  const { allocations, available } = planIssue(data, product.id, input.quantity, input.batchId)
  if (input.quantity > available) {
    return { ok: false, error: `Only ${available} ${product.unit} available${input.batchId === 'fefo' ? '' : ' in the selected batch'}.` }
  }

  const previous = stockOf(data.batches, product.id)
  const now = new Date().toISOString()
  const take = new Map(allocations.map((a) => [a.batch.id, a.qty]))
  const batches = data.batches.map((b) => (take.has(b.id) ? { ...b, quantity: b.quantity - (take.get(b.id) as number) } : b))

  const movement: Movement = {
    id: uid('m'),
    type: 'out',
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    unit: product.unit,
    quantity: input.quantity,
    previousStock: previous,
    newStock: previous - input.quantity,
    batchSummary: allocations.map((a) => a.batch.batchNumber).join(', '),
    reason: input.reason ?? 'Customer dispatch',
    note: input.note ?? '',
    createdAt: now,
  }
  const products = data.products.map((p) => (p.id === product.id ? { ...p, updatedAt: now } : p))
  return { ok: true, data: { ...data, products, batches, movements: [movement, ...data.movements] }, movement }
}

export interface BulkCommitRow {
  productId: string | null
  product: ProductInput
  quantity: number
  batchNumber: string
  expiryDate: string
  supplier: string
}

export function commitBulkOp(data: Data, rows: BulkCommitRow[]): { data: Data; created: number; received: number } {
  let next = data
  let created = 0
  let received = 0
  for (const row of rows) {
    let productId = row.productId
    if (!productId) {
      const res = createProductOp(next, row.product)
      next = res.data
      productId = res.product.id
      created += 1
    }
    if (row.quantity > 0) {
      const res = receiveOp(next, {
        productId,
        quantity: row.quantity,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate || null,
        supplier: row.supplier,
        reason: row.productId ? 'Supplier delivery' : 'Initial stock',
        note: 'Bulk entry',
      })
      if (res.ok) {
        next = res.data
        if (row.productId) received += 1
      }
    }
  }
  return { data: next, created, received }
}
