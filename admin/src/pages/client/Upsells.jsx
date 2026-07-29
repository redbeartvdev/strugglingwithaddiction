import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

function StatusPill({ status }) {
  const label = {
    active: 'Active on listing',
    in_progress: 'In progress',
    fulfilled: 'Delivered',
    pending: 'Checkout pending',
    available: 'Available',
  }[status] || status
  const tone = status === 'active' || status === 'fulfilled' ? 'ok' : status === 'in_progress' || status === 'pending' ? 'warn' : 'muted'
  return <span className={`upsell-pill upsell-pill--${tone}`}>{label}</span>
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
      setMsg('Payment received. Your upgrade will appear on the listing as soon as it activates.')
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

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Upsells.</h1>
        <p className="page-sub">Upgrade visibility, then open your public listing to see the live result.</p>
      </header>

      {(data.verified_badge || data.featured_active || data.public_listing_url) && (
        <Card>
          <p className="eyebrow">LIVE ON YOUR LISTING</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, alignItems: 'center' }}>
            {data.verified_badge && <StatusPill status="active" />}
            {data.featured_active && <span className="upsell-pill upsell-pill--ok">Featured placement</span>}
            {data.public_listing_url && (
              <a className="btn btn-primary btn-sm" href={data.public_listing_url} target="_blank" rel="noreferrer">
                View public listing
              </a>
            )}
            <Link className="btn btn-ghost btn-sm" to="/client/profile">Edit profile</Link>
          </div>
        </Card>
      )}

      {err && <p className="form-error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {(data.products || []).map(p => {
          const owned = p.owned || p.status === 'active' || p.status === 'fulfilled'
          return (
            <Card key={p.product_type}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <p className="eyebrow">{p.fulfillment === 'human' ? 'HUMAN CLOSE' : 'SELF-SERVE'}</p>
                <StatusPill status={p.status} />
              </div>
              <h3 style={{ marginTop: 8 }}>{p.label}</h3>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '8px 0' }}>{p.price_label}</p>
              <p className="muted">{p.description}</p>

              {p.detail_text ? (
                <div className="upsell-preview">
                  <p>{p.detail_text}</p>
                </div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {owned && data.public_listing_url ? (
                  <a className="btn btn-primary" href={data.public_listing_url} target="_blank" rel="noreferrer">
                    View on listing
                  </a>
                ) : (
                  <Button
                    type="button"
                    disabled={busy === p.product_type || p.status === 'pending' || p.status === 'in_progress'}
                    onClick={() => buy(p.product_type)}
                  >
                    {busy === p.product_type
                      ? 'Working…'
                      : p.status === 'in_progress'
                        ? 'In progress'
                        : p.fulfillment === 'human'
                          ? 'Request package'
                          : 'Upgrade now'}
                  </Button>
                )}
                {!owned && data.public_listing_url && (
                  <a className="btn btn-ghost" href={data.public_listing_url} target="_blank" rel="noreferrer">
                    Preview listing
                  </a>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <style>{`
        .upsell-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.25rem 0.7rem;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .upsell-pill--ok { background: #e8f5ef; color: #176b45; }
        .upsell-pill--warn { background: #fff6e8; color: #9a6700; }
        .upsell-pill--muted { background: #f3f4f6; color: #6b7280; }
        .upsell-preview {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f7fafb;
          border: 1px solid #e5e7eb;
          font-size: 0.9rem;
        }
        .upsell-preview p { margin: 0; }
      `}</style>
    </div>
  )
}
