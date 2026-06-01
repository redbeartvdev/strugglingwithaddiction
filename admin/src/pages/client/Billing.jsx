import { useEffect, useState } from 'react'
import { api } from '../../api'
import ChangePassword from '../ChangePassword'

export default function ClientBilling() {
  const [sub, setSub] = useState(null)
  const [interval, setInterval] = useState('month')

  useEffect(() => {
    api('/api/billing/subscription').then(setSub)
  }, [])

  async function checkout() {
    const { checkout_url } = await api('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval }),
    })
    window.location.href = checkout_url
  }

  async function portal() {
    const { portal_url } = await api('/api/billing/portal', { method: 'POST' })
    window.location.href = portal_url
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Billing.</h1>
        <p className="page-sub">Status: {sub?.status || 'inactive'}</p>
      </header>
      <div className="card card-flat">
        {sub?.status !== 'active' && (
          <>
            <label>Plan</label>
            <select value={interval} onChange={e => setInterval(e.target.value)}>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={checkout}>Subscribe</button>
            </div>
          </>
        )}
        {sub?.status === 'active' && (
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={portal}>Manage billing</button>
          </div>
        )}
      </div>
      <ChangePassword />
    </div>
  )
}
