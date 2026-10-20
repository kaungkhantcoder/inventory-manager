'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badges'
import { SearchInput, Select } from '@/components/ui/fields'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, KpiStrip, PageHeader, PageSkeleton, Panel, Th } from '@/components/page-kit'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { downloadCsv } from '@/lib/csv'
import { fmtDateTime, fmtInt } from '@/lib/calc'

const DAY = 86_400_000

export function MovementsView() {
  const { ready, data } = useStore()
  const { openMovement, openProduct, toast } = useUI()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'in' | 'out'>('all')
  const [range, setRange] = useState<'all' | '1' | '7' | '30'>('all')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const since = range === 'all' ? 0 : Date.now() - Number(range) * DAY
    const out = data.movements.filter((m) => {
      if (type !== 'all' && m.type !== type) return false
      if (since && new Date(m.createdAt).getTime() < since) return false
      if (term && !`${m.productName} ${m.sku} ${m.reason} ${m.batchSummary}`.toLowerCase().includes(term)) return false
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp = (a: (typeof out)[number], b: (typeof out)[number]) => {
      switch (sort.key) {
        case 'product':
          return a.productName.localeCompare(b.productName)
        case 'quantity':
          return a.quantity - b.quantity
        case 'type':
          return a.type.localeCompare(b.type)
        default:
          return a.createdAt.localeCompare(b.createdAt)
      }
    }
    return out.sort((a, b) => cmp(a, b) * dir)
  }, [data.movements, q, type, range, sort])

  const stats = useMemo(() => {
    const since = Date.now() - 7 * DAY
    const week = data.movements.filter((m) => new Date(m.createdAt).getTime() >= since)
    const inQty = week.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0)
    const outQty = week.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0)
    return { count: week.length, inQty, outQty }
  }, [data.movements])

  if (!ready) return <PageSkeleton />

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasFilters = q !== '' || type !== 'all' || range !== 'all'

  const onSort = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const exportCsv = () => {
    downloadCsv('stocksense-movements.csv', [
      ['Date', 'Type', 'Product', 'SKU', 'Quantity', 'Unit', 'Previous stock', 'New stock', 'Batch', 'Reason', 'Note'],
      ...filtered.map((m) => [m.createdAt, m.type === 'in' ? 'Stock in' : 'Stock out', m.productName, m.sku, m.quantity, m.unit, m.previousStock, m.newStock, m.batchSummary, m.reason, m.note]),
    ])
    toast(`Exported ${fmtInt(filtered.length)} movements.`)
  }

  return (
    <>
      <PageHeader
        title="Stock Movements"
        description="Record stock arriving and leaving, and review every change."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={!filtered.length}>
              <Download aria-hidden="true" />
              Export
            </Button>
            <Button variant="outline" size="lg" onClick={() => openMovement('out')}>
              <ArrowUpFromLine aria-hidden="true" />
              Stock Out
            </Button>
            <Button size="lg" onClick={() => openMovement('in')}>
              <ArrowDownToLine aria-hidden="true" />
              Stock In
            </Button>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Movements, last 7 days', value: fmtInt(stats.count), hint: 'Recorded entries' },
          { label: 'Units received, 7 days', value: fmtInt(stats.inQty), hint: 'Stock in', tone: 'success' },
          { label: 'Units issued, 7 days', value: fmtInt(stats.outQty), hint: 'Stock out' },
          { label: 'Net change, 7 days', value: `${stats.inQty - stats.outQty >= 0 ? '+' : '−'}${fmtInt(Math.abs(stats.inQty - stats.outQty))}`, hint: 'Received minus issued' },
          { label: 'All-time entries', value: fmtInt(data.movements.length), hint: 'History is never edited' },
        ]}
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="w-full sm:w-64">
            <SearchInput aria-label="Search movements" placeholder="Search product or reason" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
          <div className="w-36">
            <Select aria-label="Filter by movement type" value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1) }}>
              <option value="all">In and out</option>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
            </Select>
          </div>
          <div className="w-40">
            <Select aria-label="Filter by date" value={range} onChange={(e) => { setRange(e.target.value as typeof range); setPage(1) }}>
              <option value="all">All time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="ghost" onClick={() => { setQ(''); setType('all'); setRange('all'); setPage(1) }}>
              Clear
            </Button>
          ) : null}
        </div>

        {data.movements.length === 0 ? (
          <EmptyState
            title="No stock movements yet"
            description="Record the first stock in or out and it will be logged here with before and after quantities."
            action={
              <Button size="lg" onClick={() => openMovement('in')}>
                Record Stock In
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No movements match these filters" description="Try a wider date range or clear the filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    <Th sortKey="date" sort={sort} onSort={onSort}>Date and time</Th>
                    <Th sortKey="type" sort={sort} onSort={onSort}>Type</Th>
                    <Th sortKey="product" sort={sort} onSort={onSort} className="min-w-[180px]">Product</Th>
                    <Th align="right" sortKey="quantity" sort={sort} onSort={onSort}>Quantity</Th>
                    <Th align="right">Stock before</Th>
                    <Th align="right">Stock after</Th>
                    <Th>Batch</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m) => (
                    <tr key={m.id} className="h-12 border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="tabular px-3 text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                      <td className="px-3">
                        <Badge tone={m.type === 'in' ? 'success' : 'neutral'}>{m.type === 'in' ? 'Stock in' : 'Stock out'}</Badge>
                      </td>
                      <td className="px-3">
                        <button type="button" onClick={() => openProduct(m.productId)} className="rounded text-left font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                          {m.productName}
                        </button>
                        <p className="font-mono text-xs text-muted-foreground">{m.sku}</p>
                      </td>
                      <td className="tabular px-3 text-right font-mono font-medium">
                        {m.type === 'in' ? '+' : '−'}
                        {fmtInt(m.quantity)} <span className="text-xs font-normal text-muted-foreground">{m.unit}</span>
                      </td>
                      <td className="tabular px-3 text-right font-mono text-muted-foreground">{fmtInt(m.previousStock)}</td>
                      <td className="tabular px-3 text-right font-mono">{fmtInt(m.newStock)}</td>
                      <td className="max-w-[200px] truncate px-3 text-muted-foreground" title={m.batchSummary}>{m.batchSummary || '—'}</td>
                      <td className="max-w-[200px] truncate px-3 text-muted-foreground" title={m.note || m.reason}>{m.reason}</td>
                    </tr>
                  ))}
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
