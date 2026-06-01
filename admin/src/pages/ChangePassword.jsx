import { useState } from 'react'
import { api } from '../api'

export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      setMsg('Password updated.')
      setCurrent('')
      setNext('')
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <form className="card card-flat" onSubmit={submit} style={{ marginTop: 'var(--space-3)' }}>
      <p className="eyebrow">Password</p>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <label>Current</label>
      <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
      <label>New</label>
      <input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={8} required />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Update</button>
      </div>
    </form>
  )
}
