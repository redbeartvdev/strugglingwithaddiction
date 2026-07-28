import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiUpload } from '../api'
import ImageCropUpload from '../components/ImageCropUpload'
import ChangePassword from './ChangePassword'
import { useAuth } from '../auth'

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/me/profile').then(p => {
      setProfile(p)
      setForm({
        display_name: p.display_name || '',
        slug: p.slug || '',
        title: p.title || '',
        bio: p.bio || '',
        phone: p.phone || '',
        address_line: p.address_line || '',
        city: p.city || '',
        state: p.state || '',
        country: p.country || '',
        social_links: p.social_links || {},
        notification_preferences: p.notification_preferences || {
          lead_alerts: true,
          billing_alerts: true,
          renewal_reminders: true,
          product_updates: true,
        },
      })
    })
  }, [])

  async function save(e) {
    e.preventDefault()
    setErr('')
    setMsg('')
    try {
      const updated = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify(form) })
      setProfile(updated)
      setMsg('Saved.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function onCropped(file) {
    try {
      const updated = await apiUpload('/api/me/profile/photo', file)
      setProfile(updated)
      setMsg('Photo updated.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function sendConfirmation() {
    setErr('')
    try {
      const res = await api('/api/auth/request-email-confirmation', { method: 'POST' })
      setMsg(res.message)
    } catch (e) {
      setErr(e.message)
    }
  }

  if (!profile) return <p className="muted">Loading</p>

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Account.</h1>
        <p className="page-sub">Login identity, notifications, and password — not your public rehab listing.</p>
      </header>

      {user?.role === 'client' && (
        <div className="card card-flat" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">Public listing</p>
            <p style={{ margin: '4px 0 0' }}>Edit your rehab listing, insurance, gallery, and partner page in the Profile Page Editor.</p>
          </div>
          <Link className="btn btn-primary" to="/client/profile">Open Profile Page Editor</Link>
        </div>
      )}

      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <div className="card card-flat form-stack">
        <p className="eyebrow">Photo</p>
        {profile.profile_photo_url && (
          <img src={profile.profile_photo_url} alt="" className="avatar-preview" />
        )}
        <ImageCropUpload onCropped={onCropped} />
      </div>

      <div className="card card-flat form-stack">
        <p className="eyebrow">Account email</p>
        <p>{profile.email}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={sendConfirmation}>Send confirmation email</button>
      </div>

      <form className="card card-flat form-stack" onSubmit={save}>
        <p className="eyebrow">Profile details</p>
        <div className="form-grid-2">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Slug</span>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Title</span>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Bio</span>
          <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
        </label>

        <p className="eyebrow">Address</p>
        <div className="form-grid-2">
          <label className="field">
          <span className="field-label">Street</span>
            <input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">State</span>
            <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Country</span>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
          </label>
        </div>

        <p className="eyebrow">Social</p>
        <div className="form-grid-2">
          {[
            ['website', 'Website'],
            ['twitter', 'Twitter'],
            ['linkedin', 'LinkedIn'],
          ].map(([key, label]) => (
            <label key={key} className="field">
              <span className="field-label">{label}</span>
              <input
                value={form.social_links?.[key] || ''}
                onChange={e => setForm(f => ({
                  ...f,
                  social_links: { ...f.social_links, [key]: e.target.value },
                }))}
              />
            </label>
          ))}
        </div>

        <p className="eyebrow">Notifications</p>
        <div className="form-stack" style={{ gap: 8 }}>
          {[
            ['lead_alerts', 'New lead alerts'],
            ['billing_alerts', 'Billing, dunning, and cancellation alerts'],
            ['renewal_reminders', 'Renewal reminders'],
            ['product_updates', 'Directory product updates'],
          ].map(([key, label]) => (
            <label key={key} className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.notification_preferences?.[key] !== false}
                onChange={e => setForm(f => ({
                  ...f,
                  notification_preferences: { ...f.notification_preferences, [key]: e.target.checked },
                }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
      <ChangePassword />
    </div>
  )
}
