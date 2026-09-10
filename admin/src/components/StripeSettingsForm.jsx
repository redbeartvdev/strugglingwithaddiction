import { useEffect, useState } from 'react'
import { api } from '../api'
import Button from './ui/Button'

function emptyForm() {
  return {
    enabled: true,
    mode: 'live',
    secret_key: '',
    webhook_secret: '',
    publishable_key: '',
    price_monthly: '',
    price_yearly: '',
    price_verified_badge: '',
    price_featured_placement: '',
    test_secret_key: '',
    test_webhook_secret: '',
    test_publishable_key: '',
    test_price_monthly: '',
    test_price_yearly: '',
    test_price_verified_badge: '',
    test_price_featured_placement: '',
  }
}

function formFromStatus(s) {
  const live = s.live || {}
  const test = s.test || {}
  return {
    enabled: s.enabled !== false,
    mode: s.mode === 'test' ? 'test' : 'live',
    secret_key: '',
    webhook_secret: '',
    publishable_key: live.publishable_key || s.publishable_key || '',
    price_monthly: live.price_monthly || s.price_monthly || '',
    price_yearly: live.price_yearly || s.price_yearly || '',
    price_verified_badge: live.price_verified_badge || s.price_verified_badge || '',
    price_featured_placement: live.price_featured_placement || s.price_featured_placement || '',
    test_secret_key: '',
    test_webhook_secret: '',
    test_publishable_key: test.publishable_key || '',
    test_price_monthly: test.price_monthly || '',
    test_price_yearly: test.price_yearly || '',
    test_price_verified_badge: test.price_verified_badge || '',
    test_price_featured_placement: test.price_featured_placement || '',
  }
}

