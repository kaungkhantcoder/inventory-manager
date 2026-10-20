'use client'

import { useUI } from '@/lib/ui'
import { BatchReviewModal } from '@/components/batch-review-modal'
import { BulkEntry } from '@/components/bulk/bulk-entry'
import { MovementModal } from '@/components/movement-modal'
import { ProductDrawer } from '@/components/product-drawer'
import { ReorderModal } from '@/components/reorder-modal'

export function Overlays() {
  const ui = useUI()
  return (
    <>
      {ui.productId ? <ProductDrawer key={ui.productId} productId={ui.productId} onClose={ui.closeProduct} /> : null}
      {ui.movement ? (
        <MovementModal key={ui.movement.key} initialType={ui.movement.type} initialProductId={ui.movement.productId} onClose={ui.closeMovement} />
      ) : null}
      {ui.bulk ? <BulkEntry key={ui.bulk.key} seedRows={ui.bulk.rows} onClose={ui.closeBulk} /> : null}
      {ui.reorder ? (
        <ReorderModal key={ui.reorder.productId} productId={ui.reorder.productId} basis={ui.reorder.basis} qty={ui.reorder.qty} onClose={ui.closeReorder} />
      ) : null}
      {ui.batchReview ? <BatchReviewModal key={ui.batchReview} batchId={ui.batchReview} onClose={ui.closeBatchReview} /> : null}
    </>
  )
}
