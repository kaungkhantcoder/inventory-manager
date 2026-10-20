'use client'

import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiStrip, PageHeader, PageSkeleton, Panel, PanelHeader, Th } from '@/components/page-kit'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { downloadCsv } from '@/lib/csv'
import { buildBatchRows } from '@/lib/insights'
import { fmtInt, fmtMoney, toISODate } from '@/lib/calc'

const DAY = 86_400_000

export function ReportsView() {
  const { ready, rows, data, settings } = useStore()
  const { toast } = useUI()

  const byCategory = useMemo(() => {
    const map = new Map<string, { products: number; units: number; value: number }>()
    for (const { product, m } of rows) {
      const c = map.get(product.category) ?? { products: 0, units: 0, value: 0 }
      c.products += 1
      c.units += m.stock
      c.value += m.stock * product.unitCost
      map.set(product.category, c)
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value)
  }, [rows])

  const daily = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, n) => {
      const d = new Date(Date.now() - (13 - n) * DAY)
      return { key: toISODate(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), inQty: 0, outQty: 0 }
    })
    const index = new Map(days.map((d) => [d.key, d]))
    for (const m of data.movements) {
      const d = index.get(toISODate(new Date(m.createdAt)))
      if (!d) continue
      if (m.type === 'in') d.inQty += m.quantity
      else d.outQty += m.quantity
    }
    return days
  }, [data.movements])

  if (!ready) return <PageSkeleton />

  const totalValue = byCategory.reduce((s, c) => s + c.value, 0)
  const maxValue = Math.max(1, ...byCategory.map((c) => c.value))
  const maxDaily = Math.max(1, ...daily.flatMap((d) => [d.inQty, d.outQty]))
  const since = Date.now() - 30 * DAY
  const month = data.movements.filter((m) => new Date(m.createdAt).getTime() >= since)
  const monthIn = month.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0)
  const monthOut = month.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0)

  const exportInventory = () => {
    downloadCsv('stocksense-inventory-report.csv', [
      ['Product', 'SKU', 'Category', 'Supplier', 'Stock', 'Unit', 'Unit cost', 'Stock value', 'Daily usage', 'Reorder point', 'Stock status'],
      ...rows.map(({ product, m }) => [product.name, product.sku, product.category, product.supplier, m.stock, product.unit, product.unitCost, (m.stock * product.unitCost).toFixed(2), product.dailyUsage, product.reorderPoint, m.stockStatus]),
    ])
    toast('Inventory report exported.')
  }
  const exportMovements = () => {
    downloadCsv('stocksense-movements-report.csv', [
      ['Date', 'Type', 'Product', 'SKU', 'Quantity', 'Unit', 'Previous stock', 'New stock', 'Batch', 'Reason'],
      ...data.movements.map((m) => [m.createdAt, m.type, m.productName, m.sku, m.quantity, m.unit, m.previousStock, m.newStock, m.batchSummary, m.reason]),
    ])
    toast('Movements report exported.')
  }
  const exportExpiry = () => {
    downloadCsv('stocksense-expiry-report.csv', [
      ['Product', 'SKU', 'Batch', 'Quantity', 'Unit', 'Expiry date', 'Days until expiry', 'Stock value', 'Status'],
      ...buildBatchRows(data, settings).map((r) => [r.productName, r.sku, r.batch.batchNumber, r.batch.quantity, r.unit, r.batch.expiryDate ?? '', r.days ?? '', (r.batch.quantity * r.unitCost).toFixed(2), r.status]),
    ])
    toast('Expiry report exported.')
  }

  return (
    <>
      <PageHeader title="Reports" description="Stock value, movement trends, and data exports." />

      <KpiStrip
        items={[
          { label: 'Stock value (at cost)', value: fmtMoney(totalValue), hint: `${fmtInt(rows.length)} products` },
          { label: 'Units received, 30 days', value: fmtInt(monthIn), hint: 'Stock in', tone: 'success' },
          { label: 'Units issued, 30 days', value: fmtInt(monthOut), hint: 'Stock out' },
          { label: 'Movements, 30 days', value: fmtInt(month.length), hint: 'Recorded entries' },
          { label: 'Reorder requests', value: fmtInt(data.reorders.length), hint: `${data.reorders.filter((r) => r.status === 'Requested').length} awaiting order` },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Stock value by category" description="Units on hand multiplied by unit cost." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th align="right">Products</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Value</Th>
                  <Th className="w-32"><span className="sr-only">Share of value</span></Th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.name} className="h-12 border-b border-border last:border-0">
                    <td className="px-3 font-medium">{c.name}</td>
                    <td className="tabular px-3 text-right font-mono text-muted-foreground">{c.products}</td>
                    <td className="tabular px-3 text-right font-mono text-muted-foreground">{fmtInt(c.units)}</td>
                    <td className="tabular px-3 text-right font-mono">{fmtMoney(c.value)}</td>
                    <td className="px-3">
                      <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(c.value / maxValue) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Daily movement, last 14 days"
            description="Units received and issued per day."
            actions={
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-success" aria-hidden="true" />In</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" aria-hidden="true" />Out</span>
              </div>
            }
          />
          <div className="p-4">
            <div className="flex h-44 items-end gap-1.5" role="img" aria-label={`Daily units in and out for the last 14 days. Peak ${fmtInt(maxDaily)} units.`}>
              {daily.map((d) => (
                <div key={d.key} className="flex h-full flex-1 items-end gap-0.5" title={`${d.label}: ${fmtInt(d.inQty)} in, ${fmtInt(d.outQty)} out`}>
                  <div className="w-1/2 rounded-t-sm bg-success" style={{ height: `${(d.inQty / maxDaily) * 100}%`, minHeight: d.inQty ? 2 : 0 }} />
                  <div className="w-1/2 rounded-t-sm bg-primary" style={{ height: `${(d.outQty / maxDaily) * 100}%`, minHeight: d.outQty ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{daily[0].label}</span>
              <span>{daily[daily.length - 1].label}</span>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Export data" description="Download the current data as CSV for spreadsheets or accounting." />
          <div className="flex flex-wrap gap-2 p-4">
            <Button variant="outline" size="lg" onClick={exportInventory} disabled={!rows.length}>
              <Download aria-hidden="true" />
              Inventory and valuation
            </Button>
            <Button variant="outline" size="lg" onClick={exportMovements} disabled={!data.movements.length}>
              <Download aria-hidden="true" />
              Stock movements
            </Button>
            <Button variant="outline" size="lg" onClick={exportExpiry}>
              <Download aria-hidden="true" />
              Batches and expiry
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
