import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Eyebrow from '../../components/ui/Eyebrow'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import './Analytics.css'

const RANGE_OPTIONS = [
  ['1h', '1 hour'],
  ['12h', '12 hours'],
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['custom', 'Date range'],
]

const VIEW_TABS = [
  ['platform', 'Platform'],
  ['providers', 'Each Rehab Providers Analytics'],
]

function StatCard({ label, value, hint }) {
  return (
    <div className="aa-stat">
      <p className="aa-stat-label">{label}</p>
      <p className="aa-stat-value">{value}</p>
      {hint && <p className="aa-stat-hint">{hint}</p>}
    </div>
  )
}

function RankList({ empty, rows }) {
  if (!rows?.length) return <p className="muted">{empty}</p>
  return (
    <ul className="aa-rank-list">
      {rows.map(row => (
        <li key={row.key}>
          <span className="aa-rank-main">
            <strong className="aa-rank-title">{row.title}</strong>
            {row.sub && <span className="aa-rank-sub">{row.sub}</span>}
          </span>
          <strong className="aa-rank-value">{row.value}</strong>
        </li>
      ))}
    </ul>
  )
}

function RangeControls({ range, setRange, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="aa-range-row">
      <div className="tabs-row aa-range-tabs">
        {RANGE_OPTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab-btn${range === id ? ' active' : ''}`}
            onClick={() => setRange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="aa-date-range">
          <label>
            From
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  )
}

function rangeParams(range, dateFrom, dateTo) {
  const params = new URLSearchParams()
  if (range === 'custom') {
    if (!dateFrom || !dateTo) return null
    params.set('date_from', new Date(dateFrom).toISOString())
    params.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString())
  } else {
    params.set('range', range)
  }
  return params
}

function ProviderDetail({ data }) {
  const maxBar = Math.max(1, ...(data?.series || []).map(s => Math.max(s.views, s.leads)))
  return (
    <>
      <div className="aa-stat-grid">
        <StatCard label="Profile visits" value={data.summary.page_views} hint={`${data.summary.unique_sessions} unique sessions`} />
        <StatCard label="Leads" value={data.summary.leads} hint={`${data.summary.unread_leads} unread`} />
        <StatCard label="Conversion" value={`${data.summary.conversion_rate}%`} hint="Leads ÷ visits" />
      </div>
      <div className="aa-grid">
        <Card>
          <p className="eyebrow">Visits & leads over time</p>
          <div className="aa-bars">
            {(data.series || []).length === 0 && <p className="muted">No activity in this range yet.</p>}
            {(data.series || []).map(row => (
              <div key={row.label} className="aa-bar-row">
                <span className="aa-bar-label">{row.label}</span>
                <div className="aa-bar-tracks">
                  <div className="aa-bar aa-bar-views" style={{ width: `${(row.views / maxBar) * 100}%` }} title={`${row.views} visits`} />
                  <div className="aa-bar aa-bar-leads" style={{ width: `${(row.leads / maxBar) * 100}%` }} title={`${row.leads} leads`} />
                </div>
                <span className="aa-bar-nums">{row.views} / {row.leads}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="eyebrow">Visitor states</p>
          <RankList
            empty="No state data yet."
            rows={(data.by_state || []).map(row => ({
              key: row.state,
              title: row.state,
              value: `${row.views} visits`,
            }))}
          />
        </Card>
        <Card>
          <p className="eyebrow">Devices</p>
          <RankList
            empty="No device data yet."
            rows={(data.by_device || []).map(row => ({
              key: row.device,
              title: row.device.charAt(0).toUpperCase() + row.device.slice(1),
              value: String(row.views),
            }))}
          />
        </Card>
        <Card>
          <p className="eyebrow">Recent leads</p>
          <RankList
            empty="No leads in this range."
            rows={(data.recent_leads || []).map(lead => ({
              key: String(lead.id),
              title: lead.full_name,
              sub: lead.email,
              value: lead.read_at ? 'Read' : 'New',
            }))}
          />
        </Card>
      </div>
    </>
  )
}

function PlatformAnalytics({ data }) {
  const maxBar = Math.max(1, ...(data?.series || []).map(s => Math.max(s.views, s.leads)))
  return (
    <>
      <div className="aa-stat-grid">
        <StatCard
          label="Site visits"
          value={data.summary.site_visits}
          hint={`${data.summary.unique_sessions} unique sessions`}
        />
        <StatCard
          label="Profile visits"
          value={data.summary.profile_visits}
          hint="Rehab listing pages"
        />
        <StatCard
          label="Leads"
          value={data.summary.leads}
          hint={`${data.summary.unread_leads} unread`}
        />
        <StatCard
          label="Conversion"
          value={`${data.summary.conversion_rate}%`}
          hint="Leads ÷ profile visits"
        />
      </div>

      <div className="aa-grid">
        <Card>
          <p className="eyebrow">Visits & leads over time</p>
          <div className="aa-bars">
            {(data.series || []).length === 0 && <p className="muted">No activity in this range yet.</p>}
            {(data.series || []).map(row => (
              <div key={row.label} className="aa-bar-row">
                <span className="aa-bar-label">{row.label}</span>
                <div className="aa-bar-tracks">
                  <div className="aa-bar aa-bar-views" style={{ width: `${(row.views / maxBar) * 100}%` }} title={`${row.views} visits`} />
                  <div className="aa-bar aa-bar-leads" style={{ width: `${(row.leads / maxBar) * 100}%` }} title={`${row.leads} leads`} />
                </div>
                <span className="aa-bar-nums">{row.views} / {row.leads}</span>
              </div>
            ))}
          </div>
          <p className="muted aa-legend">
            <span className="aa-dot views" /> Site visits
            <span className="aa-dot leads" /> Leads
          </p>
        </Card>

        <Card>
          <p className="eyebrow">Top landing pages</p>
          <RankList
            empty="No landing page visits yet. Browse the public site to start collecting data."
            rows={(data.top_landing_pages || []).map(row => ({
              key: row.path,
              title: row.title || row.path,
              sub: row.title ? row.path : null,
              value: `${row.views} visits`,
            }))}
          />
        </Card>

        <Card>
          <p className="eyebrow">Top profile visits</p>
          <RankList
            empty="No rehab profile visits in this range."
            rows={(data.top_profiles || []).map(row => ({
              key: String(row.center_id),
              title: row.name,
              sub: [row.city, row.state].filter(Boolean).join(', ') || row.slug,
              value: `${row.views} visits`,
            }))}
          />
        </Card>

        <Card>
          <p className="eyebrow">Top leads by center</p>
          <RankList
            empty="No leads in this range."
            rows={(data.top_leads || []).map(row => ({
              key: String(row.center_id),
              title: row.name,
              sub: row.unread ? `${row.unread} unread` : null,
              value: `${row.leads} leads`,
            }))}
          />
          <Button variant="ghost" size="sm" as={Link} to="/admin/leads" style={{ marginTop: 12 }}>
            Open leads
          </Button>
        </Card>

        <Card>
          <p className="eyebrow">Visitor states</p>
          <RankList
            empty="No state data yet."
            rows={(data.by_state || []).map(row => ({
              key: row.state,
              title: row.state,
              value: `${row.views} visits`,
            }))}
          />
        </Card>

        <Card>
          <p className="eyebrow">Devices</p>
          <RankList
            empty="No device data yet."
            rows={(data.by_device || []).map(row => ({
              key: row.device,
              title: row.device.charAt(0).toUpperCase() + row.device.slice(1),
              value: String(row.views),
            }))}
          />
        </Card>

        <Card className="aa-span-2">
          <p className="eyebrow">Recent leads</p>
          <RankList
            empty="No leads in this range."
            rows={(data.recent_leads || []).map(lead => ({
              key: String(lead.id),
              title: lead.full_name,
              sub: lead.center_name || lead.email,
              value: lead.read_at ? 'Read' : 'New',
            }))}
          />
        </Card>
      </div>
    </>
  )
}

export default function AdminAnalytics() {
  const [view, setView] = useState('platform')
  const [range, setRange] = useState('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [options, setOptions] = useState([])
  const [detail, setDetail] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [pickerQuery, setPickerQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (view !== 'providers') return
    api('/api/admin/analytics/provider-options')
      .then(setOptions)
      .catch(e => setErr(e.message))
  }, [view])

  useEffect(() => {
    const params = rangeParams(range, dateFrom, dateTo)
    if (!params) {
      setLoading(false)
      return
    }
    if (view === 'providers') {
      if (!selectedId) {
        setDetail(null)
        setLoading(false)
        setLoadingDetail(false)
        return
      }
      setLoadingDetail(true)
      setErr('')
      api(`/api/admin/analytics/providers?${params}&center_id=${selectedId}`)
        .then(setDetail)
        .catch(e => {
          setDetail(null)
          setErr(e.message)
        })
        .finally(() => setLoadingDetail(false))
      return
    }
    setLoading(true)
    setErr('')
    api(`/api/admin/analytics?${params}`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [view, range, dateFrom, dateTo, selectedId])

  const filteredOptions = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter(row => (
      row.name?.toLowerCase().includes(q)
      || row.slug?.toLowerCase().includes(q)
      || row.city?.toLowerCase().includes(q)
      || row.state?.toLowerCase().includes(q)
    ))
  }, [options, pickerQuery])

  const pickerOptions = useMemo(() => {
    const selected = options.find(row => String(row.center_id) === String(selectedId))
    if (selected && !filteredOptions.some(row => row.center_id === selected.center_id)) {
      return [selected, ...filteredOptions]
    }
    return filteredOptions
  }, [filteredOptions, options, selectedId])

  return (
    <div className="page-stack aa-page">
      <section className="page-header-block">
        <Eyebrow>Platform</Eyebrow>
        <h1 className="hero-title">Analytics</h1>
        <p className="hero-lead">
          Site visits, top landing pages, and per-provider rehab listing performance.
        </p>
      </section>

      <div className="tabs-row aa-view-tabs">
        {VIEW_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab-btn${view === id ? ' active' : ''}`}
            onClick={() => {
              setView(id)
              setErr('')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'platform' && (
        <RangeControls
          range={range}
          setRange={setRange}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
        />
      )}

      {err && <p className="error">{err}</p>}
      {view === 'platform' && loading && <p className="muted">Loading analytics…</p>}
      {!loading && view === 'platform' && data && <PlatformAnalytics data={data} />}

      {view === 'providers' && (
        <div className="aa-providers">
          <Card>
            <p className="eyebrow">Select a rehab center</p>
            <p className="page-sub" style={{ marginTop: 4 }}>
              Choose one listing first. Analytics load only for that center.
            </p>
            <label className="field aa-provider-picker">
              <span className="field-label">Search</span>
              <input
                type="search"
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder="Search by name, city, or state…"
                aria-label="Search rehab centers"
              />
            </label>
            <label className="field">
              <span className="field-label">Rehab center</span>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">Select a rehab center…</option>
                {pickerOptions.map(row => (
                  <option key={row.center_id} value={row.center_id}>
                    {row.name}
                    {[row.city, row.state].filter(Boolean).length
                      ? ` — ${[row.city, row.state].filter(Boolean).join(', ')}`
                      : ''}
                    {row.claimed ? ' (claimed)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {filteredOptions.length === 0 && (
              <p className="muted">No rehab centers match that search.</p>
            )}
          </Card>

          {selectedId && (
            <RangeControls
              range={range}
              setRange={setRange}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
            />
          )}

          {!selectedId && (
            <p className="muted">Select a rehab center to load its visits, leads, and conversion.</p>
          )}

          {selectedId && loadingDetail && <p className="muted">Loading analytics for this center…</p>}

          {selectedId && !loadingDetail && detail && (
            <section className="aa-provider-detail">
              <div className="aa-providers-head">
                <div>
                  <Eyebrow>Selected provider</Eyebrow>
                  <h2 className="page-title">{detail.center_name}</h2>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {[detail.city, detail.state].filter(Boolean).join(', ') || detail.slug || '—'}
                    {detail.owner_email ? ` · ${detail.owner_email}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" as={Link} to={`/admin/rehab/${detail.center_id}/edit`}>
                  Open listing
                </Button>
              </div>
              <ProviderDetail data={detail} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
