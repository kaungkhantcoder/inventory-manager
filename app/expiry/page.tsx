import type { Metadata } from 'next'
import { ExpiryView } from '@/components/expiry/expiry-view'

export const metadata: Metadata = { title: 'Expiry Management' }

export default function ExpiryPage() {
  return <ExpiryView />
}
