'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Check, ScanLine, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { fmtInt } from '@/lib/calc'
import { inputClass } from '@/components/ui/fields'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (productId: string | null) => void
  invalid?: boolean
  autoFocus?: boolean
  id?: string
}

export function ProductPicker({ value, onChange, invalid, autoFocus, id }: Props) {
  const { rows } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? rows.find((r) => r.product.id === value) : undefined

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? rows.filter((r) => r.product.name.toLowerCase().includes(q) || r.product.sku.toLowerCase().includes(q)) : rows
    return list.slice(0, 8)
  }, [rows, query])

  const choose = (productId: string) => {
    onChange(productId)
    setQuery('')
    setOpen(false)
  }

  if (selected) {
    const { product, m } = selected
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-text" aria-hidden="true">
          <Check className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{product.sku}</span> · {product.category} ·{' '}
            <span className="tabular">
              {fmtInt(m.stock)} {product.unit}
            </span>{' '}
            on hand
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            window.setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
        >
          <X className="size-3.5" aria-hidden="true" />
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        data-autofocus={autoFocus ? '' : undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].product.id}` : undefined}
        autoComplete="off"
        placeholder="Search by name, or scan / type a SKU and press Enter"
        value={query}
        className={cn(inputClass, 'pl-8')}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            const q = query.trim().toLowerCase()
            const exact = rows.find((r) => r.product.sku.toLowerCase() === q)
            const target = exact ?? (open ? matches[active] : undefined)
            if (target) {
              e.preventDefault()
              choose(target.product.id)
            }
          } else if (e.key === 'Escape' && open && query) {
            e.stopPropagation()
            setQuery('')
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching products"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No product matches “{query}”. Create it first with Add Products.</li>
          ) : (
            matches.map((r, i) => (
              <li
                key={r.product.id}
                id={`${listId}-${r.product.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(r.product.id)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm', i === active && 'bg-muted')}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{r.product.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{r.product.sku}</span> · {r.product.category}
                  </span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {fmtInt(r.m.stock)} {r.product.unit}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
