'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onOpenChange, children, className }: ModalProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              'animate-in zoom-in-95 border-surface-input-border relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border bg-card shadow-2xl',
              className,
            )}
          >
            <button
              onClick={() => onOpenChange(false)}
              className="text-text-muted-surface hover:bg-surface-row-hover hover:text-text-on-surface bg-card/80 absolute right-4 top-4 z-20 rounded-lg p-1 backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Scrollable content — `flex-1 min-h-0` is what actually bounds
                this region inside the flex-col panel (capped at max-h-[90vh]),
                so long forms scroll and the footer / Save button stay
                reachable. Without min-h-0 the flex item refuses to shrink and
                the content (and footer) overflow off-screen. */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}

export function ModalHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function ModalTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <h2 className={cn('text-text-on-surface text-xl font-bold', className)}>{children}</h2>
}

export function ModalBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('py-4', className)}>{children}</div>
}

export function ModalFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)}>{children}</div>
}
