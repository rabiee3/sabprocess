import type { ReactNode } from 'react'
import pattern from '../assets/patterns/splash-pattern.svg'

/**
 * Ink background with the scattered splash pattern (icons at 8–26% opacity, never raised).
 * Phone: one covering <img>. From 640px: the tile repeated at 400px. Children render above.
 */
export function DarkBackdrop({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate flex flex-col overflow-hidden bg-ink-strong text-white ${className}`}>
      <img
        src={pattern}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 size-full object-cover sm:hidden"
      />
      <div
        aria-hidden="true"
        data-testid="backdrop-tiles"
        className="pointer-events-none absolute inset-0 -z-10 hidden sm:block"
        style={{ backgroundImage: `url(${pattern})`, backgroundSize: '400px auto' }}
      />
      {children}
    </div>
  )
}
