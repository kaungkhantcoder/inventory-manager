'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { CalendarCheck, CalendarOff, Copy, Download, Plus, TriangleAlert, Trash2, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/overlay'
import { IconButton } from '@/components/ui/icon-button'
import { useStore } from '@/lib/store'
import { useUI, type BulkSeed } from '@/lib/ui'
import { fmtInt, todayISO } from '@/lib/calc'
import { BULK_TEMPLATE_HEADERS, downloadCsv } from '@/lib/csv'
import { generateSku, normalizeSku, uniqueSkuVariant, type BulkCommitRow } from '@/lib/ops'
import { CATEGORIES, UNITS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NameCell } from './name-cell'
import {
  COLS,
  FIELD_LABEL,
  LOCKED_WHEN_LINKED,
  linkRow,
  makeRow,
  matchProduct,
  normalizeCell,
  parseBulkCsv,
  rowFromSeed,
  unlinkRow,
  validateRows,
  type BRow,
  type Field,
} from './bulk-logic'

const MIN_ROWS = 3

const cellClass = (invalid: boolean, extra?: string) =>
  cn(
    'h-10 w-full bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-primary-soft focus:ring-2 focus:ring-primary focus:ring-inset',
    invalid && 'bg-danger-soft/60 ring-1 ring-danger ring-inset',
    extra,
  )

interface Props {
  seedRows?: BulkSeed[]
  onClose: () => void
}

