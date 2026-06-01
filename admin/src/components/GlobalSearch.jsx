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

export default function GlobalSearch({ open, onClose, nav, role }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState([])
  const [loading, setLoading] = useState(false)
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

  const flatResults = useMemo(
    () => Object.values(grouped).flat(),
    [grouped],
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setApiResults([])
    setActiveIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIndex(i => Math.min(i, Math.max(flatResults.length - 1, 0)))
  }, [flatResults.length, open])

  useEffect(() => {
    if (!open) return undefined
    const q = query.trim()
    if (q.length < 2) {
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
    }, 180)
    return () => clearTimeout(timer)
  }, [query, open])

  const selectHit = useCallback((hit) => {
    onClose()
    navigate(resolvePath(hit, role))
  }, [navigate, onClose, role])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
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
      if (e.key === 'Enter' && flatResults[activeIndex]) {
        e.preventDefault()
        selectHit(flatResults[activeIndex])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, flatResults, activeIndex, onClose, selectHit])

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="search-overlay" onClick={onClose} role="presentation">
      <div
        className="search-palette"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div className="search-palette-input-wrap">
          <span className="search-palette-icon" aria-hidden><IconSearch size={18} /></span>
          <input
            ref={inputRef}
            type="search"
            className="search-palette-input"
            placeholder="Search posts, centers, users…"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="search-palette-kbd">{modKey}K</kbd>
        </div>

        <div className="search-palette-body" ref={listRef}>
          {loading && query.trim().length >= 2 && (
            <p className="search-palette-empty">Searching…</p>
          )}

          {!loading && flatResults.length === 0 && (
            <p className="search-palette-empty">
              {query.trim().length >= 2 ? 'No results found.' : 'Type to search or pick a page below.'}
            </p>
          )}

          {Object.entries(grouped).map(([type, items]) => {
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
                          onMouseEnter={() => setActiveIndex(idx)}
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

        <div className="search-palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

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
