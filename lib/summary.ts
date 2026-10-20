import type { Row } from './store'
import { fmtInt } from './calc'
import type { KpiItem } from '@/components/page-kit'

export interface Summary {
  products: number
  units: number
  low: number
  expiring: number
  stockout: number
}

export function summarize(rows: Row[]): Summary {
  return {
    products: rows.length,
    units: rows.reduce((s, r) => s + r.m.stock, 0),
    low: rows.filter((r) => r.m.stockStatus === 'low').length,
    expiring: rows.filter((r) => r.m.expiryStatus === 'expiring' || r.m.expiryStatus === 'expired').length,
    stockout: rows.filter((r) => r.m.stockStatus === 'stockout').length,
  }
}

export function summaryItems(s: Summary, link: (key: 'all' | 'low' | 'expiring' | 'stockout') => Partial<Pick<KpiItem, 'href' | 'onClick'>>): KpiItem[] {
  return [
    { label: 'Total products', value: fmtInt(s.products), hint: 'Active product records', ...link('all') },
    { label: 'Total stock units', value: fmtInt(s.units), hint: 'Across all units of measure' },
    { label: 'Low-stock items', value: fmtInt(s.low), hint: 'At or below reorder point', tone: s.low ? 'warning' : 'default', ...link('low') },
    { label: 'Expiring items', value: fmtInt(s.expiring), hint: 'Batches inside the expiry window', tone: s.expiring ? 'expiry' : 'default', ...link('expiring') },
    { label: 'Stockout risks', value: fmtInt(s.stockout), hint: 'Short days of cover', tone: s.stockout ? 'danger' : 'default', ...link('stockout') },
  ]
}
