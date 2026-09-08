import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiUpload } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import AdminEmailList from './EmailList'

const PROVIDERS = [
  { value: 'auto', label: 'Auto (Resend → SMTP → console)' },
  { value: 'resend', label: 'Resend' },
  { value: 'gmail_smtp', label: 'Gmail SMTP' },
  { value: 'smtp', label: 'Custom SMTP' },
]

const CATEGORY_LABELS = {
  auth: 'Account & security',
  claim: 'Claim journey',
  billing: 'Billing & subscription',
  leads: 'Leads & listing',
  upsells: 'Upsells',
  marketing: 'Marketing',
  other: 'Other',
}

const emptySettings = {
  provider: 'auto',
  email_from: '',
  postal_address: '',
  site_name: '',
  logo_url: '',
  resend_api_key: '',
  clear_resend_api_key: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  clear_smtp_password: false,
  smtp_use_tls: true,
  social_facebook: '',
  social_twitter: '',
  social_youtube: '',
  social_instagram: '',
  social_linkedin: '',
  mailchimp_enabled: false,
  mailchimp_api_key: '',
  clear_mailchimp_api_key: false,
  mailchimp_audience_id: '',
  abandonment_emails_enabled: true,
}

export default function AdminEmails() {
  const [tab, setTab] = useState('activity')
  const [logs, setLogs] = useState([])
  const [templates, setTemplates] = useState([])
  const [settingsMeta, setSettingsMeta] = useState(null)
  const [form, setForm] = useState(emptySettings)
  const [selectedKey, setSelectedKey] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [preview, setPreview] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendingId, setResendingId] = useState(null)
  const [mailchimpPing, setMailchimpPing] = useState('')

  function loadLogs() {
    return api('/api/admin/emails').then(setLogs)
  }

  function loadTemplates() {
    return api('/api/admin/email-templates').then(rows => {
      setTemplates(rows)
      if (rows.length) {
        const nextKey = selectedKey && rows.some(r => r.key === selectedKey) ? selectedKey : rows[0].key
        setSelectedKey(nextKey)
        const row = rows.find(r => r.key === nextKey) || rows[0]
        setDraftSubject(row.subject)
        setDraftBody(row.body)
        setDirty(false)
      }
    })
  }

  function loadSettings() {
    return api('/api/admin/email-settings').then(s => {
      setSettingsMeta(s)
      setForm(f => ({
        ...f,
        provider: s.provider || 'auto',
        email_from: s.email_from || '',
        postal_address: s.postal_address || '',
        site_name: s.site_name || '',
        logo_url: s.logo_url || '',
        resend_api_key: '',
        clear_resend_api_key: false,
        smtp_host: s.smtp_host || '',
        smtp_port: s.smtp_port || 587,
        smtp_user: s.smtp_user || '',
        smtp_password: '',
        clear_smtp_password: false,
        smtp_use_tls: s.smtp_use_tls !== false,
        social_facebook: s.social_facebook || '',
        social_twitter: s.social_twitter || '',
        social_youtube: s.social_youtube || '',
        social_instagram: s.social_instagram || '',
        social_linkedin: s.social_linkedin || '',
        mailchimp_enabled: !!s.mailchimp_enabled,
        mailchimp_api_key: '',
        clear_mailchimp_api_key: false,
        mailchimp_audience_id: s.mailchimp_audience_id || '',
        abandonment_emails_enabled: s.abandonment_emails_enabled !== false,
      }))
      if (!testTo && s.email_from) setTestTo(s.email_from)
    })
  }

  useEffect(() => {
    setErr('')
    const loaders = {
      activity: loadLogs,
      templates: loadTemplates,
      settings: loadSettings,
      list: () => Promise.resolve(),
    }
    loaders[tab]?.().catch(e => setErr(e.message))
  }, [tab])

  useEffect(() => {
    if (tab !== 'templates' || !selectedKey) return
    const row = templates.find(t => t.key === selectedKey)
    if (!row) return
    setDraftSubject(row.subject)
    setDraftBody(row.body)
    setDirty(false)
  }, [selectedKey])

  useEffect(() => {
    if (tab !== 'templates' || !selectedKey) return
    const handle = setTimeout(() => {
      api(`/api/admin/email-templates/${selectedKey}/preview`, {
        method: 'POST',
        body: JSON.stringify({
          subject: draftSubject,
          body: draftBody,
        }),
      })
        .then(setPreview)
        .catch(e => setErr(e.message))
    }, 280)
    return () => clearTimeout(handle)
  }, [tab, selectedKey, draftSubject, draftBody])

  const selectedTemplate = templates.find(t => t.key === selectedKey)
  const groupedTemplates = useMemo(() => {
    const groups = {}
    for (const t of templates) {
      const cat = t.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(t)
    }
    return groups
  }, [templates])

  async function selectTemplate(key) {
    if (dirty && !confirm('Discard unsaved template edits?')) return
    setSelectedKey(key)
    setErr('')
    setMsg('')
  }

  async function saveTemplate() {
    if (!selectedKey) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/email-templates/${selectedKey}`, {
        method: 'PATCH',
        body: JSON.stringify({ subject: draftSubject, body: draftBody }),
      })
      setTemplates(rows => rows.map(r => (r.key === selectedKey ? updated : r)))
      setDraftSubject(updated.subject)
      setDraftBody(updated.body)
      setDirty(false)
      setMsg('Template saved.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetTemplate() {
    if (!selectedKey) return
    if (!confirm('Reset this template to the built-in default?')) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api(`/api/admin/email-templates/${selectedKey}/reset`, { method: 'POST' })
      setTemplates(rows => rows.map(r => (r.key === selectedKey ? updated : r)))
      setDraftSubject(updated.subject)
      setDraftBody(updated.body)
      setDirty(false)
      setMsg('Template reset to default.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const payload = {
        provider: form.provider,
        email_from: form.email_from,
        postal_address: form.postal_address,
        site_name: form.site_name,
        logo_url: form.logo_url || null,
        smtp_host: form.smtp_host || null,
        smtp_port: Number(form.smtp_port) || 587,
        smtp_user: form.smtp_user || null,
        smtp_use_tls: form.smtp_use_tls,
        social_facebook: form.social_facebook || null,
        social_twitter: form.social_twitter || null,
        social_youtube: form.social_youtube || null,
        social_instagram: form.social_instagram || null,
        social_linkedin: form.social_linkedin || null,
        mailchimp_enabled: !!form.mailchimp_enabled,
        mailchimp_audience_id: form.mailchimp_audience_id || null,
        abandonment_emails_enabled: form.abandonment_emails_enabled !== false,
        clear_resend_api_key: form.clear_resend_api_key,
        clear_smtp_password: form.clear_smtp_password,
        clear_mailchimp_api_key: form.clear_mailchimp_api_key,
      }
      if (form.resend_api_key.trim()) payload.resend_api_key = form.resend_api_key.trim()
      if (form.smtp_password.trim()) payload.smtp_password = form.smtp_password.trim()
      if (form.mailchimp_api_key.trim()) payload.mailchimp_api_key = form.mailchimp_api_key.trim()
      const updated = await api('/api/admin/email-settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setSettingsMeta(updated)
      setForm(f => ({
        ...f,
        resend_api_key: '',
        smtp_password: '',
        mailchimp_api_key: '',
        clear_resend_api_key: false,
        clear_smtp_password: false,
        clear_mailchimp_api_key: false,
        logo_url: updated.logo_url || '',
        smtp_host: updated.smtp_host || '',
        smtp_port: updated.smtp_port || 587,
      }))
      setMsg('Email settings saved.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function onLogoUpload(file) {
    if (!file) return
    setErr('')
    setMsg('')
    try {
      const updated = await apiUpload('/api/admin/email-settings/logo', file)
      setSettingsMeta(updated)
      setForm(f => ({ ...f, logo_url: updated.logo_url || '' }))
      setMsg('Logo updated.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function pingMailchimp() {
    setBusy(true)
    setErr('')
    setMailchimpPing('')
    try {
      const res = await api('/api/admin/email-settings/mailchimp/ping', { method: 'POST' })
      setMailchimpPing(`Connected: ${res.list_name || res.list_id}${res.member_count != null ? ` · ${res.member_count} members` : ''}`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      if (dirty && selectedKey) {
        await api(`/api/admin/email-templates/${selectedKey}`, {
          method: 'PATCH',
          body: JSON.stringify({ subject: draftSubject, body: draftBody }),
        })
        setDirty(false)
        await loadTemplates()
      }
      const res = await api('/api/admin/email-settings/test', {
        method: 'POST',
        body: JSON.stringify({
          to_email: testTo.trim(),
          template_key: selectedKey || 'email_confirmation',
        }),
      })
      setMsg(res.message || 'Test sent.')
      if (tab === 'activity') loadLogs().catch(() => {})
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function resendLog(id) {
    setResendingId(id)
    setErr('')
    setMsg('')
    try {
      const res = await api(`/api/admin/emails/${id}/resend`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setMsg(res.ok ? `Resent to ${res.to_email}` : 'Resend skipped or failed')
      await loadLogs()
    } catch (e) {
      setErr(e.message)
    } finally {
      setResendingId(null)
    }
  }

  const showSmtp = form.provider === 'gmail_smtp' || form.provider === 'smtp' || form.provider === 'auto'
  const showResend = form.provider === 'resend' || form.provider === 'auto'

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Emails.</h1>
        <p className="page-sub">Named mailing lists, assignment, CSV export, templates, and delivery settings.</p>
      </header>

      <div className="tabs-row">
        {[
          ['activity', 'Activity'],
          ['list', 'Lists'],
          ['templates', 'Templates'],
          ['settings', 'Settings'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab-btn${tab === id ? ' active' : ''}`}
            onClick={() => { setTab(id); setErr(''); setMsg('') }}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      {tab === 'activity' && (
        <Card className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Template</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No emails logged yet.</td></tr>
                ) : logs.map(row => (
                  <tr key={row.id}>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td>{row.to_email}</td>
                    <td><code>{row.template_key}</code></td>
                    <td>
                      {row.subject}
                      {row.error && <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{row.error}</div>}
                    </td>
                    <td>
                      <Badge tone={row.status === 'sent' ? 'ok' : row.status === 'skipped' ? 'neutral' : 'err'}>
                        {row.status}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={resendingId === row.id}
                        onClick={() => resendLog(row.id)}
                      >
                        {resendingId === row.id ? '…' : 'Resend'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'list' && <AdminEmailList embedded />}

      {tab === 'templates' && (
        <div className="form-grid-2" style={{ alignItems: 'start', gap: 20 }}>
          <Card>
            <p className="eyebrow">All transactional templates</p>
            <p className="muted" style={{ marginBottom: 12 }}>
              {templates.length} templates. Edit subject and body with live preview. Use {'{variable}'} placeholders.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflow: 'auto' }}>
              {Object.keys(CATEGORY_LABELS).filter(c => groupedTemplates[c]?.length).map(cat => (
                <div key={cat}>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>{CATEGORY_LABELS[cat]}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {groupedTemplates[cat].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        className={`tab-btn${selectedKey === t.key ? ' active' : ''}`}
                        style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                        onClick={() => selectTemplate(t.key)}
                      >
                        <span>
                          <strong>{t.label}</strong>
                          {t.is_custom ? <>{' '}<Badge tone="info">Custom</Badge></> : null}
                          {t.routed_to_mailchimp ? <>{' '}<Badge tone="info">Mailchimp</Badge></> : null}
                          <span className="muted" style={{ display: 'block', fontSize: 12 }}>{t.key}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              {selectedTemplate ? (
                <>
                  <p className="eyebrow">Edit template</p>
                  <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{selectedTemplate.label}</h2>
                  <p className="muted">{selectedTemplate.description}</p>
                  {selectedTemplate.routed_to_mailchimp && (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Built-in send is off. Contacts are added to Mailchimp with tags
                      {' '}<code>swa-abandonment-claim</code> / <code>swa-abandonment-submit</code>.
                      Set up a Customer Journey on those tags in Mailchimp.
                    </p>
                  )}
                  {selectedTemplate.preference_gate && (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Preference gate: <code>{selectedTemplate.preference_gate}</code>
                    </p>
                  )}
                  <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    Variables: {selectedTemplate.variables.map(v => `{${v}}`).join(' · ') || '—'}
                  </p>

                  <label style={{ marginTop: 16 }}>Subject</label>
                  <input
                    value={draftSubject}
                    onChange={e => { setDraftSubject(e.target.value); setDirty(true) }}
                  />
                  <label>Body</label>
                  <textarea
                    rows={12}
                    value={draftBody}
                    onChange={e => { setDraftBody(e.target.value); setDirty(true) }}
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
                  />

                  <div className="form-actions">
                    <Button type="button" onClick={saveTemplate} disabled={busy || !dirty}>
                      {busy ? 'Saving…' : 'Save template'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetTemplate} disabled={busy}>
                      Reset to default
                    </Button>
                    {dirty && <span className="muted">Unsaved changes</span>}
                  </div>
                </>
              ) : (
                <p className="muted">Select a template.</p>
              )}
            </Card>

            <Card>
              <p className="eyebrow">Live preview</p>
              {preview ? (
                <>
                  <p style={{ marginTop: 8 }}><strong>Subject:</strong> {preview.subject}</p>
                  <div
                    style={{
                      marginTop: 12,
                      border: '1px solid var(--border, #d8dee6)',
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: '#eef2f5',
                    }}
                  >
                    <iframe
                      title="Email preview"
                      srcDoc={preview.html}
                      style={{ width: '100%', height: 480, border: 0, background: '#eef2f5' }}
                    />
                  </div>
                  <details style={{ marginTop: 12 }}>
                    <summary className="muted">Plain text version</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 8 }}>{preview.text}</pre>
                  </details>
                  <div className="form-actions">
                    <input
                      type="email"
                      placeholder="Send test to…"
                      value={testTo}
                      onChange={e => setTestTo(e.target.value)}
                      style={{ maxWidth: 280 }}
                    />
                    <Button type="button" onClick={sendTest} disabled={busy || !testTo.trim()}>
                      {dirty ? 'Save & send test' : 'Send test'}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="muted">Preview will appear as you type.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <form className="card card-flat" onSubmit={saveSettings}>
          <p className="eyebrow">Delivery</p>
          <p className="muted" style={{ marginBottom: 12 }}>
            Effective provider: <code>{settingsMeta?.effective_provider || '—'}</code>
            {settingsMeta?.env_resend_configured ? ' · env Resend set' : ''}
            {settingsMeta?.env_smtp_configured ? ' · env SMTP set' : ''}
            {' · '}
            <Link to="/admin/settings?tab=mailchimp">Admin Settings → Mailchimp</Link>
          </p>

          <label>Provider</label>
          <select
            value={form.provider}
            onChange={e => setForm(f => ({
              ...f,
              provider: e.target.value,
              ...(e.target.value === 'gmail_smtp'
                ? { smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_use_tls: true }
                : {}),
            }))}
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <div className="form-grid-2">
            <div>
              <label>From address</label>
              <input
                value={form.email_from}
                onChange={e => setForm(f => ({ ...f, email_from: e.target.value }))}
                placeholder="noreply@strugglingwithaddiction.com"
              />
            </div>
            <div>
              <label>Site name</label>
              <input
                value={form.site_name}
                onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
              />
            </div>
          </div>

          <label>Postal address</label>
          <input
            value={form.postal_address}
            onChange={e => setForm(f => ({ ...f, postal_address: e.target.value }))}
          />

          <p className="eyebrow" style={{ marginTop: 16 }}>Header logo</p>
          <p className="muted" style={{ marginBottom: 8 }}>
            Used in the email header. Defaults to the public site logo on a dark bar.
          </p>
          {form.logo_url && (
            <div style={{ marginBottom: 12, padding: 16, background: '#0f2a36', borderRadius: 4, display: 'inline-block' }}>
              <img src={form.logo_url} alt="Email logo" style={{ maxHeight: 40, display: 'block' }} />
            </div>
          )}
          <label>Logo URL</label>
          <input
            value={form.logo_url}
            onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            placeholder="https://… or /images/…"
          />
          <label style={{ marginTop: 8 }}>Upload logo</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => onLogoUpload(e.target.files?.[0])}
          />

          {showResend && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>Resend</p>
              <label>
                API key{settingsMeta?.resend_api_key_set ? ' (saved — leave blank to keep)' : ''}
              </label>
              <input
                type="password"
                autoComplete="off"
                value={form.resend_api_key}
                onChange={e => setForm(f => ({ ...f, resend_api_key: e.target.value, clear_resend_api_key: false }))}
                placeholder={settingsMeta?.resend_api_key_set ? '••••••••' : 're_…'}
              />
              {settingsMeta?.resend_api_key_set && (
                <label style={{ display: 'block', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.clear_resend_api_key}
                    onChange={e => setForm(f => ({ ...f, clear_resend_api_key: e.target.checked }))}
                  />{' '}
                  Clear saved Resend API key
                </label>
              )}
            </>
          )}

          {showSmtp && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>
                {form.provider === 'gmail_smtp' ? 'Gmail SMTP' : 'SMTP'}
              </p>
              {form.provider === 'gmail_smtp' && (
                <p className="muted" style={{ marginBottom: 8 }}>
                  Uses smtp.gmail.com:587 with TLS. Create a Google App Password for the sending account.
                </p>
              )}
              <div className="form-grid-2">
                <div>
                  <label>Host</label>
                  <input
                    value={form.smtp_host}
                    onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
                    disabled={form.provider === 'gmail_smtp'}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label>Port</label>
                  <input
                    type="number"
                    value={form.smtp_port}
                    onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))}
                    disabled={form.provider === 'gmail_smtp'}
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>{form.provider === 'gmail_smtp' ? 'Gmail address' : 'Username'}</label>
                  <input
                    value={form.smtp_user}
                    onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))}
                    placeholder="you@gmail.com"
                  />
                </div>
                <div>
                  <label>
                    {form.provider === 'gmail_smtp' ? 'App password' : 'Password'}
                    {settingsMeta?.smtp_password_set ? ' (saved — leave blank to keep)' : ''}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.smtp_password}
                    onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value, clear_smtp_password: false }))}
                    placeholder={settingsMeta?.smtp_password_set ? '••••••••' : ''}
                  />
                </div>
              </div>
              <label style={{ display: 'block', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={form.smtp_use_tls}
                  disabled={form.provider === 'gmail_smtp'}
                  onChange={e => setForm(f => ({ ...f, smtp_use_tls: e.target.checked }))}
                />{' '}
                Use TLS (STARTTLS)
              </label>
              {settingsMeta?.smtp_password_set && (
                <label style={{ display: 'block', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.clear_smtp_password}
                    onChange={e => setForm(f => ({ ...f, clear_smtp_password: e.target.checked }))}
                  />{' '}
                  Clear saved SMTP password
                </label>
              )}
            </>
          )}

          <p className="eyebrow" style={{ marginTop: 16 }}>Mailchimp</p>
          <p className="muted" style={{ marginBottom: 8 }}>
            Syncs new registrations, listing claims, and new rehab-center submissions into one audience.
            Status: {settingsMeta?.mailchimp_configured ? 'ready' : 'not configured'}
            {settingsMeta?.env_mailchimp_configured ? ' · env key set' : ''}
            {' · '}
            <Link to="/admin/email-list">Manage named lists</Link>
          </p>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={!!form.mailchimp_enabled}
              onChange={e => setForm(f => ({ ...f, mailchimp_enabled: e.target.checked }))}
            />{' '}
            Enable Mailchimp audience sync
          </label>
          <label>
            API key{settingsMeta?.mailchimp_api_key_set ? ' (saved — leave blank to keep)' : ''}
          </label>
          <input
            type="password"
            autoComplete="off"
            value={form.mailchimp_api_key}
            onChange={e => setForm(f => ({ ...f, mailchimp_api_key: e.target.value, clear_mailchimp_api_key: false }))}
            placeholder={settingsMeta?.mailchimp_api_key_set ? '••••••••' : 'abcd…-us21'}
          />
          {settingsMeta?.mailchimp_api_key_set && (
            <label style={{ display: 'block', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={form.clear_mailchimp_api_key}
                onChange={e => setForm(f => ({ ...f, clear_mailchimp_api_key: e.target.checked }))}
              />{' '}
              Clear saved Mailchimp API key
            </label>
          )}
          <label style={{ marginTop: 8 }}>Audience / list ID</label>
          <input
            value={form.mailchimp_audience_id}
            onChange={e => setForm(f => ({ ...f, mailchimp_audience_id: e.target.value }))}
            placeholder="e.g. a1b2c3d4e5"
          />
          <label style={{ display: 'block', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={form.abandonment_emails_enabled === false}
              onChange={e => setForm(f => ({ ...f, abandonment_emails_enabled: !e.target.checked }))}
            />{' '}
            Disable built-in abandonment emails and send those contacts to Mailchimp
          </label>
          {form.abandonment_emails_enabled === false && !form.mailchimp_enabled && (
            <p className="muted" style={{ marginTop: 6 }}>
              Built-in abandonment emails will stop. Enable Mailchimp above so those contacts still land in your audience.
            </p>
          )}
          <p className="muted" style={{ marginTop: 6 }}>
            Tags applied: <code>swa-registration</code>, <code>swa-claim</code>, <code>swa-new-center</code>,
            {' '}<code>swa-abandonment-claim</code>, <code>swa-abandonment-submit</code>.
            Merge fields: FNAME, LNAME, PHONE, CENTER, SOURCE, CONTURL.
            Save settings, then test the connection.
          </p>
          <div className="form-actions" style={{ marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={pingMailchimp} disabled={busy}>
              Test Mailchimp connection
            </Button>
            {mailchimpPing && <span className="success">{mailchimpPing}</span>}
          </div>

          <p className="eyebrow" style={{ marginTop: 16 }}>Footer social links</p>
          <div className="form-grid-2">
            {[
              ['social_facebook', 'Facebook'],
              ['social_twitter', 'X / Twitter'],
              ['social_youtube', 'YouTube'],
              ['social_instagram', 'Instagram'],
              ['social_linkedin', 'LinkedIn'],
            ].map(([key, label]) => (
              <div key={key}>
                <label>{label}</label>
                <input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Copyright line uses the current year automatically (&copy; {new Date().getFullYear()} {form.site_name || '…'}).
          </p>

          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
            <input
              type="email"
              placeholder="Send test to…"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              style={{ maxWidth: 240 }}
            />
            <Button type="button" variant="ghost" onClick={sendTest} disabled={busy || !testTo.trim()}>
              Send test email
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
