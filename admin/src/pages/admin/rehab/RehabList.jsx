import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { IconExternalLink } from '../../../components/Icons'
import './RehabList.css'

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'hidden', label: 'Hidden' },
]
const CLAIMED_OPTIONS = [
  { value: '', label: 'Claimed: all' },
  { value: 'true', label: 'Claimed' },
  { value: 'false', label: 'Unclaimed' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US')
}

function listParams({ tab, page, query, status, claimed }) {
  const params = new URLSearchParams({
    trash: String(tab === 'trash'),
    page: String(page),
    per_page: String(PAGE_SIZE),
  })
  if (query) params.set('q', query)
  if (status) params.set('status', status)
  if (claimed) params.set('claimed', claimed)
  return params
}

function ListControls({
  placement,
  query,
  onQueryChange,
  status,
  onStatusChange,
  claimed,
  onClaimedChange,
  total,
  from,
  to,
  page,
  pages,
  loading,
  onGoToPage,
}) {
  return (
    <div className={`rl-chrome rl-chrome--${placement}`}>
      <div className="rl-controls">
        <label className="rl-search">
          <input
            type="search"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search name, city, state, ZIP, or phone"
            aria-label={placement === 'top' ? 'Search centers' : 'Search centers (bottom)'}
          />
        </label>
        <label className="rl-filter">
          <select
            value={status}
            onChange={e => onStatusChange(e.target.value)}
            aria-label={placement === 'top' ? 'Filter by status' : 'Filter by status (bottom)'}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="rl-filter">
          <select
            value={claimed}
            onChange={e => onClaimedChange(e.target.value)}
            aria-label={placement === 'top' ? 'Filter by claimed' : 'Filter by claimed (bottom)'}
          >
            {CLAIMED_OPTIONS.map(opt => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
      {total > 0 && (
        <div className="rl-pager">
          <p className="muted" style={{ margin: 0 }}>
            Showing {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
          </p>
          <div className="rl-pager-controls">
            <Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => onGoToPage(page - 1)}>
              Previous
            </Button>
            <label className="rl-page-jump">
              Page
              <input
                type="number"
                min={1}
                max={pages}
                value={page}
                onChange={e => onGoToPage(Number(e.target.value) || 1)}
                aria-label={placement === 'top' ? 'Page number' : 'Page number (bottom)'}
              />
              of {formatCount(pages)}
            </label>
            <Button variant="ghost" size="sm" disabled={page >= pages || loading} onClick={() => onGoToPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RehabList({ embedded = false }) {
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState('')
  const [claimed, setClaimed] = useState('')
  const [centers, setCenters] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [tab, debouncedQuery, status, claimed])

  const applyPage = useCallback((data) => {
    const items = Array.isArray(data?.items) ? data.items : []
    const nextPage = data?.page || 1
    setCenters(items)
    setTotal(data?.total || 0)
    setPages(data?.pages || 1)
    setPerPage(data?.per_page || PAGE_SIZE)
    setPage(current => (nextPage !== current ? nextPage : current))
    return items
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    const params = listParams({ tab, page, query: debouncedQuery, status, claimed })
    api(`/api/admin/rehab-centers?${params}`)
      .then(data => {
        if (!cancelled) applyPage(data)
      })
      .catch(e => {
        if (cancelled) return
        setCenters([])
        setErr(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [tab, page, debouncedQuery, status, claimed, applyPage])

  async function reloadAfterChange() {
    const params = listParams({ tab, page, query: debouncedQuery, status, claimed })
    const data = await api(`/api/admin/rehab-centers?${params}`)
    const items = applyPage(data)
    if (items.length === 0 && page > 1) setPage(page - 1)
  }

  async function moveToTrash(id) {
    if (!confirm('Move this center to trash?')) return
    await api(`/api/admin/rehab-centers/${id}`, { method: 'DELETE' })
    await reloadAfterChange()
  }

  async function restore(id) {
    await api(`/api/admin/rehab-centers/${id}/restore`, { method: 'POST' })
    await reloadAfterChange()
  }

  async function permanentDelete(id) {
    if (!confirm('Permanently delete this center?')) return
    await api(`/api/admin/rehab-centers/${id}/permanent`, { method: 'DELETE' })
    await reloadAfterChange()
  }

  const statusTone = s => (s === 'published' ? 'ok' : s === 'draft' ? 'warn' : 'neutral')
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const hasFilters = Boolean(debouncedQuery || status || claimed)
  const emptyLabel = loading
    ? 'Loading centers…'
    : hasFilters
      ? 'No centers match those filters.'
      : 'No centers.'

  function goToPage(next) {
    const clamped = Math.min(Math.max(1, next), pages)
    if (clamped !== page) setPage(clamped)
  }

  const listControlProps = {
    query,
    onQueryChange: setQuery,
    status,
    onStatusChange: setStatus,
    claimed,
    onClaimedChange: setClaimed,
    total,
    from,
    to,
    page,
    pages,
    loading,
    onGoToPage: goToPage,
  }

  return (
    <div className={embedded ? '' : 'page-stack rl-page'}>
      {!embedded && (
        <header className="page-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="page-title">Rehab.</h1>
            <p className="page-sub">{tab === 'trash' ? 'Trashed centers' : 'All centers'}</p>
          </div>
          {tab === 'active' && (
            <Button variant="primary" as={Link} to="/admin/rehab/new">New center</Button>
          )}
        </header>
      )}

      {embedded && tab === 'active' && (
        <div className="form-actions" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button variant="primary" as={Link} to="/admin/rehab/new">New center</Button>
        </div>
      )}

      {err && <p className="error">{err}</p>}

      <div className="rl-toolbar">
        <div className="tabs-row">
          <button type="button" className={`tab-btn${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>All centers</button>
          <button type="button" className={`tab-btn${tab === 'trash' ? ' active' : ''}`} onClick={() => setTab('trash')}>Trash</button>
        </div>
        <p className="muted rl-meta">
          {loading ? 'Loading…' : `${formatCount(total)} center${total === 1 ? '' : 's'}${hasFilters ? ' matching your filters' : ''}`}
        </p>
      </div>

      <div className="card card-pad-0 rl-card">
        <ListControls placement="top" {...listControlProps} />
        <div className="table-wrap rl-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Claimed</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {centers.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>{emptyLabel}</td></tr>
              ) : (
                centers.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.location_display || [c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td><Badge tone={statusTone(c.listing_status)}>{c.listing_status}</Badge></td>
                    <td>
                      <span className={c.claimed ? 'claimed-yes' : 'claimed-no'}>
                        {c.claimed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{formatDate(c.published_at)}</td>
                    <td className="table-actions">
                      {tab === 'active' ? (
                        <>
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noopener noreferrer" className="view-post-btn" title="Open website" aria-label="Open website">
                              <IconExternalLink size={16} />
                            </a>
                          )}
                          <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${c.id}/edit`}>Edit</Button>
                          <Button variant="link" size="sm" type="button" onClick={() => moveToTrash(c.id)}>Delete</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="link" size="sm" type="button" onClick={() => restore(c.id)}>Restore</Button>
                          <Button variant="link" size="sm" type="button" onClick={() => permanentDelete(c.id)}>Delete forever</Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListControls placement="bottom" {...listControlProps} />
      </div>
    </div>
  )
}
