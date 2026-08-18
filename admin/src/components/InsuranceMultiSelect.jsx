import { useEffect, useMemo, useRef, useState } from 'react'
import '../pages/client/MyCenter.css'

export const OTHER_INSURANCE_NAME = 'Other Insurance'

export function namesFromCenter(names, catalog) {
  const list = names || []
  const catalogNames = new Set((catalog || []).map(i => i.name.toLowerCase()))
  const matched = (catalog || [])
    .filter(i => list.some(n => n.toLowerCase() === i.name.toLowerCase()
      || n.toLowerCase().replace(/[-_]/g, ' ') === i.slug.replace(/-/g, ' ')))
    .map(i => i.name)
  const custom = list.filter(n => !catalogNames.has(n.toLowerCase())
    && !matched.some(m => m.toLowerCase() === n.toLowerCase()))
  const merged = [...matched, ...custom]
  if (custom.length > 0 && !merged.some(n => n.toLowerCase() === OTHER_INSURANCE_NAME.toLowerCase())) {
    const other = (catalog || []).find(i => i.name === OTHER_INSURANCE_NAME || i.slug === 'other-insurance')
    if (other) merged.push(other.name)
    else merged.push(OTHER_INSURANCE_NAME)
  }
  return merged
}

export function insurancePayload(selected, catalogNameSet) {
  const names = (selected || []).filter(Boolean)
  const hasCustom = names.some(n => !catalogNameSet.has(n))
  if (hasCustom && !names.some(n => n.toLowerCase() === OTHER_INSURANCE_NAME.toLowerCase())) {
    return [...names, OTHER_INSURANCE_NAME]
  }
  return names
}

export default function InsuranceMultiSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Select insurance…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(opt => opt.label.toLowerCase().includes(q))
  }, [options, query])

  function toggle(optValue) {
    if (disabled) return
    onChange(
      value.includes(optValue)
        ? value.filter(n => n !== optValue)
        : [...value, optValue],
    )
  }

  function remove(optValue) {
    if (disabled) return
    onChange(value.filter(n => n !== optValue))
  }

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} selected`

  return (
    <div className={`mc-multiselect${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`mc-multiselect-trigger${open ? ' is-open' : ''}${value.length ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span>{summary}</span>
        <span className="mc-multiselect-caret" aria-hidden="true" />
      </button>

      {value.length > 0 && (
        <div className="mc-multiselect-chips">
          {value.map(item => (
            <button
              key={item}
              type="button"
              className="mc-multiselect-chip"
              disabled={disabled}
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
            >
              {item}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {open && !disabled && (
        <div className="mc-multiselect-panel" role="listbox" aria-multiselectable="true">
          <input
            type="search"
            className="mc-multiselect-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search insurance…"
            autoFocus
            aria-label="Search insurance"
          />
          <div className="mc-multiselect-options">
            {filtered.length === 0 ? (
              <p className="mc-multiselect-empty">No matches</p>
            ) : (
              filtered.map(opt => {
                const selected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`mc-multiselect-option${selected ? ' is-on' : ''}`}
                    onClick={() => toggle(opt.value)}
                  >
                    {opt.logo && <img src={opt.logo} alt="" className="mc-multiselect-logo" />}
                    <span>{opt.label}</span>
                    <span className="mc-multiselect-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
