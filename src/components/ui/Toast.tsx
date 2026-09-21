'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import clsx from 'clsx'

type Tone = 'success' | 'error' | 'info'
type Toast = { id: number; tone: Tone; text: string }

type Ctx = { push: (text: string, tone?: Tone) => void }
const ToastCtx = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id}
            className={clsx('pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-pop min-w-[240px] max-w-sm text-sm',
              t.tone === 'success' && 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100',
              t.tone === 'error' && 'bg-red-500/15 border-red-500/40 text-red-100',
              t.tone === 'info' && 'bg-brand-500/15 border-brand-500/40 text-brand-100',
            )}>
            {t.tone === 'success' && <CheckCircle2 size={16} className="mt-0.5" />}
            {t.tone === 'error' && <AlertTriangle size={16} className="mt-0.5" />}
            {t.tone === 'info' && <Info size={16} className="mt-0.5" />}
            <div>{t.text}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): Ctx {
  const c = useContext(ToastCtx)
  if (!c) return { push: () => {} }
  return c
}
