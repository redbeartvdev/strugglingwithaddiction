import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import './SetupWizard.css'

const STEPS = [
  {
    id: 'welcome',
    eyebrow: 'First-time setup',
    title: 'Your listing is claimed.',
    body: 'One step before families can reach you: assign the inbox that receives private inquiries from your public listing.',
  },
  {
    id: 'how',
    eyebrow: 'How inquiries work',
    title: 'Messages go to your email — not our database.',
    body: 'When someone uses “Send a private inquiry,” we email that message to the address you assign. We do not store it, and platform admins cannot see it.',
  },
  {
    id: 'email',
    eyebrow: 'Inquiry inbox',
    title: 'Where should we send inquiries?',
    body: 'Use admissions, intake, or any inbox your team monitors. This can be different from your login email.',
  },
]

export default function ClientSetupWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [center, setCenter] = useState(null)
  const [email, setEmail] = useState(user?.email || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/client/my-center')
      .then(data => {
        setCenter(data)
        if (data?.contact_email) setEmail(data.contact_email)
        else if (user?.email) setEmail(user.email)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [user?.email])

  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function saveEmail() {
    if (!validEmail || saving) return
    setSaving(true)
    setErr('')
    try {
      await api('/api/client/my-center', {
        method: 'PATCH',
        body: JSON.stringify({ contact_email: email.trim() }),
      })
      navigate('/client', { replace: true, state: { inquirySetupComplete: true } })
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="muted">Loading setup…</p>
  }

  if (!center) {
    return (
      <div className="page-stack sw-page">
        <div className="card sw-card">
          <p className="eyebrow">Setup</p>
          <h1 className="sw-title">No listing is linked yet.</h1>
          <p className="sw-lead">Claim and verify a listing first, then you can assign an inquiry email.</p>
          <Button type="button" onClick={() => navigate('/client', { replace: true })}>Back to overview</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack sw-page">
      <div className="card sw-card">
        <ol className="sw-steps" aria-label="Setup steps">
          {STEPS.map((item, index) => (
            <li key={item.id} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}>
              <span>{index + 1}</span>
              {item.eyebrow}
            </li>
          ))}
        </ol>

        <p className="eyebrow">{current.eyebrow}</p>
        <h1 className="sw-title">{current.title}</h1>
        <p className="sw-lead">{current.body}</p>
        {center.name && <p className="sw-center">Listing: <strong>{center.name}</strong></p>}

        {last && (
          <label className="field sw-field">
            <span className="field-label">Inquiry email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveEmail()
                }
              }}
              placeholder="admissions@yourcenter.com"
            />
            <span className="muted">
              Families who inquire on your listing will email this address. You can change it later in Profile.
            </span>
          </label>
        )}

        {err && <p className="form-error">{err}</p>}

        <div className="sw-actions">
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <Button type="button" disabled={!validEmail || saving} onClick={saveEmail}>
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep(s => s + 1)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
