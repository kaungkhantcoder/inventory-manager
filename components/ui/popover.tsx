'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TriggerProps {
  ref: Ref<HTMLButtonElement>
  onClick: () => void
  'aria-expanded': boolean
  'aria-haspopup': 'menu'
}

interface PopoverProps {
  trigger: (props: TriggerProps, open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  label?: string
}

export function Popover({ trigger, children, align = 'start', width = 220, label }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const h = panelRef.current?.offsetHeight ?? 0
    let left = align === 'end' ? r.right - width : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    let top = r.bottom + 4
    if (h && top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4
    setPos({ left, top })
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) setPos(null)
  }, [open])

  return (
    <>
      {trigger(
        {
          ref: triggerRef,
          onClick: () => setOpen((v) => !v),
          'aria-expanded': open,
          'aria-haspopup': 'menu',
        },
        open,
      )}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={label}
              style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
              className="fixed z-[60] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function MenuItem({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />
}
