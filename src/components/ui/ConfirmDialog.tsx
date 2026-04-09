'use client'

import * as React from 'react'
import { useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './Modal'
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
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      {description && <ModalBody>{description}</ModalBody>}
      <ModalFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'outline' : 'default'}
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
          className={destructive ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : ''}
        >
          {destructive && <AlertTriangle className="mr-2 h-4 w-4" />}
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
  const [dialog, setDialog] = useState<ConfirmDialogOptions & { resolve?: (value: boolean) => void } | null>(null)

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
