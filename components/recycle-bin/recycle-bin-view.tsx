'use client'

import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/overlay'
import { EmptyState, PageHeader, PageSkeleton, Panel, PanelHeader } from '@/components/page-kit'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { fmtDateTime, fmtInt } from '@/lib/calc'
import type { TrashItem } from '@/lib/types'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

type Confirmation =
  | { type: 'item'; item: TrashItem }
  | { type: 'restore'; item: TrashItem }
  | { type: 'empty'; count: number }

export function RecycleBinView() {
  const { ready, trash, restoreTrash, permanentlyDeleteTrash, emptyTrash } = useStore()
  const { toast } = useUI()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  if (!ready) return <PageSkeleton />

  const confirmAction = () => {
    if (!confirmation) return
    if (confirmation.type === 'empty') {
      emptyTrash()
      toast('Recycle Bin emptied.')
    } else if (confirmation.type === 'restore') {
      const result = restoreTrash(confirmation.item.id)
      if (!result.ok) {
        toast(result.error ?? 'Could not restore this product.', 'error')
        setConfirmation(null)
        return
      }
      toast(`${confirmation.item.product.name} restored to inventory.`)
    } else {
      permanentlyDeleteTrash(confirmation.item.id)
      toast(`${confirmation.item.product.name} permanently deleted.`, 'info')
    }
    setConfirmation(null)
  }

  return (
    <>
      <PageHeader
        title="Recycle Bin"
        description="Deleted products are kept here for 7 days so you can recover mistakes."
        actions={trash.length ? <Button variant="destructive" size="lg" onClick={() => setConfirmation({ type: 'empty', count: trash.length })}><Trash2 aria-hidden="true" /> Empty Recycle Bin</Button> : null}
      />

      <Panel>
        <PanelHeader title={`${fmtInt(trash.length)} deleted ${trash.length === 1 ? 'product' : 'products'}`} description="Items are automatically removed after 7 days." />
        {trash.length === 0 ? (
          <EmptyState title="Your Recycle Bin is empty" description="Deleted products will appear here and can be restored within 7 days." />
        ) : (
          <ul className="divide-y divide-border">
            {trash.map((item) => {
              const remaining = Math.max(1, Math.ceil((new Date(item.deletedAt).getTime() + RETENTION_MS - Date.now()) / (24 * 60 * 60 * 1000)))
              return (
                <li key={item.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-text" aria-hidden="true">
                    <Trash2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.product.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{item.product.sku}</span> · {item.product.category} · {fmtInt(item.batches.length)} {item.batches.length === 1 ? 'batch' : 'batches'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Deleted {fmtDateTime(item.deletedAt)} · {remaining} {remaining === 1 ? 'day' : 'days'} remaining</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                    <Button variant="outline" size="sm" onClick={() => setConfirmation({ type: 'restore', item })}><RotateCcw aria-hidden="true" /> Restore</Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirmation({ type: 'item', item })}><Trash2 aria-hidden="true" /> Delete forever</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {confirmation ? (
        <Modal
          open
          onClose={() => setConfirmation(null)}
          title={confirmation.type === 'empty' ? 'Empty Recycle Bin?' : confirmation.type === 'restore' ? `Restore ${confirmation.item.product.name}?` : `Delete ${confirmation.item.product.name} forever?`}
          description={
            confirmation.type === 'empty'
              ? `This permanently removes ${confirmation.count} ${confirmation.count === 1 ? 'product' : 'products'} and their batches. This cannot be undone.`
              : confirmation.type === 'restore'
                ? 'This will add the saved product and batches back to Inventory.'
                : 'This permanently removes the product and its batches. This cannot be undone.'
          }
          size="sm"
          footer={
            <>
              <Button variant="outline" size="lg" onClick={() => setConfirmation(null)}>Cancel</Button>
              {confirmation.type === 'restore' ? (
                <Button size="lg" onClick={confirmAction}><RotateCcw aria-hidden="true" /> Restore to Inventory</Button>
              ) : (
                <Button variant="destructive" size="lg" onClick={confirmAction}>Delete forever</Button>
              )}
            </>
          }
        >
          {confirmation.type === 'restore' ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
              <p className="font-medium">What will change</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>The product record will be added back to Inventory.</li>
                <li>{fmtInt(confirmation.item.batches.length)} saved {confirmation.item.batches.length === 1 ? 'batch' : 'batches'} will be restored.</li>
                <li>Existing movement history will remain unchanged.</li>
              </ul>
            </div>
          ) : (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
              Restoration will not be possible after this action.
            </p>
          )}
        </Modal>
      ) : null}
    </>
  )
}
