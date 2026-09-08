import { useMemo, useState } from 'react'
import './ServiceCodePicker.css'

function groupRows(rows) {
  const groups = []
  const index = new Map()
  for (const row of rows || []) {
    const key = row.category_code
    if (!index.has(key)) {
      const group = {
        category_code: row.category_code,
        category_name: row.category_name,
        codes: [],
      }
      index.set(key, group)
      groups.push(group)
    }
    index.get(key).codes.push(row)
  }
  return groups
}

export default function ServiceCodePicker({
  catalog = [],
  value = [],
  onChange,
  disabled = false,
}) {
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState('')

  const selected = useMemo(() => new Set(value || []), [value])
  const groups = useMemo(() => groupRows(catalog), [catalog])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .map(group => {
        const codes = q
          ? group.codes.filter(row => (
            row.service_code.toLowerCase().includes(q)
            || row.service_name.toLowerCase().includes(q)
            || (row.service_description || '').toLowerCase().includes(q)
            || group.category_name.toLowerCase().includes(q)
          ))
          : group.codes
        return { ...group, codes }
      })
      .filter(group => group.codes.length > 0)
  }, [groups, query])

  function toggle(code) {
    if (disabled) return
    const next = selected.has(code)
      ? value.filter(item => item !== code)
      : [...value, code]
    onChange(next)
  }

  function toggleGroup(group) {
    if (disabled) return
    const codes = group.codes.map(row => row.service_code)
    const allOn = codes.every(code => selected.has(code))
    if (allOn) {
      onChange(value.filter(code => !codes.includes(code)))
      return
    }
    const next = [...value]
    for (const code of codes) {
      if (!selected.has(code)) next.push(code)
    }
    onChange(next)
  }

  if (!catalog.length) {
    return <p className="muted">No service codes in the catalog yet. Seed them from Settings → Service codes.</p>
  }

  return (
    <div className="scp">
      <div className="scp-toolbar">
        <label className="scp-search">
          <span className="sr-only">Search service codes</span>
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search code, name, or category…"
          />
        </label>
        <p className="muted">{value.length} selected</p>
      </div>

      <div className="scp-groups">
        {visible.map(group => {
          const selectedCount = group.codes.filter(row => selected.has(row.service_code)).length
          const expanded = openCategory === group.category_code || Boolean(query.trim())
          return (
            <section key={group.category_code} className="scp-group">
              <header className="scp-group-head">
                <button
                  type="button"
                  className="scp-group-toggle"
                  onClick={() => setOpenCategory(expanded && !query.trim() ? '' : group.category_code)}
                >
                  <span className="scp-group-title">{group.category_name}</span>
                  <span className="muted">{group.category_code} · {selectedCount}/{group.codes.length}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={disabled}
                  onClick={() => toggleGroup(group)}
                >
                  {selectedCount === group.codes.length ? 'Clear' : 'Select all'}
                </button>
              </header>
              {expanded && (
                <ul className="scp-list">
                  {group.codes.map(row => {
                    const on = selected.has(row.service_code)
                    return (
                      <li key={row.service_code}>
                        <label className={`scp-item${on ? ' is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={disabled}
                            onChange={() => toggle(row.service_code)}
                          />
                          <span>
                            <strong>{row.service_name}</strong>
                            <span className="scp-code">{row.service_code}</span>
                            {row.service_description && (
                              <span className="scp-desc">{row.service_description}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
        {visible.length === 0 && <p className="muted scp-empty">No codes match that search.</p>}
      </div>
    </div>
  )
}
