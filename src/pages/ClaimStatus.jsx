import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchApi, apiEnabled, getApiBase } from '../lib/api'
import ListingPlanPicker from '../components/ListingPlanPicker'
import './RehabCenters.css'

export default function ClaimStatus() {
  const { ticket } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneMessage, setPhoneMessage] = useState('')

  const load = () => {
    if (!apiEnabled()) {
      setError('API not configured')
      return
    }
    fetchApi(`/api/rehab/claims/${encodeURIComponent(ticket)}`)
      .then(setData)
      .catch(e => setError(e.message))
  }

  useEffect(() => { load() }, [ticket])

  useEffect(() => {
    if (searchParams.get('paid') === '1') {
      const t = setTimeout(load, 1500)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  async function uploadCert(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const base = getApiBase()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${base}/api/rehab/claims/${encodeURIComponent(ticket)}/cert`, {
        method: 'POST',
        body: form,
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : null
      if (!res.ok) throw new Error(json?.detail || 'Upload failed')
      setData(d => ({ ...d, status: json.status, message: json.message, payment_received: true }))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function subscribe(interval) {
    setBusy(true)
    setError('')
    try {
      const res = await fetchApi('/api/billing/checkout-claim', {
        method: 'POST',
        body: JSON.stringify({ ticket_number: ticket, interval }),
      })
      window.location.href = res.checkout_url
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function sendPhoneCode() {
    setBusy(true)
    setError('')
    try {
      const res = await fetchApi(`/api/rehab/claims/${encodeURIComponent(ticket)}/phone/send`, { method: 'POST' })
      setPhoneMessage(res.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyPhoneCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetchApi(`/api/rehab/claims/${encodeURIComponent(ticket)}/phone/verify`, {
        method: 'POST',
        body: JSON.stringify({ code: phoneCode }),
      })
      setPhoneMessage(res.message)
      setPhoneCode('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const needsPayment = data && !data.payment_received && data.checkout_ready
  const canUploadCert = data && data.payment_received && (data.status === 'pending' || data.status === 'under_review')

  return (
    <main className="rehab-page" style={{ padding: '4rem 1rem' }}>
      <div className="container" style={{ maxWidth: needsPayment ? 760 : 560 }}>
        <h1>Claim Status</h1>
        {searchParams.get('paid') === '1' && (
          <p style={{ color: '#166534', marginTop: 8 }}>Payment received — continue verification below.</p>
        )}
        {error && <p style={{ color: '#8c1126' }}>{error}</p>}
        {data && (
          <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <p><strong>Ticket:</strong> {data.ticket_number}</p>
            <p><strong>Center:</strong> {data.center_name}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p><strong>Payment:</strong> {data.payment_received ? 'Received' : 'Required'}</p>
            <p style={{ marginTop: '1rem' }}>{data.message}</p>

            {needsPayment && (
              <div style={{ marginTop: '1.25rem' }}>
                <ListingPlanPicker
                  centerName={data.center_name}
                  ticket={data.ticket_number}
                  busy={busy}
                  onSelect={subscribe}
                />
              </div>
            )}

            {canUploadCert && (
              <label style={{ display: 'block', marginTop: '1.25rem' }}>
                Upload rehab certification (required)
                <input type="file" accept=".pdf,image/*" disabled={busy} onChange={uploadCert} style={{ display: 'block', marginTop: 8 }} />
              </label>
            )}

            {data.status !== 'approved' && data.payment_received && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <p><strong>Ownership verification</strong></p>
                <p style={{ fontSize: '.9rem' }}>Certificate: {data.certification_uploaded ? '✓ uploaded' : 'pending'}</p>
                <p style={{ fontSize: '.9rem' }}>Work email domain: {data.email_domain_matched ? '✓ matches listing website' : 'does not yet match'}</p>
                <p style={{ fontSize: '.9rem' }}>Facility phone callback: {data.phone_verified ? '✓ verified' : 'pending'}</p>
                {!data.phone_verified && (
                  <>
                    <button type="button" className="btn" disabled={busy} onClick={sendPhoneCode} style={{ marginTop: 8 }}>
                      Send callback code to facility
                    </button>
                    <form onSubmit={verifyPhoneCode} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        aria-label="Facility callback code"
                        value={phoneCode}
                        onChange={e => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        required
                      />
                      <button type="submit" className="btn" disabled={busy || phoneCode.length !== 6}>Verify code</button>
                    </form>
                  </>
                )}
                {phoneMessage && <p style={{ fontSize: '.9rem', marginTop: 8 }}>{phoneMessage}</p>}
              </div>
            )}

            {data.status === 'approved' && (
              <p style={{ marginTop: 12 }}>
                <a href={`${import.meta.env.VITE_ADMIN_SITE_URL || 'http://127.0.0.1:5180'}/login`}>Log in to your dashboard →</a>
              </p>
            )}
          </div>
        )}
        <p style={{ marginTop: '2rem' }}>
          <Link to="/rehab-centers">← Back to directory</Link>
        </p>
      </div>
    </main>
  )
}
