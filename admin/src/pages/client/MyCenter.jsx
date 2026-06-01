import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function ClientMyCenter() {
  const [center, setCenter] = useState(null)

  useEffect(() => {
    api('/api/client/my-center').then(setCenter).catch(() => setCenter(null))
  }, [])

  if (!center) {
    return (
      <div>
        <header className="page-header">
          <h1 className="page-title">Center.</h1>
        </header>
        <p className="card card-flat muted">No center linked. Submit a claim on the public site.</p>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">{center.name}</h1>
        <p className="page-sub">{center.location_display}</p>
      </header>
      <div className="card card-flat">
        <p className="muted">{center.description?.slice(0, 200)}…</p>
        <p className="claim-meta" style={{ marginTop: 8 }}>
          {center.claimed ? 'Claimed' : 'Unclaimed'} · {center.listing_status}
        </p>
      </div>
    </div>
  )
}
