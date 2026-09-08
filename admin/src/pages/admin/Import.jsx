import { useState } from 'react'
import { api, apiUploadWithProgress, getApiBase } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './Import.css'

const MAX_IMPORT_BYTES = 40 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 10 * 60 * 1000
const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const COLUMN_HELP = [
  { key: 'name1', tip: 'Business name' },
  { key: 'name2', tip: 'Listing title. If empty, the center is created with name1' },
  { key: 'street1', tip: 'Address 1' },
  { key: 'street2', tip: 'Address 2 — suite or unit. Combined with street1 on the listing' },
  { key: 'city', tip: 'City' },
  { key: 'state', tip: 'State' },
  { key: 'zip', tip: 'ZIP' },
  { key: 'phone', tip: 'Primary listing phone. If empty, uses the first intake number' },
  { key: 'intake1', tip: 'Intake phone 1' },
  { key: 'intake2', tip: 'Intake phone 2' },
  { key: 'intake1a', tip: 'Intake phone 1a' },
  { key: 'intake2a', tip: 'Intake phone 2a' },
  { key: 'service_code_info', tip: 'SAMHSA locator text, groups split by * — e.g. SA MH SUMH * OP * CMHC * CHLOR FLUPH … * CH/AD YAD ADLT SNR * ACT COOT FPSY PRS CM SPS. Each code is matched to the Service codes catalog.' },
  { key: 'Optional extras', tip: 'samhsa_id, website, emails, service_codes, list columns, and individual catalog flags (SA, OP, CBT, …) are still imported when present' },
  { key: 'image / logo / gallery columns', tip: 'Ignored — imports use the SWA logo and a shared placeholder photo only' },
]

