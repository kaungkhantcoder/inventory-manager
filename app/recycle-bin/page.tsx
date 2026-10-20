import type { Metadata } from 'next'
import { RecycleBinView } from '@/components/recycle-bin/recycle-bin-view'

export const metadata: Metadata = { title: 'Recycle Bin' }

export default function RecycleBinPage() {
  return <RecycleBinView />
}
