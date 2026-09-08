import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './ServiceCodes.css'

const emptyForm = {
  category_code: '',
  category_name: '',
  service_code: '',
  service_name: '',
  service_description: '',
  enabled: true,
}

export default function AdminServiceCodes() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const data = await api('/api/admin/service-codes')
    setRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      if (!map.has(row.category_code)) {
        map.set(row.category_code, row.category_name)
      }
    }
    return [...map.entries()].map(([code, name]) => ({ code, name }))
  }, [rows])

  const enabledCount = useMemo(() => rows.filter(r => r.enabled).length, [rows])
  const disabledCount = rows.length - enabledCount

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (filter === 'enabled' && !row.enabled) return false
      if (filter === 'disabled' && row.enabled) return false
      if (category !== 'all' && row.category_code !== category) return false
      if (!q) return true
      return (
        row.service_code.toLowerCase().includes(q)
        || row.service_name.toLowerCase().includes(q)
        || row.category_name.toLowerCase().includes(q)
        || (row.service_description || '').toLowerCase().includes(q)
      )
    })
  }, [rows, query, filter, category])

  function openCreate() {
    setCreating(true)
    setEditing(null)
    setForm(emptyForm)
    setErr('')
    setMsg('')
  }

  function openEditor(row) {
    setCreating(false)
    setEditing(row)
    setForm({
      category_code: row.category_code || '',
      category_name: row.category_name || '',
      service_code: row.service_code || '',
      service_name: row.service_name || '',
      service_description: row.service_description || '',
      enabled: Boolean(row.enabled),
    })
    setErr('')
    setMsg('')
  }

  function closeEditor() {
    setEditing(null)
    setCreating(false)
    setForm(emptyForm)
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      if (creating) {
        const created = await api('/api/admin/service-codes', {
          method: 'POST',
          body: JSON.stringify(form),
        })
        setRows(list => [...list, created].sort((a, b) => a.sort_order - b.sort_order || a.service_name.localeCompare(b.service_name)))
        setMsg(`Added ${created.service_code}.`)
        closeEditor()
      } else if (editing) {
        const updated = await api(`/api/admin/service-codes/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
        setRows(list => list.map(r => (r.id === updated.id ? updated : r)))
        setEditing(updated)
        setMsg(`Saved ${updated.service_code}.`)
      }
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row) {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/service-codes/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      })
      setRows(list => list.map(r => (r.id === updated.id ? updated : r)))
      setMsg(`${updated.service_code} ${updated.enabled ? 'enabled' : 'disabled'}.`)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.service_code} from the catalog? Centers already using it will keep the stored code until they save again.`)) {
      return
    }
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await api(`/api/admin/service-codes/${row.id}`, { method: 'DELETE' })
      setRows(list => list.filter(r => r.id !== row.id))
      if (editing?.id === row.id) closeEditor()
      setMsg(`Deleted ${row.service_code}.`)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function bulk(enabled) {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await api('/api/admin/service-codes/bulk', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      })
      await load()
      setMsg(enabled ? 'All service codes enabled.' : 'All service codes disabled.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function seedCatalog() {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const result = await api('/api/admin/service-codes/seed', { method: 'POST' })
      await load()
      const created = result?.created ?? 0
      const total = result?.total ?? 0
      setMsg(
        created > 0
          ? `Catalog seeded — ${created} added (${total} total).`
          : `Catalog refreshed — ${total} codes ready.`,
      )
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  const emptyCatalog = !loading && rows.length === 0
  const emptyFilter = !loading && rows.length > 0 && visible.length === 0
  const panelOpen = creating || Boolean(editing)

  return (
    <div className="page-stack">
      <header className="page-header sc-header">
        <div>
          <h1 className="page-title">Service codes.</h1>
          <p className="page-sub">
            SAMHSA-style codes for every rehab listing. Enable, edit, or add codes, then assign them on each center’s Services tab.
          </p>
        </div>
        {!loading && rows.length > 0 && (
          <p className="sc-counts muted">
            <strong>{enabledCount}</strong> enabled · <strong>{disabledCount}</strong> disabled · <strong>{categories.length}</strong> categories
          </p>
        )}
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="sc-toolbar">
        <div className="sc-toolbar-actions">
          <Button type="button" disabled={busy || loading} onClick={openCreate}>
            Add code
          </Button>
          <Button type="button" disabled={busy || loading || emptyCatalog} onClick={() => bulk(true)}>
            Enable all
          </Button>
          <Button type="button" variant="ghost" disabled={busy || loading || emptyCatalog} onClick={() => bulk(false)}>
            Disable all
          </Button>
          <Button type="button" variant="secondary" disabled={busy || loading} onClick={seedCatalog}>
            {emptyCatalog ? 'Seed catalog' : 'Refresh from CSV'}
          </Button>
        </div>
        {!emptyCatalog && (
          <label className="sc-search">
            <span className="sr-only">Search service codes</span>
            <input
              type="search"
              placeholder="Search code, name, or category…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={loading}
            />
          </label>
        )}
      </div>

      {!emptyCatalog && (
        <div className="tabs-row">
          <button type="button" className={`tab-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
            All
            <span className="tab-count">{rows.length}</span>
          </button>
          <button type="button" className={`tab-btn${filter === 'enabled' ? ' active' : ''}`} onClick={() => setFilter('enabled')}>
            Enabled
            <span className="tab-count">{enabledCount}</span>
          </button>
          <button type="button" className={`tab-btn${filter === 'disabled' ? ' active' : ''}`} onClick={() => setFilter('disabled')}>
            Disabled
            <span className="tab-count">{disabledCount}</span>
          </button>
          <label className="sc-category-filter">
            <span className="sr-only">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map(item => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className={`sc-layout${panelOpen ? ' sc-layout--split' : ''}`}>
        <Card className="card-pad-0">
          {loading ? (
            <p className="muted sc-empty">Loading service-code catalog…</p>
          ) : emptyCatalog ? (
            <div className="sc-empty-state">
              <p className="sc-empty-title">No service codes yet</p>
              <p className="muted">
                Seed the SAMHSA reference list (type of care, settings, pharmacotherapies, payment, languages, and more) so every center can select them.
              </p>
              <Button type="button" disabled={busy} onClick={seedCatalog}>
                {busy ? 'Seeding…' : 'Seed service-code catalog'}
              </Button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr
                      key={row.id}
                      className={`${row.enabled ? '' : 'sc-row-off'}${editing?.id === row.id ? ' sc-row-active' : ''}`.trim()}
                    >
                      <td><code>{row.service_code}</code></td>
                      <td>
                        <strong>{row.service_name}</strong>
                        {row.service_description && (
                          <div className="muted sc-row-desc">{row.service_description}</div>
                        )}
                      </td>
                      <td>
                        <div>{row.category_name}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{row.category_code}</div>
                      </td>
                      <td>
                        <span className={`badge ${row.enabled ? 'badge-ok' : 'badge-warn'}`}>
                          {row.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="sc-row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => openEditor(row)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggle(row)}>
                          {row.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(row)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {emptyFilter && (
                    <tr>
                      <td colSpan={5} className="muted" style={{ padding: 24 }}>
                        No codes match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {panelOpen && (
          <Card className="sc-editor">
            <div className="sc-editor-head">
              <div>
                <p className="eyebrow">{creating ? 'New code' : 'Edit code'}</p>
                <h2 className="sc-editor-title">{creating ? 'Add service code' : editing.service_code}</h2>
              </div>
              <Button type="button" variant="ghost" onClick={closeEditor}>Close</Button>
            </div>
            <form className="form-stack" onSubmit={save}>
              <div className="form-grid-2">
                <label className="field">
                  <span className="field-label">Category code</span>
                  <input
                    value={form.category_code}
                    onChange={e => setForm(f => ({ ...f, category_code: e.target.value }))}
                    required
                    maxLength={16}
                    placeholder="TC"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Category name</span>
                  <input
                    value={form.category_name}
                    onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                    required
                    placeholder="Type of Care"
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Service code</span>
                <input
                  value={form.service_code}
                  onChange={e => setForm(f => ({ ...f, service_code: e.target.value }))}
                  required
                  maxLength={40}
                  placeholder="SA"
                />
              </label>
              <label className="field">
                <span className="field-label">Service name</span>
                <input
                  value={form.service_name}
                  onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
                  required
                  placeholder="Substance use treatment"
                />
              </label>
              <label className="field">
                <span className="field-label">Description</span>
                <textarea
                  rows={5}
                  value={form.service_description}
                  onChange={e => setForm(f => ({ ...f, service_description: e.target.value }))}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                />
                Enabled for listing pickers
              </label>
              <div className="form-actions">
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : creating ? 'Add code' : 'Save code'}</Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
