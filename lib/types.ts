export const CATEGORIES = ['Dairy', 'Meat & Poultry', 'Beverages', 'Bakery', 'Frozen', 'Pantry'] as const
export const UNITS = ['units', 'kg', 'L', 'packs', 'cartons', 'bottles', 'cases', 'cans', 'trays'] as const

export type StockStatus = 'healthy' | 'low' | 'stockout'
export type ExpiryStatus = 'ok' | 'expiring' | 'expired' | 'none'

/** A product record: who it is and how it is managed. Stock lives in batches. */
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  unit: string
  reorderPoint: number
  dailyUsage: number
  unitCost: number
  supplier: string
  tracksExpiry: boolean
  createdAt: string
  updatedAt: string
}

/** A received lot of a product. Current stock is the sum of batch quantities. */
export interface Batch {
  id: string
  productId: string
  batchNumber: string
  quantity: number
  receivedQty: number
  expiryDate: string | null
  receivedAt: string
  supplier: string
  dispatchPriority: boolean
}

/** Immutable history entry. Product name/SKU are snapshots so later edits never rewrite history. */
export interface Movement {
  id: string
  type: 'in' | 'out'
  productId: string
  productName: string
  sku: string
  unit: string
  quantity: number
  previousStock: number
  newStock: number
  batchSummary: string
  reason: string
  note: string
  createdAt: string
}

export type ReorderStatus = 'Requested' | 'Ordered' | 'Cancelled'

export interface ReorderRequest {
  id: string
  productId: string
  productName: string
  sku: string
  unit: string
  quantity: number
  status: ReorderStatus
  basis: string
  createdAt: string
}

export interface Settings {
  expiryWindowDays: number
  stockoutHorizonDays: number
  targetCoverDays: number
}

export interface Data {
  products: Product[]
  batches: Batch[]
  movements: Movement[]
  reorders: ReorderRequest[]
}

export interface TrashItem {
  id: string
  product: Product
  batches: Batch[]
  deletedAt: string
}

export interface Persisted {
  data: Data
  trash: TrashItem[]
  settings: Settings
  seededOn: string
  dirty: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  expiryWindowDays: 7,
  stockoutHorizonDays: 3,
  targetCoverDays: 14,
}
