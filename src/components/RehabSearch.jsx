import { useEffect, useState } from 'react'
import { FaSearch, FaSlidersH, FaTimes, FaMapMarkerAlt } from 'react-icons/fa'
import { US_STATES } from '../lib/usStates'
import { REHAB_SERVICE_TYPES } from '../lib/rehabServices'
import './RehabSearch.css'

const AI_PROMPTS = [
  'What kind of rehab are you looking for?',
  'Which state do you need help in?',
  'Detox, inpatient, or outpatient?',
  'Looking for dual diagnosis treatment?',
  'Need telehealth or in-person care?',
  'Searching for trauma-informed programs?',
]

const AI_HINTS = [
  'Try filtering by state and care type to narrow results.',
  'Most centers offer multiple levels of care — pick what matters most.',
  'Dual diagnosis programs treat addiction and mental health together.',
  'Medical detox is often the first step before residential care.',
]

function useTypewriter(phrases, { typingSpeed = 42, pauseMs = 2400, deleteSpeed = 22 } = {}) {
  const [text, setText] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const phrase = phrases[phraseIdx % phrases.length]
    let timer

    if (!deleting && text === phrase) {
      timer = setTimeout(() => setDeleting(true), pauseMs)
    } else if (deleting && text === '') {
      setDeleting(false)
      setPhraseIdx(i => (i + 1) % phrases.length)
    } else {
      timer = setTimeout(() => {
        setText(deleting ? phrase.slice(0, text.length - 1) : phrase.slice(0, text.length + 1))
      }, deleting ? deleteSpeed : typingSpeed)
    }

    return () => clearTimeout(timer)
  }, [text, deleting, phraseIdx, phrases, typingSpeed, pauseMs, deleteSpeed])

  return text
}

export default function RehabSearch({
  query,
  onQueryChange,
  state,
  onStateChange,
  service,
  onServiceChange,
  resultCount,
  totalCount,
  onClear,
  hasActiveFilters,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)
  const [thinking, setThinking] = useState(false)
  const typedPrompt = useTypewriter(AI_PROMPTS)

  useEffect(() => {
    if (!hasActiveFilters) return
    setThinking(true)
    const t = setTimeout(() => setThinking(false), 700)
    return () => clearTimeout(t)
  }, [query, state, service, hasActiveFilters])

  useEffect(() => {
    const interval = setInterval(() => setHintIdx(i => (i + 1) % AI_HINTS.length), 6000)
    return () => clearInterval(interval)
  }, [])

  const activeFilterCount = (state ? 1 : 0) + (service ? 1 : 0)

  return (
    <div className="rehab-search-wrap">
      <div className={`rehab-search-card ${focused ? 'rehab-search-card--focused' : ''}`}>
        <div className="rehab-search-ai">
          <p className="rehab-search-ai-prompt" aria-live="polite">
            {typedPrompt}
            <span className="rehab-search-cursor" aria-hidden="true" />
          </p>
          <p className="rehab-search-ai-hint">{AI_HINTS[hintIdx]}</p>
        </div>

        <div className="rehab-search-bar-row">
          <div className="rehab-search-input-wrap">
            <FaSearch className="rehab-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="rehab-search-input"
              placeholder="Search by center name, city, or keyword…"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Search rehab centers"
            />
            {query && (
              <button
                type="button"
                className="rehab-search-clear-input"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`rehab-search-filters-toggle ${filtersOpen ? 'rehab-search-filters-toggle--open' : ''}`}
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
            aria-controls="rehab-advanced-filters"
          >
            <FaSlidersH aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rehab-search-filter-count">{activeFilterCount}</span>
            )}
          </button>
        </div>

        <div
          id="rehab-advanced-filters"
          className={`rehab-search-filters ${filtersOpen ? 'rehab-search-filters--open' : ''}`}
        >
          <div className="rehab-search-filters-inner">
            <div className="rehab-search-filters-grid">
              <div className="rehab-search-filter-group">
                <label htmlFor="rehab-state-select">
                  <FaMapMarkerAlt aria-hidden="true" />
                  State
                </label>
                <select
                  id="rehab-state-select"
                  value={state}
                  onChange={e => onStateChange(e.target.value)}
                >
                  <option value="">All states</option>
                  {US_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="rehab-search-filter-group">
                <label htmlFor="rehab-service-select">Type of service</label>
                <select
                  id="rehab-service-select"
                  value={service}
                  onChange={e => onServiceChange(e.target.value)}
                >
                  <option value="">All services</option>
                  {REHAB_SERVICE_TYPES.map(svc => (
                    <option key={svc.id} value={svc.id}>{svc.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rehab-search-status">
          <div className={`rehab-search-results ${thinking ? 'rehab-search-results--thinking' : ''}`}>
            {thinking && <span className="rehab-search-thinking-dot" aria-hidden="true" />}
            <span>
              {hasActiveFilters ? (
                <>
                  Found <strong>{resultCount}</strong> of {totalCount} centers
                </>
              ) : (
                <>
                  Showing all <strong>{totalCount}</strong> featured centers
                </>
              )}
            </span>
          </div>

          {hasActiveFilters && (
            <button type="button" className="rehab-search-clear-all" onClick={onClear}>
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