export function BulkEntry({ seedRows, onClose }: Props) {
  const { data, rows: storeRows, commitBulk } = useStore()
  const { toast } = useUI()
  const products = data.products

  const stockById = useMemo(() => new Map(storeRows.map((r) => [r.product.id, r.m.stock])), [storeRows])

  const [rows, setRows] = useState<BRow[]>(() => {
    const seeded = (seedRows ?? []).map((s) => rowFromSeed(s, products))
    const pad = Math.max(seeded.length ? 1 : MIN_ROWS, MIN_ROWS - seeded.length)
    return [...seeded, ...Array.from({ length: pad }, () => makeRow())]
  })
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayISO()

  const checks = useMemo(() => validateRows(rows, products, data.batches), [rows, products, data.batches])
  const filled = rows.filter((r) => !checks.get(r.key)?.empty)
  const invalidRows = filled.filter((r) => Object.keys(checks.get(r.key)?.errors ?? {}).length > 0)
  const validRows = filled.filter((r) => Object.keys(checks.get(r.key)?.errors ?? {}).length === 0)
  const newCount = validRows.filter((r) => !r.productId).length
  const batchCount = validRows.filter((r) => r.productId).length
  const unitCount = validRows.reduce((sum, r) => sum + (Number(r.qty) > 0 ? Number(r.qty) : 0), 0)

  const focusCell = useCallback((key: string, col: Field, select = false) => {
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-cell="${key}:${col}"]`)
      el?.focus()
      if (select && el instanceof HTMLInputElement) el.select()
    })
  }, [])

  useEffect(() => {
    const first = rowsRef.current.find((r) => !r.productId && !r.name) ?? rowsRef.current[0]
    focusCell(first.key, 'name')
  }, [focusCell])

  const inheritFromLast = () => {
    const last = rowsRef.current[rowsRef.current.length - 1]
    return makeRow({ category: last?.category ?? '', unit: last?.unit ?? '', supplier: last?.supplier ?? '' })
  }

  const patch = (key: string, changes: Partial<BRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)))
  const touch = (key: string, field: Field) => setTouched((t) => (t.has(`${key}:${field}`) ? t : new Set(t).add(`${key}:${field}`)))

  const takenSkus = () => new Set([...products.map((p) => p.sku), ...rowsRef.current.map((r) => (r.sku ? normalizeSku(r.sku) : '')).filter(Boolean)])

  const addRows = (count: number) => {
    const added = Array.from({ length: count }, () => inheritFromLast())
    setRows((prev) => [...prev, ...added])
    focusCell(added[0].key, 'name')
  }

  const removeRow = (key: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key)
      return next.length ? next : [makeRow()]
    })
  }

  const duplicateRow = (key: string) => {
    const index = rowsRef.current.findIndex((r) => r.key === key)
    const src = rowsRef.current[index]
    if (!src) return
    const taken = takenSkus()
    const sku = src.productId ? src.sku : src.sku ? uniqueSkuVariant(normalizeSku(src.sku), taken) : src.name ? generateSku(src.name, src.category, taken) : ''
    const copy = makeRow({ ...src, sku, batch: '' })
    setRows((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)])
    focusCell(copy.key, src.productId ? 'qty' : 'name', true)
  }

  const blurName = (key: string) => {
    touch(key, 'name')
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key || r.productId || !r.name.trim()) return r
        const exact = products.find((p) => p.name.toLowerCase() === r.name.trim().toLowerCase())
        if (exact) return linkRow(r, exact)
        if (r.sku) return r
        const taken = new Set([...products.map((p) => p.sku), ...prev.map((x) => (x.sku ? normalizeSku(x.sku) : '')).filter(Boolean)])
        return { ...r, sku: generateSku(r.name, r.category, taken) }
      }),
    )
  }

  const blurSku = (key: string) => {
    touch(key, 'sku')
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key || r.productId || !r.sku.trim()) return r
        const sku = normalizeSku(r.sku)
        const exact = !r.name.trim() ? products.find((p) => p.sku === sku) : undefined
        return exact ? linkRow({ ...r, sku }, exact) : { ...r, sku }
      }),
    )
  }

  const moveVertical = (key: string, col: Field, dir: 1 | -1) => {
    const list = rowsRef.current
    let i = list.findIndex((r) => r.key === key) + dir
    while (i >= 0 && i < list.length) {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-cell="${list[i].key}:${col}"]`)
      if (el) {
        el.focus()
        if (el instanceof HTMLInputElement) el.select()
        return
      }
      i += dir
    }
    if (dir > 0) {
      const added = inheritFromLast()
      setRows((prev) => [...prev, added])
      focusCell(added.key, col)
    }
  }

  const onCellKeyDown = (e: KeyboardEvent<HTMLElement>, row: BRow, col: Field) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault()
      moveVertical(row.key, col, e.shiftKey ? -1 : 1)
      return
    }
    const isLastRow = rowsRef.current[rowsRef.current.length - 1]?.key === row.key
    const lastCol: Field = row.tracksExpiry ? 'expiry' : 'batch'
    if (e.key === 'Tab' && !e.shiftKey && isLastRow && col === lastCol) {
      e.preventDefault()
      const added = inheritFromLast()
      setRows((prev) => [...prev, added])
      focusCell(added.key, 'name')
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLElement>, key: string, col: Field) => {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n]/.test(text.replace(/[\r\n]+$/, ''))) return
    e.preventDefault()
    const startCol = COLS.indexOf(col)
    let grid = text
      .replace(/\r/g, '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => line.split('\t'))
    if (startCol === 0 && /^(product|name)/i.test(grid[0][0]?.trim() ?? '')) grid = grid.slice(1)
    if (!grid.length) return

    setRows((prev) => {
      const next = [...prev]
      const start = next.findIndex((r) => r.key === key)
      grid.forEach((cells, gi) => {
        const idx = start + gi
        if (idx >= next.length) {
          const last = next[next.length - 1]
          next.push(makeRow({ category: last?.category ?? '', unit: last?.unit ?? '', supplier: last?.supplier ?? '' }))
        }
        let r = next[idx]
        cells.forEach((cell, offset) => {
          const field = COLS[startCol + offset]
          if (!field) return
          if (r.productId && LOCKED_WHEN_LINKED.includes(field)) return
          r = { ...r, [field]: normalizeCell(field, cell) }
        })
        if (!r.productId) {
          const match = matchProduct(r, products)
          if (match) r = linkRow(r, match)
        }
        next[idx] = r
      })
      return next
    })
    setNotice(`Pasted ${grid.length} row${grid.length === 1 ? '' : 's'}. Check the highlighted cells before saving.`)
  }

  const importCsv = async (file: File | undefined) => {
    if (!file) return
    const seeds = parseBulkCsv(await file.text())
    if (!seeds.length) {
      toast('No rows were found in that CSV file.', 'error')
      return
    }
    const imported = seeds.map((s) => rowFromSeed(s, products))
    setRows((prev) => [...prev.filter((r) => !checks.get(r.key)?.empty), ...imported, makeRow()])
    setNotice(`Imported ${imported.length} row${imported.length === 1 ? '' : 's'} from ${file.name}. Rows matching an existing product will receive a batch.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadTemplate = () =>
    downloadCsv('stocksense-bulk-template.csv', [
      BULK_TEMPLATE_HEADERS,
      ['Whole Milk 1L', 'DA-2001', 'Dairy', 'cartons', 120, 40, 'Valley Dairy Co.', 'L-2001', '2026-12-01'],
      ['Sourdough Loaf', '', 'Bakery', 'units', 60, 20, 'Corner Bakery', '', '2026-12-05'],
    ])

  const errorFor = (key: string, field: Field) => (submitted || touched.has(`${key}:${field}`) ? checks.get(key)?.errors[field] : undefined)

  const save = () => {
    setSubmitted(true)
    if (!validRows.length) return
    const commitRows: BulkCommitRow[] = validRows.map((r) => ({
      productId: r.productId,
      product: {
        name: r.name.trim(),
        sku: normalizeSku(r.sku),
        category: r.category,
        unit: r.unit,
        reorderPoint: Number(r.reorder) || 0,
        supplier: r.supplier.trim(),
        tracksExpiry: r.tracksExpiry,
      },
      quantity: Number(r.qty) > 0 ? Number(r.qty) : 0,
      batchNumber: r.batch.trim(),
      expiryDate: r.tracksExpiry ? r.expiry : '',
      supplier: r.supplier.trim(),
    }))
    const result = commitBulk(commitRows)
    const parts = [
      result.created ? `${result.created} new product${result.created === 1 ? '' : 's'}` : '',
      result.received ? `${result.received} batch${result.received === 1 ? '' : 'es'} received` : '',
    ].filter(Boolean)
    toast(`Saved ${parts.join(' and ') || `${validRows.length} rows`}.`)

    if (!invalidRows.length) {
      onClose()
      return
    }
    const savedKeys = new Set(validRows.map((r) => r.key))
    setRows((prev) => {
      const next = prev.filter((r) => !savedKeys.has(r.key))
      return next.length ? next : [makeRow()]
    })
    setNotice(`Saved ${validRows.length} valid row${validRows.length === 1 ? '' : 's'}. ${invalidRows.length} row${invalidRows.length === 1 ? ' still needs' : 's still need'} attention.`)
  }

  const requestClose = () => {
    if (filled.length) setConfirmDiscard(true)
    else onClose()
  }

  const goToIssue = (row: BRow) => {
    const field = COLS.find((c) => checks.get(row.key)?.errors[c])
    if (field) focusCell(row.key, field)
  }

  const saveLabel = !validRows.length
    ? 'Save'
    : invalidRows.length
      ? `Save ${validRows.length} valid row${validRows.length === 1 ? '' : 's'}`
      : `Save ${validRows.length} row${validRows.length === 1 ? '' : 's'}`

  return (
    <Modal
      open
      onClose={requestClose}
      size="full"
      title="Bulk Stock Entry"
      description="Create new products or receive batches for existing ones. Paste from Excel or Google Sheets into any cell."
      bodyClassName="p-0"
      footer={
        confirmDiscard ? (
          <>
            <p className="mr-auto text-sm text-foreground">
              Discard {filled.length} unsaved row{filled.length === 1 ? '' : 's'}?
            </p>
            <Button variant="outline" size="lg" onClick={() => setConfirmDiscard(false)} data-autofocus>
              Keep editing
            </Button>
            <Button variant="destructive" size="lg" onClick={onClose}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <p className="mr-auto hidden text-xs text-muted-foreground md:block">
              Enter moves down a column. Tab moves across and adds a row at the end.
            </p>
            <Button variant="outline" size="lg" onClick={requestClose}>
              Cancel
            </Button>
            <Button size="lg" onClick={save} disabled={!filled.length}>
              {saveLabel}
            </Button>
          </>
        )
      }
    >
      <div ref={containerRef} className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border px-5 py-3">
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Stat label="New products" value={fmtInt(newCount)} />
            <Stat label="Batches to receive" value={fmtInt(batchCount)} />
            <Stat label="Units to add" value={fmtInt(unitCount)} />
            <Stat label="Need attention" value={fmtInt(invalidRows.length)} tone={invalidRows.length ? 'danger' : 'muted'} />
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => addRows(1)}>
              <Plus aria-hidden="true" />
              Add row
            </Button>
            <Button variant="outline" onClick={() => addRows(5)}>
              Add 5 rows
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden="true" />
              Import CSV
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>
              <Download aria-hidden="true" />
              Template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a CSV file to import"
              onChange={(e) => importCsv(e.target.files?.[0])}
            />
          </div>
        </div>

        {notice || (submitted && invalidRows.length) ? (
          <div className="flex flex-col gap-2 border-b border-border bg-muted/50 px-5 py-3 text-sm">
            {notice ? (
              <p className="flex items-start gap-2 text-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {notice}
              </p>
            ) : null}
            {submitted && invalidRows.length ? (
              <div role="alert" className="flex flex-col gap-1.5">
                <p className="flex items-center gap-2 font-medium text-danger-text">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                  {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} need fixing. Valid rows can still be saved.
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {invalidRows.map((r) => {
                    const n = rows.indexOf(r) + 1
                    const first = Object.values(checks.get(r.key)?.errors ?? {})[0]
                    return (
                      <li key={r.key}>
                        <button type="button" onClick={() => goToIssue(r)} className="rounded text-left text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                          Row {n}: {first}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[calc(100dvh-24rem)] min-h-64 overflow-auto">
          <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Rows to add. Each row is either a new product or a new batch for an existing product.</caption>
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted text-left text-xs font-medium text-muted-foreground">
                <Head className="w-20">Row</Head>
                <Head className="w-60">Product name</Head>
                <Head className="w-32">SKU</Head>
                <Head className="w-36">Category</Head>
                <Head className="w-28">Unit</Head>
                <Head className="w-28 text-right">Quantity</Head>
                <Head className="w-28 text-right">Reorder at</Head>
                <Head className="w-44">Supplier</Head>
                <Head className="w-36">Batch no.</Head>
                <Head className="w-44">Expiry date</Head>
                <Head className="w-20">
                  <span className="sr-only">Row actions</span>
                </Head>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const check = checks.get(row.key)
                const linked = !!row.productId
                const empty = check?.empty
                const visible = COLS.filter((c) => errorFor(row.key, c))
                const errId = `${row.key}-errors`
                const err = (f: Field) => !!errorFor(row.key, f)
                const common = (f: Field) => ({
                  'data-cell': `${row.key}:${f}`,
                  'aria-invalid': err(f) || undefined,
                  'aria-describedby': visible.length ? errId : undefined,
                  'aria-label': `${FIELD_LABEL[f]}, row ${i + 1}`,
                  onBlur: () => touch(row.key, f),
                  onKeyDown: (e: KeyboardEvent<HTMLElement>) => onCellKeyDown(e, row, f),
                  onPaste: (e: ClipboardEvent<HTMLElement>) => onPaste(e, row.key, f),
                })
                const locked = (value: string, align?: 'right') => (
                  <div className={cn('flex h-10 items-center px-2 text-sm text-muted-foreground', align === 'right' && 'justify-end tabular-nums')} title="From the saved product">
                    <span className="truncate">{value || '-'}</span>
                  </div>
                )
                const expiryApplies = row.tracksExpiry

                return (
                  <Fragment key={row.key}>
                    <tr className={cn('group', empty && 'opacity-80')}>
                      <Cell className="px-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-4 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                          {empty ? null : (
                            <span className={cn('rounded px-1.5 py-0.5 font-medium', linked ? 'bg-muted text-foreground' : 'bg-primary-soft text-primary')}>{linked ? 'Batch' : 'New'}</span>
                          )}
                        </div>
                      </Cell>
                      <Cell>
                        <NameCell
                          row={row}
                          rowNumber={i + 1}
                          invalid={err('name')}
                          products={products}
                          stockById={stockById}
                          onChange={(value) => patch(row.key, { name: value })}
                          onPick={(p) => {
                            setRows((prev) => prev.map((r) => (r.key === row.key ? linkRow(r, p) : r)))
                            focusCell(row.key, 'qty', true)
                          }}
                          onUnlink={() => {
                            setRows((prev) => prev.map((r) => (r.key === row.key ? unlinkRow(r) : r)))
                            focusCell(row.key, 'name', true)
                          }}
                          onBlur={() => blurName(row.key)}
                          onKeyDown={(e) => onCellKeyDown(e, row, 'name')}
                          onPaste={(e) => onPaste(e, row.key, 'name')}
                        />
                      </Cell>
                      <Cell>
                        {linked ? (
                          <div className="flex h-10 items-center px-2 font-mono text-xs text-muted-foreground" title="From the saved product">
                            {row.sku}
                          </div>
                        ) : (
                          <input
                            {...common('sku')}
                            type="text"
                            autoComplete="off"
                            placeholder="Auto"
                            value={row.sku}
                            onChange={(e) => patch(row.key, { sku: e.target.value })}
                            onBlur={() => blurSku(row.key)}
                            className={cellClass(err('sku'), 'font-mono text-xs uppercase')}
                          />
                        )}
                      </Cell>
                      <Cell>
                        {linked ? (
                          locked(row.category)
                        ) : (
                          <select
                            {...common('category')}
                            value={row.category}
                            onChange={(e) => patch(row.key, { category: e.target.value })}
                            className={cellClass(err('category'), cn('cursor-pointer', !row.category && 'text-muted-foreground/70'))}
                          >
                            <option value="">Select</option>
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        )}
                      </Cell>
                      <Cell>
                        {linked ? (
                          locked(row.unit)
                        ) : (
                          <select
                            {...common('unit')}
                            value={row.unit}
                            onChange={(e) => patch(row.key, { unit: e.target.value })}
                            className={cellClass(err('unit'), cn('cursor-pointer', !row.unit && 'text-muted-foreground/70'))}
                          >
                            <option value="">Select</option>
                            {UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        )}
                      </Cell>
                      <Cell>
                        <input
                          {...common('qty')}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={linked ? 'Received' : '0'}
                          value={row.qty}
                          onChange={(e) => patch(row.key, { qty: e.target.value })}
                          className={cellClass(err('qty'), 'text-right tabular-nums')}
                        />
                      </Cell>
                      <Cell>
                        {linked ? (
                          locked(row.reorder, 'right')
                        ) : (
                          <input
                            {...common('reorder')}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            value={row.reorder}
                            onChange={(e) => patch(row.key, { reorder: e.target.value })}
                            className={cellClass(err('reorder'), 'text-right tabular-nums')}
                          />
                        )}
                      </Cell>
                      <Cell>
                        <input
                          {...common('supplier')}
                          type="text"
                          autoComplete="off"
                          placeholder="Optional"
                          value={row.supplier}
                          onChange={(e) => patch(row.key, { supplier: e.target.value })}
                          className={cellClass(false)}
                        />
                      </Cell>
                      <Cell>
                        <input
                          {...common('batch')}
                          type="text"
                          autoComplete="off"
                          placeholder="Auto-generated"
                          value={row.batch}
                          onChange={(e) => patch(row.key, { batch: e.target.value })}
                          className={cellClass(err('batch'), 'font-mono text-xs')}
                        />
                      </Cell>
                      <Cell>
                        <div className="flex items-center">
                          {expiryApplies ? (
                            <input
                              {...common('expiry')}
                              type="date"
                              min={today}
                              value={row.expiry}
                              onChange={(e) => patch(row.key, { expiry: e.target.value })}
                              className={cellClass(err('expiry'), 'min-w-0 flex-1')}
                            />
                          ) : (
                            <div className="flex h-10 min-w-0 flex-1 items-center px-2 text-sm text-muted-foreground">Not tracked</div>
                          )}
                          {linked ? null : (
                            <IconButton
                              label={expiryApplies ? 'This product has no expiry date' : 'Track expiry for this product'}
                              className="mr-1 size-7"
                              onClick={() => patch(row.key, { tracksExpiry: !row.tracksExpiry, expiry: '' })}
                            >
                              {expiryApplies ? <CalendarOff /> : <CalendarCheck />}
                            </IconButton>
                          )}
                        </div>
                      </Cell>
                      <Cell className="px-1">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton label={linked ? `Add another batch of ${row.name}` : `Duplicate row ${i + 1}`} className="size-7" onClick={() => duplicateRow(row.key)} disabled={!!empty}>
                            <Copy />
                          </IconButton>
                          <IconButton label={`Remove row ${i + 1}`} className="size-7" onClick={() => removeRow(row.key)} disabled={rows.length === 1 && !!empty}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      </Cell>
                    </tr>
                    {visible.length ? (
                      <tr>
                        <td colSpan={11} id={errId} className="border-b border-border bg-danger-soft/50 px-4 py-1.5 text-xs text-danger-text">
                          <span className="font-medium">Row {i + 1}:</span>{' '}
                          {visible.map((f) => `${FIELD_LABEL[f]}: ${checks.get(row.key)?.errors[f]}`).join('  ')}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

function Head({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th scope="col" className={cn('border-b border-border px-2 py-2 font-medium whitespace-nowrap', className)}>
      {children}
    </th>
  )
}

function Cell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn('border-b border-r border-border/70 p-0 align-middle last:border-r-0', className)}>{children}</td>
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'muted' }) {
  return (
    <div className="flex items-baseline gap-2">
      <dd className={cn('order-1 text-lg font-semibold tabular-nums', tone === 'danger' ? 'text-danger-text' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground')}>{value}</dd>
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}
