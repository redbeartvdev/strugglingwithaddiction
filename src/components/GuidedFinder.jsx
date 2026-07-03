import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { US_STATES } from '../lib/usStates'
import {
  GUIDED_CARE_LEVELS,
  REHAB_INSURANCE_TYPES,
  buildRehabDirectoryUrl,
} from '../lib/rehabServices'
import './HomeDirectoryTools.css'

const STEPS = [
  { key: 'state', label: 'Location', title: 'Which state?' },
  { key: 'service', label: 'Level of care', title: 'What type of care?' },
  { key: 'insurance', label: 'Insurance', title: 'Insurance accepted' },
]

export default function GuidedFinder({ variant = 'full' }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [state, setState] = useState('')
  const [service, setService] = useState('')
  const [insurance, setInsurance] = useState('')
  const idPrefix = variant === 'sidebar' ? 'sidebar-guided-finder' : 'guided-finder'

  const isLastStep = step === STEPS.length - 1

  function handleNext(e) {
    e.preventDefault()
    if (isLastStep) {
      navigate(buildRehabDirectoryUrl({ state, service, insurance }))
      return
    }
    setStep(s => s + 1)
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1))
  }

  return (
    <div className={`directory-tool-card guided-finder guided-finder--${variant}`}>
      <div className="directory-tool-header">
        <span className="section-label">Find a Center</span>
        <h2>Answer 3 questions to see matching centers</h2>
        {variant === 'full' && (
          <p className="directory-tool-desc">
            Filter our directory by location, level of care, and insurance accepted.
            This does not verify your specific plan — it shows listings that may match.
          </p>
        )}
      </div>

      <ol className="guided-finder-steps" aria-label="Finder progress">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`guided-finder-step-marker${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="guided-finder-step-num" aria-hidden="true">{i + 1}</span>
            <span className="guided-finder-step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      <form className="guided-finder-form" onSubmit={handleNext}>
        {step === 0 && (
          <div className="directory-tool-field">
            <label htmlFor={`${idPrefix}-state`}>{STEPS[0].title}</label>
            <select
              id={`${idPrefix}-state`}
              value={state}
              onChange={e => setState(e.target.value)}
            >
              <option value="">Select a state</option>
              {US_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {step === 1 && (
          <div className="directory-tool-field">
            <label htmlFor={`${idPrefix}-service`}>{STEPS[1].title}</label>
            <select
              id={`${idPrefix}-service`}
              value={service}
              onChange={e => setService(e.target.value)}
            >
              <option value="">Any level of care</option>
              {GUIDED_CARE_LEVELS.map(level => (
                <option key={level.serviceId} value={level.serviceId}>{level.label}</option>
              ))}
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="directory-tool-field">
            <label htmlFor={`${idPrefix}-insurance`}>{STEPS[2].title}</label>
            <select
              id={`${idPrefix}-insurance`}
              value={insurance}
              onChange={e => setInsurance(e.target.value)}
            >
              <option value="">Any insurance</option>
              {REHAB_INSURANCE_TYPES.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="guided-finder-actions">
          {step > 0 && (
            <button type="button" className="btn btn-outline guided-finder-back" onClick={handleBack}>
              Back
            </button>
          )}
          <button type="submit" className="btn guided-finder-submit">
            {isLastStep ? 'See Matching Centers' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  )
}
