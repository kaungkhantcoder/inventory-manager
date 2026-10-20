'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BulkSeed {
  productId?: string | null
  name?: string
  sku?: string
  category?: string
  unit?: string
  qty?: string
  reorder?: string
  supplier?: string
  batch?: string
  expiry?: string
}

type ToastTone = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface UIState {
  productId: string | null
  movement: { type: 'in' | 'out'; productId?: string; key: number } | null
  bulk: { rows?: BulkSeed[]; key: number } | null
  reorder: { productId: string; basis?: string; qty?: number } | null
  batchReview: string | null
}

interface UIApi extends UIState {
  openProduct: (id: string) => void
  closeProduct: () => void
  openMovement: (type: 'in' | 'out', productId?: string) => void
  closeMovement: () => void
  openBulk: (rows?: BulkSeed[]) => void
  closeBulk: () => void
  openReorder: (productId: string, opts?: { basis?: string; qty?: number }) => void
  closeReorder: () => void
  openBatchReview: (batchId: string) => void
  closeBatchReview: () => void
  toast: (message: string, tone?: ToastTone) => void
}

const Ctx = createContext<UIApi | null>(null)
let keySeed = 0

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UIState>({ productId: null, movement: null, bulk: null, reorder: null, batchReview: null })
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++keySeed
    setToasts((t) => [...t.slice(-3), { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  const api = useMemo<UIApi>(
    () => ({
      ...state,
      openProduct: (id) => setState((s) => ({ ...s, productId: id })),
      closeProduct: () => setState((s) => ({ ...s, productId: null })),
      openMovement: (type, productId) => setState((s) => ({ ...s, movement: { type, productId, key: ++keySeed } })),
      closeMovement: () => setState((s) => ({ ...s, movement: null })),
      openBulk: (rows) => setState((s) => ({ ...s, bulk: { rows, key: ++keySeed } })),
      closeBulk: () => setState((s) => ({ ...s, bulk: null })),
      openReorder: (productId, opts) => setState((s) => ({ ...s, reorder: { productId, ...opts } })),
      closeReorder: () => setState((s) => ({ ...s, reorder: null })),
      openBatchReview: (id) => setState((s) => ({ ...s, batchReview: id })),
      closeBatchReview: () => setState((s) => ({ ...s, batchReview: null })),
      toast,
    }),
    [state, toast],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-full max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? TriangleAlert : Info
          return (
            <div
              key={t.id}
              className="animate-in slide-in-from-bottom-2 fade-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-sm shadow-md"
            >
              <Icon
                className={cn('mt-0.5 size-4 shrink-0', t.tone === 'success' && 'text-success', t.tone === 'error' && 'text-danger', t.tone === 'info' && 'text-primary')}
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 text-foreground text-pretty">{t.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useUI(): UIApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
