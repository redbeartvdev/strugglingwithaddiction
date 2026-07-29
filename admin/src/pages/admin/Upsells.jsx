import { useEffect, useState } from 'react'
import { api } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const emptyForm = {
  product_key: '',
  label: '',
  price_label: '',
  amount_cents: 0,
  fulfillment: 'human',
  description: '',
  detail_text: '',
  enabled: true,
  sort_order: 100,
  stripe_price_id: '',
}

export default function AdminUpsells() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  function loadOrders() {
    return api('/api/admin/upsell-orders').then(setOrders)
  }

  function loadProducts() {
    return api('/api/admin/upsell-products').then(setProducts)
  }

  function load() {
    return Promise.all([loadProducts(), loadOrders()])
  }

  useEffect(() => {
    load().catch(e => setErr(e.message))
  }, [])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function startCreate() {
    setCreating(true)
    setEditingId(null)
    setForm({ ...emptyForm, sort_order: (products.length + 1) * 10 })
    setErr('')
    setMsg('')
  }

  function startEdit(row) {
    setCreating(false)
    setEditingId(row.id)
    setForm({
      product_key: row.product_key || '',
      label: row.label || '',
      price_label: row.price_label || '',
      amount_cents: row.amount_cents || 0,
      fulfillment: row.fulfillment || 'human',
      description: row.description || '',
      detail_text: row.detail_text || '',
      enabled: Boolean(row.enabled),
      sort_order: row.sort_order ?? 0,
      stripe_price_id: row.stripe_price_id || '',
    })
    setErr('')
    setMsg('')
  }

  function cancelForm() {
    setCreating(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function saveProduct(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    const body = {
      label: form.label.trim(),
      price_label: form.price_label.trim(),
      amount_cents: Number(form.amount_cents) || 0,
      fulfillment: form.fulfillment,
      description: form.description.trim(),
      detail_text: form.detail_text.trim(),
      enabled: Boolean(form.enabled),
      sort_order: Number(form.sort_order) || 0,
      stripe_price_id: form.stripe_price_id.trim() || null,
    }
    try {
      if (creating) {
        body.product_key = form.product_key.trim() || undefined
        await api('/api/admin/upsell-products', { method: 'POST', body: JSON.stringify(body) })
        setMsg('Package created.')
      } else if (editingId) {
        const row = products.find(p => p.id === editingId)
        if (row && !row.is_system) {
          body.product_key = form.product_key.trim()
        }
        await api(`/api/admin/upsell-products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        setMsg('Package updated.')
      }
      cancelForm()
      await loadProducts()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(row) {
    const action = row.is_system ? 'Disable' : 'Delete'
    if (!confirm(`${action} “${row.label}”?`)) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const res = await api(`/api/admin/upsell-products/${row.id}`, { method: 'DELETE' })
      setMsg(res.message || (res.deleted ? 'Package deleted.' : 'Package disabled.'))
      if (editingId === row.id) cancelForm()
      await loadProducts()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function markFulfilled(id) {
    try {
      await api(`/api/admin/upsell-orders/${id}?status=fulfilled`, { method: 'PATCH' })
      await loadOrders()
    } catch (e) {
      setErr(e.message)
    }
  }

  const showForm = creating || editingId != null

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Upsells.</h1>
        <p className="page-sub">Manage package cards shown to clients, then fulfill human Article / AEO orders.</p>
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <section className="page-stack" style={{ gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">PACKAGE CATALOG</p>
            <p className="muted" style={{ margin: 0 }}>Headline, detail, price, and fulfillment for each upsell card.</p>
          </div>
          {!showForm && (
            <Button type="button" onClick={startCreate}>Add package</Button>
          )}
        </div>

        {showForm && (
          <Card>
            <form onSubmit={saveProduct} className="page-stack" style={{ gap: 12 }}>
              <p className="eyebrow">{creating ? 'NEW PACKAGE' : 'EDIT PACKAGE'}</p>
              <div className="form-grid-2">
                <div>
                  <label htmlFor="upsell-label">Title</label>
                  <input
                    id="upsell-label"
                    required
                    value={form.label}
                    onChange={e => setField('label', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="upsell-price-label">Price label</label>
                  <input
                    id="upsell-price-label"
                    required
                    value={form.price_label}
                    onChange={e => setField('price_label', e.target.value)}
                    placeholder="$249 / mo"
                  />
                </div>
                <div>
                  <label htmlFor="upsell-amount">Amount (cents)</label>
                  <input
                    id="upsell-amount"
                    type="number"
                    min="0"
                    value={form.amount_cents}
                    onChange={e => setField('amount_cents', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="upsell-fulfillment">Fulfillment</label>
                  <select
                    id="upsell-fulfillment"
                    value={form.fulfillment}
                    onChange={e => setField('fulfillment', e.target.value)}
                  >
                    <option value="self_serve">Self-serve (Stripe)</option>
                    <option value="human">Human close</option>
                  </select>
                </div>
                <div className="form-span-2">
                  <label htmlFor="upsell-description">Headline</label>
                  <input
                    id="upsell-description"
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Short headline under the price"
                  />
                </div>
                <div className="form-span-2">
                  <label htmlFor="upsell-detail">Detail</label>
                  <textarea
                    id="upsell-detail"
                    rows={3}
                    value={form.detail_text}
                    onChange={e => setField('detail_text', e.target.value)}
                    placeholder="Supporting detail shown in the card preview box"
                  />
                </div>
                <div>
                  <label htmlFor="upsell-key">Product key</label>
                  <input
                    id="upsell-key"
                    value={form.product_key}
                    onChange={e => setField('product_key', e.target.value)}
                    disabled={!creating && products.find(p => p.id === editingId)?.is_system}
                    placeholder="auto from title if blank"
                  />
                </div>
                <div>
                  <label htmlFor="upsell-sort">Sort order</label>
                  <input
                    id="upsell-sort"
                    type="number"
                    value={form.sort_order}
                    onChange={e => setField('sort_order', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="upsell-stripe">Stripe price ID (optional)</label>
                  <input
                    id="upsell-stripe"
                    value={form.stripe_price_id}
                    onChange={e => setField('stripe_price_id', e.target.value)}
                    placeholder="price_…"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={e => setField('enabled', e.target.checked)}
                    />
                    Active on client Upsells page
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save package'}</Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={cancelForm}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Price</th>
                  <th>Headline</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No packages yet.</td></tr>
                ) : products.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.label}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{row.product_key} · {row.fulfillment}</div>
                    </td>
                    <td>
                      {row.price_label}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>${((row.amount_cents || 0) / 100).toFixed(2)}</div>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <div>{row.description || '—'}</div>
                      {row.detail_text ? (
                        <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>{row.detail_text}</div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={row.enabled ? 'ok' : 'warn'}>{row.enabled ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => deleteProduct(row)}>
                          {row.is_system ? 'Disable' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="page-stack" style={{ gap: 12 }}>
        <div>
          <p className="eyebrow">ORDERS</p>
          <p className="muted" style={{ margin: 0 }}>Self-serve badge/placement checkouts and human Article / AEO pipeline.</p>
        </div>
        <Card className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Center</th>
                  <th>Product</th>
                  <th>Fulfillment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No upsell orders yet.</td></tr>
                ) : orders.map(order => (
                  <tr key={order.id}>
                    <td>{order.center_name || order.rehab_center_id}</td>
                    <td>{order.product_type}</td>
                    <td>{order.fulfillment}</td>
                    <td>${((order.amount_cents || 0) / 100).toFixed(2)}</td>
                    <td><Badge tone={order.status === 'fulfilled' || order.status === 'paid' ? 'ok' : 'warn'}>{order.status}</Badge></td>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</td>
                    <td>
                      {order.fulfillment === 'human' && order.status !== 'fulfilled' && (
                        <Button type="button" className="btn btn-ghost btn-sm" onClick={() => markFulfilled(order.id)}>Mark fulfilled</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}
