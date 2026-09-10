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
  const [provisioning, setProvisioning] = useState(false)
  const [provisioningLive, setProvisioningLive] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (status) setForm(formFromStatus(status))
  }, [status])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
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

  async function provisionLive() {
    setProvisioningLive(true)
    onError?.('')
    try {
      if (form.secret_key.trim()) {
        await api('/api/billing/admin/stripe-settings', {
          method: 'PATCH',
          body: JSON.stringify({ secret_key: form.secret_key.trim() }),
        })
      }
      const saved = await api('/api/billing/admin/stripe-provision-live', { method: 'POST' })
      onSaved?.(saved)
      setForm(formFromStatus(saved))
    } catch (ex) {
      onError?.(ex.message)
    } finally {
      setProvisioningLive(false)
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

  async function provisionSandbox() {
    setProvisioning(true)
    onError?.('')
    try {
      if (form.test_secret_key.trim()) {
        await api('/api/billing/admin/stripe-settings', {
          method: 'PATCH',
          body: JSON.stringify({ test_secret_key: form.test_secret_key.trim() }),
        })
      }
      const saved = await api('/api/billing/admin/stripe-provision-sandbox', { method: 'POST' })
      onSaved?.(saved)
      setForm(formFromStatus(saved))
    } catch (ex) {
      onError?.(ex.message)
    } finally {
      setProvisioning(false)
    }
  }

  const live = status?.live || {}
  const test = status?.test || {}
  const account = status?.account || {}
  const activeReady = status?.configured ? 'Ready' : 'Not ready'

  return (
    <form className="card card-flat" onSubmit={save} style={{ maxWidth: 640, display: 'grid', gap: 12 }}>
      <p className="eyebrow">Stripe settings</p>
      {status ? (
        <>
          <p className="muted">
            Active mode: <strong>{status.mode === 'test' ? 'Sandbox' : 'Production'}</strong> · {activeReady}
            {' '}· Prices: {status.prices_ready ? 'set' : 'missing'} · Webhook: {status.webhook_ready ? 'set' : 'missing'}
          </p>
          {account.ok ? (
            <p className="muted">
              Connected: <strong>{account.display_name || 'Stripe account'}</strong>
              {account.id ? <> · <code>{account.id}</code></> : null}
              {account.email ? <> · {account.email}</> : null}
              {' '}· Charges {account.charges_enabled ? 'on' : 'off'}
              {' '}· Payouts {account.payouts_enabled ? 'on' : 'off'}
            </p>
          ) : account.error ? (
            <p className="muted">Stripe account check failed: {account.error}</p>
          ) : null}
          <p className="muted">
            Stripe webhook (custom domain): <code>{status.webhook_url || 'https://strugglingwithaddiction.com/api/billing/webhook'}</code>
          </p>
          <p className="muted">
            Live and sandbox both use this URL. It must be <code>https://strugglingwithaddiction.com/api/billing/webhook</code>, not the Railway hostname.
          </p>
        </>
      ) : (
        <p className="muted">Loading Stripe settings…</p>
      )}

      <label>
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={e => setField('enabled', e.target.checked)}
        />{' '}
        Enabled
      </label>

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12 }}>
        <legend className="eyebrow">Active mode</legend>
        <p className="muted" style={{ marginBottom: 8 }}>
          Sandbox uses Stripe test cards (e.g. 4242). Production charges real cards.
        </p>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="stripe-mode"
            checked={form.mode === 'live'}
            onChange={() => setField('mode', 'live')}
          />{' '}
          Production (live)
        </label>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="stripe-mode"
            checked={form.mode === 'test'}
            onChange={() => setField('mode', 'test')}
          />{' '}
          Sandbox (test)
        </label>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
        <legend className="eyebrow">Production</legend>
        <p className="muted">Secret on file: {live.secret_key_masked || status?.secret_key_masked || '—'}</p>
        <label>Live secret key (sk_live_ / rk_live_, leave blank to keep)
          <input type="password" autoComplete="off" value={form.secret_key} onChange={e => setField('secret_key', e.target.value)} placeholder="sk_live_…" />
        </label>
        <label>Live webhook secret (leave blank to keep)
          <input type="password" autoComplete="off" value={form.webhook_secret} onChange={e => setField('webhook_secret', e.target.value)} placeholder="whsec_…" />
        </label>
        <label>Live publishable key
          <input value={form.publishable_key} onChange={e => setField('publishable_key', e.target.value)} placeholder="pk_live_…" />
        </label>
        <label>Monthly price ID<input value={form.price_monthly} onChange={e => setField('price_monthly', e.target.value)} placeholder="price_…" /></label>
        <label>Yearly price ID<input value={form.price_yearly} onChange={e => setField('price_yearly', e.target.value)} placeholder="price_…" /></label>
        <label>Verified badge price ID<input value={form.price_verified_badge} onChange={e => setField('price_verified_badge', e.target.value)} placeholder="price_…" /></label>
        <label>Featured placement price ID<input value={form.price_featured_placement} onChange={e => setField('price_featured_placement', e.target.value)} placeholder="price_…" /></label>
        <Button type="button" variant="ghost" disabled={provisioningLive} onClick={provisionLive}>
          {provisioningLive ? 'Syncing live products…' : 'Find or create live products & prices'}
        </Button>
      </fieldset>

      <fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
        <legend className="eyebrow">Sandbox</legend>
        <p className="muted">Test secret on file: {test.secret_key_masked || '—'}</p>
        <p className="muted">In Stripe, switch to Test mode, create a webhook to the same URL, and paste sk_test_ / whsec_ here.</p>
        <label>Test secret key (sk_test_ / rk_test_, leave blank to keep)
          <input type="password" autoComplete="off" value={form.test_secret_key} onChange={e => setField('test_secret_key', e.target.value)} placeholder="sk_test_…" />
        </label>
        <label>Test webhook secret (leave blank to keep)
          <input type="password" autoComplete="off" value={form.test_webhook_secret} onChange={e => setField('test_webhook_secret', e.target.value)} placeholder="whsec_…" />
        </label>
        <label>Test publishable key
          <input value={form.test_publishable_key} onChange={e => setField('test_publishable_key', e.target.value)} placeholder="pk_test_…" />
        </label>
        <label>Test monthly price ID<input value={form.test_price_monthly} onChange={e => setField('test_price_monthly', e.target.value)} placeholder="price_…" /></label>
        <label>Test yearly price ID<input value={form.test_price_yearly} onChange={e => setField('test_price_yearly', e.target.value)} placeholder="price_…" /></label>
        <label>Test verified badge price ID<input value={form.test_price_verified_badge} onChange={e => setField('test_price_verified_badge', e.target.value)} placeholder="price_…" /></label>
        <label>Test featured placement price ID<input value={form.test_price_featured_placement} onChange={e => setField('test_price_featured_placement', e.target.value)} placeholder="price_…" /></label>
        <Button type="button" variant="ghost" disabled={provisioning} onClick={provisionSandbox}>
          {provisioning ? 'Creating sandbox products…' : 'Create sandbox products & prices'}
        </Button>
      </fieldset>

      <div className="form-actions">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Stripe settings'}</Button>
        <Button type="button" variant="ghost" disabled={!!verifying} onClick={() => verifyConnection('live')}>
          {verifying === 'live' ? 'Checking production…' : 'Test production connection'}
        </Button>
        <Button type="button" variant="ghost" disabled={!!verifying} onClick={() => verifyConnection('test')}>
          {verifying === 'test' ? 'Checking sandbox…' : 'Test sandbox connection'}
        </Button>
        {footer}
      </div>
    </form>
  )
}
