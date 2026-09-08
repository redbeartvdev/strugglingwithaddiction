import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Card from '../../components/ui/Card'

export default function ClientLeads() {
  const [center, setCenter] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/client/my-center').then(setCenter).catch(e => setErr(e.message))
  }, [])

  const inbox = (center?.contact_email || '').trim()

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Inquiries.</h1>
        <p className="page-sub">
          Listing inquiries are emailed to your assigned address. They are not recorded in our
          database and cannot be viewed here.
        </p>
      </header>
      {err && <p className="form-error">{err}</p>}
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
