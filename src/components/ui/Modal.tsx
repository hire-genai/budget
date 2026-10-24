  'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export function Modal({
  open, onClose, title, subtitle, children, size = 'md',
}: {
  open: boolean; onClose: () => void
  title: string; subtitle?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sz = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className={clsx('w-full card shadow-pop my-8', sz)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-bg-border">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="text-xs text-text-secondary mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-bg-hover"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', busy = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>
  title: string; message: string; confirmLabel?: string
  tone?: 'danger' | 'primary'; busy?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="text-sm text-text-secondary">{message}</div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
