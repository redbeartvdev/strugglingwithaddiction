import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './Upsells.css'

function StatusPill({ status }) {
  const label = {
    active: 'Active on listing',
    in_progress: 'In progress',
    fulfilled: 'Delivered',
    pending: 'Checkout pending',
    available: 'Available',
  }[status] || status
  const tone = status === 'active' || status === 'fulfilled'
    ? 'ok'
    : status === 'in_progress' || status === 'pending'
      ? 'warn'
      : 'muted'
  return <span className={`upsell-pill upsell-pill--${tone}`}>{label}</span>
}

function isMonthly(product) {
  return product.billing === 'monthly' || /\/mo/i.test(product.price_label || '')
}

function billingBadge(product) {
  if (isMonthly(product)) return 'Monthly subscription'
  if (product.billing === 'once' || /once/i.test(product.price_label || '')) return 'One-time'
  return product.fulfillment === 'human' ? 'One-time' : 'Upgrade'
}

function ctaLabel(product, busy) {
  if (busy === product.product_type) return 'Working…'
  if (product.status === 'in_progress') return 'In progress'
  if (product.status === 'pending') return 'Checkout pending'
  if (product.fulfillment === 'human') return 'Request package'
  if (isMonthly(product)) return `Subscribe monthly — ${product.price_label}`
  return 'Upgrade now'
}

