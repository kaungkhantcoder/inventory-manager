'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight text-foreground text-balance">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl border border-border bg-card', className)}>{children}</section>
}

export function PanelHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  )
}

export interface KpiItem {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'danger' | 'expiry' | 'success'
  onClick?: () => void
  href?: string
}

const KPI_TONE: Record<NonNullable<KpiItem['tone']>, string> = {
  default: 'text-foreground',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  expiry: 'text-expiry-text',
  success: 'text-success-text',
}

export function KpiStrip({ items, size = 'md' }: { items: KpiItem[]; size?: 'md' | 'lg' }) {
  return (
    <div className="mb-5 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      {items.map((item) => {
        const inner = (
          <>
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className={cn('tabular mt-1 block font-semibold tracking-tight', size === 'lg' ? 'text-[30px] leading-9' : 'text-[26px] leading-8', KPI_TONE[item.tone ?? 'default'])}>
              {item.value}
            </span>
            {item.hint ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.hint}</span> : null}
          </>
        )
        const cls = 'block px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        if (item.href)
          return (
            <Link key={item.label} href={item.href} className={cn(cls, 'hover:bg-muted/60')}>
              {inner}
            </Link>
          )
        if (item.onClick)
          return (
            <button key={item.label} type="button" onClick={item.onClick} className={cn(cls, 'w-full hover:bg-muted/60')}>
              {inner}
            </button>
          )
        return (
          <div key={item.label} className={cls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-5 h-8 w-48 rounded-lg bg-muted" />
      <div className="mb-5 h-20 rounded-xl border border-border bg-card" />
      <div className="rounded-xl border border-border bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-border last:border-0" />
        ))}
      </div>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
  className,
  sort,
  onSort,
  sortKey,
}: {
  children?: ReactNode
  align?: 'left' | 'right'
  className?: string
  sort?: { key: string; dir: 'asc' | 'desc' }
  onSort?: (key: string) => void
  sortKey?: string
}) {
  const active = sort && sortKey && sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('h-10 border-b border-border bg-muted/50 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground', align === 'right' ? 'text-right' : 'text-left', className)}
    >
      {onSort && sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn('inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', align === 'right' && 'flex-row-reverse', active && 'text-foreground')}
        >
          {children}
          <span aria-hidden="true" className="w-2.5 text-[10px]">
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  )
}
