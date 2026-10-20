'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link2Off, PackagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtInt } from '@/lib/calc'
import type { Product } from '@/lib/types'
import type { BRow } from './bulk-logic'

interface NameCellProps {
  row: BRow
  rowNumber: number
  invalid: boolean
  products: Product[]
  stockById: Map<string, number>
  onChange: (value: string) => void
  onPick: (product: Product) => void
  onUnlink: () => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void
}

export function NameCell({ row, rowNumber, invalid, products, stockById, onChange, onPick, onUnlink, onBlur, onKeyDown, onPaste }: NameCellProps) {
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const query = row.name.trim().toLowerCase()
  const matches =
    focused && !row.productId && query
      ? products.filter((p) => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)).slice(0, 6)
      : []
  const open = matches.length > 0

  const place = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 300)
    setPos({ left: Math.min(r.left, window.innerWidth - width - 8), top: r.bottom + 2, width })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place, row.name])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  if (row.productId) {
    return (
      <div className="flex h-10 items-center gap-1.5 px-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={row.name}>
          {row.name}
        </span>
        <button
          type="button"
          onClick={onUnlink}
          aria-label={`Treat row ${rowNumber} as a new product instead of ${row.name}`}
          title="Create as a new product instead"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Link2Off className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  const pick = (p: Product) => {
    setActive(-1)
    onPick(p)
  }

  return (
    <>
      <input
        ref={inputRef}
        data-cell={`${row.key}:name`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label={`Product name, row ${rowNumber}`}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        placeholder="Type a name or pick existing"
        value={row.name}
        onChange={(e) => {
          setActive(-1)
          onChange(e.target.value)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setActive(-1)
          onBlur()
        }}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (a + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => (a <= 0 ? matches.length - 1 : a - 1))
              return
            }
            if (e.key === 'Enter' && active >= 0) {
              e.preventDefault()
              pick(matches[active])
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setFocused(false)
              return
            }
          }
          onKeyDown(e)
        }}
        className={cn(
          'h-10 w-full bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-primary-soft focus:ring-2 focus:ring-primary focus:ring-inset',
          invalid && 'bg-danger-soft/60 ring-1 ring-danger ring-inset',
        )}
      />
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              aria-label="Existing products"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
              className="fixed z-[75] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              <li role="presentation" className="flex items-center gap-1.5 px-3 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <PackagePlus className="size-3" aria-hidden="true" />
                Existing products: pick one to receive a batch
              </li>
              {matches.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm', i === active ? 'bg-primary-soft' : 'hover:bg-muted')}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{p.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {fmtInt(stockById.get(p.id) ?? 0)} {p.unit}
                  </span>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  )
}
