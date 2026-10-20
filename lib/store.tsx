'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { computeMetrics, todayISO, type Metrics } from './calc'
import {
  commitBulkOp,
  createProductOp,
  issueOp,
  receiveOp,
  type BulkCommitRow,
  type IssueInput,
  type OpResult,
  type ProductInput,
  type ReceiveInput,
} from './ops'
import { buildSeed } from './seed'
import { DEFAULT_SETTINGS, type Data, type Persisted, type Product, type ReorderStatus, type Settings, type TrashItem } from './types'

const STORAGE_KEY = 'stocksense-ai:v1'
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export interface Row {
  product: Product
  m: Metrics
}

interface StoreApi {
  ready: boolean
  data: Data
  trash: TrashItem[]
  settings: Settings
  rows: Row[]
  getRow: (productId: string) => Row | undefined
  addProduct: (input: ProductInput) => Product
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => { ok: boolean; error?: string }
  updateProducts: (ids: string[], patch: Partial<Pick<Product, 'category' | 'unit' | 'reorderPoint' | 'dailyUsage'>>) => void
  deleteProducts: (ids: string[]) => void
  restoreTrash: (id: string) => { ok: boolean; error?: string }
  permanentlyDeleteTrash: (id: string) => void
  emptyTrash: () => void
  receiveStock: (input: ReceiveInput) => OpResult
  issueStock: (input: IssueInput) => OpResult
  commitBulk: (rows: BulkCommitRow[]) => { created: number; received: number }
  createReorder: (productId: string, quantity: number, basis: string) => void
  setReorderStatus: (id: string, status: ReorderStatus) => void
  setDispatchPriority: (batchId: string, value: boolean) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
}

const EMPTY: Data = { products: [], batches: [], movements: [], reorders: [] }
const Ctx = createContext<StoreApi | null>(null)

