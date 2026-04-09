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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              'animate-in zoom-in-95 relative z-10 w-full max-w-lg rounded-2xl border border-surface-input-border bg-card p-6 shadow-2xl',
              className,
            )}
          >
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-text-muted-surface hover:bg-surface-row-hover hover:text-text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
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
  return <h2 className={cn('text-xl font-bold text-text-on-surface', className)}>{children}</h2>
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
