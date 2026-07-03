import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { REHAB_INSURANCE_TYPES, buildRehabDirectoryUrl } from '../lib/rehabServices'
import './HomeDirectoryTools.css'

export default function InsuranceCheck() {
  const navigate = useNavigate()
  const [insurance, setInsurance] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!insurance) return
    navigate(buildRehabDirectoryUrl({ insurance }))
  }

  return (
    <div className="directory-tool-card insurance-check">
      <div className="directory-tool-header">
        <span className="section-label">Insurance Filter</span>
        <h2>Does my insurance cover rehab?</h2>
        <p className="directory-tool-desc">
          See centers that list your insurance type as accepted. This filters directory
          listings only — it does not confirm your specific plan or benefits.
        </p>
      </div>

      <form className="insurance-check-form" onSubmit={handleSubmit}>
        <div className="directory-tool-field">
          <label htmlFor="insurance-check-select">Insurance type</label>
          <select
            id="insurance-check-select"
            value={insurance}
            onChange={e => setInsurance(e.target.value)}
            required
          >
            <option value="">Select insurance type</option>
            {REHAB_INSURANCE_TYPES.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn insurance-check-submit">
          See Centers That Accept This
        </button>
      </form>
    </div>
  )
}
