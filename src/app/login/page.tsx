'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wallet, ArrowLeft, Mail, ShieldCheck } from 'lucide-react'

type Step = 'EMAIL' | 'NAME' | 'CODE'

function LoginFlow() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/dashboard'

  const [step, setStep] = useState<Step>('EMAIL')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [purpose, setPurpose] = useState<'LOGIN' | 'SIGNUP'>('LOGIN')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [devHint, setDevHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  // countdown for resend button
  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  async function requestOtp(nameOverride?: string) {
    setError(null); setInfo(null); setDevHint(null); setLoading(true)
    try {
      const body: any = { email }
      const nm = (nameOverride ?? name).trim()
      if (nm) body.name = nm
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.details?.field === 'name' || data?.error?.includes('Name is required')) {
          setPurpose('SIGNUP')
          setStep('NAME')
          setError(null)
          return
        }
        setError(data.error || 'Unable to send code')
        return
      }
      setPurpose(data.purpose || 'LOGIN')
      setStep('CODE')
      setResendIn(30)
      setInfo(`We sent a 6-digit code to ${email}.`)
      if (data.devHint) setDevHint(data.devHint)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, name: name || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Unable to verify code')
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function backTo(s: Step) {
    setError(null); setInfo(null); setCode(''); setStep(s)
  }

  return (
    <>
      {step === 'EMAIL' && (
        <form
          onSubmit={(e) => { e.preventDefault(); requestOtp() }}
          className="space-y-4"
        >
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input pl-9"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus required
              />
            </div>
            <div className="text-[11px] text-text-muted mt-1.5">
              New here? We'll ask for a name after your code.
            </div>
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading || !email}>
            {loading ? 'Sending code…' : 'Send one-time code'}
          </button>
        </form>
      )}

      {step === 'NAME' && (
        <form
          onSubmit={(e) => { e.preventDefault(); requestOtp(name) }}
          className="space-y-4"
        >
          <div className="text-sm text-text-secondary">
            We don't have an account for <span className="text-text-primary">{email}</span> yet. Tell us your name and we'll create one.
          </div>
          <div>
            <label className="label">Full name</label>
            <input
              className="input" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Shah"
              minLength={2} required autoFocus
            />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => backTo('EMAIL')}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading || name.trim().length < 2}>
              {loading ? 'Sending code…' : 'Create account & send code'}
            </button>
          </div>
        </form>
      )}

      {step === 'CODE' && (
        <form
          onSubmit={(e) => { e.preventDefault(); verifyOtp() }}
          className="space-y-4"
        >
          <div className="text-sm text-text-secondary">
            {purpose === 'SIGNUP' ? 'Almost there! ' : ''}
            Enter the 6-digit code we sent to{' '}
            <span className="text-text-primary">{email}</span>.
          </div>
          <OtpInput value={code} onChange={setCode} onComplete={() => code.length === 6 && verifyOtp()} />
          {info && <InfoBox>{info}</InfoBox>}
          {devHint && <InfoBox tone="warn">{devHint}</InfoBox>}
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading || code.length < 4}>
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <button type="button" className="btn-ghost !p-1" onClick={() => backTo('EMAIL')}>
              <ArrowLeft size={14} /> Use a different email
            </button>
            <button
              type="button"
              className="btn-ghost !p-1 disabled:opacity-50"
              disabled={resendIn > 0 || loading}
              onClick={() => requestOtp()}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

function OtpInput({
  value, onChange, onComplete, length = 6,
}: { value: string; onChange: (v: string) => void; onComplete?: () => void; length?: number }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const chars = value.split('').concat(Array(length).fill('')).slice(0, length)

  useEffect(() => { refs.current[0]?.focus() }, [])

  function setChar(i: number, ch: string) {
    const next = chars.slice()
    next[i] = ch.replace(/\D/g, '').slice(-1)
    const merged = next.join('').slice(0, length)
    onChange(merged)
    if (ch && i < length - 1) refs.current[i + 1]?.focus()
    if (merged.length === length) onComplete?.()
  }

  return (
    <div className="flex gap-2 justify-between">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          value={c}
          inputMode="numeric"
          maxLength={1}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !c && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
            if (!text) return
            e.preventDefault()
            onChange(text)
            const idx = Math.min(text.length, length - 1)
            refs.current[idx]?.focus()
            if (text.length === length) onComplete?.()
          }}
          className="w-11 h-12 md:w-12 md:h-14 text-center text-xl font-semibold rounded-lg
            bg-bg-soft border border-bg-border text-text-primary tabular-nums
            focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40"
        />
      ))}
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{children}</div>
}
function InfoBox({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const cl = tone === 'warn'
    ? 'text-amber-100 bg-amber-500/10 border-amber-500/30'
    : 'text-brand-100 bg-brand-500/10 border-brand-500/30'
  return <div className={`text-xs rounded-lg px-3 py-2 border ${cl}`}>{children}</div>
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md card p-8 shadow-pop">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Wallet size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Sign in to Ledger</h1>
            <p className="text-sm text-text-secondary">Passwordless — we'll email you a one-time code.</p>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-text-secondary">Loading…</div>}>
          <LoginFlow />
        </Suspense>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-text-muted">
          <ShieldCheck size={12} />
          Secure OTP login · No passwords stored
        </div>
      </div>
    </div>
  )
}
