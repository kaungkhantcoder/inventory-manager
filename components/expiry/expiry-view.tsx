'use client'

import { useMemo, useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, ExpiryBadge } from '@/components/ui/badges'
import { SearchInput, Select } from '@/components/ui/fields'
import { IconButton } from '@/components/ui/icon-button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, KpiStrip, PageHeader, PageSkeleton, Panel, Th } from '@/components/page-kit'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { buildBatchRows, type BatchRow } from '@/lib/insights'
import { batchExpiry, batchRecommendation, fmtDate, fmtInt, fmtMoney } from '@/lib/calc'
import { downloadCsv } from '@/lib/csv'
import { CATEGORIES } from '@/lib/types'

type StatusFilter = 'all' | 'expired' | 'expiring' | 'ok' | 'none'

export function ExpiryView() {
  const { ready, data, settings } = useStore()
  const { openBatchReview, openProduct, toast } = useUI()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'expiry', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const all = useMemo(() => buildBatchRows(data, settings), [data, settings])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const out = all.filter((r) => {
      if (term && !`${r.productName} ${r.sku} ${r.batch.batchNumber}`.toLowerCase().includes(term)) return false
      if (category !== 'all' && r.category !== category) return false
      if (status !== 'all' && r.status !== status) return false
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp = (a: BatchRow, b: BatchRow) => {
      switch (sort.key) {
        case 'product':
          return a.productName.localeCompare(b.productName)
        case 'batch':
          return a.batch.batchNumber.localeCompare(b.batch.batchNumber)
        case 'qty':
          return a.batch.quantity - b.batch.quantity
        case 'value':
          return a.batch.quantity * a.unitCost - b.batch.quantity * b.unitCost
        default:
          return (a.days ?? Infinity) - (b.days ?? Infinity)
      }
    }
    return out.sort((a, b) => cmp(a, b) * dir || a.productName.localeCompare(b.productName))
  }, [all, q, status, category, sort])

  if (!ready) return <PageSkeleton />

  const expired = all.filter((r) => r.status === 'expired')
  const expiring = all.filter((r) => r.status === 'expiring')
  const atRisk = [...expired, ...expiring]
  const valueAtRisk = atRisk.reduce((s, r) => s + r.batch.quantity * r.unitCost, 0)
  const priority = all.filter((r) => r.batch.dispatchPriority).length

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasFilters = q !== '' || status !== 'all' || category !== 'all'

  const onSort = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const exportCsv = () => {
    downloadCsv('stocksense-expiry.csv', [
      ['Product', 'SKU', 'Batch', 'Quantity remaining', 'Unit', 'Expiry date', 'Days until expiry', 'Stock value', 'Status'],
      ...filtered.map((r) => [r.productName, r.sku, r.batch.batchNumber, r.batch.quantity, r.unit, r.batch.expiryDate ?? '', r.days ?? '', (r.batch.quantity * r.unitCost).toFixed(2), r.status]),
    ])
    toast(`Exported ${fmtInt(filtered.length)} batches.`)
  }

  return (
    <>
      <PageHeader
        title="Expiry Management"
        description="Track batches by expiry date and dispatch the earliest first."
        actions={
          <Button variant="outline" size="lg" onClick={exportCsv} disabled={!filtered.length}>
            <Download aria-hidden="true" />
            Export
          </Button>
        }
      />

      <KpiStrip
        items={[
          { label: 'Active batches', value: fmtInt(all.length), hint: 'With stock remaining' },
          { label: 'Expiring soon', value: fmtInt(expiring.length), hint: `Within ${settings.expiryWindowDays} days`, tone: expiring.length ? 'expiry' : 'default' },
          { label: 'Expired batches', value: fmtInt(expired.length), hint: 'Still on hand', tone: expired.length ? 'expiry' : 'default' },
          { label: 'Value at risk', value: fmtMoney(valueAtRisk), hint: 'Expired and expiring, at cost', tone: valueAtRisk ? 'expiry' : 'default' },
          { label: 'Priority dispatch', value: fmtInt(priority), hint: 'Batches you flagged' },
        ]}
      />

      <p className="mb-3 text-sm text-muted-foreground text-pretty">
        FEFO (first expired, first out): ship the earliest-expiring batch first. Recommendations are suggestions only and never change quantities.
      </p>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="w-full sm:w-64">
            <SearchInput aria-label="Search batches" placeholder="Search product, SKU or batch" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
          <div className="w-40">
            <Select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select aria-label="Filter by expiry status" value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1) }}>
              <option value="all">All statuses</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring soon</option>
              <option value="ok">Not expiring soon</option>
              <option value="none">No expiry date</option>
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="ghost" onClick={() => { setQ(''); setStatus('all'); setCategory('all'); setPage(1) }}>
              Clear
            </Button>
          ) : null}
        </div>

        {all.length === 0 ? (
          <EmptyState title="No batches in stock" description="Batches appear here once stock is received." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No batches match these filters" description="Try a different status or clear the filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr>
                    <Th sortKey="product" sort={sort} onSort={onSort} className="min-w-[180px]">Product</Th>
                    <Th sortKey="batch" sort={sort} onSort={onSort}>Batch number</Th>
                    <Th align="right" sortKey="qty" sort={sort} onSort={onSort}>Qty remaining</Th>
                    <Th sortKey="expiry" sort={sort} onSort={onSort}>Expiry date</Th>
                    <Th align="right" sortKey="expiry" sort={sort} onSort={onSort}>Days left</Th>
                    <Th align="right" sortKey="value" sort={sort} onSort={onSort}>Stock value</Th>
                    <Th className="min-w-[220px]">Recommended action</Th>
                    <Th>Status</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const info = batchExpiry(r.batch, settings)
                    return (
                      <tr key={r.batch.id} className="h-14 border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="px-3">
                          <button type="button" onClick={() => openProduct(r.batch.productId)} className="rounded text-left font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                            {r.productName}
                          </button>
                          <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
                        </td>
                        <td className="px-3 font-mono text-xs">
                          {r.batch.batchNumber}
                          {r.batch.dispatchPriority ? (
                            <span className="ml-2 align-middle">
                              <Badge tone="primary" dot={false}>Priority</Badge>
                            </span>
                          ) : null}
                        </td>
                        <td className="tabular px-3 text-right font-mono">
                          {fmtInt(r.batch.quantity)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                        </td>
                        <td className="tabular px-3 whitespace-nowrap text-muted-foreground">{r.batch.expiryDate ? fmtDate(r.batch.expiryDate) : '—'}</td>
                        <td className="tabular px-3 text-right font-mono">{r.days === null ? '—' : r.days}</td>
                        <td className="tabular px-3 text-right font-mono text-muted-foreground">{fmtMoney(r.batch.quantity * r.unitCost)}</td>
                        <td className="px-3 text-xs text-muted-foreground text-pretty">{batchRecommendation(info, settings)}</td>
                        <td className="px-3">
                          <ExpiryBadge status={r.status} days={r.days} />
                        </td>
                        <td className="px-3">
                          <div className="flex justify-end">
                            <IconButton label={`Review batch ${r.batch.batchNumber} of ${r.productName}`} onClick={() => openBatchReview(r.batch.id)}>
                              <Eye />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1) }} />
          </>
        )}
      </Panel>
    </>
  )
}
