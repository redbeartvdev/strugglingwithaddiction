import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Card from '../../components/ui/Card'

export default function ClientLeads() {
  const [center, setCenter] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/client/my-center').then(setCenter).catch(e => setErr(e.message))
    api('/api/client/analytics?range=year')
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
  }, [])

  const inbox = (center?.contact_email || '').trim()
  const sentTotal = analytics?.summary?.inquiry_sends_total
  const sentYear = analytics?.summary?.inquiry_sends

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Inquiries.</h1>
        <p className="page-sub">
          Listing inquiries are emailed to your assigned address. We count how many were sent
          to you and do not store the visitor's message.
        </p>
      </header>
      {err && <p className="form-error">{err}</p>}
      <Card>
        <p className="eyebrow">Inquiries emailed to you</p>
        <p style={{ marginTop: 8, fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
          {sentTotal == null ? '—' : sentTotal}
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          {sentYear == null
            ? 'Activate your subscription to see this count.'
            : `${sentYear} in the last year · visitor names and messages stay in your inbox only`}
        </p>
        <Link className="btn btn-ghost btn-sm" to="/client/profile?tab=analytics" style={{ marginTop: 16 }}>
          Open analytics
        </Link>
      </Card>
      <Card>
        <p className="eyebrow">Where inquiries are sent</p>
        <p style={{ marginTop: 8, fontSize: '1.15rem', fontWeight: 600 }}>
          {inbox || 'No inquiry email is set yet.'}
        </p>
        <p className="muted" style={{ marginTop: 10 }}>
          When someone uses “Send a private inquiry” on your public listing, the message goes
          only to this address. Reply from your email to reach the visitor. Platform admins
          cannot see these submissions.
        </p>
        <Link className="btn btn-ghost btn-sm" to="/client/profile?tab=listing" style={{ marginTop: 16 }}>
          Update inquiry email
        </Link>
      </Card>
    </div>
  )
}
