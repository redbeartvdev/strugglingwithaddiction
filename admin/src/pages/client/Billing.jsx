import { useEffect, useState } from 'react'
import { api, apiBlob } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import {
  LISTING_DISCOUNT_PCT,
  LISTING_FEATURES,
  LISTING_MONTHLY_PRICE,
  LISTING_YEARLY_EFFECTIVE_MO,
  LISTING_YEARLY_FULL,
  LISTING_YEARLY_PRICE,
  LISTING_YEARLY_SAVINGS,
} from '../../lib/listingPlans'

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ClientBilling() {
  const [sub, setSub] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [meta, setMeta] = useState({ stripe_configured: true, has_customer: true })
  const [err, setErr] = useState('')
  const [busyPdf, setBusyPdf] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    api('/api/billing/subscription').then(setSub).catch(e => setErr(e.message))
    Promise.all([
      api('/api/billing/invoices'),
      api('/api/billing/payments'),
    ])
      .then(([inv, pay]) => {
        setInvoices(inv.invoices || [])
        setPayments(pay.payments || [])
        setMeta({
          stripe_configured: inv.stripe_configured !== false && pay.stripe_configured !== false,
          has_customer: Boolean(inv.has_customer || pay.has_customer),
        })
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoadingHistory(false))
  }, [])

  async function checkout(plan) {
    setErr('')
    try {
      const { checkout_url } = await api('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ interval: plan }),
      })
      window.location.href = checkout_url
    } catch (e) {
      setErr(e.message)
    }
  }

  async function portal() {
    const { portal_url } = await api('/api/billing/portal', { method: 'POST' })
    window.location.href = portal_url
  }

  async function downloadHistoryPdf() {
    setBusyPdf('history')
    setErr('')
    try {
      const { blob, filename } = await apiBlob('/api/billing/history.pdf')
      downloadBlob(blob, filename)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyPdf('')
    }
  }

  async function downloadInvoicePdf(invoice) {
    setBusyPdf(invoice.id)
    setErr('')
    try {
      if (invoice.invoice_pdf) {
        window.open(invoice.invoice_pdf, '_blank', 'noopener,noreferrer')
        return
      }
      const { blob, filename } = await apiBlob(`/api/billing/invoices/${invoice.id}/pdf`)
      downloadBlob(blob, filename || `${invoice.number || invoice.id}.pdf`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyPdf('')
    }
  }

  const active = ['active', 'trialing', 'past_due'].includes(sub?.status)

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Billing.</h1>
        <p className="page-sub">Status: {sub?.status || 'inactive'}</p>
      </header>

      {!active && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Card>
            <p className="eyebrow">Best value · Save {LISTING_DISCOUNT_PCT}%</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0' }}>
              ${LISTING_YEARLY_PRICE.toFixed(2)}
              <span style={{ fontSize: '1rem' }}>/yr</span>
            </p>
            <p className="muted">Only ${LISTING_YEARLY_EFFECTIVE_MO.toFixed(2)}/mo billed annually</p>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--muted, #6b7280)' }}>
              <li>
                <span style={{ textDecoration: 'line-through' }}>${LISTING_YEARLY_FULL.toFixed(2)}</span>
                {' '}→ ${LISTING_YEARLY_PRICE.toFixed(2)}
              </li>
              <li>You save ${LISTING_YEARLY_SAVINGS.toFixed(2)} / year</li>
            </ul>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {LISTING_FEATURES.map(f => <li key={f}>{f}</li>)}
            </ul>
            <Button type="button" style={{ marginTop: 12 }} onClick={() => checkout('year')}>
              Choose annual
            </Button>
          </Card>
          <Card>
            <p className="eyebrow">Monthly</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0' }}>
              ${LISTING_MONTHLY_PRICE.toFixed(2)}
              <span style={{ fontSize: '1rem' }}>/mo</span>
            </p>
            <p className="muted">Flexible — cancel anytime</p>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--muted, #6b7280)' }}>
              <li>Billed every month</li>
              <li>Annual total if kept: ${LISTING_YEARLY_FULL.toFixed(2)}</li>
            </ul>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {LISTING_FEATURES.map(f => <li key={f}>{f}</li>)}
            </ul>
            <Button type="button" variant="ghost" style={{ marginTop: 12 }} onClick={() => checkout('month')}>
              Choose monthly
            </Button>
          </Card>
        </div>
      )}

      {active && (
        <Card>
          <p>Plan: {sub?.plan_name || 'Base listing'} · {sub?.interval || '—'}</p>
      {sub?.status === 'past_due' && (
            <p className="form-error" style={{ marginTop: 8 }}>
              Your latest payment needs attention. Update your card before Stripe’s retries are exhausted.
            </p>
          )}
          {sub?.status === 'unpaid' && (
            <p className="form-error" style={{ marginTop: 8 }}>
              Payment failed and retries were exhausted. Update your card to restore your listing.
            </p>
          )}
          {(sub?.status === 'past_due' || sub?.status === 'unpaid') && (
            <div className="card" style={{ marginTop: 12, padding: 12, border: '1px solid #fecaca', background: '#fef2f2' }}>
              <p className="eyebrow">Payment renewal</p>
              <p style={{ marginTop: 4 }}>This alert only appears when a renewal payment did not go through.</p>
              <Button type="button" style={{ marginTop: 8 }} onClick={portal}>Update payment method</Button>
            </div>
          )}
          {sub?.current_period_end && (
            <p className="muted">Current period ends {new Date(sub.current_period_end).toLocaleDateString()}</p>
          )}
          <p className="muted" style={{ marginTop: 8 }}>Cancel or update card via the Stripe customer portal. Access continues through the paid period.</p>
          <div className="form-actions" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button type="button" onClick={portal}>Manage billing</Button>
            <Button type="button" variant="ghost" disabled={busyPdf === 'history'} onClick={downloadHistoryPdf}>
              {busyPdf === 'history' ? 'Preparing PDF…' : 'Download history PDF'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">Invoices</p>
            <p className="muted" style={{ marginTop: 4 }}>Official Stripe invoices for your subscription and upgrades.</p>
          </div>
          <Button type="button" variant="ghost" disabled={busyPdf === 'history' || loadingHistory} onClick={downloadHistoryPdf}>
            {busyPdf === 'history' ? 'Preparing PDF…' : 'Download all as PDF'}
          </Button>
        </div>

        {loadingHistory ? (
          <p className="muted" style={{ marginTop: 16 }}>Loading invoices…</p>
        ) : !meta.stripe_configured && invoices.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No invoices yet.</p>
        ) : !meta.has_customer && invoices.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No billing account yet. Choose a plan above to start.</p>
        ) : invoices.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No invoices yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{formatDate(inv.created)}</td>
                    <td>{inv.number}</td>
                    <td>{inv.description}</td>
                    <td style={{ textTransform: 'capitalize' }}>{inv.status}</td>
                    <td>{inv.amount_label}</td>
                    <td className="table-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyPdf === `view-${inv.id}` || (!inv.invoice_pdf && inv.status === 'draft')}
                        onClick={async () => {
                          setBusyPdf(`view-${inv.id}`)
                          try {
                            if (inv.hosted_invoice_url) {
                              window.open(inv.hosted_invoice_url, '_blank', 'noopener,noreferrer')
                              return
                            }
                            if (inv.invoice_pdf) {
                              window.open(inv.invoice_pdf, '_blank', 'noopener,noreferrer')
                              return
                            }
                            const { blob } = await apiBlob(`/api/billing/invoices/${inv.id}/pdf`)
                            const url = URL.createObjectURL(blob)
                            window.open(url, '_blank', 'noopener,noreferrer')
                            setTimeout(() => URL.revokeObjectURL(url), 60_000)
                          } catch (e) {
                            setErr(e.message)
                          } finally {
                            setBusyPdf('')
                          }
                        }}
                      >
                        {busyPdf === `view-${inv.id}` ? '…' : 'View'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyPdf === inv.id || (!inv.invoice_pdf && inv.status === 'draft' && !inv.id)}
                        onClick={() => downloadInvoicePdf(inv)}
                      >
                        {busyPdf === inv.id ? '…' : 'Download PDF'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <p className="eyebrow">Payment history</p>
        <p className="muted" style={{ marginTop: 4 }}>Charges and receipts from Stripe.</p>

        {loadingHistory ? (
          <p className="muted" style={{ marginTop: 16 }}>Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No payments recorded yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map(pay => (
                  <tr key={pay.id}>
                    <td>{formatDate(pay.created)}</td>
                    <td>
                      {pay.description}
                      {pay.failure_message && <div className="form-error" style={{ fontSize: 12 }}>{pay.failure_message}</div>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{pay.status}{pay.paid ? '' : ''}</td>
                    <td>{pay.amount_label}</td>
                    <td className="table-actions">
                      {pay.receipt_url ? (
                        <a className="btn btn-ghost btn-sm" href={pay.receipt_url} target="_blank" rel="noreferrer">
                          Receipt
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {err && <p className="form-error">{err}</p>}
    </div>
  )
}
