import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

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

export default function AdminSubmissions() {
  const [tab, setTab] = useState('queue')
  const [rows, setRows] = useState([])
  const [notes, setNotes] = useState({})
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState(null)

  function load() {
    return api('/api/admin/center-submissions').then(setRows)
  }

  useEffect(() => {
    load().catch(e => setErr(e.message))
  }, [])

  const queue = rows.filter(r => r.status === 'pending')
  const history = rows.filter(r => r.status !== 'pending')
  const visible = tab === 'queue' ? queue : history

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
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const tone = s => (s === 'approved' ? 'ok' : s === 'rejected' ? 'err' : 'warn')

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Submission Center.</h1>
        <p className="page-sub">
          Review facilities submitted from the public “Submit Your Center” form.
        </p>
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="tabs-row">
        <button type="button" className={`tab-btn${tab === 'queue' ? ' active' : ''}`} onClick={() => setTab('queue')}>
          Queue
          {queue.length > 0 && <span className="tab-count">{queue.length}</span>}
        </button>
        <button type="button" className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <p className="muted">{tab === 'queue' ? 'No pending submissions.' : 'No reviewed submissions yet.'}</p>
        </Card>
      ) : (
        visible.map(row => (
          <Card key={row.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <p className="eyebrow">SUBMISSION #{row.id}</p>
                <h3 style={{ margin: '4px 0 8px' }}>{row.center_name}</h3>
                <p className="muted" style={{ margin: 0 }}>{row.location_display}</p>
              </div>
              <Badge tone={tone(row.status)}>{row.status}</Badge>
            </div>

            <div className="form-grid-2" style={{ marginTop: 16 }}>
              <div>
                <p className="eyebrow">CONTACT</p>
                <p style={{ margin: '4px 0' }}><strong>{row.full_name}</strong></p>
                <p style={{ margin: '4px 0' }}><a href={`mailto:${row.email}`}>{row.email}</a></p>
                <p style={{ margin: '4px 0' }}><a href={`tel:${row.phone}`}>{row.phone}</a></p>
                <p className="muted" style={{ margin: '8px 0 0' }}>Submitted {formatDate(row.created_at)}</p>
              </div>
              <div>
                <p className="eyebrow">ADDRESS</p>
                <p style={{ margin: '4px 0' }}>{row.address_line}</p>
                <p style={{ margin: '4px 0' }}>{row.city}, {row.state} {row.zip || ''}</p>
              </div>
              <div className="form-span-2">
                <p className="eyebrow">SERVICES</p>
                <p style={{ margin: '4px 0' }}>{(row.services || []).join(', ') || '—'}</p>
              </div>
              <div className="form-span-2">
                <p className="eyebrow">INSURANCE</p>
                <p style={{ margin: '4px 0' }}>{(row.insurances || []).join(', ') || '—'}</p>
              </div>
              <div className="form-span-2">
                <p className="eyebrow">DESCRIPTION</p>
                <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{row.description || '—'}</p>
              </div>
            </div>

            {row.status === 'pending' ? (
              <div style={{ marginTop: 16 }}>
                <label>
                  Admin notes
                  <textarea
                    rows={2}
                    value={notes[row.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))}
                    placeholder="Optional notes for the submitter"
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <Button type="button" disabled={busyId === row.id} onClick={() => review(row.id, 'approved', { publish: true })}>
                    Approve & publish
                  </Button>
                  <Button type="button" variant="ghost" disabled={busyId === row.id} onClick={() => review(row.id, 'approved')}>
                    Approve as draft
                  </Button>
                  <Button type="button" variant="ghost" disabled={busyId === row.id} onClick={() => review(row.id, 'rejected')}>
                    Reject
                  </Button>
                  <Button type="button" variant="ghost" disabled={busyId === row.id} onClick={() => remove(row.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {row.admin_notes && <p className="muted" style={{ margin: 0 }}>Notes: {row.admin_notes}</p>}
                {row.rehab_center_id && (
                  <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${row.rehab_center_id}/edit`}>
                    Edit center
                  </Button>
                )}
                <Button type="button" className="btn btn-ghost btn-sm" disabled={busyId === row.id} onClick={() => remove(row.id)}>
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
