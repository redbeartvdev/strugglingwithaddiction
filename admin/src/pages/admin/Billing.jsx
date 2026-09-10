import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiBlob } from '../../api'
import Button from '../../components/ui/Button'
import StripeSettingsForm from '../../components/StripeSettingsForm'

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
  const [invoiceCounts, setInvoiceCounts] = useState({ all: 0, paid: 0, unpaid: 0 })
  const [invoiceFilter, setInvoiceFilter] = useState('all')
  const [upgrades, setUpgrades] = useState([])
  const [report, setReport] = useState(null)
  const [stripe, setStripe] = useState(null)
  const [plans, setPlans] = useState([])
  const [err, setErr] = useState('')
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
      api(`/api/billing/admin/invoices?filter=${invoiceFilter}`)
        .then(data => {
          if (Array.isArray(data)) {
            setInvoices(data)
            return
          }
          setInvoices(data.invoices || [])
          setInvoiceCounts(data.counts || { all: 0, paid: 0, unpaid: 0 })
        })
        .catch(e => setErr(e.message))
    }
    if (id === 'upgrades') {
      api('/api/admin/upsell-orders').then(setUpgrades).catch(e => setErr(e.message))
    }
    if (id === 'reports') {
      api(`/api/billing/admin/reports/sales?days=${days}`).then(setReport).catch(e => setErr(e.message))
    }
    if (id === 'stripe') {
      api('/api/billing/admin/stripe-settings').then(setStripe).catch(e => setErr(e.message))
    }
  }

  useEffect(() => { loadTab(tab) }, [tab, days, invoiceFilter])

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

  async function openPayLink(inv) {
    setBusyInv(`${inv.id}-pay`)
    setErr('')
    try {
      if (inv.pay_url || inv.hosted_invoice_url) {
        window.open(inv.pay_url || inv.hosted_invoice_url, '_blank', 'noopener,noreferrer')
        return
      }
      const { pay_url } = await api(`/api/billing/admin/invoices/${inv.id}/pay-link`, { method: 'POST' })
      if (pay_url) window.open(pay_url, '_blank', 'noopener,noreferrer')
    } catch (ex) {
      setErr(ex.message)
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
            All rehab-center invoices. Filter by paid vs not paid. Unpaid rows include a Stripe pay link.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[
              { id: 'all', label: `All (${invoiceCounts.all || invoices.length})` },
              { id: 'paid', label: `Paid (${invoiceCounts.paid || 0})` },
              { id: 'unpaid', label: `Not paid (${invoiceCounts.unpaid || 0})` },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                className={`btn ${invoiceFilter === item.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setInvoiceFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
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
                      {inv.payable && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyInv === `${inv.id}-pay`}
                          onClick={() => openPayLink(inv)}
                        >
                          {busyInv === `${inv.id}-pay` ? '…' : 'Pay in Stripe'}
                        </Button>
                      )}
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
            <p className="muted">No invoices in this filter.</p>
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

      {tab === 'stripe' && (
        <StripeSettingsForm
          status={stripe}
          onSaved={setStripe}
          onError={setErr}
        />
      )}
    </div>
  )
}
