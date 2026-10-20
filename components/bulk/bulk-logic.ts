import { todayISO } from '@/lib/calc'
import { normalizeSku } from '@/lib/ops'
import { parseCsv } from '@/lib/csv'
import type { BulkSeed } from '@/lib/ui'
import { CATEGORIES, UNITS, type Batch, type Product } from '@/lib/types'

export type Field = 'name' | 'sku' | 'category' | 'unit' | 'qty' | 'reorder' | 'supplier' | 'batch' | 'expiry'

export const COLS: Field[] = ['name', 'sku', 'category', 'unit', 'qty', 'reorder', 'supplier', 'batch', 'expiry']

export const FIELD_LABEL: Record<Field, string> = {
  name: 'Product name',
  sku: 'SKU',
  category: 'Category',
  unit: 'Unit',
  qty: 'Quantity',
  reorder: 'Reorder point',
  supplier: 'Supplier',
  batch: 'Batch number',
  expiry: 'Expiry date',
}

/** Columns that come from the saved product record when a row is linked to an existing product. */
export const LOCKED_WHEN_LINKED: Field[] = ['name', 'sku', 'category', 'unit', 'reorder']

export interface BRow {
  key: string
  productId: string | null
  name: string
  sku: string
  category: string
  unit: string
  qty: string
  reorder: string
  supplier: string
  batch: string
  expiry: string
  tracksExpiry: boolean
}

let seq = 0
export function makeRow(over: Partial<BRow> = {}): BRow {
  seq += 1
  return {
    key: `row-${seq}`,
    productId: null,
    name: '',
    sku: '',
    category: '',
    unit: '',
    qty: '',
    reorder: '',
    supplier: '',
    batch: '',
    expiry: '',
    tracksExpiry: true,
    ...over,
  }
}

export function linkRow(row: BRow, product: Product): BRow {
  return {
    ...row,
    productId: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    reorder: String(product.reorderPoint),
    supplier: row.supplier || product.supplier,
    tracksExpiry: product.tracksExpiry,
  }
}

export function unlinkRow(row: BRow): BRow {
  return { ...row, productId: null }
}

export function normalizeCell(field: Field, raw: string): string {
  const v = raw.trim()
  switch (field) {
    case 'category':
      return CATEGORIES.find((c) => c.toLowerCase() === v.toLowerCase()) ?? v
    case 'unit':
      return UNITS.find((u) => u.toLowerCase() === v.toLowerCase()) ?? v
    case 'qty':
    case 'reorder':
      return v.replace(/,/g, '')
    case 'sku':
      return v ? normalizeSku(v) : ''
    case 'expiry': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
      const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
      if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
      return v
    }
    default:
      return v
  }
}

export function rowFromSeed(seed: BulkSeed, products: Product[]): BRow {
  let row = makeRow({
    name: seed.name ?? '',
    sku: normalizeCell('sku', seed.sku ?? ''),
    category: normalizeCell('category', seed.category ?? ''),
    unit: normalizeCell('unit', seed.unit ?? ''),
    qty: normalizeCell('qty', seed.qty ?? ''),
    reorder: normalizeCell('reorder', seed.reorder ?? ''),
    supplier: seed.supplier ?? '',
    batch: seed.batch ?? '',
    expiry: normalizeCell('expiry', seed.expiry ?? ''),
  })
  const product = seed.productId ? products.find((p) => p.id === seed.productId) : matchProduct(row, products)
  if (product) row = linkRow(row, product)
  return row
}

/** Exact name or SKU match against the existing catalogue. */
export function matchProduct(row: BRow, products: Product[]): Product | undefined {
  const name = row.name.trim().toLowerCase()
  const sku = row.sku ? normalizeSku(row.sku) : ''
  return products.find((p) => (name && p.name.toLowerCase() === name) || (sku && p.sku === sku))
}

export interface RowCheck {
  empty: boolean
  kind: 'new' | 'batch'
  errors: Partial<Record<Field, string>>
}

