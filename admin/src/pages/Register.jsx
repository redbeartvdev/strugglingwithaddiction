import { useState } from 'react'
import { api } from '../api'

export default function Register() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    display_name: '',
    facility_name: '',
    interval: 'month',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(k, v) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api('/api/billing/register', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (data.checkout_url) window.location.href = data.checkout_url
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card card-flat">
        <p className="eyebrow">Register</p>
        <h1 className="page-title">Partner account.</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="form-stack">
          <label>Name</label>
          <input value={form.display_name} onChange={e => update('display_name', e.target.value)} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => update('password', e.target.value)} minLength={8} required />
          <label>Facility</label>
          <input value={form.facility_name} onChange={e => update('facility_name', e.target.value)} placeholder="Optional" />
          <label>Plan</label>
          <select value={form.interval} onChange={e => update('interval', e.target.value)}>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
          <label className="checkbox-row">
            <input type="checkbox" required />
            Terms accepted
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Processing' : 'Continue'}
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 'var(--space-3)', textAlign: 'center' }}>
          <a href="/login">Sign in</a>
        </p>
      </div>
      <footer className="studio-footer studio-footer-auth">Developed by RedbearTV Dev Team</footer>
    </div>
  )
}
