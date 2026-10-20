import type { Metadata } from 'next'
import { InsightsView } from '@/components/insights/insights-view'

export const metadata: Metadata = { title: 'AI Insights' }

export default function InsightsPage() {
  return <InsightsView />
}