export default function StripeSettingsForm({ status, onSaved, onError, footer = null }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (status) setForm(formFromStatus(status))
  }, [status])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function connect(mode) {
    const key = (mode === 'test' ? form.test_secret_key : form.secret_key).trim()
    if (!key) {
      onError?.(mode === 'test'
        ? 'Paste a Stripe test secret key (sk_test_ or rk_test_).'
        : 'Paste a Stripe live secret key (sk_live_ or rk_live_).')
      return
    }
    setConnecting(mode)
    onError?.('')
    try {
      const saved = await api('/api/billing/admin/stripe-connect', {
        method: 'POST',
        body: JSON.stringify({ mode, secret_key: key }),
      })
      if (saved?.account && !saved.account.ok) {
        onError?.(saved.account.error || 'Stripe connected but the account check failed.')
      }
      onSaved?.(saved)
      setForm(formFromStatus(saved))
    } catch (ex) {
      onError?.(ex.message)
    } finally {
      setConnecting(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    onError?.('')
    try {
      const body = {
        enabled: form.enabled,
        mode: form.mode,
        publishable_key: form.publishable_key || null,
        price_monthly: form.price_monthly || null,
        price_yearly: form.price_yearly || null,
        price_verified_badge: form.price_verified_badge || null,
        price_featured_placement: form.price_featured_placement || null,
        test_publishable_key: form.test_publishable_key || null,
        test_price_monthly: form.test_price_monthly || null,
        test_price_yearly: form.test_price_yearly || null,
        test_price_verified_badge: form.test_price_verified_badge || null,
        test_price_featured_placement: form.test_price_featured_placement || null,
      }
      if (form.secret_key.trim()) body.secret_key = form.secret_key.trim()
      if (form.webhook_secret.trim()) body.webhook_secret = form.webhook_secret.trim()
      if (form.test_secret_key.trim()) body.test_secret_key = form.test_secret_key.trim()
      if (form.test_webhook_secret.trim()) body.test_webhook_secret = form.test_webhook_secret.trim()
      const saved = await api('/api/billing/admin/stripe-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      onSaved?.(saved)
      setForm(formFromStatus(saved))
    } catch (ex) {
      onError?.(ex.message)
    } finally {
      setSaving(false)
    }
  }

  async function verifyConnection(mode) {
    setVerifying(mode)
    onError?.('')
    try {
      const saved = await api(`/api/billing/admin/stripe-verify?mode=${mode}`, { method: 'POST' })
      if (saved?.account && !saved.account.ok) {
        onError?.(saved.account.error || `Could not connect to Stripe ${mode === 'test' ? 'sandbox' : 'production'}.`)
      }
      onSaved?.(saved)
    } catch (ex) {
      onError?.(ex.message)
    } finally {
      setVerifying(false)
    }
  }

  const live = status?.live || {}
  const test = status?.test || {}
  const account = status?.account || {}
  const webhookUrl = status?.webhook_url || 'https://strugglingwithaddiction.com/api/billing/webhook'
  const liveReady = live.configured && live.prices_ready
  const testReady = test.configured && test.prices_ready

  return (
    <form className="card card-flat" onSubmit={save} style={{ maxWidth: 640, display: 'grid', gap: 12 }}>
      <p className="eyebrow">Connect Stripe</p>
      <p className="muted">
        Paste a secret key and click Connect. We create the products, prices, billing portal, and webhook on{' '}
        <code>{webhookUrl}</code>.
      </p>
      {status ? (
        <p className="muted">
          Active: <strong>{status.mode === 'test' ? 'Sandbox' : 'Production'}</strong>
          {' '}· Production {liveReady ? 'ready' : 'not connected'}
          {' '}· Sandbox {testReady ? 'ready' : 'not connected'}
        </p>
      ) : (
        <p className="muted">Loading Stripe settings…</p>
      )}
      {account.ok ? (
        <p className="muted">
          Connected: <strong>{account.display_name || 'Stripe account'}</strong>
          {account.id ? <> · <code>{account.id}</code></> : null}
          {account.email ? <> · {account.email}</> : null}
        </p>
      ) : null}

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
        <legend className="eyebrow">Production</legend>
        <p className="muted">On file: {live.secret_key_masked || '—'} · {liveReady ? 'catalog ready' : 'needs connect'}</p>
        <label>Live secret key (sk_live_ / rk_live_)
          <input type="password" autoComplete="off" value={form.secret_key} onChange={e => setField('secret_key', e.target.value)} placeholder="rk_live_… or sk_live_…" />
        </label>
        <Button type="button" disabled={!!connecting} onClick={() => connect('live')}>
          {connecting === 'live' ? 'Connecting production…' : 'Connect production'}
        </Button>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
        <legend className="eyebrow">Sandbox</legend>
        <p className="muted">
          In Stripe, turn on <strong>Test mode</strong> and paste the test secret. On file: {test.secret_key_masked || '—'}
        </p>
        <label>Test secret key (sk_test_ / rk_test_)
          <input type="password" autoComplete="off" value={form.test_secret_key} onChange={e => setField('test_secret_key', e.target.value)} placeholder="rk_test_… or sk_test_…" />
        </label>
        <Button type="button" disabled={!!connecting} onClick={() => connect('test')}>
          {connecting === 'test' ? 'Connecting sandbox…' : 'Connect sandbox'}
        </Button>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12 }}>
        <legend className="eyebrow">Active mode</legend>
        <label style={{ display: 'block' }}>
          <input type="radio" name="stripe-mode" checked={form.mode === 'live'} onChange={() => setField('mode', 'live')} />{' '}
          Charge real cards (production)
        </label>
        <label style={{ display: 'block' }}>
          <input type="radio" name="stripe-mode" checked={form.mode === 'test'} onChange={() => setField('mode', 'test')} />{' '}
          Use test cards (sandbox)
        </label>
      </fieldset>

      <label>
        <input type="checkbox" checked={form.enabled} onChange={e => setField('enabled', e.target.checked)} />{' '}
        Enabled
      </label>

      <details>
        <summary className="muted">Advanced: webhook secrets and price IDs</summary>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label>Live webhook secret
            <input type="password" autoComplete="off" value={form.webhook_secret} onChange={e => setField('webhook_secret', e.target.value)} placeholder="whsec_… (leave blank to keep)" />
          </label>
          <label>Monthly price ID<input value={form.price_monthly} onChange={e => setField('price_monthly', e.target.value)} placeholder="price_…" /></label>
          <label>Yearly price ID<input value={form.price_yearly} onChange={e => setField('price_yearly', e.target.value)} placeholder="price_…" /></label>
          <label>Verified badge price ID<input value={form.price_verified_badge} onChange={e => setField('price_verified_badge', e.target.value)} placeholder="price_…" /></label>
          <label>Featured placement price ID<input value={form.price_featured_placement} onChange={e => setField('price_featured_placement', e.target.value)} placeholder="price_…" /></label>
          <label>Test webhook secret
            <input type="password" autoComplete="off" value={form.test_webhook_secret} onChange={e => setField('test_webhook_secret', e.target.value)} placeholder="whsec_… (leave blank to keep)" />
          </label>
          <label>Test monthly price ID<input value={form.test_price_monthly} onChange={e => setField('test_price_monthly', e.target.value)} placeholder="price_…" /></label>
          <label>Test yearly price ID<input value={form.test_price_yearly} onChange={e => setField('test_price_yearly', e.target.value)} placeholder="price_…" /></label>
        </div>
      </details>

      <div className="form-actions">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save mode & advanced settings'}</Button>
        <Button type="button" variant="ghost" disabled={!!verifying} onClick={() => verifyConnection('live')}>
          {verifying === 'live' ? 'Checking production…' : 'Test production'}
        </Button>
        <Button type="button" variant="ghost" disabled={!!verifying} onClick={() => verifyConnection('test')}>
          {verifying === 'test' ? 'Checking sandbox…' : 'Test sandbox'}
        </Button>
        {footer}
      </div>
    </form>
  )
}
