import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './Submissions.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function tone(status) {
  if (status === 'approved') return 'ok'
  if (status === 'rejected' || status === 'abandoned') return 'err'
  return 'warn'
}

function matchesQuery(row, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const blob = [
    row.id,
    row.center_name,
    row.full_name,
    row.email,
    row.phone,
    row.city,
    row.state,
    row.zip,
    row.address_line,
    row.location_display,
    row.status,
    ...(row.services || []),
    ...(row.insurances || []),
    row.description,
    row.admin_notes,
  ].filter(Boolean).join(' ').toLowerCase()
  return blob.includes(q)
}

function SubmissionDetailModal({
  row,
  notes,
  setNotes,
  busyId,
  onClose,
  onReview,
  onRemove,
}) {
  if (!row) return null
  const busy = busyId === row.id
  const pending = row.status === 'pending'

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="card modal-card sub-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-detail-title"
      >
        <div className="sub-modal-head">
          <div>
            <p className="eyebrow">Submission #{row.id}</p>
            <h2 id="submission-detail-title" className="sub-modal-title">{row.center_name}</h2>
            <p className="muted" style={{ margin: 0 }}>{row.location_display || '—'}</p>
          </div>
          <div className="sub-modal-head-actions">
            <Badge tone={tone(row.status)}>{row.status}</Badge>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        <div className="sub-detail-grid">
          <section>
            <p className="eyebrow">Contact</p>
            <p style={{ margin: '4px 0' }}><strong>{row.full_name}</strong></p>
            <p style={{ margin: '4px 0' }}><a href={`mailto:${row.email}`}>{row.email}</a></p>
            <p style={{ margin: '4px 0' }}><a href={`tel:${row.phone}`}>{row.phone}</a></p>
            <p className="muted" style={{ margin: '8px 0 0' }}>Submitted {formatDate(row.created_at)}</p>
            {row.reviewed_at && (
              <p className="muted" style={{ margin: '4px 0 0' }}>Reviewed {formatDate(row.reviewed_at)}</p>
            )}
          </section>

          <section>
            <p className="eyebrow">Address</p>
            <p style={{ margin: '4px 0' }}>{row.address_line || '—'}</p>
            <p style={{ margin: '4px 0' }}>
              {[row.city, row.state].filter(Boolean).join(', ')}
              {row.zip ? ` ${row.zip}` : ''}
            </p>
          </section>

          <section className="sub-detail-span">
            <p className="eyebrow">Services</p>
            <p style={{ margin: '4px 0' }}>{(row.services || []).join(', ') || '—'}</p>
          </section>

          <section className="sub-detail-span">
            <p className="eyebrow">Insurance</p>
            <p style={{ margin: '4px 0' }}>{(row.insurances || []).join(', ') || '—'}</p>
          </section>

          <section className="sub-detail-span">
            <p className="eyebrow">Description</p>
            <p className="sub-description">{row.description || '—'}</p>
          </section>

          {row.admin_notes && !pending && (
            <section className="sub-detail-span">
              <p className="eyebrow">Admin notes</p>
              <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{row.admin_notes}</p>
            </section>
          )}
        </div>

        {pending ? (
          <div className="sub-modal-actions">
            <label className="field">
              <span className="field-label">Admin notes</span>
              <textarea
                rows={3}
                value={notes[row.id] || ''}
                onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))}
                placeholder="Optional notes for the submitter"
              />
            </label>
            <div className="sub-action-row">
              <Button type="button" disabled={busy} onClick={() => onReview(row.id, 'approved', { publish: true })}>
                Approve & publish
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onReview(row.id, 'approved')}>
                Approve as draft
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onReview(row.id, 'rejected')}>
                Reject
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onRemove(row.id)}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="sub-action-row">
            {row.rehab_center_id && (
              <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${row.rehab_center_id}/edit`}>
                Edit center
              </Button>
            )}
            <Button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRemove(row.id)}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminSubmissions() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [notes, setNotes] = useState({})
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState(null)

  function load() {
    return api('/api/admin/center-submissions').then(setRows)
  }

  useEffect(() => {
    load().catch(e => setErr(e.message))
  }, [])

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    abandoned: rows.filter(r => r.status === 'abandoned').length,
  }), [rows])

  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      return matchesQuery(row, query)
    })
  }, [rows, statusFilter, query])

  const viewingRow = viewing ? rows.find(r => r.id === viewing) || null : null

  async function review(id, status, { publish = false } = {}) {
    setBusyId(id)
    setErr('')
    setMsg('')
    try {
      await api(`/api/admin/center-submissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          admin_notes: notes[id] || '',
          create_center: status === 'approved',
          publish: status === 'approved' && publish,
        }),
      })
      setMsg(status === 'approved' ? 'Submission approved.' : 'Submission rejected.')
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this submission permanently?')) return
    setBusyId(id)
    setErr('')
    try {
      await api(`/api/admin/center-submissions/${id}`, { method: 'DELETE' })
      setMsg('Submission deleted.')
      if (viewing === id) setViewing(null)
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['abandoned', 'Abandoned'],
  ]

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Submission Center.</h1>
        <p className="page-sub">
          Contact submissions from the public “Submit Your Center” form — search, view details, and take action.
        </p>
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="sub-toolbar">
        <div className="tabs-row">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab-btn${statusFilter === id ? ' active' : ''}`}
              onClick={() => setStatusFilter(id)}
            >
              {label}
              {counts[id] > 0 && <span className="tab-count">{counts[id]}</span>}
            </button>
          ))}
        </div>

        <label className="sub-search">
          <span className="sr-only">Search submissions</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by center, contact, email, city…"
            aria-label="Search submissions"
          />
        </label>
      </div>

      <Card className="card-pad-0">
        <div className="table-wrap">
          <table className="sub-table">
            <thead>
              <tr>
                <th>Center</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 24 }}>
                    {rows.length === 0
                      ? 'No submissions yet.'
                      : 'No submissions match your search or filter.'}
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.center_name}</strong>
                    <div className="muted sub-id">#{row.id}</div>
                  </td>
                  <td>{row.full_name}</td>
                  <td>
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </td>
                  <td>
                    <a href={`tel:${row.phone}`}>{row.phone}</a>
                  </td>
                  <td>{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                  <td><Badge tone={tone(row.status)}>{row.status}</Badge></td>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <div className="sub-row-actions">
                      <Button type="button" variant="link" size="sm" onClick={() => setViewing(row.id)}>
                        View
                      </Button>
                      {row.status === 'pending' && (
                        <>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => review(row.id, 'approved', { publish: true })}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => review(row.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {row.rehab_center_id && (
                        <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${row.rehab_center_id}/edit`}>
                          Edit center
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => remove(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {viewingRow && (
        <SubmissionDetailModal
          row={viewingRow}
          notes={notes}
          setNotes={setNotes}
          busyId={busyId}
          onClose={() => setViewing(null)}
          onReview={review}
          onRemove={remove}
        />
      )}
    </div>
  )
}