function pruneTrash(items: TrashItem[], now = Date.now()): TrashItem[] {
  return items.filter((item) => now - new Date(item.deletedAt).getTime() < TRASH_RETENTION_MS)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted | null>(null)
  const ref = useRef<Persisted | null>(null)

  const commit = useCallback((next: Persisted) => {
    ref.current = next
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage may be unavailable (private mode); the in-memory state still works.
    }
  }, [])

  useEffect(() => {
    let loaded: Persisted | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) loaded = JSON.parse(raw) as Persisted
    } catch {
      loaded = null
    }
    // Untouched demo data is re-seeded each day so relative dates (expiry, usage) stay meaningful.
    if (!loaded || (!loaded.dirty && loaded.seededOn !== todayISO())) loaded = buildSeed()
    loaded = { ...loaded, trash: pruneTrash(loaded.trash ?? []), settings: { ...DEFAULT_SETTINGS, ...loaded.settings } }
    commit(loaded)
  }, [commit])

  const mutate = useCallback(
    (fn: (s: Persisted) => Persisted) => {
      if (!ref.current) return
      commit({ ...fn(ref.current), dirty: true })
    },
    [commit],
  )

  const data = state?.data ?? EMPTY
  const settings = state?.settings ?? DEFAULT_SETTINGS

  const rows = useMemo<Row[]>(
    () => data.products.map((product) => ({ product, m: computeMetrics(product, data.batches, settings) })),
    [data.products, data.batches, settings],
  )

  const api = useMemo<StoreApi>(() => {
    const cur = () => ref.current as Persisted
    return {
      ready: state !== null,
      data,
      trash: pruneTrash(state?.trash ?? []),
      settings,
      rows,
      getRow: (id) => rows.find((r) => r.product.id === id),
      addProduct: (input) => {
        const res = createProductOp(cur().data, input)
        mutate((s) => ({ ...s, data: res.data }))
        return res.product
      },
      updateProduct: (id, patch) => {
        const s = cur()
        if (patch.sku !== undefined) {
          const sku = patch.sku.trim().toUpperCase()
          if (s.data.products.some((p) => p.id !== id && p.sku === sku)) return { ok: false, error: 'SKU is already used by another product.' }
          patch = { ...patch, sku }
        }
        mutate((st) => ({
          ...st,
          data: {
            ...st.data,
            products: st.data.products.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
          },
        }))
        return { ok: true }
      },
      updateProducts: (ids, patch) => {
        const set = new Set(ids)
        const now = new Date().toISOString()
        mutate((st) => ({
          ...st,
          data: { ...st.data, products: st.data.products.map((p) => (set.has(p.id) ? { ...p, ...patch, updatedAt: now } : p)) },
        }))
      },
      deleteProducts: (ids) => {
        const set = new Set(ids)
        const now = new Date().toISOString()
        mutate((st) => ({
          ...st,
          data: {
            ...st.data,
            products: st.data.products.filter((p) => !set.has(p.id)),
            batches: st.data.batches.filter((b) => !set.has(b.productId)),
          },
          trash: [
            ...st.data.products
              .filter((p) => set.has(p.id))
              .map((product) => ({
                id: `trash-${product.id}-${Date.now().toString(36)}`,
                product,
                batches: st.data.batches.filter((b) => b.productId === product.id),
                deletedAt: now,
              })),
            ...pruneTrash(st.trash ?? []),
          ],
        }))
      },
      restoreTrash: (id) => {
        const s = cur()
        const item = pruneTrash(s.trash ?? []).find((entry) => entry.id === id)
        if (!item) return { ok: false, error: 'This item is no longer in the recycle bin.' }
        if (s.data.products.some((p) => p.id === item.product.id)) return { ok: false, error: 'A product with this record already exists.' }
        if (s.data.products.some((p) => p.sku === item.product.sku)) return { ok: false, error: `SKU ${item.product.sku} is already used by another product.` }
        mutate((st) => ({
          ...st,
          data: {
            ...st.data,
            products: [...st.data.products, item.product],
            batches: [...st.data.batches, ...item.batches],
          },
          trash: pruneTrash(st.trash ?? []).filter((entry) => entry.id !== id),
        }))
        return { ok: true }
      },
      permanentlyDeleteTrash: (id) => mutate((st) => ({ ...st, trash: pruneTrash(st.trash ?? []).filter((entry) => entry.id !== id) })),
      emptyTrash: () => mutate((st) => ({ ...st, trash: [] })),
      receiveStock: (input) => {
        const res = receiveOp(cur().data, input)
        if (res.ok) mutate((s) => ({ ...s, data: res.data }))
        return res
      },
      issueStock: (input) => {
        const res = issueOp(cur().data, input)
        if (res.ok) mutate((s) => ({ ...s, data: res.data }))
        return res
      },
      commitBulk: (bulkRows) => {
        const res = commitBulkOp(cur().data, bulkRows)
        mutate((s) => ({ ...s, data: res.data }))
        return { created: res.created, received: res.received }
      },
      createReorder: (productId, quantity, basis) => {
        const product = cur().data.products.find((p) => p.id === productId)
        if (!product) return
        mutate((s) => ({
          ...s,
          data: {
            ...s.data,
            reorders: [
              {
                id: `r-${Date.now().toString(36)}`,
                productId,
                productName: product.name,
                sku: product.sku,
                unit: product.unit,
                quantity,
                status: 'Requested',
                basis,
                createdAt: new Date().toISOString(),
              },
              ...s.data.reorders,
            ],
          },
        }))
      },
      setReorderStatus: (id, status) =>
        mutate((s) => ({ ...s, data: { ...s.data, reorders: s.data.reorders.map((r) => (r.id === id ? { ...r, status } : r)) } })),
      setDispatchPriority: (batchId, value) =>
        mutate((s) => ({
          ...s,
          data: { ...s.data, batches: s.data.batches.map((b) => (b.id === batchId ? { ...b, dispatchPriority: value } : b)) },
        })),
      updateSettings: (patch) => mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      resetDemo: () => commit(buildSeed()),
    }
  }, [state, data, settings, rows, mutate, commit])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
