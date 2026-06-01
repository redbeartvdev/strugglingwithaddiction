import { useEffect, useState } from 'react'
import { api } from '../api'
import Button from './ui/Button'
import Card from './ui/Card'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', key: 'openai_api_key' },
  { id: 'kimi', label: 'KIMI', key: 'kimi_api_key' },
  { id: 'claude', label: 'Claude', key: 'claude_api_key' },
  { id: 'gemini', label: 'Gemini', key: 'gemini_api_key' },
]

export default function AiApiScrapeSettings() {
  const [settings, setSettings] = useState(null)
  const [keys, setKeys] = useState({ openai_api_key: '', kimi_api_key: '', claude_api_key: '', gemini_api_key: '' })
  const [preferred, setPreferred] = useState('openai')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/admin/scrape-settings')
      .then(s => {
        setSettings(s)
        if (s?.preferred_provider) setPreferred(s.preferred_provider)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const body = { preferred_provider: preferred }
      for (const p of PROVIDERS) {
        if (keys[p.key]) body[p.key] = keys[p.key]
      }
      const s = await api('/api/admin/scrape-settings', { method: 'PATCH', body: JSON.stringify(body) })
      setSettings(s)
      setKeys({ openai_api_key: '', kimi_api_key: '', claude_api_key: '', gemini_api_key: '' })
      setMsg('API keys saved.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <p className="eyebrow">AI API Scrape</p>
      <p className="muted" style={{ marginBottom: 16 }}>
        API keys used to discover and enrich rehab center listings on the Scrape page.
      </p>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-grid-2">
          {PROVIDERS.map(p => (
            <div key={p.id}>
              <label>{p.label} API key</label>
              <input
                type="password"
                placeholder={settings?.[`${p.id}_api_key_masked`] || (settings?.[`${p.id}_api_key_set`] ? '••••••••' : 'Not set')}
                value={keys[p.key]}
                onChange={e => setKeys(k => ({ ...k, [p.key]: e.target.value }))}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <label>Preferred provider</label>
        <select value={preferred} onChange={e => setPreferred(e.target.value)}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="form-actions form-actions-tight">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save keys'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
