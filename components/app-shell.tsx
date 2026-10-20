'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Boxes, CalendarClock, LayoutDashboard, Menu, Settings, Sparkles, ArrowLeftRight, Trash2, X } from 'lucide-react'
import { StoreProvider, useStore } from '@/lib/store'
import { UIProvider } from '@/lib/ui'
import { buildInsights } from '@/lib/insights'
import { cn } from '@/lib/utils'
import { Overlays } from '@/components/overlays'
import { PageSkeleton } from '@/components/page-kit'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/movements', label: 'Stock Movements', icon: ArrowLeftRight },
  { href: '/expiry', label: 'Expiry Management', icon: CalendarClock, badge: 'expiry' as const },
  { href: '/insights', label: 'AI Insights', icon: Sparkles, badge: 'insights' as const },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { rows, settings, trash, ready } = useStore()
  const counts = useMemo(() => {
    const insights = buildInsights(rows, settings)
    return {
      insights: new Set(insights.map((i) => i.productId)).size,
      expiry: insights.filter((i) => i.kind === 'expiry').length,
    }
  }, [rows, settings])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
          <Boxes className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          StockSense <span className="text-primary">AI</span>
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href)
            const count = ready && item.badge ? counts[item.badge] : 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count > 0 ? (
                    <span className="tabular rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground">{count}</span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/recycle-bin"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/recycle-bin') ? 'page' : undefined}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            pathname.startsWith('/recycle-bin') ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="flex-1">Recycle Bin</span>
          {ready && trash.length > 0 ? <span className="tabular rounded-full bg-danger-soft px-1.5 text-xs font-semibold text-danger-text">{trash.length}</span> : null}
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            pathname.startsWith('/settings') ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </Link>
        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-primary-foreground" aria-hidden="true">
            JM
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">Jordan Mills</p>
            <p className="truncate text-xs text-muted-foreground">Warehouse Manager</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { ready } = useStore()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [pathname])

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-[15px] font-semibold tracking-tight">
          StockSense <span className="text-primary">AI</span>
        </span>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="animate-in slide-in-from-left absolute inset-y-0 left-0 w-64 border-r border-border bg-card duration-200">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{ready ? children : <PageSkeleton />}</div>
      </main>
      {ready ? <Overlays /> : null}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell>{children}</Shell>
      </UIProvider>
    </StoreProvider>
  )
}
