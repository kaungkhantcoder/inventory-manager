'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from './icon-button'
import { Select } from './fields'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  sizes?: number[]
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 25, 50] }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  const visible: (number | 'gap')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) visible.push(p)
    else if (visible[visible.length - 1] !== 'gap') visible.push('gap')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <label htmlFor="rows-per-page" className="text-xs">
          Rows per page
        </label>
        <Select
          id="rows-per-page"
          wrapperClassName="w-[76px]"
          className="h-8"
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value))
            onPage(1)
          }}
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <p className="tabular text-xs" aria-live="polite">
        {start}–{end} of {total}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </IconButton>
        {visible.map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={
                p === page
                  ? 'tabular h-8 min-w-8 rounded-lg bg-primary-soft px-2 text-xs font-semibold text-primary'
                  : 'tabular h-8 min-w-8 rounded-lg px-2 text-xs text-foreground hover:bg-muted'
              }
            >
              {p}
            </button>
          ),
        )}
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </IconButton>
      </nav>
    </div>
  )
}
