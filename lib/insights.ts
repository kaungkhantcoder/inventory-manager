import { batchExpiry, fmtCover, fmtInt, suggestedReorderQty } from './calc'
import type { Row } from './store'
import type { Batch, Data, Settings } from './types'

export type InsightKind = 'stockout' | 'expiry' | 'low'

export interface Insight {
  id: string
  kind: InsightKind
  severity: 'high' | 'medium'
  productId: string
  productName: string
  unit: string
  batchId?: string
  title: string
  summary: string
  recommendation: string
  recorded: string[]
  estimated: string[]
  action: { type: 'reorder' | 'review-batch' | 'check-stock'; label: string }
  suggestedQty: number
  sortKey: number
}

const KIND_ORDER: Record<InsightKind, number> = { stockout: 0, expiry: 1, low: 2 }

export function buildInsights(rows: Row[], settings: Settings): Insight[] {
  const out: Insight[] = []

  for (const { product, m } of rows) {
    const qty = suggestedReorderQty(product, m.stock, settings)

    if (m.stockStatus === 'stockout') {
      const out0 = m.stock <= 0
      out.push({
        id: `stockout-${product.id}`,
        kind: 'stockout',
        severity: 'high',
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        title: out0 ? `${product.name} is out of stock` : `${product.name} may run out in ${fmtCover(m.cover)}`,
        summary: out0
          ? `0 ${product.unit} on hand; average usage ${fmtInt(product.dailyUsage)} ${product.unit}/day.`
          : `${fmtInt(m.stock)} ${product.unit} remaining; average usage ${fmtInt(product.dailyUsage)} ${product.unit}/day; estimated stockout in approximately ${fmtCover(m.cover).replace('~', '')}.`,
        recommendation: `Review a reorder for ${product.name}.`,
        recorded: [
          `On hand: ${fmtInt(m.stock)} ${product.unit}`,
          `Average daily usage: ${fmtInt(product.dailyUsage)} ${product.unit}/day (as set on the product)`,
          `Reorder point: ${fmtInt(product.reorderPoint)} ${product.unit}`,
        ],
        estimated: [
          m.cover === null ? 'Days of cover unavailable (no usage set)' : `Days of cover: ${fmtCover(m.cover)} (${fmtInt(m.stock)} ÷ ${fmtInt(product.dailyUsage)} per day)`,
          `Suggested reorder: ${fmtInt(qty)} ${product.unit} to reach ${settings.targetCoverDays} days of cover`,
        ],
        action: { type: 'reorder', label: 'Create Reorder Request' },
        suggestedQty: qty,
        sortKey: m.cover ?? 0,
      })
    } else if (m.stockStatus === 'low') {
      out.push({
        id: `low-${product.id}`,
        kind: 'low',
        severity: 'medium',
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        title: `${product.name} is below its normal stock level`,
        summary: `${fmtInt(m.stock)} ${product.unit} on hand against a reorder point of ${fmtInt(product.reorderPoint)}.`,
        recommendation: `Review ${product.name} stock levels.`,
        recorded: [
          `On hand: ${fmtInt(m.stock)} ${product.unit}`,
          `Reorder point: ${fmtInt(product.reorderPoint)} ${product.unit}`,
          `Average daily usage: ${fmtInt(product.dailyUsage)} ${product.unit}/day (as set on the product)`,
        ],
        estimated: [
          `Days of cover: ${fmtCover(m.cover)}`,
          `Suggested reorder: ${fmtInt(qty)} ${product.unit} to reach ${settings.targetCoverDays} days of cover`,
        ],
        action: { type: 'check-stock', label: 'Check Stock' },
        suggestedQty: qty,
        sortKey: m.cover ?? 999,
      })
    }

    for (const info of m.atRiskBatches) {
      const days = info.days as number
      const expectedUse = Math.min(info.batch.quantity, Math.max(0, product.dailyUsage * Math.max(days, 0)))
      const atRisk = Math.max(0, Math.round(info.batch.quantity - expectedUse))
      const expired = info.status === 'expired'
      out.push({
        id: `expiry-${info.batch.id}`,
        kind: 'expiry',
        severity: expired || days <= 3 ? 'high' : 'medium',
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        batchId: info.batch.id,
        title: expired
          ? `${fmtInt(info.batch.quantity)} ${product.name} ${product.unit} have expired`
          : `${fmtInt(info.batch.quantity)} ${product.name} ${product.unit} will expire ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        summary: `Batch ${info.batch.batchNumber} expires ${info.batch.expiryDate}. ${atRisk > 0 ? `About ${fmtInt(atRisk)} ${product.unit} may not be used in time at current usage.` : 'Expected to be used before expiry at current usage.'}`,
        recommendation: expired ? `Quarantine the expired ${product.name} batch.` : `Prioritize dispatch of the expiring ${product.name} batch.`,
        recorded: [
          `Batch ${info.batch.batchNumber}: ${fmtInt(info.batch.quantity)} ${product.unit} remaining`,
          `Expiry date: ${info.batch.expiryDate}`,
          `Average daily usage: ${fmtInt(product.dailyUsage)} ${product.unit}/day (as set on the product)`,
        ],
        estimated: [
          `Expected use before expiry: ~${fmtInt(Math.round(expectedUse))} ${product.unit} (assumes this batch ships first, FEFO)`,
          `Possible unsold at expiry: ~${fmtInt(atRisk)} ${product.unit}`,
        ],
        action: { type: 'review-batch', label: 'Review Batch' },
        suggestedQty: 0,
        sortKey: days,
      })
    }
  }

  return out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    return a.sortKey - b.sortKey
  })
}

export function attentionCount(insights: Insight[]): number {
  return new Set(insights.map((i) => i.productId)).size
}

export interface BatchRow {
  batch: Batch
  productName: string
  sku: string
  unit: string
  unitCost: number
  category: string
  days: number | null
  status: ReturnType<typeof batchExpiry>['status']
}

export function buildBatchRows(data: Data, settings: Settings): BatchRow[] {
  const out: BatchRow[] = []
  for (const batch of data.batches) {
    if (batch.quantity <= 0) continue
    const product = data.products.find((p) => p.id === batch.productId)
    if (!product) continue
    const info = batchExpiry(batch, settings)
    out.push({
      batch,
      productName: product.name,
      sku: product.sku,
      unit: product.unit,
      unitCost: product.unitCost,
      category: product.category,
      days: info.days,
      status: info.status,
    })
  }
  return out
}

export interface Answer {
  heading: string
  lines: string[]
  actions: { label: string; productId: string }[]
}

export function answerQuestion(question: string, insights: Insight[], rows: Row[], settings: Settings): Answer {
  const q = question.toLowerCase()
  const stockouts = insights.filter((i) => i.kind === 'stockout')
  const expiries = insights.filter((i) => i.kind === 'expiry')

  if (/attention|today|urgent|priorit|what.*(need|should)/.test(q) && !/reorder/.test(q)) {
    const byProduct = new Map<string, Insight>()
    for (const i of insights) if (!byProduct.has(i.productId)) byProduct.set(i.productId, i)
    const list = [...byProduct.values()]
    if (!list.length) return { heading: 'Nothing needs attention today.', lines: ['No stockout, low-stock or near-expiry risks were found in your recorded inventory.'], actions: [] }
    return {
      heading: `${list.length} item${list.length === 1 ? '' : 's'} need${list.length === 1 ? 's' : ''} attention today.`,
      lines: list.map((i, n) => `${n + 1}. ${i.title}`),
      actions: list.map((i) => ({ label: i.recommendation, productId: i.productId })),
    }
  }

  if (/reorder|order|buy|restock/.test(q)) {
    const need = rows
      .filter((r) => r.m.stockStatus !== 'healthy')
      .map((r) => ({ r, qty: suggestedReorderQty(r.product, r.m.stock, settings) }))
      .filter((x) => x.qty > 0)
    if (!need.length) return { heading: 'No reorders suggested.', lines: ['All products are above their reorder point.'], actions: [] }
    return {
      heading: `${need.length} product${need.length === 1 ? '' : 's'} may need a reorder.`,
      lines: need.map(({ r, qty }) => `${r.product.name}: about ${fmtInt(qty)} ${r.product.unit} (estimate, targeting ${settings.targetCoverDays} days of cover)`),
      actions: need.map(({ r }) => ({ label: `Review reorder for ${r.product.name}`, productId: r.product.id })),
    }
  }

  if (/expir|dispatch|fefo|batch|shelf/.test(q)) {
    if (!expiries.length) return { heading: 'No batches are near expiry.', lines: [`No batch expires within ${settings.expiryWindowDays} days.`], actions: [] }
    return {
      heading: `${expiries.length} batch${expiries.length === 1 ? '' : 'es'} near expiry.`,
      lines: expiries.map((i, n) => `${n + 1}. ${i.title}`),
      actions: expiries.map((i) => ({ label: `Review the ${i.productName} batch`, productId: i.productId })),
    }
  }

  if (/stock ?out|run out|out of stock|low|short/.test(q)) {
    const list = insights.filter((i) => i.kind !== 'expiry')
    if (!list.length) return { heading: 'No stock risks found.', lines: ['All products have enough stock at current usage.'], actions: [] }
    return {
      heading: `${list.length} stock risk${list.length === 1 ? '' : 's'} found.`,
      lines: list.map((i, n) => `${n + 1}. ${i.title}`),
      actions: stockouts.concat(list.filter((i) => i.kind === 'low')).map((i) => ({ label: i.recommendation, productId: i.productId })),
    }
  }

  return {
    heading: 'I can answer a few inventory questions.',
    lines: [
      'Try: "What needs my attention today?", "What should I reorder?", "Which batches expire soon?" or "What may run out?"',
      'Answers come from rule-based calculations on your recorded inventory, not an external AI model.',
    ],
    actions: [],
  }
}
