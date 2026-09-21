'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

export default function SettingsPage() {
  const toast = useToast()
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/settings').then((r) => r.json())
    setUser(res.user); setSettings(res.settings || {})
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(patch: any) {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    setSaving(false)
    if (!res.ok) { toast.push('Unable to save', 'error'); return }
    toast.push('Saved', 'success'); load()
  }

  if (loading || !user) return <div className="text-sm text-text-secondary">Loading…</div>

  return (
    <div className="space-y-4 max-w-3xl">
      <header>
        <div className="text-xl font-semibold">Settings</div>
        <div className="text-sm text-text-secondary">Preferences, currency, and notifications.</div>
      </header>

      <Card>
        <CardTitle title="Profile" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" defaultValue={user.name} onBlur={(e) => e.target.value !== user.name && save({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={user.email} disabled />
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" defaultValue={user.currency} onChange={(e) => save({ currency: e.target.value })}>
              <option value="INR">INR — Indian Rupee (₹)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="JPY">JPY — Japanese Yen</option>
            </select>
          </div>
          <div>
            <label className="label">Timezone</label>
            <input className="input" defaultValue={user.timezone} onBlur={(e) => e.target.value !== user.timezone && save({ timezone: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle title="Notifications & alerts" subtitle="These appear in your dashboard insights." />
        <div className="space-y-3">
          <Toggle label="Budget alerts (near limit / over)" value={settings.budgetAlertsEnabled ?? true} onChange={(v) => save({ budgetAlertsEnabled: v })} />
          <Toggle label="Upcoming recurring payment alerts" value={settings.recurringAlerts ?? true} onChange={(v) => save({ recurringAlerts: v })} />
          <Toggle label="Large transaction alert" value={settings.largeTxAlert ?? true} onChange={(v) => save({ largeTxAlert: v })} />
          <div>
            <label className="label">Large transaction threshold</label>
            <input className="input tabular-nums max-w-[200px]" inputMode="decimal"
              defaultValue={settings.largeTxThreshold ?? '5000'}
              onBlur={(e) => save({ largeTxThreshold: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle title="Data" subtitle="Import / export your transactions." />
        <div className="flex gap-2">
          <a className="btn" href="/api/export/csv" target="_blank">Download all transactions (CSV)</a>
        </div>
      </Card>

      <Card>
        <CardTitle title="About" />
        <div className="text-sm text-text-secondary space-y-1">
          <div>Ledger — a personal finance tracker.</div>
          <div>Signed in as <span className="text-text-primary">{user.email}</span></div>
          <div>Currency defaults to <span className="text-text-primary">{user.currency}</span></div>
        </div>
      </Card>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`w-10 h-6 rounded-full transition-colors ${value ? 'bg-brand-500' : 'bg-bg-hover'}`}>
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}
