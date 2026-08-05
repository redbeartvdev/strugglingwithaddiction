import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiBlob } from '../../api'
import { resolveMediaUrl } from '../../lib/mediaUrl'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Admin-facing status labels: pending | approved | disapproved */
function displayStatus(status) {
  if (status === 'rejected') return 'disapproved'
  if (status === 'certified' || status === 'approved') return 'approved'
  if (status === 'under_review' || status === 'pending') return 'pending'
  return status
}

function badgeTone(status) {
  const label = displayStatus(status)
  if (label === 'approved') return 'ok'
  if (label === 'disapproved') return 'err'
  return 'warn'
}

/** Map UI action → API ClaimStatus */
const STATUS_ACTION = {
  pending: 'pending',
  approved: 'certified',
  disapproved: 'rejected',
}

export default function AdminClaims() {
  const [tab, setTab] = useState('queue')
  const [claims, setClaims] = useState([])
  const [claimedClients, setClaimedClients] = useState([])
  const [notes, setNotes] = useState({})
  const [passwords, setPasswords] = useState({})
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const loadClaims = () => api('/api/admin/claims').then(setClaims)
  const loadClaimed = () => api('/api/admin/claimed-clients').then(setClaimedClients)

  useEffect(() => {
    loadClaims()
    loadClaimed()
  }, [])

  async function review(id, uiStatus) {
    const note = (notes[id] || '').trim()
    if (!note) {
      setError('Notes are required for every status change.')
      return
    }
    const status = STATUS_ACTION[uiStatus]
    if (!status) return
    setError('')
    setBusyId(id)
    try {
      await api(`/api/admin/claims/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          admin_notes: note,
          create_client_user: status === 'certified' || status === 'approved',
          client_password: passwords[id] || 'TempPass123!',
        }),
      })
      await Promise.all([loadClaims(), loadClaimed()])
    } catch (err) {
      setError(err.message || 'Failed to update claim')
    } finally {
      setBusyId(null)
    }
  }

  async function viewCertification(c) {
    setError('')
    const raw = c.business_license_url
    if (!raw) {
      setError('No certification uploaded for this claim.')
      return
    }
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      window.open(raw, '_blank', 'noopener,noreferrer')
      return
    }
    try {
      const { blob, filename } = await apiBlob(`/api/admin/claims/${c.id}/certification`)
      const objUrl = URL.createObjectURL(blob)
      const win = window.open(objUrl, '_blank', 'noopener,noreferrer')
      if (!win) {
        const a = document.createElement('a')
        a.href = objUrl
        a.download = filename || 'certification'
        a.rel = 'noopener'
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000)
    } catch (err) {
      const fallback = resolveMediaUrl(raw)
      if (fallback) {
        window.open(fallback, '_blank', 'noopener,noreferrer')
      } else {
        setError(err.message || 'Could not open certification upload')
      }
    }
  }

  const queueClaims = claims.filter(c => c.status === 'pending' || c.status === 'under_review')
  const historyClaims = claims.filter(c => ['approved', 'rejected', 'certified', 'abandoned'].includes(c.status))
  const visibleClaims = tab === 'queue' ? queueClaims : tab === 'history' ? historyClaims : []

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Claims.</h1>
        <p className="page-sub">
          Claimants pay subscription first, then upload certification. Approving a paid claim unlocks the listing; rejecting a paid claim cancels and refunds via Stripe.
          Status changes require notes.
        </p>
      </header>

      {error && (
        <div className="card" style={{ borderColor: 'var(--err, #b91c1c)', color: 'var(--err, #b91c1c)' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

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
                <span style={{ marginLeft: 8 }}><Badge tone={badgeTone(c.status)}>{displayStatus(c.status)}</Badge></span>
                {c.email_domain_matched && <span style={{ marginLeft: 8 }}><Badge tone="ok">email domain match</Badge></span>}
                {c.payment_received_at && <span style={{ marginLeft: 8 }}><Badge tone="ok">paid</Badge></span>}
                {!c.payment_received_at && (c.status === 'pending' || c.status === 'under_review') && (
                  <span style={{ marginLeft: 8 }}><Badge>awaiting payment</Badge></span>
                )}
                <p className="claim-meta">{c.center_name}</p>
                <p className="claim-meta">{c.full_name} · {c.work_email}</p>
                {c.phone && <p className="claim-meta">{c.phone}</p>}
                <p className="muted" style={{ marginTop: 4 }}>{c.affiliation_text}</p>
                {c.business_license_url && (
                  <p style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-link btn-sm"
                      style={{ padding: 0, height: 'auto' }}
                      onClick={() => viewCertification(c)}
                    >
                      View certification upload
                    </button>
                  </p>
                )}
                {c.admin_notes && <p className="muted" style={{ marginTop: 8 }}>Notes: {c.admin_notes}</p>}
                {c.reviewed_at && <p className="muted" style={{ marginTop: 4 }}>Reviewed {formatDate(c.reviewed_at)}</p>}
                {c.status === 'certified' && !c.payment_received_at && (
                  <p className="muted" style={{ marginTop: 4 }}>Verified — waiting for Stripe payment (legacy path).</p>
                )}
                {c.payment_received_at && (c.status === 'pending' || c.status === 'under_review') && (
                  <p className="muted" style={{ marginTop: 4 }}>Paid — verify certification to unlock listing.</p>
                )}
              </div>
            </div>
            {(c.status === 'pending' || c.status === 'under_review') && (
              <>
                <label>Notes <span className="muted">(required)</span></label>
                <textarea
                  rows={2}
                  required
                  value={notes[c.id] || ''}
                  onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                  placeholder="Required for pending, approved, or disapproved"
                />
                <label>Temp password (if account missing)</label>
                <input value={passwords[c.id] || ''} onChange={e => setPasswords(p => ({ ...p, [c.id]: e.target.value }))} placeholder="TempPass123!" />
                <div className="form-actions form-actions-tight">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === c.id}
                    onClick={() => review(c.id, 'pending')}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busyId === c.id}
                    onClick={() => review(c.id, 'approved')}
                  >
                    Approved
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === c.id}
                    onClick={() => review(c.id, 'disapproved')}
                  >
                    Disapproved
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}
