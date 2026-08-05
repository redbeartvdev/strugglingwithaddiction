import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './Insurances.css'

function LogoCell({ row }) {
  const [broken, setBroken] = useState(false)
  if (!row.logo_url || broken) {
    return <span className="ins-logo-fallback" aria-hidden>{row.name?.slice(0, 2) || '?'}</span>
  }
  return (
    <img
      className="ins-logo"
      src={row.logo_url}
      alt=""
      onError={() => setBroken(true)}
    />
  )
}

const emptyEdit = {
  meta_title: '',
  meta_description: '',
  hero_title: '',
  summary: '',
  content_html: '',
  show_on_hub: false,
}

export default function AdminInsurances() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(emptyEdit)

  async function load() {
    const data = await api('/api/admin/insurances')
    setRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const enabledCount = useMemo(() => rows.filter(r => r.enabled).length, [rows])
  const disabledCount = rows.length - enabledCount
  const hubCount = useMemo(() => rows.filter(r => r.show_on_hub).length, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (filter === 'enabled' && !row.enabled) return false
      if (filter === 'disabled' && row.enabled) return false
      if (filter === 'hub' && !row.show_on_hub) return false
      if (!q) return true
      return row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q)
    })
  }, [rows, query, filter])

  function openEditor(row) {
    setEditing(row)
    setEditForm({
      meta_title: row.meta_title || '',
      meta_description: row.meta_description || '',
      hero_title: row.hero_title || '',
      summary: row.summary || '',
      content_html: row.content_html || '',
      show_on_hub: Boolean(row.show_on_hub),
    })
    setErr('')
    setMsg('')
  }

  async function saveEditorial(e) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/insurances/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          meta_title: editForm.meta_title || null,
          meta_description: editForm.meta_description || null,
          hero_title: editForm.hero_title || null,
          summary: editForm.summary || null,
          content_html: editForm.content_html || null,
          show_on_hub: editForm.show_on_hub,
        }),
      })
      setRows(list => list.map(r => (r.id === updated.id ? updated : r)))
      setEditing(updated)
      setMsg(`Saved coverage page for ${updated.name}.`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row) {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/insurances/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      })
      setRows(list => list.map(r => (r.id === row.id ? updated : r)))
      setMsg(`${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}.`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function bulk(enabled) {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await api('/api/admin/insurances/bulk', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      })
      await load()
      setMsg(enabled ? 'All insurance options enabled.' : 'All insurance options disabled.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function seedCatalog() {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const result = await api('/api/admin/insurances/seed', { method: 'POST' })
      await load()
      const created = result?.created ?? 0
      const total = result?.total ?? 0
      setMsg(
        created > 0
          ? `Catalog seeded — ${created} added (${total} total).`
          : `Catalog refreshed — ${total} options ready.`,
      )
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const emptyCatalog = !loading && rows.length === 0
  const emptyFilter = !loading && rows.length > 0 && visible.length === 0

  return (
    <div className="page-stack">
      <header className="page-header ins-header">
        <div>
          <h1 className="page-title">Insurance.</h1>
          <p className="page-sub">
            Enable plans for providers and edit coverage-hub pages (SEO + body HTML).
          </p>
        </div>
        {!loading && rows.length > 0 && (
          <p className="ins-counts muted">
            <strong>{enabledCount}</strong> enabled · <strong>{disabledCount}</strong> disabled · <strong>{hubCount}</strong> on hub
          </p>
        )}
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="ins-toolbar">
        <div className="ins-toolbar-actions">
          <Button type="button" disabled={busy || loading || emptyCatalog} onClick={() => bulk(true)}>
            Enable all
          </Button>
          <Button type="button" variant="ghost" disabled={busy || loading || emptyCatalog} onClick={() => bulk(false)}>
            Disable all
          </Button>
          <Button type="button" variant="secondary" disabled={busy || loading} onClick={seedCatalog}>
            {emptyCatalog ? 'Seed catalog' : 'Refresh catalog'}
          </Button>
        </div>
        {!emptyCatalog && (
          <label className="ins-search">
            <span className="sr-only">Search insurance</span>
            <input
              type="search"
              placeholder="Search name or slug…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={loading}
            />
          </label>
        )}
      </div>

      {!emptyCatalog && (
        <div className="tabs-row">
          <button
            type="button"
            className={`tab-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="tab-count">{rows.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn${filter === 'enabled' ? ' active' : ''}`}
            onClick={() => setFilter('enabled')}
          >
            Enabled
            <span className="tab-count">{enabledCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn${filter === 'hub' ? ' active' : ''}`}
            onClick={() => setFilter('hub')}
          >
            On hub
            <span className="tab-count">{hubCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn${filter === 'disabled' ? ' active' : ''}`}
            onClick={() => setFilter('disabled')}
          >
            Disabled
            <span className="tab-count">{disabledCount}</span>
          </button>
        </div>
      )}

      <div className={`ins-layout${editing ? ' ins-layout--split' : ''}`}>
        <Card className="card-pad-0">
          {loading ? (
            <p className="muted ins-empty">Loading insurance catalog…</p>
          ) : emptyCatalog ? (
            <div className="ins-empty-state">
              <p className="ins-empty-title">No insurance catalog yet</p>
              <p className="muted">
                Seed the standard USA plans (Aetna, Cigna, Medicaid, and more) so providers can select them and they appear in public search.
              </p>
              <Button type="button" disabled={busy} onClick={seedCatalog}>
                {busy ? 'Seeding…' : 'Seed USA catalog'}
              </Button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Name</th>
                    <th>Hub</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr
                      key={row.id}
                      className={`${row.enabled ? '' : 'ins-row-off'}${editing?.id === row.id ? ' ins-row-active' : ''}`.trim()}
                    >
                      <td>
                        <LogoCell row={row} />
                      </td>
                      <td>
                        <strong>{row.name}</strong>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{row.slug}</div>
                      </td>
                      <td>
                        {row.show_on_hub ? <span className="badge badge-ok">Hub</span> : <span className="muted">—</span>}
                      </td>
                      <td>
                        <span className={`badge ${row.enabled ? 'badge-ok' : 'badge-warn'}`}>
                          {row.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="ins-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => openEditor(row)}
                        >
                          Edit page
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => toggle(row)}
                        >
                          {row.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {emptyFilter && (
                    <tr>
                      <td colSpan={5} className="muted" style={{ padding: 24 }}>
                        No plans match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {editing && (
          <Card className="ins-editor">
            <div className="ins-editor-head">
              <div>
                <p className="eyebrow">Coverage page</p>
                <h2 className="ins-editor-title">{editing.name}</h2>
                <p className="muted">Public URL: /insurance-coverage/{editing.slug}</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <form className="form-stack" onSubmit={saveEditorial}>
              <label className="field checkbox-row">
                <input
                  type="checkbox"
                  checked={editForm.show_on_hub}
                  onChange={e => setEditForm(f => ({ ...f, show_on_hub: e.target.checked }))}
                />
                <span>Show on coverage hub</span>
              </label>
              <label className="field">
                <span className="field-label">Hero title</span>
                <input
                  value={editForm.hero_title}
                  onChange={e => setEditForm(f => ({ ...f, hero_title: e.target.value }))}
                  placeholder={`Does ${editing.name} cover rehab?`}
                />
              </label>
              <label className="field">
                <span className="field-label">Summary</span>
                <textarea
                  rows={2}
                  value={editForm.summary}
                  onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Meta title</span>
                <input
                  value={editForm.meta_title}
                  onChange={e => setEditForm(f => ({ ...f, meta_title: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Meta description</span>
                <textarea
                  rows={2}
                  value={editForm.meta_description}
                  onChange={e => setEditForm(f => ({ ...f, meta_description: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Body HTML</span>
                <textarea
                  rows={14}
                  className="ins-html-editor"
                  value={editForm.content_html}
                  onChange={e => setEditForm(f => ({ ...f, content_html: e.target.value }))}
                  placeholder="<p>…</p>"
                />
              </label>
              <div className="form-actions">
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save coverage page'}</Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
