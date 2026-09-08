import { useEffect, useMemo, useState } from 'react'
import { api, apiBlob } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const SOURCE_FILTERS = [
  ['', 'All'],
  ['registration', 'Registration'],
  ['claim', 'Claim'],
  ['new_center', 'New center'],
  ['abandonment_claim', 'Abandon claim'],
  ['abandonment_submit', 'Abandon submit'],
  ['manual', 'Manual'],
]

const AUTO_SOURCE_OPTIONS = SOURCE_FILTERS.filter(([id]) => id)

function sourceLabel(source) {
  return SOURCE_FILTERS.find(([id]) => id === source)?.[1] || source || '—'
}

function mailchimpAudienceLabel(list, audiences) {
  if (!list?.mailchimp_enabled) return ''
  const id = list.mailchimp_audience_id || ''
  const match = (audiences || []).find(a => a.id === id)
  if (match?.name) return match.name
  if (id) return id
  return 'default audience'
}

function contactMailchimpState(row) {
  const syncLists = (row.lists || []).filter(l => l.mailchimp_enabled)
  const membershipSynced = syncLists.some(l => l.synced_at)
  if (syncLists.length && (row.mailchimp_synced_at || membershipSynced)) return 'synced'
  if (syncLists.length) return 'pending'
  return 'local'
}

function MailchimpLegend() {
  return (
    <div
      className="card card-flat"
      style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center' }}
    >
      <p className="eyebrow" style={{ margin: 0 }}>Legend</p>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Badge tone="info">Syncs to Mailchimp</Badge>
        <span className="muted">list is connected and will push contacts</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Badge tone="info">Synced</Badge>
        <span className="muted">this contact was sent to Mailchimp</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Badge tone="warn">Pending sync</Badge>
        <span className="muted">on a Mailchimp list, not pushed yet</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Badge tone="neutral">Local only</Badge>
        <span className="muted">not connected to Mailchimp</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Badge tone="neutral">System</Badge>
        <span className="muted">built-in auto list</span>
      </span>
    </div>
  )
}

function ContactMailchimpLabel({ row }) {
  const state = contactMailchimpState(row)
  const syncLists = (row.lists || []).filter(l => l.mailchimp_enabled)
  const names = syncLists.map(l => l.name).join(', ')
  if (state === 'synced') {
    return (
      <>
        <Badge tone="info">Synced</Badge>
        {names ? <span className="muted" style={{ display: 'block', fontSize: 12 }}>{names}</span> : null}
      </>
    )
  }
  if (state === 'pending') {
    return (
      <>
        <Badge tone="warn">Pending sync</Badge>
        {names ? <span className="muted" style={{ display: 'block', fontSize: 12 }}>{names}</span> : null}
      </>
    )
  }
  return <Badge tone="neutral">Local only</Badge>
}

function emptyListForm() {
  return {
    name: '',
    description: '',
    auto_sources: [],
    mailchimp_enabled: false,
    mailchimp_audience_id: '',
    mailchimp_tag: '',
  }
}

