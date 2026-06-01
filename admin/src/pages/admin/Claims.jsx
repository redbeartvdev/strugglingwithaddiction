import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminClaims() {
  const [tab, setTab] = useState('queue')
  const [claims, setClaims] = useState([])
  const [claimedClients, setClaimedClients] = useState([])
  const [notes, setNotes] = useState({})
  const [passwords, setPasswords] = useState({})

  const loadClaims = () => api('/api/admin/claims').then(setClaims)
  const loadClaimed = () => api('/api/admin/claimed-clients').then(setClaimedClients)

  useEffect(() => {
    loadClaims()
    loadClaimed()
  }, [])

  async function review(id, status) {
    await api(`/api/admin/claims/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        admin_notes: notes[id] || '',
        create_client_user: status === 'approved',
        client_password: passwords[id] || 'TempPass123!',
      }),
    })
    loadClaims()
    loadClaimed()
  }

  const badgeTone = s => (s === 'approved' ? 'ok' : s === 'rejected' ? 'err' : 'warn')

  const queueClaims = claims.filter(c => c.status === 'pending' || c.status === 'under_review')
  const historyClaims = claims.filter(c => c.status === 'approved' || c.status === 'rejected')
  const visibleClaims = tab === 'queue' ? queueClaims : tab === 'history' ? historyClaims : []

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Claims.</h1>
        <p className="page-sub">
          {tab === 'claimed'
            ? `${claimedClients.length} claimed center${claimedClients.length === 1 ? '' : 's'}`
            : tab === 'queue'
              ? `${queueClaims.length} awaiting review`
              : `${historyClaims.length} reviewed`}
        </p>
      </header>

      <div className="tabs-row">
        <button type="button" className={`tab-btn${tab === 'queue' ? ' active' : ''}`} onClick={() => setTab('queue')}>
          Queue
          {queueClaims.length > 0 && <span className="tab-count">{queueClaims.length}</span>}
        </button>
        <button type="button" className={`tab-btn${tab === 'claimed' ? ' active' : ''}`} onClick={() => setTab('claimed')}>
          Claimed clients
        </button>
        <button type="button" className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {tab === 'claimed' ? (
        <div className="card card-pad-0 table-wrap">
          <table>
            <thead>
              <tr>
                <th>Center</th>
                <th>Location</th>
                <th>Client</th>
                <th>Email</th>
                <th>Account</th>
                <th>Claimed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claimedClients.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No claimed centers yet.</td></tr>
              ) : (
                claimedClients.map(c => (
                  <tr key={c.rehab_center_id}>
                    <td><strong>{c.center_name}</strong></td>
                    <td>{c.location_display || '—'}</td>
                    <td>{c.client_name || '—'}</td>
                    <td>{c.client_email || '—'}</td>
                    <td>
                      {c.client_user_id == null ? (
                        <span className="muted">No account</span>
                      ) : (
                        <Badge tone={c.client_active ? 'ok' : 'warn'}>
                          {c.client_active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </td>
                    <td>{formatDate(c.claimed_at)}</td>
                    <td className="table-actions">
                      <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${c.rehab_center_id}/edit`}>Edit center</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : visibleClaims.length === 0 ? (
        <div className="card">
          <p className="muted">{tab === 'queue' ? 'No claims waiting for review.' : 'No reviewed claims yet.'}</p>
        </div>
      ) : (
        visibleClaims.map(c => (
          <div key={c.id} className="card">
            <div className="claim-item">
              <div>
                <strong style={{ fontSize: 'var(--text-sm)' }}>{c.ticket_number}</strong>
                <span style={{ marginLeft: 8 }}><Badge tone={badgeTone(c.status)}>{c.status}</Badge></span>
                <p className="claim-meta">{c.center_name}</p>
                <p className="claim-meta">{c.full_name} · {c.work_email}</p>
                {c.phone && <p className="claim-meta">{c.phone}</p>}
                <p className="muted" style={{ marginTop: 4 }}>{c.affiliation_text}</p>
                {c.admin_notes && <p className="muted" style={{ marginTop: 8 }}>Notes: {c.admin_notes}</p>}
                {c.reviewed_at && <p className="muted" style={{ marginTop: 4 }}>Reviewed {formatDate(c.reviewed_at)}</p>}
              </div>
            </div>
            {c.status === 'pending' && (
              <>
                <label>Notes</label>
                <textarea rows={2} value={notes[c.id] || ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} />
                <label>Temp password</label>
                <input value={passwords[c.id] || ''} onChange={e => setPasswords(p => ({ ...p, [c.id]: e.target.value }))} placeholder="TempPass123!" />
                <div className="form-actions form-actions-tight">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => review(c.id, 'approved')}>Approve</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => review(c.id, 'rejected')}>Reject</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => review(c.id, 'under_review')}>Review</button>
                </div>
              </>
            )}
            {c.status === 'under_review' && (
              <>
                <label>Notes</label>
                <textarea rows={2} value={notes[c.id] || ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} />
                <label>Temp password</label>
                <input value={passwords[c.id] || ''} onChange={e => setPasswords(p => ({ ...p, [c.id]: e.target.value }))} placeholder="TempPass123!" />
                <div className="form-actions form-actions-tight">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => review(c.id, 'approved')}>Approve</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => review(c.id, 'rejected')}>Reject</button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}
