import { useEffect, useState } from 'react'
import { api } from '../../api'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

function tagLabel(lead) {
  if (lead.source_kind === 'claim_abandonment') return 'Abandonment · Claim'
  if (lead.source_kind === 'submit_abandonment') return 'Abandonment · Submit'
  if (lead.tag === 'abandonment') return 'Abandonment'
  return null
}

export default function AdminLeads() {
  const [leads, setLeads] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/admin/leads').then(setLeads).catch(e => setErr(e.message))
  }, [])

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Leads.</h1>
        <p className="page-sub">
          Abandoned claim and submit journeys only. Listing inquiries are emailed to each
          center and are not stored or visible here.
        </p>
      </header>
      {err && <p className="error">{err}</p>}
      <Card className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Center</th>
                <th>Tag</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Message</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No abandonment leads yet.</td></tr>
              ) : leads.map(lead => {
                const abandon = tagLabel(lead)
                return (
                  <tr key={lead.id}>
                    <td>{lead.center_name || '—'}</td>
                    <td>{abandon ? <Badge tone="warn">{abandon}</Badge> : <Badge tone="neutral">Other</Badge>}</td>
                    <td><strong>{lead.full_name}</strong></td>
                    <td>{lead.email}</td>
                    <td>{lead.phone || '—'}</td>
                    <td>{lead.message || '—'}</td>
                    <td>{lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}</td>
                    <td><Badge tone={lead.read_at ? 'neutral' : 'warn'}>{lead.read_at ? 'Read' : 'New'}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
