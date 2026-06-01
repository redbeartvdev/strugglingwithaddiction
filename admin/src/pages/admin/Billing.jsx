import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function AdminBilling() {
  const [subs, setSubs] = useState([])
  const [plans, setPlans] = useState([])

  useEffect(() => {
    api('/api/billing/admin/subscribers').then(setSubs)
    api('/api/billing/admin/plans').then(setPlans)
  }, [])

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Billing.</h1>
      </header>
      <div className="card card-flat">
        <p className="eyebrow">Plans</p>
        {plans.map(p => (
          <p key={p.id} className="muted" style={{ marginBottom: 4 }}>{p.name} · {p.stripe_price_id_monthly || '—'} / {p.stripe_price_id_yearly || '—'}</p>
        ))}
      </div>
      <div className="table-wrap">
        <table>
        <thead><tr><th>User</th><th>Email</th><th>Status</th><th>Interval</th></tr></thead>
        <tbody>
          {subs.map(s => (
            <tr key={s.user_id}>
              <td>{s.display_name}</td>
              <td>{s.email}</td>
              <td>{s.status}</td>
              <td>{s.interval || '—'}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  )
}
