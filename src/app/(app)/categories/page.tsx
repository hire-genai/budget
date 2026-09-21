'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, EmptyState } from '@/components/ui/Card'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Plus, Pencil, Trash2, Tag, FolderTree } from 'lucide-react'
import clsx from 'clsx'
import { CHART_COLORS } from '@/lib/constants'

export default function CategoriesPage() {
  const toast = useToast()
  const [cats, setCats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/categories').then((r) => r.json())
    setCats(res.categories || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const tree = useMemo(() => {
    const filtered = cats.filter((c) => c.kind === kind)
    const roots = filtered.filter((c) => !c.parentId)
    return roots.map((r) => ({ ...r, children: filtered.filter((c) => c.parentId === r.id) }))
  }, [cats, kind])

  async function del() {
    if (!deleting) return
    setBusy(true)
    const res = await fetch(`/api/categories/${deleting.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.push('Unable to delete', 'error'); return }
    toast.push('Category deleted', 'success')
    setDeleting(null); load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Categories</div>
          <div className="text-sm text-text-secondary">Organise your transactions with hierarchical categories.</div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-bg-card border border-bg-border rounded-lg p-0.5">
            {(['EXPENSE', 'INCOME'] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={clsx('px-3 py-1.5 text-xs font-medium rounded-md',
                  kind === k ? 'bg-brand-500/20 text-brand-200' : 'text-text-secondary hover:text-text-primary')}>
                {k === 'EXPENSE' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> New category</button>
        </div>
      </header>

      {loading
        ? <div className="text-sm text-text-secondary">Loading…</div>
        : tree.length === 0
        ? <Card><EmptyState title="No categories yet" hint="Create categories to organise your transactions." icon={<Tag size={16} />} /></Card>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tree.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-[11px] text-text-muted">{c.children.length} sub-categor{c.children.length === 1 ? 'y' : 'ies'}</div>
                    </div>
                  </div>
                  <div className="flex">
                    <button className="btn-ghost !p-1.5" onClick={() => { setEditing(c); setOpen(true) }}><Pencil size={14} /></button>
                    <button className="btn-ghost !p-1.5 text-red-400 hover:!text-red-300" onClick={() => setDeleting(c)}><Trash2 size={14} /></button>
                  </div>
                </div>
                {c.children.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {c.children.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-bg-hover text-sm">
                        <span className="text-text-secondary">{s.name}</span>
                        <div className="flex">
                          <button className="btn-ghost !p-1" onClick={() => { setEditing(s); setOpen(true) }}><Pencil size={12} /></button>
                          <button className="btn-ghost !p-1 text-red-400 hover:!text-red-300" onClick={() => setDeleting(s)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-ghost mt-2 text-xs" onClick={() => { setEditing({ parentId: c.id, kind: c.kind, color: c.color }); setOpen(true) }}>
                  <Plus size={12} /> Add sub-category
                </button>
              </div>
            ))}
          </div>
        )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing?.id ? 'Edit category' : 'New category'}>
        <CategoryForm cats={cats} initial={editing} kind={kind}
          onSaved={() => { setOpen(false); setEditing(null); load() }}
          onCancel={() => { setOpen(false); setEditing(null) }} />
      </Modal>

      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} busy={busy}
        title="Delete this category?"
        message="Transactions in this category will be marked as uncategorised. Sub-categories will become top-level."
        confirmLabel="Delete" />
    </div>
  )
}

function CategoryForm({ cats, initial, kind, onSaved, onCancel }: {
  cats: any[]; initial: any | null; kind: 'EXPENSE' | 'INCOME'
  onSaved: () => void; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [parentId, setParentId] = useState<string>(initial?.parentId || '')
  const [color, setColor] = useState(initial?.color || CHART_COLORS[0])
  const [thisKind, setThisKind] = useState<'EXPENSE' | 'INCOME'>(initial?.kind || kind)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const parents = cats.filter((c) => !c.parentId && c.kind === thisKind && c.id !== initial?.id)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const isEdit = !!initial?.id
    const url = isEdit ? `/api/categories/${initial.id}` : '/api/categories'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null, color, kind: thisKind }),
    })
    setBusy(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'Unable to save'); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Kind</label>
          <select className="input" value={thisKind} onChange={(e) => setThisKind(e.target.value as any)}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label className="label">Parent category</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— None (top-level)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Colour</label>
        <div className="flex flex-wrap gap-1.5">
          {CHART_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={clsx('w-7 h-7 rounded-md border-2', color === c ? 'border-white/60' : 'border-transparent')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      {err && <div className="text-sm text-accent-red bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : initial?.id ? 'Save changes' : 'Create category'}</button>
      </div>
    </form>
  )
}
