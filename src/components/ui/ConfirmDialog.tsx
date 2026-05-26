'use client'

import * as React from 'react'
import { useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal, ModalFooter } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
}: ConfirmDialogProps) {
  // Visual hierarchy redesigned:
  //  - Prominent icon-on-tinted-circle at the top so the destructive
  //    action is recognisable at a glance (was missing entirely).
  //  - Centred title + description for readability.
  //  - Footer is a 50/50 grid (Cancel | Confirm) so both buttons are
  //    equal-weight and visible as buttons — the previous Delete used
  //    a pale outline variant that read as "secondary" and competed
  //    badly with the white Cancel ghost.
  //  - Destructive confirm now uses Button variant="danger" → solid
  //    red background + white text. Unambiguously destructive.
  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-w-md">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={
            destructive
              ? 'bg-error/10 flex h-14 w-14 items-center justify-center rounded-full'
              : 'bg-accent/10 flex h-14 w-14 items-center justify-center rounded-full'
          }
        >
          <AlertTriangle className={destructive ? 'h-7 w-7 text-error' : 'h-7 w-7 text-accent'} />
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>

      <ModalFooter className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
          className="w-full"
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

interface ConfirmDialogRef {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<
    (ConfirmDialogOptions & { resolve?: (value: boolean) => void }) | null
  >(null)

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    dialog?.resolve?.(true)
    setDialog(null)
  }, [dialog])

  const handleCancel = useCallback(() => {
    dialog?.resolve?.(false)
    setDialog(null)
  }, [dialog])

  const ConfirmDialogComponent = useCallback(
    () => (
      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        destructive={dialog?.destructive}
        onConfirm={handleConfirm}
      />
    ),
    [dialog, handleConfirm, handleCancel],
  )

  return { confirm, ConfirmDialog: ConfirmDialogComponent }
}
