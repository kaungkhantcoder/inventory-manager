'use client'

import { useUI } from '@/lib/ui'
import type { Insight } from '@/lib/insights'

export function useInsightAction() {
  const { openReorder, openBatchReview, openProduct } = useUI()
  return (insight: Insight) => {
    if (insight.action.type === 'reorder') openReorder(insight.productId, { basis: insight.summary, qty: insight.suggestedQty })
    else if (insight.action.type === 'review-batch' && insight.batchId) openBatchReview(insight.batchId)
    else openProduct(insight.productId)
  }
}
