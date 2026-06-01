import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { US_STATES } from '../../lib/usStates'

function resultKey(r) {
  return (r.website || r.source_url || r.name || '').toLowerCase()
}

function mergeResults(existing, jobId, incoming) {
  const seen = new Set(existing.map(resultKey))
  const added = []
  for (let i = 0; i < incoming.length; i++) {
    const r = incoming[i]
    const key = resultKey(r)
    if (seen.has(key)) continue
    seen.add(key)
    added.push({ ...r, jobId, index: i })
  }
  return [...existing, ...added]
}

export default function AdminScrape() {
  const [state, setState] = useState('Arizona')
  const [job, setJob] = useState(null)
  const [results, setResults] = useState([])
  const [searchOffset, setSearchOffset] = useState(0)
  const [saved, setSaved] = useState([])
  const [err, setErr] = useState('')
  const [searching, setSearching] = useState(false)
  const pollRef = useRef(null)

  const loadSaved = () => api('/api/admin/scrape/saved/list').then(setSaved).catch(() => {})

  useEffect(() => {
    loadSaved()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function waitForJob(jobId, append) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api(`/api/admin/scrape/${jobId}`)
        setJob(updated)
        if (updated.status === 'completed') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setSearching(false)
          const batch = updated.results || []
          if (append) {
            setResults(prev => mergeResults(prev, jobId, batch))
            setSearchOffset(prev => prev + batch.length)
          } else {
            setResults(batch.map((r, i) => ({ ...r, jobId, index: i })))
            setSearchOffset(batch.length)
          }
        } else if (updated.status === 'failed') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setSearching(false)
        }
      } catch (ex) {
        clearInterval(pollRef.current)
        pollRef.current = null
        setSearching(false)
        setErr(ex.message)
      }
    }, 2500)
  }

  async function runSearch(e, append = false) {
    e?.preventDefault()
    setErr('')
    setSearching(true)
    if (!append) {
      setResults([])
      setSearchOffset(0)
      setJob(null)
    }
    try {
      const offset = append ? searchOffset : 0
      const j = await api('/api/admin/scrape', {
        method: 'POST',
        body: JSON.stringify({ state, offset }),
      })
      setJob(j)
      waitForJob(j.id, append)
    } catch (ex) {
      setSearching(false)
      setErr(ex.message)
    }
  }

  async function addResult(entry) {
    await api(`/api/admin/scrape/${entry.jobId}/add/${entry.index}`, { method: 'POST' })
    alert('Added to rehab centers (draft).')
  }

  async function saveResult(entry) {
    await api(`/api/admin/scrape/${entry.jobId}/save/${entry.index}`, { method: 'POST' })
    loadSaved()
  }

  async function addSaved(id) {
    await api(`/api/admin/scrape/saved/${id}/add`, { method: 'POST' })
    alert('Added to rehab centers (draft).')
  }

  async function removeSaved(id) {
    await api(`/api/admin/scrape/saved/${id}`, { method: 'DELETE' })
    loadSaved()
  }

  const jobRunning = searching || job?.status === 'running' || job?.status === 'pending'

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Scrape.</h1>
        <p className="page-sub">Discover rehab centers by state and add them to your directory.</p>
      </header>

      {err && <p className="error">{err}</p>}

      <Card>
        <p className="eyebrow">Search by state</p>
        <form onSubmit={e => runSearch(e, false)} className="form-row-actions">
          <div>
            <label>State</label>
            <select value={state} onChange={e => setState(e.target.value)}>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row-action-cell">
            <Button type="submit" variant="primary" disabled={jobRunning}>
              {jobRunning && !results.length ? 'Searching…' : 'Check More Rehab'}
            </Button>
          </div>
        </form>
      </Card>

      {(job || results.length > 0) && (
        <Card>
          <div className="scrape-results-head">
            <p className="eyebrow">
              Results
              {results.length > 0 && <span className="muted"> · {results.length} found</span>}
              {job?.status && job.status !== 'completed' && (
                <span className="muted"> · {job.status === 'running' ? 'searching…' : job.status}</span>
              )}
            </p>
            {results.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={jobRunning}
                onClick={e => runSearch(e, true)}
              >
                {jobRunning ? 'Searching…' : 'Search more'}
              </Button>
            )}
          </div>
          {job?.error_log && (
            <pre className="scrape-log">{job.error_log}</pre>
          )}
          {results.length > 0 ? (
            <div className="scrape-results">
              {results.map((r, i) => (
                <div key={`${r.jobId}-${r.index}-${i}`} className="scrape-result-card">
                  <div className="scrape-result-head">
                    <strong>{r.name}</strong>
                    {r.rating != null && <span className="muted">★ {r.rating}</span>}
                  </div>
                  {r.address && <p className="muted">{r.address}</p>}
                  {r.phone && <p className="muted">{r.phone}</p>}
                  {r.services?.length > 0 && <p className="muted">{r.services.join(' · ')}</p>}
                  <p className="scrape-result-desc">{r.description?.slice(0, 200)}{(r.description?.length || 0) > 200 ? '…' : ''}</p>
                  {r.website && (
                    <a href={r.website} target="_blank" rel="noopener noreferrer" className="muted">{r.website}</a>
                  )}
                  <div className="form-actions form-actions-tight">
                    <Button type="button" variant="primary" size="sm" onClick={() => addResult(r)}>Add to rehab page</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => saveResult(r)}>Save to wishlist</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : jobRunning ? (
            <p className="muted" style={{ marginTop: 12 }}>Looking for rehab centers in {state}…</p>
          ) : null}
        </Card>
      )}

      <Card>
        <p className="eyebrow">Saved items</p>
        <p className="muted" style={{ marginBottom: 12 }}>Wishlist of scraped centers not yet published.</p>
        {saved.length === 0 ? (
          <p className="muted">No saved items yet.</p>
        ) : (
          <div className="scrape-results">
            {saved.map(item => (
              <div key={item.id} className="scrape-result-card">
                <div className="scrape-result-head">
                  <strong>{item.name}</strong>
                  {item.state && <span className="muted">{item.state}</span>}
                </div>
                {item.address && <p className="muted">{item.address}</p>}
                {item.phone && <p className="muted">{item.phone}</p>}
                <div className="form-actions form-actions-tight">
                  <Button type="button" variant="primary" size="sm" onClick={() => addSaved(item.id)}>Add to rehab page</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeSaved(item.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
