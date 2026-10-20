import type { Metadata } from 'next'
import { MovementsView } from '@/components/movements/movements-view'

export const metadata: Metadata = { title: 'Stock Movements' }

export default function MovementsPage() {
  return <MovementsView />
}
