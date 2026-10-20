import type { Batch, ExpiryStatus, Product, Settings, StockStatus } from './types'

const DAY = 86_400_000

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDaysISO(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return toISODate(d)
}

export function daysUntil(dateISO: string): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((parseISODate(dateISO).getTime() - start) / DAY)
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function fmtDate(iso: string): string {
  const d = iso.length === 10 ? parseISODate(iso) : new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function fmtDays(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function fmtCover(days: number | null): string {
  if (days === null) return 'n/a'
  if (days < 1) return '<1 day'
  const r = Math.round(days)
  return `~${r} day${r === 1 ? '' : 's'}`
}

export interface BatchInfo {
  batch: Batch
  days: number | null
  status: ExpiryStatus
}

export function batchExpiry(batch: Batch, settings: Settings): BatchInfo {
  if (!batch.expiryDate) return { batch, days: null, status: 'none' }
  const days = daysUntil(batch.expiryDate)
  const status: ExpiryStatus = days < 0 ? 'expired' : days <= settings.expiryWindowDays ? 'expiring' : 'ok'
  return { batch, days, status }
}

export interface Metrics {
  stock: number
  cover: number | null
  stockStatus: StockStatus
  expiryStatus: ExpiryStatus
  nextExpiry: { date: string; days: number } | null
  atRiskBatches: BatchInfo[]
  activeBatches: Batch[]
}

export function computeMetrics(product: Product, batches: Batch[], settings: Settings): Metrics {
  const active = batches.filter((b) => b.productId === product.id && b.quantity > 0)
  const stock = active.reduce((s, b) => s + b.quantity, 0)
  const cover = product.dailyUsage > 0 ? stock / product.dailyUsage : null

  let stockStatus: StockStatus = 'healthy'
  if (stock <= 0 || (cover !== null && cover <= settings.stockoutHorizonDays)) stockStatus = 'stockout'
  else if (stock <= product.reorderPoint) stockStatus = 'low'

  const infos = active.map((b) => batchExpiry(b, settings)).filter((i) => i.days !== null)
  infos.sort((a, b) => (a.days as number) - (b.days as number))
  const first = infos[0]
  const atRisk = infos.filter((i) => i.status === 'expiring' || i.status === 'expired')
  let expiryStatus: ExpiryStatus = 'none'
  if (infos.length) expiryStatus = atRisk.some((i) => i.status === 'expired') ? 'expired' : atRisk.length ? 'expiring' : 'ok'

  return {
    stock,
    cover,
    stockStatus,
    expiryStatus,
    nextExpiry: first ? { date: first.batch.expiryDate as string, days: first.days as number } : null,
    atRiskBatches: atRisk,
    activeBatches: active,
  }
}

export function suggestedReorderQty(product: Product, stock: number, settings: Settings): number {
  const target = product.dailyUsage * settings.targetCoverDays
  const needed = Math.max(target, product.reorderPoint) - stock
  if (needed <= 0) return 0
  return Math.ceil(needed / 10) * 10
}

export function batchRecommendation(info: BatchInfo, settings: Settings): string {
  if (info.status === 'expired') return 'Quarantine and review for disposal'
  if (info.status === 'expiring') return 'Dispatch first (FEFO)'
  if (info.days !== null && info.days <= settings.expiryWindowDays * 3) return 'Next in FEFO queue'
  return 'No action needed'
}
