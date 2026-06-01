import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ email: '', password: '', role: 'client', display_name: '', is_active: false })

  const load = () => api('/api/admin/users').then(setUsers)
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form) })
    setForm({ email: '', password: '', role: 'client', display_name: '', is_active: false })
    load()
  }

  async function toggleActive(u) {
    await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) })
    load()
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Users.</h1>
        <p className="page-sub">Create and manage accounts.</p>
      </header>
      <form className="card" onSubmit={create}>
        <p className="eyebrow">New account</p>
        <div className="form-grid-2">
          <div><label>Email</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
          <div><label>Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
        </div>
        <div className="form-grid-2">
          <div>
            <label>Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin</option>
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
          <button type="submit" className="btn btn-primary">Create</button>
        </div>
      </form>
      <div className="card card-pad-0 table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><span className="badge">{u.role}</span></td>
                <td>{u.is_active ? 'Yes' : 'No'}</td>
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>Toggle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
