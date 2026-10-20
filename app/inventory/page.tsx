import { Suspense } from 'react'
import type { Metadata } from 'next'
import { InventoryView } from '@/components/inventory/inventory-view'
import { PageSkeleton } from '@/components/page-kit'

export const metadata: Metadata = { title: 'Inventory' }

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InventoryView />
    </Suspense>
  )
}
