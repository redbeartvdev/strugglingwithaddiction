import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ email: '', password: '', role: 'client', display_name: '', is_active: false })
  const [invite, setInvite] = useState({ email: '', display_name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = () => api('/api/admin/users').then(setUsers)
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form) })
      setForm({ email: '', password: '', role: 'client', display_name: '', is_active: false })
      setMessage('Account created.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function inviteSuperadmin(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await api('/api/admin/users/invite-admin', {
        method: 'POST',
        body: JSON.stringify(invite),
      })
      setInvite({ email: '', display_name: '' })
      setMessage(
        result.email_sent
          ? 'Superadmin invitation sent.'
          : 'Superadmin created. Email delivery is not configured; send them a password-reset link after email is configured.',
      )
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(u) {
    setError('')
    setMessage('')
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Users.</h1>
        <p className="page-sub">Invite superadmins and manage platform accounts.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <form className="card" onSubmit={inviteSuperadmin}>
        <p className="eyebrow">Invite superadmin</p>
        <p className="muted">The new administrator receives a secure 24-hour link to set their password.</p>
        <div className="form-grid-2">
          <div><label>Email</label><input type="email" value={invite.email} onChange={e => setInvite(f => ({ ...f, email: e.target.value }))} required /></div>
          <div><label>Name</label><input value={invite.display_name} onChange={e => setInvite(f => ({ ...f, display_name: e.target.value }))} /></div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send superadmin invitation'}
          </button>
        </div>
      </form>
      <form className="card" onSubmit={create}>
        <p className="eyebrow">New account</p>
        <div className="form-grid-2">
          <div><label>Email</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
          <div><label>Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
        </div>
        <div className="form-grid-2">
          <div>
            <label>Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({
                ...f,
                role: e.target.value,
                is_active: e.target.value === 'admin' ? true : f.is_active,
              }))}
            >
              <option value="admin">Superadmin</option>
              <option value="editor">Editor</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div><label>Name</label><input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>Create</button>
        </div>
      </form>
      <div className="card card-pad-0 table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><span className="badge">{u.role === 'admin' ? 'superadmin' : u.role}</span></td>
                <td>{u.is_active ? 'Yes' : 'No'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleActive(u)}
                    disabled={u.role === 'admin'}
                    title={u.role === 'admin' ? 'Superadmins remain active; demote them before deactivation.' : undefined}
                  >
                    Toggle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