export default function AdminEmailList({ embedded = false }) {
  const [data, setData] = useState({ total: 0, counts: {}, items: [], lists: [] })
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState(null)
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [audiences, setAudiences] = useState([])
  const [form, setForm] = useState({ email: '', name: '', phone: '', center_name: '', source: 'manual', list_ids: [] })
  const [listForm, setListForm] = useState(emptyListForm())
  const [newListName, setNewListName] = useState('')

  const selectedList = lists.find(l => l.id === selectedListId) || null

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (source) params.set('source', source)
    if (status) params.set('status', status)
    if (selectedListId) params.set('list_id', String(selectedListId))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [q, source, status, selectedListId])

  function loadLists() {
    return api('/api/admin/mailing-lists').then(setLists)
  }

  function load() {
    return api(`/api/admin/email-list${query}`).then(res => {
      setData(res)
      if (res.lists) setLists(res.lists)
    })
  }

  useEffect(() => {
    setErr('')
    load().catch(e => setErr(e.message))
  }, [query])

  useEffect(() => {
    api('/api/admin/email-settings/mailchimp/audiences')
      .then(res => setAudiences(res.items || []))
      .catch(() => setAudiences([]))
  }, [])

  useEffect(() => {
    if (!selectedList) {
      setListForm(emptyListForm())
      return
    }
    setListForm({
      name: selectedList.name || '',
      description: selectedList.description || '',
      auto_sources: selectedList.auto_sources || [],
      mailchimp_enabled: !!selectedList.mailchimp_enabled,
      mailchimp_audience_id: selectedList.mailchimp_audience_id || '',
      mailchimp_tag: selectedList.mailchimp_tag || '',
    })
  }, [selectedListId, selectedList?.updated_at])

  async function exportCsv() {
    setBusy(true)
    setErr('')
    try {
      const { blob, filename } = await apiBlob(`/api/admin/email-list/export${query}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'swa-email-list.csv'
      a.click()
      URL.revokeObjectURL(url)
      setMsg(`Exported ${data.total} contact${data.total === 1 ? '' : 's'}.`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function rebuild() {
    if (!confirm('Import existing registrations, claims, new-center submissions, and abandonment leads into these lists?')) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const res = await api('/api/admin/email-list/rebuild', { method: 'POST' })
      setMsg(`Imported or updated ${res.upserted} record${res.upserted === 1 ? '' : 's'}. ${res.total} contacts total.`)
      await load()
      await loadLists()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function createList(e) {
    e?.preventDefault()
    const name = (newListName || listForm.name || '').trim()
    if (!name) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const created = await api('/api/admin/mailing-lists', {
        method: 'POST',
        body: JSON.stringify({ name, description: '', auto_sources: [] }),
      })
      setNewListName('')
      await loadLists()
      setSelectedListId(created.id)
      setMsg(`Created list “${created.name}”.`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveList(e) {
    e.preventDefault()
    if (!selectedListId) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/mailing-lists/${selectedListId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: listForm.name,
          description: listForm.description,
          auto_sources: listForm.auto_sources,
          mailchimp_enabled: !!listForm.mailchimp_enabled,
          mailchimp_audience_id: listForm.mailchimp_audience_id || null,
          mailchimp_tag: listForm.mailchimp_tag || null,
        }),
      })
      setMsg(`Saved “${updated.name}”.`)
      await loadLists()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteList() {
    if (!selectedList || selectedList.is_system) return
    if (!confirm(`Delete list “${selectedList.name}”? Contacts stay in the pool.`)) return
    setBusy(true)
    setErr('')
    try {
      await api(`/api/admin/mailing-lists/${selectedList.id}`, { method: 'DELETE' })
      setSelectedListId(null)
      setMsg('List deleted.')
      await loadLists()
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function pingList() {
    if (!selectedListId) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const res = await api(`/api/admin/mailing-lists/${selectedListId}/ping`, { method: 'POST' })
      setMsg(`Connected: ${res.list_name || res.list_id}${res.member_count != null ? ` · ${res.member_count} members` : ''}`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function syncList() {
    if (!selectedListId) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const res = await api(`/api/admin/mailing-lists/${selectedListId}/sync`, { method: 'POST' })
      setMsg(`Synced ${res.synced} of ${res.total} to Mailchimp${res.failed ? ` · ${res.failed} failed` : ''}.`)
      await load()
      await loadLists()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function setContactStatus(row, next) {
    setErr('')
    try {
      await api(`/api/admin/email-list/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      await load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function removeContact(row) {
    if (selectedListId) {
      if (!confirm(`Remove ${row.email} from this list?`)) return
      setErr('')
      try {
        await api(`/api/admin/mailing-lists/${selectedListId}/members/${row.id}`, { method: 'DELETE' })
        await load()
        await loadLists()
      } catch (e) {
        setErr(e.message)
      }
      return
    }
    if (!confirm(`Remove ${row.email} from the contact pool?`)) return
    setErr('')
    try {
      await api(`/api/admin/email-list/${row.id}`, { method: 'DELETE' })
      await load()
      await loadLists()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function assignLists(row, listIds) {
    setErr('')
    try {
      await api(`/api/admin/email-list/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ list_ids: listIds }),
      })
      await load()
      await loadLists()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function addContact(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const listIds = selectedListId ? [selectedListId] : form.list_ids
      await api('/api/admin/email-list', {
        method: 'POST',
        body: JSON.stringify({ ...form, list_ids: listIds }),
      })
      setForm({ email: '', name: '', phone: '', center_name: '', source: 'manual', list_ids: selectedListId ? [selectedListId] : [] })
      setAddOpen(false)
      setMsg('Contact saved.')
      await load()
      await loadLists()
    } catch (err) {
      setErr(err.message)
    } finally {
      setBusy(false)
    }
  }

  function toggleAutoSource(id) {
    setListForm(f => ({
      ...f,
      auto_sources: f.auto_sources.includes(id)
        ? f.auto_sources.filter(s => s !== id)
        : [...f.auto_sources, id],
    }))
  }

  const counts = data.counts || {}

  return (
    <div className={embedded ? '' : 'page-stack'}>
      {!embedded && (
        <header className="page-header">
          <h1 className="page-title">Email lists.</h1>
          <p className="page-sub">
            Create named lists, assign contacts, and connect each list to a Mailchimp audience.
          </p>
        </header>
      )}
      {embedded && (
        <p className="muted" style={{ marginBottom: 12 }}>
          Create named lists, assign contacts, and connect each list to a Mailchimp audience.
        </p>
      )}

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <MailchimpLegend />

      <div className="form-grid-2" style={{ alignItems: 'start', gap: 20 }}>
        <Card>
          <p className="eyebrow">Lists</p>
          <form onSubmit={createList} className="form-actions" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="New list name"
              style={{ minWidth: 0, flex: 1 }}
            />
            <Button type="submit" disabled={busy || !newListName.trim()}>Create list</Button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className={`tab-btn${selectedListId == null ? ' active' : ''}`}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => setSelectedListId(null)}
            >
              <span>
                <strong>All contacts</strong>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {selectedListId == null ? `${data.total} in this view` : 'Full contact pool'}
                </span>
              </span>
            </button>
            {lists.map(list => (
              <button
                key={list.id}
                type="button"
                className={`tab-btn${selectedListId === list.id ? ' active' : ''}`}
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                onClick={() => setSelectedListId(list.id)}
              >
                <span>
                  <strong>{list.name}</strong>
                  {' '}
                  {list.mailchimp_enabled
                    ? <Badge tone="info">Syncs to Mailchimp</Badge>
                    : <Badge tone="neutral">Local only</Badge>}
                  {list.is_system ? <>{' '}<Badge tone="neutral">System</Badge></> : null}
                  <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                    {list.member_count} contact{list.member_count === 1 ? '' : 's'}
                    {list.mailchimp_enabled
                      ? ` · ${mailchimpAudienceLabel(list, audiences)}`
                      : ''}
                    {list.auto_sources?.length ? ` · auto: ${list.auto_sources.join(', ')}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedList && (
            <form className="card card-flat" onSubmit={saveList}>
              <p className="eyebrow">Manage list</p>
              <p style={{ margin: '0 0 12px' }}>
                {listForm.mailchimp_enabled
                  ? <Badge tone="info">Syncs to Mailchimp</Badge>
                  : <Badge tone="neutral">Local only</Badge>}
                {selectedList.is_system ? <>{' '}<Badge tone="neutral">System</Badge></> : null}
                {listForm.mailchimp_enabled && (
                  <span className="muted" style={{ marginLeft: 8 }}>
                    Audience: {mailchimpAudienceLabel({ ...selectedList, mailchimp_enabled: true, mailchimp_audience_id: listForm.mailchimp_audience_id }, audiences)}
                  </span>
                )}
              </p>
              <label>Name</label>
              <input
                value={listForm.name}
                onChange={e => setListForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <label>Description</label>
              <input
                value={listForm.description}
                onChange={e => setListForm(f => ({ ...f, description: e.target.value }))}
              />
              <p className="muted" style={{ marginTop: 8 }}>Auto-assign contacts from these events:</p>
              {AUTO_SOURCE_OPTIONS.map(([id, label]) => (
                <label key={id} style={{ display: 'block', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={listForm.auto_sources.includes(id)}
                    onChange={() => toggleAutoSource(id)}
                  />{' '}
                  {label}
                </label>
              ))}

              <p className="eyebrow" style={{ marginTop: 16 }}>Mailchimp</p>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={!!listForm.mailchimp_enabled}
                  onChange={e => setListForm(f => ({ ...f, mailchimp_enabled: e.target.checked }))}
                />{' '}
                Sync this list to Mailchimp
              </label>
              <label>Audience</label>
              {audiences.length > 0 ? (
                <select
                  value={listForm.mailchimp_audience_id}
                  onChange={e => setListForm(f => ({ ...f, mailchimp_audience_id: e.target.value }))}
                >
                  <option value="">Use default audience from Settings</option>
                  {audiences.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.member_count != null ? ` (${a.member_count})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={listForm.mailchimp_audience_id}
                  onChange={e => setListForm(f => ({ ...f, mailchimp_audience_id: e.target.value }))}
                  placeholder="Audience / list ID (or leave blank for Settings default)"
                />
              )}
              <label>Mailchimp tag</label>
              <input
                value={listForm.mailchimp_tag}
                onChange={e => setListForm(f => ({ ...f, mailchimp_tag: e.target.value }))}
                placeholder="e.g. swa-registrations"
              />
              <p className="muted" style={{ marginTop: 6 }}>
                Uses the Mailchimp API key from Settings. Save, then test or sync.
              </p>
              <div className="form-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={busy}>Save list</Button>
                <Button type="button" variant="ghost" onClick={pingList} disabled={busy}>Test connection</Button>
                <Button type="button" variant="ghost" onClick={syncList} disabled={busy || !listForm.mailchimp_enabled}>
                  Sync list to Mailchimp
                </Button>
                {!selectedList.is_system && (
                  <Button type="button" variant="ghost" onClick={deleteList} disabled={busy}>Delete list</Button>
                )}
              </div>
            </form>
          )}

          <div className="form-actions" style={{ flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search email, name, or center"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All statuses</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            <Button type="button" onClick={exportCsv} disabled={busy}>Export CSV</Button>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(o => !o)} disabled={busy}>
              {addOpen ? 'Cancel' : selectedList ? 'Add to this list' : 'Add contact'}
            </Button>
            <Button type="button" variant="ghost" onClick={rebuild} disabled={busy}>
              Import existing records
            </Button>
          </div>

          <div className="tabs-row" style={{ flexWrap: 'wrap' }}>
            {SOURCE_FILTERS.map(([id, label]) => (
              <button
                key={id || 'all'}
                type="button"
                className={`tab-btn${source === id ? ' active' : ''}`}
                onClick={() => setSource(id)}
              >
                {label}
                {counts[id || 'all'] != null ? ` (${counts[id || 'all']})` : ''}
              </button>
            ))}
          </div>

          {addOpen && (
            <form className="card card-flat" onSubmit={addContact}>
              <p className="eyebrow">{selectedList ? `Add to ${selectedList.name}` : 'Add contact'}</p>
              {selectedList && (
                <p className="muted" style={{ marginTop: 0 }}>
                  {selectedList.mailchimp_enabled
                    ? `This list syncs to Mailchimp (${mailchimpAudienceLabel(selectedList, audiences)}).`
                    : 'This list is local only and will not sync to Mailchimp.'}
                </p>
              )}
              <div className="form-grid-2">
                <div>
                  <label>Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label>Center</label>
                  <input value={form.center_name} onChange={e => setForm(f => ({ ...f, center_name: e.target.value }))} />
                </div>
              </div>
              {!selectedList && lists.length > 0 && (
                <>
                  <label style={{ marginTop: 8 }}>Assign to lists</label>
                  {lists.map(list => (
                    <label key={list.id} style={{ display: 'block', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.list_ids.includes(list.id)}
                        onChange={() => setForm(f => ({
                          ...f,
                          list_ids: f.list_ids.includes(list.id)
                            ? f.list_ids.filter(id => id !== list.id)
                            : [...f.list_ids, list.id],
                        }))}
                      />{' '}
                      {list.name}
                      {list.mailchimp_enabled ? ' · syncs to Mailchimp' : ' · local only'}
                    </label>
                  ))}
                </>
              )}
              <div className="form-actions" style={{ marginTop: 12 }}>
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save contact'}</Button>
              </div>
            </form>
          )}

          <Card className="card-pad-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Lists</th>
                    <th>Mailchimp</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="muted" style={{ padding: 24 }}>
                        {selectedList
                          ? 'No contacts on this list yet. Add someone or turn on auto-assign.'
                          : 'No contacts yet. Create a list, import existing records, or add a contact.'}
                      </td>
                    </tr>
                  ) : data.items.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.email}</strong>
                      </td>
                      <td>{row.name || '—'}</td>
                      <td>
                        <select
                          multiple
                          value={(row.list_ids || []).map(String)}
                          onChange={e => {
                            const ids = Array.from(e.target.selectedOptions).map(o => Number(o.value))
                            assignLists(row, ids)
                          }}
                          title="Hold Ctrl or ⌘ to assign multiple lists"
                          style={{ minWidth: 160, minHeight: 64 }}
                        >
                          {lists.map(list => (
                            <option key={list.id} value={list.id}>
                              {list.name}{list.mailchimp_enabled ? ' · syncs to Mailchimp' : ' · local only'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <ContactMailchimpLabel row={row} />
                      </td>
                      <td>{sourceLabel(row.source)}</td>
                      <td>
                        <Badge tone={row.status === 'subscribed' ? 'info' : 'neutral'}>{row.status}</Badge>
                      </td>
                      <td>{row.last_event_at ? new Date(row.last_event_at).toLocaleString() : '—'}</td>
                      <td>
                        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                          {row.status === 'subscribed' ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setContactStatus(row, 'unsubscribed')}>
                              Unsubscribe
                            </Button>
                          ) : (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setContactStatus(row, 'subscribed')}>
                              Resubscribe
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(row)}>
                            {selectedListId ? 'Remove from list' : 'Remove'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