function fileLabel(file) {
  if (!file) return ''
  const mb = file.size / (1024 * 1024)
  const size = mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
  return `${file.name} · ${size}`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapUploadPercent(uploadPct) {
  return Math.round(((uploadPct || 0) / 100) * 12)
}

export default function AdminImport() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [summary, setSummary] = useState(null)
  const [progress, setProgress] = useState(null)
  const [outreach, setOutreach] = useState(null)

  async function downloadTemplate() {
    setErr('')
    try {
      const token = localStorage.getItem('access_token')
      const base = getApiBase()
      const res = await fetch(`${base}/api/admin/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not download template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'samhsa-listing-import-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e.message)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) {
      setErr('Choose a CSV or Excel file first.')
      return
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setErr('File is too large. Upload a CSV or Excel file under 40 MB.')
      return
    }
    setBusy(true)
    setErr('')
    setSummary(null)
    setProgress({
      phase: 'uploading',
      message: 'Uploading file…',
      percent: 0,
      processed: 0,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    })
    try {
      const start = await apiUploadWithProgress('/api/admin/import/centers', file, {
        timeoutMs: IMPORT_TIMEOUT_MS,
        onProgress: event => {
          setProgress(prev => ({
            ...prev,
            ...event,
            percent: Math.max(prev?.percent || 0, mapUploadPercent(event.percent)),
          }))
        },
      })
      if (!start?.job_id) throw new Error('Import did not start')

      let job
      while (true) {
        job = await api(`/api/admin/import/jobs/${start.job_id}`)
        setProgress(prev => ({
          ...job,
          percent: job.status === 'done' || job.status === 'error'
            ? 100
            : Math.max(prev?.percent || 0, job.percent || 0),
        }))
        if (job.status === 'done' || job.status === 'error') break
        await sleep(400)
      }

      if (job.status === 'error' && job.total_rows === 0) {
        throw new Error(job.message || job.errors?.[0] || 'Import failed')
      }
      setSummary(job)
      setFile(null)
    } catch (ex) {
      setErr(ex.message)
      setProgress(prev => prev ? { ...prev, status: 'error', phase: 'error' } : prev)
    } finally {
      setBusy(false)
    }
  }

  async function sendOutreach() {
    setBusy(true)
    setErr('')
    setOutreach(null)
    try {
      const data = await api('/api/admin/import/outreach', { method: 'POST' })
      setOutreach(data)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  const barTone = progress?.status === 'error' || progress?.phase === 'error'
    ? 'is-error'
    : progress?.status === 'done'
      ? 'is-done'
      : ''

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Import.</h1>
        <p className="page-sub">Seed the directory from a SAMHSA-style CSV or Excel file (up to 15,000+ listings). Listings publish as unclaimed with a claim CTA, the SWA logo, and a shared placeholder image — no facility photos are imported.</p>
      </header>

      <Card>
        <p className="eyebrow">1. Download template</p>
        <p className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
          Expected columns, in this order: <code>name1</code>, <code>name2</code>, <code>street1</code>, <code>street2</code>, <code>city</code>, <code>state</code>, <code>zip</code>, <code>phone</code>, <code>intake1</code>, <code>intake2</code>, <code>intake1a</code>, <code>intake2a</code>, <code>service_code_info</code>. Extra columns are still imported when present. CSV and Excel (<code>.xls</code> / <code>.xlsx</code>) both work — one facility per row, up to 25,000 rows. Photo columns are ignored.
        </p>
        <Button type="button" onClick={downloadTemplate}>Download CSV template</Button>
        <ul className="muted" style={{ marginTop: 16, paddingLeft: 18, lineHeight: 1.6 }}>
          {COLUMN_HELP.map(c => (
            <li key={c.key}><strong>{c.key}</strong> — {c.tip}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <p className="eyebrow">2. Upload CSV or Excel</p>
        <form onSubmit={onSubmit} className="form-stack" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field-label">CSV or Excel file</span>
            <input
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file && <p className="muted">Selected: {fileLabel(file)}</p>}
          {err && <p className="form-error">{err}</p>}
          <Button type="submit" disabled={busy || !file}>
            {busy ? 'Importing…' : 'Import listings'}
          </Button>
          {progress && (
            <div
              className={`import-progress ${barTone}`.trim()}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent || 0}
              aria-live="polite"
            >
              <div className="import-progress-track">
                <div className="import-progress-fill" style={{ width: `${Math.min(100, progress.percent || 0)}%` }} />
              </div>
              <div className="import-progress-meta">
                <span className="import-progress-label">{progress.message || 'Working…'}</span>
                <span className="import-progress-pct">{progress.percent || 0}%</span>
              </div>
              {(progress.total > 0 || progress.created > 0 || progress.updated > 0) && (
                <p className="muted import-progress-counts">
                  {(progress.processed || 0).toLocaleString()} of {(progress.total || progress.total_rows || 0).toLocaleString()} rows
                  {' · '}{(progress.created || 0).toLocaleString()} created
                  {' · '}{(progress.updated || 0).toLocaleString()} updated
                  {progress.skipped ? ` · ${progress.skipped.toLocaleString()} skipped` : ''}
                </p>
              )}
            </div>
          )}
        </form>
      </Card>

      {summary && (
        <Card>
          <p className="eyebrow">Import result</p>
          <p style={{ marginTop: 8 }}>
            <strong>{summary.created}</strong> created · <strong>{summary.updated}</strong> updated ·{' '}
            <strong>{summary.skipped}</strong> skipped · <strong>{summary.total_rows}</strong> rows read
          </p>
          {summary.errors?.length > 0 && (
            <ul className="muted" style={{ marginTop: 12, paddingLeft: 18 }}>
              {summary.errors.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <p className="eyebrow">3. Outreach invites</p>
        <p className="muted" style={{ marginTop: 8, marginBottom: 12 }}>
          Sends “Your center is listed — claim it” to unclaimed centers that have <code>outreach_email</code> in the CSV.
          Requires Resend or SMTP configured; otherwise emails are logged server-side.
        </p>
        <Button type="button" disabled={busy} onClick={sendOutreach}>
          {busy ? 'Sending…' : 'Send outreach emails'}
        </Button>
        {outreach && (
          <p className="muted" style={{ marginTop: 12 }}>
            Sent {outreach.sent} · skipped {outreach.skipped}
            {outreach.errors?.length ? ` · ${outreach.errors.length} errors` : ''}
          </p>
        )}
      </Card>
    </div>
  )
}