export function validateRows(rows: BRow[], products: Product[], batches: Batch[]): Map<string, RowCheck> {
  const result = new Map<string, RowCheck>()
  const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]))
  const bySku = new Map(products.map((p) => [p.sku, p]))
  const seenNames = new Map<string, number>()
  const seenSkus = new Map<string, number>()
  const today = todayISO()

  rows.forEach((r, i) => {
    const linked = !!r.productId
    // Category, unit and supplier are inherited from the row above, so they do not make a row "filled".
    const blank = [r.name, r.sku, r.qty, r.batch, r.expiry, r.reorder].every((v) => !v.trim())
    if (blank && !linked) {
      result.set(r.key, { empty: true, kind: 'new', errors: {} })
      return
    }

    const errors: Partial<Record<Field, string>> = {}
    const qtyText = r.qty.trim()
    const qty = qtyText === '' ? NaN : Number(qtyText)

    if (!linked) {
      const name = r.name.trim().toLowerCase()
      if (!name) errors.name = 'Name is required.'
      else if (byName.has(name)) errors.name = 'Already exists. Pick it from the list to receive a batch.'
      else if (seenNames.has(name)) errors.name = `Same name as row ${(seenNames.get(name) as number) + 1}.`
      if (name) seenNames.set(name, seenNames.get(name) ?? i)

      const sku = r.sku ? normalizeSku(r.sku) : ''
      if (!sku) errors.sku = 'SKU is required.'
      else if (bySku.has(sku)) errors.sku = `Used by ${(bySku.get(sku) as Product).name}.`
      else if (seenSkus.has(sku)) errors.sku = `Repeated in row ${(seenSkus.get(sku) as number) + 1}.`
      if (sku) seenSkus.set(sku, seenSkus.get(sku) ?? i)

      if (!(CATEGORIES as readonly string[]).includes(r.category)) errors.category = 'Choose a category.'
      if (!(UNITS as readonly string[]).includes(r.unit)) errors.unit = 'Choose a unit.'
      const reorder = r.reorder.trim() === '' ? NaN : Number(r.reorder)
      if (!Number.isFinite(reorder) || reorder < 0) errors.reorder = 'Enter a reorder point.'
      if (qtyText !== '' && (!Number.isFinite(qty) || qty < 0)) errors.qty = 'Enter a valid quantity.'
    } else if (!Number.isFinite(qty) || qty <= 0) {
      errors.qty = 'Enter the quantity received.'
    }

    const received = Number.isFinite(qty) && qty > 0
    if (r.expiry && !/^\d{4}-\d{2}-\d{2}$/.test(r.expiry)) errors.expiry = 'Use YYYY-MM-DD.'
    else if (r.expiry && r.expiry < today) errors.expiry = 'Date is in the past.'
    else if (received && r.tracksExpiry && !r.expiry) errors.expiry = 'Expiry date is required.'

    if (linked && r.batch.trim()) {
      const exists = batches.some((b) => b.productId === r.productId && b.batchNumber.toLowerCase() === r.batch.trim().toLowerCase())
      if (exists) errors.batch = 'Batch number already exists.'
    }

    result.set(r.key, { empty: false, kind: linked ? 'batch' : 'new', errors })
  })
  return result
}

export function parseBulkCsv(text: string): BulkSeed[] {
  const grid = parseCsv(text)
  if (!grid.length) return []
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const looksLikeHeader = header.some((h) => /product|name|sku|category|quantity|qty/.test(h))
  const rows = looksLikeHeader ? grid.slice(1) : grid

  const matchers: Record<Field, RegExp> = {
    name: /product|name/,
    sku: /sku|code/,
    category: /categor/,
    unit: /unit|uom/,
    qty: /quantity|qty|stock/,
    reorder: /reorder|min/,
    supplier: /supplier|vendor/,
    batch: /batch|lot/,
    expiry: /expir|best/,
  }
  const index: Record<Field, number> = {} as Record<Field, number>
  COLS.forEach((field, pos) => {
    index[field] = looksLikeHeader ? header.findIndex((h) => matchers[field].test(h)) : pos
  })
  const cell = (r: string[], f: Field) => (index[f] >= 0 ? (r[index[f]] ?? '').trim() : '')

  return rows.map((r) => ({
    name: cell(r, 'name'),
    sku: cell(r, 'sku'),
    category: cell(r, 'category'),
    unit: cell(r, 'unit'),
    qty: cell(r, 'qty'),
    reorder: cell(r, 'reorder'),
    supplier: cell(r, 'supplier'),
    batch: cell(r, 'batch'),
    expiry: cell(r, 'expiry'),
  }))
}
