import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchApi, apiEnabled, getApiBase } from '../lib/api'
import ListingPlanPicker from '../components/ListingPlanPicker'
import './RehabCenters.css'

function invoiceHref(invoice) {
  if (!invoice) return ''
  if (invoice.invoice_pdf) return invoice.invoice_pdf
  if (invoice.hosted_invoice_url) return invoice.hosted_invoice_url
  if (invoice.download_path) return `${getApiBase()}${invoice.download_path}`
  return ''
}

export default function ClaimStatus() {
  const { ticket } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const returnedPaid = searchParams.get('paid') === '1'
  const canceled = searchParams.get('canceled') === '1'

  const load = () => {
    if (!apiEnabled()) {
      setError('API not configured')
      return
    }
    const qs = returnedPaid ? '?confirm_paid=1' : ''
    fetchApi(`/api/rehab/claims/${encodeURIComponent(ticket)}${qs}`)
      .then(setData)
      .catch(e => setError(e.message))
  }

  useEffect(() => { load() }, [ticket, returnedPaid])

  const invoiceReady = Boolean(
    data?.invoice?.download_path || data?.invoice?.invoice_pdf || data?.invoice?.hosted_invoice_url,
  )

  useEffect(() => {
    if (!returnedPaid || invoiceReady) return
    const timers = [1500, 4000, 8000, 14000].map(ms => setTimeout(load, ms))
    return () => timers.forEach(clearTimeout)
  }, [returnedPaid, ticket, invoiceReady])

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

  const paymentReceived = Boolean(data?.payment_received) || returnedPaid
  const needsPayment = data && !paymentReceived && data.checkout_ready
  const approved = data?.status === 'approved'
  const rejected = data?.status === 'rejected' || data?.status === 'abandoned'
  const showPaidConfirmation = paymentReceived && !rejected
  const invoice = data?.invoice
  const downloadUrl = invoiceHref(invoice)
  const ticketNumber = data?.ticket_number || ticket
  const centerName = data?.center_name

  return (
    <main className="rehab-page claim-status-page">
      <div className={`container claim-status-wrap${needsPayment ? ' is-plans' : ''}`}>
        <h1>
          {showPaidConfirmation && approved
            ? 'Listing active'
            : showPaidConfirmation
              ? 'Thank you'
              : 'Claim Status'}
        </h1>
        {error && <p className="claim-status-error">{error}</p>}

        {canceled && !paymentReceived && (
          <p className="claim-status-note">Checkout was canceled. Choose a plan below when you are ready to continue.</p>
        )}

        {showPaidConfirmation && (
          <div className="claim-status-card claim-status-success">
            <div className="modal-success-icon" aria-hidden="true">✓</div>
            <h2>{approved ? 'Your listing is active' : 'Thank you for your payment'}</h2>
            <p className="claim-status-lead">
              {approved ? (
                <>
                  Your claim for {centerName ? <strong>{centerName}</strong> : 'your listing'} is approved.
                  Sign in to the provider portal with the password you created.
                </>
              ) : (
                <>
                  Thank you. Your payment{centerName ? <> for <strong>{centerName}</strong></> : ''} is confirmed.
                </>
              )}
            </p>
            {!approved && (
              <>
                <p>
                  Please wait for a confirmation email. That email includes your
                  provider portal access link.
                </p>
                <p>
                  You may access our portal with the password you created when you
                  claimed this listing.
                </p>
              </>
            )}
            <dl className="claim-status-meta">
              <div>
                <dt>Ticket</dt>
                <dd>{ticketNumber}</dd>
              </div>
              {centerName && (
                <div>
                  <dt>Center</dt>
                  <dd>{centerName}</dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd>{approved ? 'Approved' : 'Pending confirmation'}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>Received</dd>
              </div>
            </dl>

            <div className="claim-status-invoice">
              <h3>Your invoice</h3>
              {invoice && downloadUrl ? (
                <>
                  <p>
                    {invoice.number ? <>Invoice {invoice.number}</> : 'Listing subscription invoice'}
                    {invoice.amount_label ? <> · {invoice.amount_label}</> : null}
                    {invoice.interval === 'year' ? ' billed annually' : invoice.interval === 'month' ? ' billed monthly' : ''}
                  </p>
                  <a
                    className="btn btn-outline"
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download invoice
                  </a>
                </>
              ) : (
                <p>
                  Your invoice is being prepared. It will appear here shortly,
                  and we will also email it to you.
                </p>
              )}
            </div>

            <div className="claim-status-actions">
              <Link to="/portal" className="btn">Open provider portal</Link>
            </div>
          </div>
        )}

        {data && needsPayment && (
          <div className="claim-status-card">
            <p><strong>Ticket:</strong> {data.ticket_number}</p>
            <p><strong>Center:</strong> {data.center_name}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p><strong>Payment:</strong> Required</p>
            <p className="claim-status-lead">{data.message}</p>
            <ListingPlanPicker
              centerName={data.center_name}
              ticket={data.ticket_number}
              busy={busy}
              onSelect={subscribe}
            />
          </div>
        )}

        {data && rejected && (
          <div className="claim-status-card">
            <p><strong>Ticket:</strong> {data.ticket_number}</p>
            <p><strong>Center:</strong> {data.center_name}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p className="claim-status-lead">{data.message}</p>
          </div>
        )}

        <p className="claim-status-back">
          <Link to="/rehab-centers">← Back to directory</Link>
        </p>
      </div>
    </main>
  )
}
