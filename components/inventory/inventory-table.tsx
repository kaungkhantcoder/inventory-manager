'use client'

import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Copy } from 'lucide-react'
import { Checkbox } from '@/components/ui/fields'
import { IconButton } from '@/components/ui/icon-button'
import { ExpiryBadge, StockBadge } from '@/components/ui/badges'
import { Th } from '@/components/page-kit'
import type { Row } from '@/lib/store'
import { fmtDate, fmtDateTime, fmtInt } from '@/lib/calc'
import { CATEGORIES, UNITS, type Product } from '@/lib/types'
import { cn } from '@/lib/utils'

export type ColumnId = 'sku' | 'category' | 'stock' | 'unit' | 'usage' | 'reorder' | 'expiry' | 'status' | 'updated'

export const COLUMN_DEFS: { id: ColumnId; label: string; align?: 'right' }[] = [
  { id: 'sku', label: 'SKU' },
  { id: 'category', label: 'Category' },
  { id: 'stock', label: 'Current Stock', align: 'right' },
  { id: 'unit', label: 'Unit' },
  { id: 'usage', label: 'Daily Usage', align: 'right' },
  { id: 'reorder', label: 'Reorder Point', align: 'right' },
  { id: 'expiry', label: 'Next Expiry' },
  { id: 'status', label: 'Stock Status' },
  { id: 'updated', label: 'Updated At' },
]

const SORT_KEY: Record<string, string> = {
  sku: 'sku',
  category: 'category',
  stock: 'stock',
  usage: 'usage',
  reorder: 'reorder',
  expiry: 'expiry',
  status: 'status',
  updated: 'updated',
}

interface Props {
  rows: Row[]
  visible: Set<ColumnId>
  dense: boolean
  selected: Set<string>
  sort: { key: string; dir: 'asc' | 'desc' }
  onSort: (key: string) => void
  onToggle: (id: string) => void
  onTogglePage: (checked: boolean) => void
  onOpen: (id: string) => void
  onStock: (type: 'in' | 'out', id: string) => void
  onDuplicate: (row: Row) => void
  editMode: boolean
  onUpdate: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => boolean
}

type InlineField = 'name' | 'sku' | 'category' | 'unit' | 'dailyUsage' | 'reorderPoint'
type Draft = Partial<Record<InlineField, string>>

const INLINE_INPUT = 'h-8 w-full min-w-0 rounded-md border border-primary/40 bg-card px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
const NUMERIC_KEYS = new Set(['e', 'E', '+', '-'])

