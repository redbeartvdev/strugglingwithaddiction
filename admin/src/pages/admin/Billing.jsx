import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiBlob } from '../../api'
import Button from '../../components/ui/Button'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscribers', label: 'Subscriptions' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'reports', label: 'Reports' },
  { id: 'stripe', label: 'Stripe' },
]

function money(label) {
  return label || '—'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export default function AdminBilling() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [subs, setSubs] = useState([])
  const [unpaid, setUnpaid] = useState([])
  const [invoices, setInvoices] = useState([])
  const [upgrades, setUpgrades] = useState([])
  const [report, setReport] = useState(null)
  const [stripe, setStripe] = useState(null)
  const [plans, setPlans] = useState([])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [stripeForm, setStripeForm] = useState({
    enabled: true,
    secret_key: '',
    webhook_secret: '',
    publishable_key: '',
    price_monthly: '',
    price_yearly: '',
    price_verified_badge: '',
    price_featured_placement: '',
  })
  const [days, setDays] = useState(30)

  function loadTab(id = tab) {
    setErr('')
    if (id === 'overview') {
      api(`/api/billing/admin/overview?days=${days}`).then(setOverview).catch(e => setErr(e.message))
      api('/api/billing/admin/plans').then(setPlans).catch(() => {})
    }
    if (id === 'subscribers') {
      api('/api/billing/admin/subscribers').then(setSubs).catch(e => setErr(e.message))
    }
    if (id === 'unpaid') {
      api('/api/billing/admin/unpaid').then(d => setUnpaid(d.items || [])).catch(e => setErr(e.message))
    }
    if (id === 'invoices') {
      api('/api/billing/admin/invoices').then(setInvoices).catch(e => setErr(e.message))
    }
    if (id === 'upgrades') {
      api('/api/admin/upsell-orders').then(setUpgrades).catch(e => setErr(e.message))
    }
    if (id === 'reports') {
      api(`/api/billing/admin/reports/sales?days=${days}`).then(setReport).catch(e => setErr(e.message))
    }
    if (id === 'stripe') {
      api('/api/billing/admin/stripe-settings').then(s => {
        setStripe(s)
        setStripeForm(f => ({
          ...f,
          enabled: s.enabled !== false,
          publishable_key: s.publishable_key || '',
          price_monthly: s.price_monthly || '',
          price_yearly: s.price_yearly || '',
          price_verified_badge: s.price_verified_badge || '',
          price_featured_placement: s.price_featured_placement || '',
          secret_key: '',
          webhook_secret: '',
        }))
      }).catch(e => setErr(e.message))
    }
  }

  useEffect(() => { loadTab(tab) }, [tab, days])

  async function saveStripe(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
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
      setStripeForm(f => ({ ...f, secret_key: '', webhook_secret: '' }))
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  const [busyInv, setBusyInv] = useState('')
  const [viewInv, setViewInv] = useState(null)

  async function downloadInvoicePdf(inv, { inline = false } = {}) {
    setBusyInv(`${inv.id}-${inline ? 'view' : 'dl'}`)
    setErr('')
    try {
      if (inv.invoice_pdf && !String(inv.stripe_invoice_id || '').startsWith('local_')) {
        window.open(inv.invoice_pdf, '_blank', 'noopener,noreferrer')
        return
      }
      if (inv.hosted_invoice_url && inline) {
        window.open(inv.hosted_invoice_url, '_blank', 'noopener,noreferrer')
        return
      }
      const { blob, filename } = await apiBlob(`/api/billing/admin/invoices/${inv.id}/pdf?download=${inline ? 0 : 1}`)
      const url = URL.createObjectURL(blob)
      if (inline) {
        window.open(url, '_blank', 'noopener,noreferrer')
        // Keep object URL briefly so the new tab can load
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `${inv.number || inv.id}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
    } catch (ex) {
      // Fallback: open detail panel if blob fails
      try {
        const detail = await api(`/api/billing/admin/invoices/${inv.id}`)
        setViewInv(detail)
      } catch {
        setErr(ex.message)
      }
    } finally {
      setBusyInv('')
    }
  }

  async function downloadCsv() {
    try {
      const { blob, filename } = await apiBlob(`/api/billing/admin/reports/sales?days=${days}&format=csv`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `swa-sales-${days}d.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (ex) {
      setErr(ex.message)
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Finance.</h1>
        <p className="page-sub">Recurring sales, invoices, unpaid subscriptions, and Stripe settings.</p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'overview' || tab === 'reports') && (
        <label className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          Period
          <select value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>365 days</option>
          </select>
        </label>
      )}

      {err && <p className="form-error">{err}</p>}

      {tab === 'overview' && overview && (
        <div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
            <div className="card card-flat"><p className="eyebrow">MRR</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(overview.mrr_label)}</p></div>
            <div className="card card-flat"><p className="eyebrow">ARR</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(overview.arr_label)}</p></div>
            <div className="card card-flat"><p className="eyebrow">Active subs</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overview.active_subscribers}</p><p className="muted">{overview.monthly_subscribers} mo · {overview.yearly_subscribers} yr</p></div>
            <div className="card card-flat"><p className="eyebrow">Unpaid</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overview.unpaid_count}</p><p className="muted">{overview.past_due_count} past due</p></div>
            <div className="card card-flat"><p className="eyebrow">New claimed</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overview.new_claimed}</p></div>
            <div className="card card-flat"><p className="eyebrow">Verified + paid</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overview.newly_verified}</p></div>
            <div className="card card-flat"><p className="eyebrow">Paid awaiting verify</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{overview.paid_awaiting_verification}</p></div>
            <div className="card card-flat"><p className="eyebrow">Upgrade sales (period)</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(overview.upgrade_period_label)}</p></div>
            <div className="card card-flat"><p className="eyebrow">Invoice revenue (period)</p><p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(overview.invoice_period_label)}</p></div>
          </div>
          <div className="card card-flat">
            <p className="eyebrow">Plans</p>
            {plans.map(p => (
              <p key={p.id} className="muted" style={{ marginBottom: 4 }}>
                {p.name} · {p.stripe_price_id_monthly || '—'} / {p.stripe_price_id_yearly || '—'}
              </p>
            ))}
            <p className="muted" style={{ marginTop: 12 }}>
              Stripe: {overview.stripe?.configured ? 'connected' : 'not configured'} ·{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('stripe')}>Open Stripe settings</button>
            </p>
          </div>
        </div>
      )}

      {tab === 'subscribers' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Center</th>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Interval</th>
                <th>Period end</th>
                <th>Claim</th>
                <th>Listing</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.user_id}>
                  <td>{s.center_name || '—'}</td>
                  <td>{s.display_name}</td>
                  <td>{s.email}</td>
                  <td>{s.status}</td>
                  <td>{s.interval || '—'}</td>
                  <td>{formatDate(s.current_period_end)}</td>
                  <td>{s.claim_status || '—'}</td>
                  <td>{s.listing_claimed ? 'Claimed' : 'Locked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'unpaid' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Center</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Ticket</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map((row, i) => (
                <tr key={`${row.kind}-${row.user_id || row.ticket_number}-${i}`}>
                  <td>{row.kind}</td>
                  <td>{row.center_name || '—'}</td>
                  <td>{row.display_name}</td>
                  <td>{row.email}</td>
                  <td>{row.status}</td>
                  <td>{row.ticket_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {unpaid.length === 0 && <p className="muted">No unpaid items.</p>}
        </div>
      )}

      {tab === 'invoices' && (
        <div>
          <p className="muted" style={{ marginBottom: 12 }}>
            View or download PDF invoices for rehab center subscriptions and upgrades.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Center</th>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{formatDate(inv.paid_at || inv.created_at)}</td>
                    <td>{inv.number || inv.stripe_invoice_id}</td>
                    <td>{inv.center_name || '—'}</td>
                    <td>{inv.email || '—'}</td>
                    <td>{inv.source}</td>
                    <td>{inv.status}</td>
                    <td>{inv.amount_label}</td>
                    <td className="table-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyInv === `${inv.id}-view`}
                        onClick={() => downloadInvoicePdf(inv, { inline: true })}
                      >
                        {busyInv === `${inv.id}-view` ? '…' : 'View'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyInv === `${inv.id}-dl`}
                        onClick={() => downloadInvoicePdf(inv, { inline: false })}
                      >
                        {busyInv === `${inv.id}-dl` ? '…' : 'Download PDF'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 && (
            <p className="muted">No invoices yet. Active subscriptions will show here automatically.</p>
          )}

          {viewInv && (
            <div className="card card-flat" style={{ marginTop: 16, maxWidth: 520 }}>
              <p className="eyebrow">Invoice detail</p>
              <p><strong>{viewInv.number || viewInv.stripe_invoice_id}</strong></p>
              <p className="muted">{viewInv.center_name || '—'} · {viewInv.email || '—'}</p>
              <p>{viewInv.product_label || viewInv.description || 'Subscription'}</p>
              <p style={{ fontWeight: 700, marginTop: 8 }}>{viewInv.amount_label}</p>
              <p className="muted">Status: {viewInv.status} · {formatDate(viewInv.paid_at || viewInv.created_at)}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button type="button" onClick={() => downloadInvoicePdf(viewInv, { inline: false })}>Download PDF</Button>
                <Button type="button" variant="ghost" onClick={() => setViewInv(null)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'upgrades' && (
        <div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Verified badge, featured placement, and article packages. <Link to="/admin/upsells">Fulfillment queue →</Link>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Center</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map(o => (
                  <tr key={o.id}>
                    <td>{formatDate(o.created_at)}</td>
                    <td>{(o.product_type || '').replace(/_/g, ' ')}</td>
                    <td>{o.center_name || o.rehab_center_id}</td>
                    <td>{o.status}</td>
                    <td>${((o.amount_cents || 0) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && report && (
        <div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div className="card card-flat"><p className="eyebrow">Subscription revenue</p><p style={{ fontWeight: 700 }}>{report.subscription_revenue_label}</p></div>
            <div className="card card-flat"><p className="eyebrow">Upgrade revenue</p><p style={{ fontWeight: 700 }}>{report.upgrade_revenue_label}</p></div>
            <div className="card card-flat"><p className="eyebrow">Total</p><p style={{ fontWeight: 700 }}>{report.total_revenue_label}</p></div>
            <Button type="button" onClick={downloadCsv}>Download CSV</Button>
          </div>
          <p className="eyebrow">By interval</p>
          <p className="muted">Month: {report.by_interval?.month?.label} · Year: {report.by_interval?.year?.label}</p>
          <p className="muted" style={{ marginTop: 8 }}>{report.invoice_count} invoices · {report.upgrade_order_count} upgrade orders</p>
        </div>
      )}

      {tab === 'stripe' && stripe && (
        <form className="card card-flat" onSubmit={saveStripe} style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
          <p className="eyebrow">Stripe settings</p>
          <p className="muted">
            Status: {stripe.configured ? 'Ready' : 'Not ready'} · Prices: {stripe.prices_ready ? 'set' : 'missing'} · Webhook: {stripe.webhook_ready ? 'set' : 'missing'}
          </p>
          <p className="muted">Webhook URL: <code>{stripe.webhook_url}</code></p>
          <p className="muted">Secret key on file: {stripe.secret_key_masked || '—'}</p>
          <label>
            <input type="checkbox" checked={stripeForm.enabled} onChange={e => setStripeForm(f => ({ ...f, enabled: e.target.checked }))} /> Enabled
          </label>
          <label>Secret key (leave blank to keep)<input type="password" autoComplete="off" value={stripeForm.secret_key} onChange={e => setStripeForm(f => ({ ...f, secret_key: e.target.value }))} placeholder="sk_…" /></label>
          <label>Webhook secret (leave blank to keep)<input type="password" autoComplete="off" value={stripeForm.webhook_secret} onChange={e => setStripeForm(f => ({ ...f, webhook_secret: e.target.value }))} placeholder="whsec_…" /></label>
          <label>Publishable key<input value={stripeForm.publishable_key} onChange={e => setStripeForm(f => ({ ...f, publishable_key: e.target.value }))} placeholder="pk_…" /></label>
          <label>Monthly price ID<input value={stripeForm.price_monthly} onChange={e => setStripeForm(f => ({ ...f, price_monthly: e.target.value }))} placeholder="price_…" /></label>
          <label>Yearly price ID<input value={stripeForm.price_yearly} onChange={e => setStripeForm(f => ({ ...f, price_yearly: e.target.value }))} placeholder="price_…" /></label>
          <label>Verified badge price ID<input value={stripeForm.price_verified_badge} onChange={e => setStripeForm(f => ({ ...f, price_verified_badge: e.target.value }))} placeholder="price_…" /></label>
          <label>Featured placement price ID<input value={stripeForm.price_featured_placement} onChange={e => setStripeForm(f => ({ ...f, price_featured_placement: e.target.value }))} placeholder="price_…" /></label>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Stripe settings'}</Button>
        </form>
      )}
    </div>
  )
}
