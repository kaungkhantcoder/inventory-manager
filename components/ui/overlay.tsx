'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './icon-button'

const stack: string[] = []
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const id = useId()

  useEffect(() => {
    if (!open) return
    stack.push(id)
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = window.setTimeout(() => {
      if (!root || root.contains(document.activeElement)) return
      const auto = root.querySelector<HTMLElement>('[data-autofocus]')
      ;(auto ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root).focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && root) {
        const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const idx = stack.indexOf(id)
      if (idx >= 0) stack.splice(idx, 1)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, id])

  return ref
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  full: 'max-w-[1360px]',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  size?: keyof typeof SIZES
  children: ReactNode
  footer?: ReactNode
  bodyClassName?: string
}

export function Modal({ open, onClose, title, description, size = 'md', children, footer, bodyClassName }: ModalProps) {
  const ref = useOverlay(open, onClose)
  const titleId = useId()
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="animate-in fade-in absolute inset-0 bg-navy/40 duration-150"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-in fade-in zoom-in-95 relative flex max-h-full w-full flex-col rounded-xl border border-border bg-card shadow-lg duration-150 outline-none',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-foreground text-balance">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
            <X />
          </IconButton>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName ?? 'p-5')}>{children}</div>
        {footer ? <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  backdropClassName?: string
  closing?: boolean
}

export function Drawer({ open, onClose, title, subtitle, children, footer, className, backdropClassName, closing = false }: DrawerProps) {
  const ref = useOverlay(open, onClose)
  const titleId = useId()
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className={cn('animate-in fade-in absolute inset-0 bg-navy/20 duration-150', backdropClassName)} onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-in slide-in-from-right absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-border bg-card shadow-lg outline-none transition-transform transition-opacity duration-200',
          closing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-foreground">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{subtitle}</div> : null}
          </div>
          <IconButton label="Close panel" onClick={onClose} className="-mr-1.5 -mt-1">
            <X />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="flex items-center gap-2 border-t border-border px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  )
}
