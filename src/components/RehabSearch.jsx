import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

function directoryStatusLine({
  query,
  state,
  city,
  service,
  insurance,
  resultCount,
  totalCount,
  hasActiveFilters,
}) {
  const count = Number(resultCount || 0).toLocaleString()
  const catalog = Number(totalCount || 0).toLocaleString()
  if (!hasActiveFilters) {
    return <>Showing all <strong>{catalog}</strong> centers</>
  }

  const place = [city, state].filter(Boolean).join(', ')
  const serviceLabel = REHAB_SERVICE_TYPES.find(item => item.id === service)?.label || service
  const extras = []
  if (serviceLabel) extras.push(<>for <strong>{serviceLabel}</strong></>)
  if (insurance) extras.push(<>that accept <strong>{insurance}</strong></>)

  if (query && place) {
    return (
      <>
        Found <strong>{count}</strong> centers in <strong>{place}</strong> matching “{query}”
        {extras.map((node, i) => <span key={i}> {node}</span>)}
      </>
    )
  }
  if (query) {
    return (
      <>
        Found <strong>{count}</strong> centers matching “{query}”
        {extras.map((node, i) => <span key={i}> {node}</span>)}
      </>
    )
  }
  if (place) {
    return (
      <>
        Showing <strong>{count}</strong> centers in <strong>{place}</strong>
        {extras.map((node, i) => <span key={i}> {node}</span>)}
      </>
    )
  }
  return (
    <>
      Found <strong>{count}</strong> centers
      {extras.map((node, i) => <span key={i}> {node}</span>)}
    </>
  )
}

export default function RehabSearch({
  query,
  onQueryChange,
  state,
  onStateChange,
  service,
  onServiceChange,
  insurance = '',
  onInsuranceChange,
  insuranceOptions = [],
  resultCount,
  totalCount,
  onClear,
  hasActiveFilters,
  city = '',
}) {
  const [filtersOpen, setFiltersOpen] = useState(() => Boolean(insurance || state))
  const [focused, setFocused] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [useFixed, setUseFixed] = useState(false)
  const anchorRef = useRef(null)
  const sentinelRef = useRef(null)
  const wrapRef = useRef(null)
  const typedPrompt = useTypewriter(AI_PROMPTS)

  useEffect(() => {
    if (insurance || state) setFiltersOpen(true)
  }, [insurance, state])

  useEffect(() => {
    if (!hasActiveFilters) return
    setThinking(true)
    const t = setTimeout(() => setThinking(false), 700)
    return () => clearTimeout(t)
  }, [query, state, service, insurance, hasActiveFilters])

  useEffect(() => {
    const interval = setInterval(() => setHintIdx(i => (i + 1) % AI_HINTS.length), 6000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const headerPx = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
    ) || 72

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: `-${headerPx}px 0px 0px 0px` },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const anchor = anchorRef.current
    if (!wrap || !anchor) return

    const clearFixed = () => {
      setUseFixed(false)
      anchor.style.minHeight = ''
      wrap.style.width = ''
      wrap.style.left = ''
    }

    if (!stuck) {
      clearFixed()
      return
    }

    const headerPx = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
    ) || 72
    const top = wrap.getBoundingClientRect().top
    const stickyFailed = top < headerPx - 2

    if (!stickyFailed) {
      clearFixed()
      return
    }

    const place = () => {
      const rect = anchor.getBoundingClientRect()
      wrap.style.width = `${rect.width}px`
      wrap.style.left = `${rect.left}px`
      anchor.style.minHeight = `${wrap.offsetHeight}px`
    }

    setUseFixed(true)
    place()
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      clearFixed()
    }
  }, [stuck])

  const activeFilterCount = (state ? 1 : 0) + (service ? 1 : 0) + (insurance ? 1 : 0)
  const wrapClass = [
    'rehab-search-wrap',
    stuck ? 'is-stuck' : '',
    useFixed ? 'is-stuck-fixed' : '',
  ].filter(Boolean).join(' ')

  return (
    <div ref={anchorRef} className={`rehab-search-anchor${stuck ? ' is-stuck' : ''}`}>
      <div ref={sentinelRef} className="rehab-search-sentinel" aria-hidden="true" />
      <div ref={wrapRef} className={wrapClass}>
      <div className={`rehab-search-card ${focused ? 'rehab-search-card--focused' : ''}`}>
        <div className="rehab-search-ai" aria-hidden={stuck || undefined}>
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

              {typeof onInsuranceChange === 'function' && (
                <div className="rehab-search-filter-group">
                  <label htmlFor="rehab-insurance-select">Insurance</label>
                  <select
                    id="rehab-insurance-select"
                    value={insurance}
                    onChange={e => onInsuranceChange(e.target.value)}
                  >
                    <option value="">All insurance</option>
                    {(insuranceOptions.length
                      ? insuranceOptions
                      : [
                          { name: 'Aetna' },
                          { name: 'Blue Cross Blue Shield' },
                          { name: 'Cigna' },
                          { name: 'UnitedHealthcare' },
                          { name: 'Tricare' },
                          { name: 'Medicaid' },
                          { name: 'Medicare' },
                        ]
                    ).map(opt => (
                      <option key={opt.slug || opt.name} value={opt.name}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rehab-search-status">
          <div className={`rehab-search-results ${thinking ? 'rehab-search-results--thinking' : ''}`}>
            {thinking && <span className="rehab-search-thinking-dot" aria-hidden="true" />}
            <span>
              {directoryStatusLine({
                query,
                state,
                city,
                service,
                insurance,
                resultCount,
                totalCount,
                hasActiveFilters,
              })}
            </span>
          </div>

          {hasActiveFilters && (
            <button type="button" className="rehab-search-clear-all" onClick={onClear}>
              Clear all filters
            </button>
          )}
        </div>
      </div>
      <p className="rehab-search-provider">
        Are you a treatment provider?{' '}
        <Link to="/provider">Log in to the provider platform</Link>
        {' '}or <strong>claim your listing</strong> below.
      </p>
      </div>
    </div>
  )
}
