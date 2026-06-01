import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  IconBuilding,
  IconFile,
  IconHome,
  IconInbox,
  IconSearch,
  IconUsers,
} from './Icons'

const TYPE_META = {
  page: { label: 'Pages', Icon: IconHome },
  post: { label: 'Posts', Icon: IconFile },
  center: { label: 'Rehab centers', Icon: IconBuilding },
  user: { label: 'Users', Icon: IconUsers },
  claim: { label: 'Claims', Icon: IconInbox },
}

function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

function hitKey(hit) {
  return `${hit.type}:${hit.id}`
}

function resolvePath(hit, role) {
  switch (hit.type) {
    case 'page':
      return hit.id
    case 'post':
      return role === 'client' ? '/client/posts' : `/${role === 'admin' ? 'admin' : 'editor'}/posts/${hit.id}/edit`
    case 'center':
      return `/admin/rehab/${hit.id}/edit`
    case 'user':
      return '/admin/users'
    case 'claim':
      return '/admin/claims'
    default:
      return '/'
  }
}

function filterNav(nav, query) {
  const q = query.trim().toLowerCase()
  if (!q) {
    return nav.map(item => ({
      type: 'page',
      id: item.to,
      label: item.label,
      meta: 'Navigate',
    }))
  }
  return nav
    .filter(item => item.label.toLowerCase().includes(q))
    .map(item => ({
      type: 'page',
      id: item.to,
      label: item.label,
      meta: 'Navigate',
    }))
}

export default function GlobalSearch({ nav, role }) {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const modKey = isMac() ? '⌘' : 'Ctrl'

  const navHits = useMemo(() => filterNav(nav, query), [nav, query])

  const grouped = useMemo(() => {
    const merged = [...navHits]
    const seen = new Set(navHits.map(hitKey))
    for (const hit of apiResults) {
      const key = hitKey(hit)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(hit)
      }
    }
    const groups = {}
    for (const hit of merged) {
      if (!groups[hit.type]) groups[hit.type] = []
      groups[hit.type].push(hit)
    }
    return groups
  }, [navHits, apiResults])

  const flatResults = useMemo(() => Object.values(grouped).flat(), [grouped])

  const showDropdown = open && (loading || flatResults.length > 0 || query.trim().length >= 1)

  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(flatResults.length - 1, 0)))
  }, [flatResults.length])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setApiResults([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(q)}`)
        .then(data => setApiResults(data.results || []))
        .catch(() => setApiResults([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const selectHit = useCallback((hit) => {
    setOpen(false)
    setQuery('')
    setApiResults([])
    inputRef.current?.blur()
    navigate(resolvePath(hit, role))
  }, [navigate, role])

  useEffect(() => {
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function onInputKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (flatResults[activeIndex]) selectHit(flatResults[activeIndex])
    }
  }

  let runningIndex = -1

  return (
    <div className="search-bar-wrap" ref={wrapRef}>
      <div className={`search-bar${open ? ' search-bar--focused' : ''}`}>
        <span className="search-bar-icon" aria-hidden><IconSearch size={16} /></span>
        <input
          ref={inputRef}
          type="search"
          className="search-bar-input"
          placeholder="Search posts, centers, users…"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          role="combobox"
        />
        <kbd className="search-bar-kbd">{modKey}K</kbd>
      </div>

      {showDropdown && (
        <div
          id="global-search-results"
          className="search-dropdown"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
        >
          {loading && (
            <p className="search-dropdown-empty">Searching…</p>
          )}

          {!loading && flatResults.length === 0 && (
            <p className="search-dropdown-empty">
              {query.trim() ? 'No results found.' : 'Type to search…'}
            </p>
          )}

          {!loading && Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || TYPE_META.page
            const GroupIcon = meta.Icon
            return (
              <div key={type} className="search-group">
                <p className="search-group-label">
                  <GroupIcon size={14} />
                  {meta.label}
                </p>
                <ul className="search-group-list">
                  {items.map(hit => {
                    runningIndex += 1
                    const idx = runningIndex
                    const active = idx === activeIndex
                    return (
                      <li key={hitKey(hit)}>
                        <button
                          type="button"
                          className={`search-result${active ? ' active' : ''}`}
                          data-active={active ? 'true' : undefined}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => selectHit(hit)}
                        >
                          <span className="search-result-label">{hit.label}</span>
                          {hit.meta && <span className="search-result-meta">{hit.meta}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** @deprecated use GlobalSearch inline — kept for compatibility */
export function useGlobalSearchShortcut(onOpen) {
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpen])
}
