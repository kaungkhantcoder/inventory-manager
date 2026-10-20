'use client'

import { forwardRef, useId, useState, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className, children, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props },
  ref,
) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const tipId = useId()

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const below = r.top < 48
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below })
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={(e) => {
          show(e.currentTarget)
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setPos(null)
          onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setPos(null)
          onBlur?.(e)
        }}
        {...props}
        onClick={(e) => {
          setPos(null)
          onClick?.(e)
        }}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
          active && 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
          className,
        )}
      >
        {children}
      </button>
      {pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              style={{ left: pos.x, top: pos.y, transform: pos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}
              className="pointer-events-none fixed z-[70] rounded-md bg-navy px-2 py-1 text-xs font-medium whitespace-nowrap text-primary-foreground"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  )
})
