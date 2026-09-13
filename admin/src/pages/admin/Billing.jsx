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
  const [catalog, setCatalog] = useState([])
  const [editor, setEditor] = useState(null)
  const [centerQuery, setCenterQuery] = useState('')
  const [centerHits, setCenterHits] = useState([])
  const [savingSale, setSavingSale] = useState(false)

  useEffect(() => {
    if (tab !== 'invoices') return
    api('/api/billing/admin/sale-catalog').then(d => setCatalog(d.items || [])).catch(() => {})
  }, [tab])

  useEffect(() => {
    if (!editor || editor.id || !centerQuery.trim()) {
      setCenterHits([])
      return
    }
    const handle = setTimeout(() => {
      api(`/api/admin/rehab-centers?q=${encodeURIComponent(centerQuery.trim())}&per_page=8`)
        .then(d => setCenterHits(d.items || []))
        .catch(() => setCenterHits([]))
    }, 220)
    return () => clearTimeout(handle)
  }, [centerQuery, editor])

  function emptyLine(item) {
    return {
      catalog_key: item?.key || 'custom',
      description: item?.label || '',
      quantity: 1,
      unit_amount_cents: item?.amount_cents || 0,
      interval: item?.interval || 'once',
      source: item?.source || 'custom',
    }
  }

  function openNewSale() {
    setViewInv(null)
    setCenterQuery('')
    setEditor({
      id: null,
      rehab_center_id: null,
      center_name: '',
      email: '',
      status: 'paid',
      description: '',
      lines: [emptyLine(catalog.find(i => i.key === 'subscription_yearly') || catalog[0])],
    })
  }

  function openSale(inv) {
    setViewInv(null)
    setCenterQuery('')
    setEditor({
      id: inv.id,
      number: inv.number,
      rehab_center_id: inv.rehab_center_id,
      center_name: inv.center_name || '',
      email: inv.email || '',
      status: inv.status || 'paid',
      description: inv.description || '',
      lines: (inv.lines && inv.lines.length)
        ? inv.lines.map(line => ({
          catalog_key: line.catalog_key,
          description: line.description,
          quantity: line.quantity || 1,
          unit_amount_cents: line.unit_amount_cents || 0,
          interval: line.interval || 'once',
          source: line.source || 'custom',
        }))
        : [emptyLine({ key: 'custom', label: inv.product_label || 'Sale item', amount_cents: inv.amount_due || inv.amount_paid || 0, interval: inv.interval, source: inv.source })],
    })
  }

  async function openSaleById(id) {
    const detail = await api(`/api/billing/admin/invoices/${id}`)
    openSale(detail)
  }

  function saleTotalCents(sale) {
    return (sale?.lines || []).reduce((sum, line) => sum + (Number(line.quantity) || 1) * (Number(line.unit_amount_cents) || 0), 0)
  }

  function updateLine(index, patch) {
    setEditor(cur => ({
      ...cur,
      lines: cur.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }))
  }

  async function saveSale() {
    if (!editor) return
    if (!editor.lines.length) {
      setErr('Add at least one payment item.')
      return
    }
    if (!editor.id && !editor.rehab_center_id) {
      setErr('Choose a rehab center for this sale.')
      return
    }
    setSavingSale(true)
    setErr('')
    try {
      const payload = {
        status: editor.status,
        rehab_center_id: editor.rehab_center_id || null,
        description: editor.description || null,
        lines: editor.lines.map(line => ({
          catalog_key: line.catalog_key || 'custom',
          description: line.description,
          quantity: Number(line.quantity) || 1,
          unit_amount_cents: Math.round(Number(line.unit_amount_cents) || 0),
          interval: line.interval || null,
          source: line.source || null,
        })),
      }
      const saved = editor.id
        ? await api(`/api/billing/admin/invoices/${editor.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/billing/admin/invoices', { method: 'POST', body: JSON.stringify(payload) })
      openSale(saved)
      loadTab('invoices')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSavingSale(false)
    }
  }

  async function deleteSale() {
    if (!editor?.id) return
    if (!confirm('Delete this sale and its payment items?')) return
    setSavingSale(true)
    setErr('')
    try {
      await api(`/api/billing/admin/invoices/${editor.id}`, { method: 'DELETE' })
      setEditor(null)
      loadTab('invoices')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSavingSale(false)
    }
  }

  async function downloadInvoicePdf(inv, { inline = false } = {}) {
    setBusyInv(`${inv.id}-${inline ? 'view' : 'dl'}`)
    setErr('')
    try {
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
            Manage each sale: add listing subscriptions, service upgrades, or custom payment items. PDFs say Invoice, not Tax Invoice.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
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
            <Button type="button" onClick={openNewSale}>New sale</Button>
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
                        onClick={() => openSaleById(inv.id).catch(e => setErr(e.message))}
                      >
                        Edit
                      </Button>
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

          {editor && (
            <div className="card card-flat" style={{ marginTop: 16 }}>
              <p className="eyebrow">{editor.id ? 'Edit sale' : 'New sale'}</p>
              <p style={{ fontWeight: 700, marginBottom: 12 }}>
                {editor.number || 'Draft invoice'}
                {editor.email ? ` · ${editor.email}` : ''}
              </p>

              {!editor.id && (
                <div style={{ marginBottom: 16 }}>
                  <label>Rehab center</label>
                  <input
                    value={centerQuery}
                    onChange={e => setCenterQuery(e.target.value)}
                    placeholder="Search center name…"
                  />
                  {editor.center_name && (
                    <p className="muted" style={{ marginTop: 6 }}>Selected: {editor.center_name}</p>
                  )}
                  {centerHits.length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      {centerHits.map(center => (
                        <button
                          key={center.id}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setEditor(cur => ({ ...cur, rehab_center_id: center.id, center_name: center.name }))
                            setCenterQuery(center.name)
                            setCenterHits([])
                          }}
                        >
                          {center.name}
                          {center.location_display ? ` · ${center.location_display}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {editor.id && (
                <p className="muted" style={{ marginBottom: 12 }}>{editor.center_name || 'No center linked'}</p>
              )}

              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <div>
                  <label>Status</label>
                  <select value={editor.status} onChange={e => setEditor(cur => ({ ...cur, status: e.target.value }))}>
                    <option value="paid">Paid</option>
                    <option value="open">Open / unpaid</option>
                    <option value="draft">Draft</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div>
                  <label>Internal note</label>
                  <input
                    value={editor.description}
                    onChange={e => setEditor(cur => ({ ...cur, description: e.target.value }))}
                    placeholder="Optional note on this sale"
                  />
                </div>
              </div>

              <p className="eyebrow">Payment items</p>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editor.lines.map((line, index) => (
                      <tr key={`${line.catalog_key}-${index}`}>
                        <td>
                          <input
                            value={line.description}
                            onChange={e => updateLine(index, { description: e.target.value })}
                          />
                          <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            {(line.interval || 'once').replace('_', ' ')} · {line.source || 'custom'}
                          </p>
                        </td>
                        <td style={{ width: 80 }}>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={e => updateLine(index, { quantity: Number(e.target.value) || 1 })}
                          />
                        </td>
                        <td style={{ width: 140 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={((Number(line.unit_amount_cents) || 0) / 100).toFixed(2)}
                            onChange={e => updateLine(index, { unit_amount_cents: Math.round(Number(e.target.value || 0) * 100) })}
                          />
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditor(cur => ({ ...cur, lines: cur.lines.filter((_, i) => i !== index) }))}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <select
                  defaultValue=""
                  onChange={e => {
                    const item = catalog.find(c => c.key === e.target.value)
                    e.target.value = ''
                    if (item) setEditor(cur => ({ ...cur, lines: [...cur.lines, emptyLine(item)] }))
                  }}
                >
                  <option value="" disabled>Add existing item…</option>
                  {catalog.filter(item => item.group === 'subscription').map(item => (
                    <option key={item.key} value={item.key}>{item.label} · ${(item.amount_cents / 100).toFixed(2)}</option>
                  ))}
                  {catalog.filter(item => item.group === 'services').map(item => (
                    <option key={item.key} value={item.key}>{item.label} · ${(item.amount_cents / 100).toFixed(2)}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditor(cur => ({ ...cur, lines: [...cur.lines, emptyLine(catalog.find(i => i.key === 'custom'))] }))}
                >
                  Add custom payment
                </Button>
                <strong style={{ marginLeft: 'auto' }}>
                  Total {money(`USD ${(saleTotalCents(editor) / 100).toFixed(2)}`)}
                </strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <Button type="button" onClick={saveSale} disabled={savingSale}>
                  {savingSale ? 'Saving…' : editor.id ? 'Save sale' : 'Create sale'}
                </Button>
                {editor.id && (
                  <Button type="button" variant="ghost" onClick={() => downloadInvoicePdf({ id: editor.id, number: editor.number }, { inline: true })}>
                    View invoice
                  </Button>
                )}
                {editor.id && (
                  <Button type="button" variant="ghost" onClick={deleteSale} disabled={savingSale}>
                    Delete sale
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setEditor(null)}>Close</Button>
              </div>
            </div>
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