function ProductCard({ product: p, owned, busy, publicListingUrl, onBuy }) {
  const benefits = p.benefits || []
  const features = p.features || []
  return (
    <Card className={`upsell-card${owned ? ' is-owned' : ''}${isMonthly(p) ? ' is-monthly' : ''}`}>
      <div className="upsell-card-top">
        <div className="upsell-card-meta">
          <span className={`upsell-billing${isMonthly(p) ? ' is-monthly' : ''}`}>{billingBadge(p)}</span>
          <span className="upsell-fulfill">
            {p.fulfillment === 'human' ? 'Team-fulfilled' : 'Self-serve'}
          </span>
        </div>
        <StatusPill status={p.status} />
      </div>

      <h3 className="upsell-card-title">{p.label}</h3>
      <p className="upsell-card-price">
        {p.price_label}
        {isMonthly(p) && <span className="upsell-card-price-note">billed monthly</span>}
      </p>
      <p className="upsell-card-desc">{p.tagline || p.description}</p>

      {benefits.length > 0 && (
        <div className="upsell-section">
          <p className="eyebrow">Benefits</p>
          <ul className="upsell-list">
            {benefits.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {features.length > 0 && (
        <div className="upsell-section">
          <p className="eyebrow">Features included</p>
          <ul className="upsell-list upsell-list--features">
            {features.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="upsell-card-actions">
        {owned && publicListingUrl ? (
          <a className="btn btn-primary" href={publicListingUrl} target="_blank" rel="noreferrer">
            View on listing
          </a>
        ) : (
          <Button
            type="button"
            disabled={busy === p.product_type || p.status === 'pending' || p.status === 'in_progress'}
            onClick={() => onBuy(p.product_type)}
          >
            {ctaLabel(p, busy)}
          </Button>
        )}
        {!owned && publicListingUrl && (
          <a className="btn btn-ghost" href={publicListingUrl} target="_blank" rel="noreferrer">
            Preview listing
          </a>
        )}
      </div>
    </Card>
  )
}

export default function ClientUpsells() {
  const [data, setData] = useState({ products: [] })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [params] = useSearchParams()

  function load() {
    return api('/api/client/upsells')
      .then(setData)
      .catch(e => setErr(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (params.get('success') === '1') {
      setMsg('Payment received. Your monthly upgrade will appear on the listing as soon as it activates.')
      load()
    } else if (params.get('canceled') === '1') {
      setErr('Checkout canceled — no charge was made.')
    }
  }, [params])

  async function buy(productType) {
    setBusy(productType)
    setErr('')
    setMsg('')
    try {
      const res = await api('/api/client/upsells/checkout', {
        method: 'POST',
        body: JSON.stringify({ product_type: productType }),
      })
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      setMsg(res.message || 'Request received — a specialist will contact you.')
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  const monthlyProducts = useMemo(
    () => (data.products || []).filter(isMonthly),
    [data.products],
  )
  const oneTimeProducts = useMemo(
    () => (data.products || []).filter(p => !isMonthly(p)),
    [data.products],
  )

  return (
    <div className="page-stack upsell-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Upgrades.</h1>
          <p className="page-sub">
            Subscribe monthly for Verified and Featured placement, or purchase one-time content packages.
          </p>
        </div>
      </header>

      {(data.verified_badge || data.featured_active || data.public_listing_url) && (
        <Card>
          <p className="eyebrow">Live on your listing</p>
          <div className="upsell-live-row">
            {data.verified_badge && <span className="upsell-pill upsell-pill--ok">Verified badge (monthly)</span>}
            {data.featured_active && <span className="upsell-pill upsell-pill--ok">Featured placement (monthly)</span>}
            {data.public_listing_url && (
              <a className="btn btn-primary btn-sm" href={data.public_listing_url} target="_blank" rel="noreferrer">
                View public listing
              </a>
            )}
            <Link className="btn btn-ghost btn-sm" to="/client/profile">Edit profile</Link>
            <Link className="btn btn-ghost btn-sm" to="/client/billing">Manage billing</Link>
          </div>
        </Card>
      )}

      {err && <p className="form-error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      {monthlyProducts.length > 0 && (
        <section className="upsell-group">
          <div className="upsell-group-head">
            <div>
              <p className="eyebrow">Monthly subscriptions</p>
              <h2 className="upsell-group-title">Verified & Featured placement</h2>
              <p className="muted" style={{ margin: 0 }}>
                Recurring monthly upgrades you can start or cancel anytime from billing.
              </p>
            </div>
          </div>
          <div className="upsell-grid">
            {monthlyProducts.map(p => (
              <ProductCard
                key={p.product_type}
                product={p}
                owned={p.owned || p.status === 'active' || p.status === 'fulfilled'}
                busy={busy}
                publicListingUrl={data.public_listing_url}
                onBuy={buy}
              />
            ))}
          </div>
        </section>
      )}

      {oneTimeProducts.length > 0 && (
        <section className="upsell-group">
          <div className="upsell-group-head">
            <div>
              <p className="eyebrow">One-time packages</p>
              <h2 className="upsell-group-title">Content & AEO</h2>
              <p className="muted" style={{ margin: 0 }}>
                Editorial packages fulfilled by our team after purchase.
              </p>
            </div>
          </div>
          <div className="upsell-grid">
            {oneTimeProducts.map(p => (
              <ProductCard
                key={p.product_type}
                product={p}
                owned={p.owned || p.status === 'active' || p.status === 'fulfilled'}
                busy={busy}
                publicListingUrl={data.public_listing_url}
                onBuy={buy}
              />
            ))}
          </div>
        </section>
      )}

      <Card className="upsell-compare">
        <p className="eyebrow">Quick compare</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Upgrade</th>
                <th>Billing</th>
                <th>Price</th>
                <th>Best for</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data.products || []).map(p => (
                <tr key={`compare-${p.product_type}`}>
                  <td><strong>{p.label}</strong></td>
                  <td>{isMonthly(p) ? 'Monthly' : 'One-time'}</td>
                  <td>{p.price_label}</td>
                  <td className="muted">{p.description}</td>
                  <td>
                    {(p.owned || p.status === 'active' || p.status === 'fulfilled') ? (
                      <StatusPill status={p.status === 'fulfilled' ? 'fulfilled' : 'active'} />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy === p.product_type || p.status === 'pending' || p.status === 'in_progress'}
                        onClick={() => buy(p.product_type)}
                      >
                        {isMonthly(p) ? 'Subscribe' : ctaLabel(p, busy)}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
