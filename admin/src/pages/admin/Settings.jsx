import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, apiUpload } from '../../api'
import Button from '../../components/ui/Button'
import ProfilePage from '../Profile'
import AdminUsers from './Users'
import RehabList from './rehab/RehabList'

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'users', label: 'Users' },
  { id: 'site', label: 'Site' },
  { id: 'email', label: 'Email' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'rehab', label: 'Rehab centers' },
]

const PROVIDERS = [
  { value: 'auto', label: 'Auto (Resend → SMTP → console)' },
  { value: 'resend', label: 'Resend' },
  { value: 'gmail_smtp', label: 'Gmail SMTP' },
  { value: 'smtp', label: 'Custom SMTP' },
]

const emptyEmailForm = {
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
}

function applyEmailSettings(s) {
  return {
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
  }
}

export default function AdminSettings() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'account'

  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [emailMeta, setEmailMeta] = useState(null)
  const [emailForm, setEmailForm] = useState(emptyEmailForm)
  const [testTo, setTestTo] = useState('')

  const [stripe, setStripe] = useState(null)
  const [stripeForm, setStripeForm] = useState({
    enabled: false,
    secret_key: '',
    webhook_secret: '',
    publishable_key: '',
    price_monthly: '',
    price_yearly: '',
    price_verified_badge: '',
    price_featured_placement: '',
  })

  const [blogSettings, setBlogSettings] = useState({ trash_retention_months: 6 })

  function setTab(id) {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next, { replace: true })
    setErr('')
    setMsg('')
  }

  useEffect(() => {
    if (tab !== 'site' && tab !== 'email') return
    let cancelled = false
    api('/api/admin/email-settings')
      .then(s => {
        if (cancelled) return
        setEmailMeta(s)
        setEmailForm(applyEmailSettings(s))
        setTestTo(prev => prev || s.email_from || '')
      })
      .catch(e => {
        if (!cancelled) setErr(e.message)
      })
    return () => { cancelled = true }
  }, [tab])

  useEffect(() => {
    if (tab !== 'stripe') return
    let cancelled = false
    api('/api/billing/admin/stripe-settings')
      .then(s => {
        if (cancelled) return
        setStripe(s)
        setStripeForm({
          enabled: !!s.enabled,
          secret_key: '',
          webhook_secret: '',
          publishable_key: s.publishable_key || '',
          price_monthly: s.price_monthly || '',
          price_yearly: s.price_yearly || '',
          price_verified_badge: s.price_verified_badge || '',
          price_featured_placement: s.price_featured_placement || '',
        })
      })
      .catch(e => {
        if (!cancelled) setErr(e.message)
      })
    return () => { cancelled = true }
  }, [tab])

  useEffect(() => {
    if (tab !== 'rehab') return
    let cancelled = false
    api('/api/admin/blog-settings')
      .then(data => {
        if (!cancelled) setBlogSettings(data)
      })
      .catch(e => {
        if (!cancelled) setErr(e.message)
      })
    return () => { cancelled = true }
  }, [tab])

  const showResend = emailForm.provider === 'auto' || emailForm.provider === 'resend'
  const showSmtp = emailForm.provider === 'auto' || emailForm.provider === 'smtp' || emailForm.provider === 'gmail_smtp'

  async function saveSite(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api('/api/admin/email-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          site_name: emailForm.site_name,
          logo_url: emailForm.logo_url || null,
          postal_address: emailForm.postal_address,
          social_facebook: emailForm.social_facebook || null,
          social_twitter: emailForm.social_twitter || null,
          social_youtube: emailForm.social_youtube || null,
          social_instagram: emailForm.social_instagram || null,
          social_linkedin: emailForm.social_linkedin || null,
        }),
      })
      setEmailMeta(updated)
      setEmailForm(f => ({ ...applyEmailSettings(updated), provider: f.provider, email_from: f.email_from }))
      setMsg('Site settings saved.')
    } catch (error) {
      setErr(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEmail(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const body = {
        provider: emailForm.provider,
        email_from: emailForm.email_from,
        clear_resend_api_key: emailForm.clear_resend_api_key,
        smtp_host: emailForm.smtp_host || null,
        smtp_port: Number(emailForm.smtp_port) || 587,
        smtp_user: emailForm.smtp_user || null,
        clear_smtp_password: emailForm.clear_smtp_password,
        smtp_use_tls: emailForm.smtp_use_tls,
      }
      if (emailForm.resend_api_key.trim()) body.resend_api_key = emailForm.resend_api_key.trim()
      if (emailForm.smtp_password.trim()) body.smtp_password = emailForm.smtp_password.trim()
      const updated = await api('/api/admin/email-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setEmailMeta(updated)
      setEmailForm(applyEmailSettings(updated))
      setMsg('Email settings saved.')
    } catch (error) {
      setErr(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function onLogoUpload(file) {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const updated = await apiUpload('/api/admin/email-settings/logo', file)
      setEmailMeta(updated)
      setEmailForm(f => ({ ...f, logo_url: updated.logo_url || '' }))
      setMsg('Logo uploaded.')
    } catch (error) {
      setErr(error.message)
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
      await api('/api/admin/email-settings/test', {
        method: 'POST',
        body: JSON.stringify({ to_email: testTo.trim() }),
      })
      setMsg(`Test email sent to ${testTo.trim()}.`)
    } catch (error) {
      setErr(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveStripe(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const body = {
        enabled: stripeForm.enabled,
        publishable_key: stripeForm.publishable_key || null,
        price_monthly: stripeForm.price_monthly || null,
        price_yearly: stripeForm.price_yearly || null,
        price_verified_badge: stripeForm.price_verified_badge || null,
        price_featured_placement: stripeForm.price_featured_placement || null,
      }
      if (stripeForm.secret_key.trim()) body.secret_key = stripeForm.secret_key.trim()
      if (stripeForm.webhook_secret.trim()) body.webhook_secret = stripeForm.webhook_secret.trim()
      const s = await api('/api/billing/admin/stripe-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setStripe(s)
      setStripeForm(f => ({
        ...f,
        secret_key: '',
        webhook_secret: '',
        enabled: !!s.enabled,
        publishable_key: s.publishable_key || '',
        price_monthly: s.price_monthly || '',
        price_yearly: s.price_yearly || '',
        price_verified_badge: s.price_verified_badge || '',
        price_featured_placement: s.price_featured_placement || '',
      }))
      setMsg('Stripe settings saved.')
    } catch (error) {
      setErr(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveRehabSettings(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api('/api/admin/blog-settings', {
        method: 'PATCH',
        body: JSON.stringify({ trash_retention_months: Number(blogSettings.trash_retention_months) }),
      })
      setBlogSettings(updated)
      setMsg('Rehab / content trash settings saved.')
    } catch (error) {
      setErr(error.message)
    } finally {
      setBusy(false)
    }
  }

  const subtitle = useMemo(() => ({
    account: 'Your administrator profile and password.',
    users: 'Create, invite, update, and remove platform users.',
    site: 'Public brand name, logo, postal address, and social links.',
    email: 'Delivery provider, SMTP / Resend credentials, and test sends.',
    stripe: 'Billing keys, webhook secret, and subscription price IDs.',
    rehab: 'Manage rehab centers and trash retention for deleted content.',
  }[tab]), [tab])

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Settings.</h1>
        <p className="page-sub">{subtitle}</p>
      </header>

      <div className="tabs-row" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      {tab === 'account' && <ProfilePage />}

      {tab === 'users' && <AdminUsers embedded />}

      {tab === 'site' && (
        <form className="card card-flat" onSubmit={saveSite}>
          <p className="eyebrow">Site branding</p>
          <p className="muted" style={{ marginBottom: 12 }}>
            These values appear in emails and shared platform branding.
          </p>
          <div className="form-grid-2">
            <div>
              <label>Site name</label>
              <input
                value={emailForm.site_name}
                onChange={e => setEmailForm(f => ({ ...f, site_name: e.target.value }))}
              />
            </div>
            <div>
              <label>Postal address</label>
              <input
                value={emailForm.postal_address}
                onChange={e => setEmailForm(f => ({ ...f, postal_address: e.target.value }))}
              />
            </div>
          </div>
          <p className="eyebrow" style={{ marginTop: 16 }}>Logo</p>
          {emailForm.logo_url && (
            <div style={{ marginBottom: 12, padding: 16, background: '#0f2a36', borderRadius: 4, display: 'inline-block' }}>
              <img src={emailForm.logo_url} alt="Site logo" style={{ maxHeight: 40, display: 'block' }} />
            </div>
          )}
          <label>Logo URL</label>
          <input
            value={emailForm.logo_url}
            onChange={e => setEmailForm(f => ({ ...f, logo_url: e.target.value }))}
            placeholder="https://… or /images/…"
          />
          <label style={{ marginTop: 8 }}>Upload logo</label>
          <input type="file" accept="image/*" onChange={e => onLogoUpload(e.target.files?.[0])} />

          <p className="eyebrow" style={{ marginTop: 16 }}>Social links</p>
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
                  value={emailForm[key]}
                  onChange={e => setEmailForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save site settings'}</Button>
          </div>
        </form>
      )}

      {tab === 'email' && (
        <form className="card card-flat" onSubmit={saveEmail}>
          <p className="eyebrow">Email delivery</p>
          <p className="muted" style={{ marginBottom: 12 }}>
            Effective provider: <code>{emailMeta?.effective_provider || '—'}</code>
            {emailMeta?.env_resend_configured ? ' · env Resend set' : ''}
            {emailMeta?.env_smtp_configured ? ' · env SMTP set' : ''}
            {' · '}
            <Link to="/admin/emails">Open full Emails page</Link>
          </p>

          <label>Provider</label>
          <select
            value={emailForm.provider}
            onChange={e => setEmailForm(f => ({
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

          <label>From address</label>
          <input
            value={emailForm.email_from}
            onChange={e => setEmailForm(f => ({ ...f, email_from: e.target.value }))}
            placeholder="noreply@strugglingwithaddiction.com"
          />

          {showResend && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>Resend</p>
              <label>
                API key{emailMeta?.resend_api_key_set ? ' (saved — leave blank to keep)' : ''}
              </label>
              <input
                type="password"
                autoComplete="off"
                value={emailForm.resend_api_key}
                onChange={e => setEmailForm(f => ({ ...f, resend_api_key: e.target.value, clear_resend_api_key: false }))}
                placeholder={emailMeta?.resend_api_key_set ? '••••••••' : 're_…'}
              />
              {emailMeta?.resend_api_key_set && (
                <label style={{ display: 'block', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={emailForm.clear_resend_api_key}
                    onChange={e => setEmailForm(f => ({ ...f, clear_resend_api_key: e.target.checked }))}
                  />{' '}
                  Clear saved Resend API key
                </label>
              )}
            </>
          )}

          {showSmtp && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>
                {emailForm.provider === 'gmail_smtp' ? 'Gmail SMTP' : 'SMTP'}
              </p>
              <div className="form-grid-2">
                <div>
                  <label>Host</label>
                  <input
                    value={emailForm.smtp_host}
                    onChange={e => setEmailForm(f => ({ ...f, smtp_host: e.target.value }))}
                    disabled={emailForm.provider === 'gmail_smtp'}
                  />
                </div>
                <div>
                  <label>Port</label>
                  <input
                    type="number"
                    value={emailForm.smtp_port}
                    onChange={e => setEmailForm(f => ({ ...f, smtp_port: e.target.value }))}
                    disabled={emailForm.provider === 'gmail_smtp'}
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>{emailForm.provider === 'gmail_smtp' ? 'Gmail address' : 'Username'}</label>
                  <input
                    value={emailForm.smtp_user}
                    onChange={e => setEmailForm(f => ({ ...f, smtp_user: e.target.value }))}
                  />
                </div>
                <div>
                  <label>
                    Password{emailMeta?.smtp_password_set ? ' (saved — leave blank to keep)' : ''}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={emailForm.smtp_password}
                    onChange={e => setEmailForm(f => ({ ...f, smtp_password: e.target.value, clear_smtp_password: false }))}
                  />
                </div>
              </div>
              <label style={{ display: 'block', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={emailForm.smtp_use_tls}
                  disabled={emailForm.provider === 'gmail_smtp'}
                  onChange={e => setEmailForm(f => ({ ...f, smtp_use_tls: e.target.checked }))}
                />{' '}
                Use TLS (STARTTLS)
              </label>
              {emailMeta?.smtp_password_set && (
                <label style={{ display: 'block', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={emailForm.clear_smtp_password}
                    onChange={e => setEmailForm(f => ({ ...f, clear_smtp_password: e.target.checked }))}
                  />{' '}
                  Clear saved SMTP password
                </label>
              )}
            </>
          )}

          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save email settings'}</Button>
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

      {tab === 'stripe' && (
        <form className="card card-flat" onSubmit={saveStripe} style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
          <p className="eyebrow">Stripe settings</p>
          {stripe ? (
            <>
              <p className="muted">
                Status: {stripe.configured ? 'Ready' : 'Not ready'} · Prices: {stripe.prices_ready ? 'set' : 'missing'} · Webhook: {stripe.webhook_ready ? 'set' : 'missing'}
              </p>
              <p className="muted">Webhook URL: <code>{stripe.webhook_url}</code></p>
              <p className="muted">Secret key on file: {stripe.secret_key_masked || '—'}</p>
            </>
          ) : (
            <p className="muted">Loading Stripe settings…</p>
          )}
          <label>
            <input
              type="checkbox"
              checked={stripeForm.enabled}
              onChange={e => setStripeForm(f => ({ ...f, enabled: e.target.checked }))}
            />{' '}
            Enabled
          </label>
          <label>Secret key (leave blank to keep)
            <input
              type="password"
              autoComplete="off"
              value={stripeForm.secret_key}
              onChange={e => setStripeForm(f => ({ ...f, secret_key: e.target.value }))}
              placeholder="sk_…"
            />
          </label>
          <label>Webhook secret (leave blank to keep)
            <input
              type="password"
              autoComplete="off"
              value={stripeForm.webhook_secret}
              onChange={e => setStripeForm(f => ({ ...f, webhook_secret: e.target.value }))}
              placeholder="whsec_…"
            />
          </label>
          <label>Publishable key
            <input
              value={stripeForm.publishable_key}
              onChange={e => setStripeForm(f => ({ ...f, publishable_key: e.target.value }))}
              placeholder="pk_…"
            />
          </label>
          <label>Monthly price ID
            <input
              value={stripeForm.price_monthly}
              onChange={e => setStripeForm(f => ({ ...f, price_monthly: e.target.value }))}
              placeholder="price_…"
            />
          </label>
          <label>Yearly price ID
            <input
              value={stripeForm.price_yearly}
              onChange={e => setStripeForm(f => ({ ...f, price_yearly: e.target.value }))}
              placeholder="price_…"
            />
          </label>
          <label>Verified badge price ID
            <input
              value={stripeForm.price_verified_badge}
              onChange={e => setStripeForm(f => ({ ...f, price_verified_badge: e.target.value }))}
              placeholder="price_…"
            />
          </label>
          <label>Featured placement price ID
            <input
              value={stripeForm.price_featured_placement}
              onChange={e => setStripeForm(f => ({ ...f, price_featured_placement: e.target.value }))}
              placeholder="price_…"
            />
          </label>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Stripe settings'}</Button>
            <Link className="btn btn-ghost" to="/admin/billing">Open Finance</Link>
          </div>
        </form>
      )}

      {tab === 'rehab' && (
        <>
          <form className="card card-flat" onSubmit={saveRehabSettings}>
            <p className="eyebrow">Trash retention</p>
            <p className="muted" style={{ marginBottom: 12 }}>
              Controls how long trashed blog content is kept before permanent cleanup. Rehab centers use the trash tab below for soft-delete and restore.
            </p>
            <label>Retention period</label>
            <select
              value={blogSettings.trash_retention_months}
              onChange={e => setBlogSettings(s => ({ ...s, trash_retention_months: Number(e.target.value) }))}
            >
              <option value={1}>1 month</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save trash settings'}</Button>
              <Link className="btn btn-ghost" to="/admin/rehab">Open Rehab page</Link>
            </div>
          </form>
          <RehabList />
        </>
      )}
    </div>
  )
}