export function InventoryTable({ rows, visible, dense, selected, sort, onSort, onToggle, onTogglePage, onOpen, onStock, onDuplicate, editMode, onUpdate }: Props) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.product.id))
  const someSelected = rows.some((r) => selected.has(r.product.id))
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  useEffect(() => {
    if (!editMode) {
      setDrafts({})
      return
    }
    setDrafts((current) => {
      const next = { ...current }
      for (const { product } of rows) {
        next[product.id] = {
          name: product.name,
          sku: product.sku,
          category: product.category,
          unit: product.unit,
          dailyUsage: String(product.dailyUsage),
          reorderPoint: String(product.reorderPoint),
        }
      }
      return next
    })
  }, [editMode, rows])

  const valueFor = (id: string, field: InlineField, fallback: string) => drafts[id]?.[field] ?? fallback

  const setDraft = (id: string, field: InlineField, value: string) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
  }

  const restoreField = (id: string, field: InlineField, value: string) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
  }

  const saveField = (row: Row, field: InlineField, draftOverride?: string) => {
    const { product } = row
    const draft = draftOverride ?? valueFor(product.id, field, String(product[field]))
    const original = String(product[field])
    if (draft === original) return

    if (field === 'name' || field === 'sku') {
      const value = draft.trim()
      if (!value) {
        restoreField(product.id, field, original)
        return
      }
      const patch = field === 'name' ? { name: value } : { sku: value.toUpperCase() }
      if (!onUpdate(product.id, patch)) restoreField(product.id, field, original)
      return
    }

    if (field === 'category' || field === 'unit') {
      if (!onUpdate(product.id, { [field]: draft })) restoreField(product.id, field, original)
      return
    }

    const numeric = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
      restoreField(product.id, field, original)
      return
    }
    if (!onUpdate(product.id, { [field]: numeric })) restoreField(product.id, field, original)
  }

  const handleNumericKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NUMERIC_KEYS.has(event.key)) event.preventDefault()
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') event.currentTarget.blur()
  }

  const handleTextKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') event.currentTarget.blur()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr>
            <Th className="w-10 pr-0">
              <Checkbox indeterminate={someSelected && !allSelected} aria-label="Select all products on this page" checked={allSelected} onChange={(e) => onTogglePage(e.target.checked)} />
            </Th>
            <Th sortKey="name" sort={sort} onSort={onSort} className="min-w-[200px]">
              Product
            </Th>
            {COLUMN_DEFS.filter((c) => visible.has(c.id)).map((c) => (
              <Th key={c.id} align={c.align} sortKey={SORT_KEY[c.id]} sort={sort} onSort={onSort} className={c.id === 'unit' ? 'w-20' : undefined}>
                {c.label}
              </Th>
            ))}
            <Th align="right" className="w-[128px]">
              <span className="sr-only">Row actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, m }) => {
            const isSel = selected.has(product.id)
            return (
              <tr
                key={product.id}
                onClick={() => { if (!editMode) onOpen(product.id) }}
                data-selected={isSel || undefined}
                className={cn('group border-b border-border transition-colors last:border-0 hover:bg-muted/50 data-[selected]:bg-primary-soft/60', !editMode && 'cursor-pointer', dense ? 'h-12' : 'h-14')}
              >
                <td className="w-10 pr-0 pl-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${product.name}`} checked={isSel} onChange={() => onToggle(product.id)} />
                </td>
                <td className="px-3">
                  {editMode ? (
                    <InlineTextInput
                      aria-label={`Product name for ${product.name}`}
                      value={valueFor(product.id, 'name', product.name)}
                      onChange={(value) => setDraft(product.id, 'name', value)}
                      onBlur={() => saveField({ product, m }, 'name')}
                      onKeyDown={handleTextKeyDown}
                      className="min-w-[180px] font-medium"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(product.id)
                      }}
                      className="max-w-[240px] truncate rounded text-left font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {product.name}
                    </button>
                  )}
                </td>
                {visible.has('sku') ? (
                  <td className="px-3 font-mono text-xs text-muted-foreground">
                    {editMode ? (
                      <InlineTextInput
                        aria-label={`SKU for ${product.name}`}
                        value={valueFor(product.id, 'sku', product.sku)}
                        onChange={(value) => setDraft(product.id, 'sku', value.toUpperCase())}
                        onBlur={() => saveField({ product, m }, 'sku')}
                        onKeyDown={handleTextKeyDown}
                        className="min-w-[100px] font-mono text-xs uppercase"
                      />
                    ) : product.sku}
                  </td>
                ) : null}
                {visible.has('category') ? (
                  <td className="px-3 text-muted-foreground">
                    {editMode ? (
                      <InlineSelect
                        aria-label={`Category for ${product.name}`}
                        value={valueFor(product.id, 'category', product.category)}
                        options={[...CATEGORIES]}
                        onChange={(value) => {
                          setDraft(product.id, 'category', value)
                          saveField({ product, m }, 'category', value)
                        }}
                      />
                    ) : product.category}
                  </td>
                ) : null}
                {visible.has('stock') ? <td title="Current stock is changed through Stock In / Out" className="tabular bg-muted/30 px-3 text-right font-mono font-medium text-foreground">{fmtInt(m.stock)}</td> : null}
                {visible.has('unit') ? (
                  <td className="px-3 text-muted-foreground">
                    {editMode ? (
                      <InlineSelect
                        aria-label={`Unit for ${product.name}`}
                        value={valueFor(product.id, 'unit', product.unit)}
                        options={[...UNITS]}
                        onChange={(value) => {
                          setDraft(product.id, 'unit', value)
                          saveField({ product, m }, 'unit', value)
                        }}
                      />
                    ) : product.unit}
                  </td>
                ) : null}
                {visible.has('usage') ? (
                  <td className="tabular px-3 text-right font-mono text-muted-foreground">
                    {editMode ? (
                      <InlineNumberInput
                        aria-label={`Daily usage for ${product.name}`}
                        value={valueFor(product.id, 'dailyUsage', String(product.dailyUsage))}
                        onChange={(value) => setDraft(product.id, 'dailyUsage', value)}
                        onBlur={() => saveField({ product, m }, 'dailyUsage')}
                        onKeyDown={handleNumericKeyDown}
                      />
                    ) : fmtInt(product.dailyUsage)}
                  </td>
                ) : null}
                {visible.has('reorder') ? (
                  <td className="tabular px-3 text-right font-mono text-muted-foreground">
                    {editMode ? (
                      <InlineNumberInput
                        aria-label={`Reorder point for ${product.name}`}
                        value={valueFor(product.id, 'reorderPoint', String(product.reorderPoint))}
                        onChange={(value) => setDraft(product.id, 'reorderPoint', value)}
                        onBlur={() => saveField({ product, m }, 'reorderPoint')}
                        onKeyDown={handleNumericKeyDown}
                      />
                    ) : fmtInt(product.reorderPoint)}
                  </td>
                ) : null}
                {visible.has('expiry') ? (
                  <td className="px-3">
                    {m.nextExpiry ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="tabular text-xs text-muted-foreground">{fmtDate(m.nextExpiry.date)}</span>
                        <ExpiryBadge status={m.expiryStatus} days={m.nextExpiry.days} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{product.tracksExpiry ? 'No stock' : 'Not tracked'}</span>
                    )}
                  </td>
                ) : null}
                {visible.has('status') ? (
                  <td className="px-3">
                    <StockBadge status={m.stockStatus} />
                  </td>
                ) : null}
                {visible.has('updated') ? <td className="tabular px-3 text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(product.updatedAt)}</td> : null}
                <td className="px-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton label={`Stock in: ${product.name}`} onClick={() => onStock('in', product.id)}>
                      <ArrowDownToLine />
                    </IconButton>
                    <IconButton label={`Stock out: ${product.name}`} onClick={() => onStock('out', product.id)}>
                      <ArrowUpFromLine />
                    </IconButton>
                    <IconButton label={`Duplicate ${product.name} as a new product`} onClick={() => onDuplicate({ product, m })}>
                      <Copy />
                    </IconButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InlineTextInput({ value, onChange, onBlur, className, ...props }: { value: string; onChange: (value: string) => void; onBlur: () => void; className?: string; onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void; 'aria-label': string }) {
  return <input {...props} type="text" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className={cn(INLINE_INPUT, className)} />
}

function InlineNumberInput({ value, onChange, onBlur, onKeyDown, ...props }: { value: string; onChange: (value: string) => void; onBlur: () => void; onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void; 'aria-label': string }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      pattern="[0-9.]*"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(INLINE_INPUT, 'tabular text-right font-mono')}
    />
  )
}

function InlineSelect({ value, options, onChange, ...props }: { value: string; options: string[]; onChange: (value: string) => void; 'aria-label': string }) {
  return (
    <select {...props} value={value} onChange={(event) => onChange(event.target.value)} className={cn(INLINE_INPUT, 'cursor-pointer appearance-none')}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  )
}
