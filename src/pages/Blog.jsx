import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePosts, useCategories, useAuthors } from '../hooks/useBlogData'
import './Blog.css'

const INITIAL_POSTS = 6
const LOAD_MORE_POSTS = 6

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function postHasCategory(post, catId) {
  if (post.categoryNames?.some(c => c.id === catId)) return true
  return post.categories?.includes(catId)
}

export default function Blog() {
  const { posts, loading } = usePosts({ limit: 200 })
  const categories = useCategories()
  const authors = useAuthors()
  const navigate = useNavigate()
  const [visibleCount, setVisibleCount] = useState(INITIAL_POSTS)
  const [enteringFrom, setEnteringFrom] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef = useRef(null)

  const authorMap = useMemo(
    () => Object.fromEntries(authors.map(a => [a.id, a])),
    [authors],
  )

  const displayCats = useMemo(
    () => categories.filter(c => c.name !== 'Uncategorized'),
    [categories],
  )

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const results = []

    authors.forEach(a => {
      if (a.name.toLowerCase().includes(q))
        results.push({ type: 'author', label: a.name, sub: a.title, to: `/author/${a.slug}` })
    })

    for (const p of posts) {
      if (results.length >= 8) break
      const title = (p.title || '').replace(/<[^>]*>/g, '')
      if (title.toLowerCase().includes(q))
        results.push({ type: 'post', label: title, sub: null, to: `/blog/${p.slug}` })
    }

    return results.slice(0, 8)
  }, [search, posts, authors])

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const commitSuggestion = useCallback(item => {
    setSearch('')
    setShowSuggestions(false)
    setActiveIdx(-1)
    navigate(item.to)
  }, [navigate])

  const handleKeyDown = e => {
    if (!showSuggestions || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); commitSuggestion(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setShowSuggestions(false); setActiveIdx(-1) }
  }

  const filtered = useMemo(() => {
    let result = posts
    if (activeCat) result = result.filter(p => postHasCategory(p, activeCat))
    const q = search.toLowerCase().trim()
    if (q) {
      result = result.filter(p => {
        const title = (p.title || '').replace(/<[^>]*>/g, '').toLowerCase()
        const excerpt = (p.excerpt || '').toLowerCase()
        const authorName = authorMap[p.authorId]?.name?.toLowerCase() ?? ''
        return title.includes(q) || excerpt.includes(q) || authorName.includes(q)
      })
    }
    return result
  }, [search, activeCat, posts, authorMap])

  useEffect(() => {
    if (enteringFrom === null) return undefined
    const timer = window.setTimeout(() => setEnteringFrom(null), 1500)
    return () => window.clearTimeout(timer)
  }, [enteringFrom, visibleCount])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const resetVisiblePosts = () => {
    setEnteringFrom(null)
    setVisibleCount(INITIAL_POSTS)
  }

  const handleSearch = e => {
    setSearch(e.target.value)
    resetVisiblePosts()
    setShowSuggestions(true)
    setActiveIdx(-1)
  }
  const handleCat = id => {
    setActiveCat(prev => prev === id ? null : id)
    resetVisiblePosts()
  }
  const handleLoadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    setEnteringFrom(visibleCount)
    setVisibleCount(count => count + LOAD_MORE_POSTS)
    window.setTimeout(() => setLoadingMore(false), 400)
  }

  if (loading) {
    return (
      <main className="blog-page">
        <section className="blog-archive">
          <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
            Loading articles…
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="blog-page">

      <section className="blog-hero">
        <div className="blog-hero-overlay" />
        <div className="container blog-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Education &amp; Resources</span>
          <h1>The SWA Blog</h1>
          <p>Evidence-based articles, personal stories, and practical guidance for every step of the recovery journey.</p>
          <div className="blog-search-wrap" ref={wrapRef}>
            <input
              type="search"
              placeholder="Search articles or authors…"
              value={search}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
              onFocus={() => search.trim() && setShowSuggestions(true)}
              aria-label="Search blog posts"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && suggestions.length > 0}
              className="blog-search"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="blog-suggestions" role="listbox">
                {suggestions.map((item, i) => (
                  <li
                    key={item.to}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={`blog-suggestion-item${i === activeIdx ? ' active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); commitSuggestion(item) }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="suggestion-type">{item.type === 'author' ? 'Author' : 'Article'}</span>
                    <span className="suggestion-label">{item.label}</span>
                    {item.sub && <span className="suggestion-sub">{item.sub}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="blog-archive">
        <div className="container">

          <div className="blog-cats">
            <button
              className={`cat-pill${activeCat === null ? ' active' : ''}`}
              onClick={() => { setActiveCat(null); resetVisiblePosts() }}
            >
              All
            </button>
            {displayCats.map(c => (
              <button
                key={c.id}
                className={`cat-pill${activeCat === c.id ? ' active' : ''}`}
                onClick={() => handleCat(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="blog-empty">No articles match your search. Try different keywords.</p>
          ) : (
            <div className="blog-grid">
              {visible.map((post, index) => {
                const isEntering = enteringFrom !== null && index >= enteringFrom
                return (
                <article
                  className={`blog-card${isEntering ? ' blog-card--enter' : ''}`}
                  key={post.id}
                  style={isEntering ? { animationDelay: `${(index - enteringFrom) * 0.1}s` } : undefined}
                >
                  <Link to={`/blog/${post.slug}`} className="blog-card-img-wrap" tabIndex={-1} aria-hidden="true">
                    {post.featuredImage
                      ? <img src={post.featuredImage} alt="" loading="lazy" className="blog-card-img" />
                      : <div className="blog-card-img blog-card-img-placeholder" />
                    }
                  </Link>
                  <div className="blog-card-body">
                    <div className="blog-card-meta">
                      <time className="blog-card-date" dateTime={post.date}>{formatDate(post.date)}</time>
                      {post.categoryNames?.filter(c => c.name !== 'Uncategorized').map(c => (
                        <button
                          key={c.id}
                          className={`cat-tag${activeCat === c.id ? ' active' : ''}`}
                          onClick={e => { e.preventDefault(); handleCat(c.id) }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {authorMap[post.authorId] && (
                      <Link
                        to={`/author/${authorMap[post.authorId].slug}`}
                        className="blog-card-author"
                      >
                        By {authorMap[post.authorId].name}
                      </Link>
                    )}
                    <h2>
                      <Link to={`/blog/${post.slug}`} dangerouslySetInnerHTML={{ __html: post.title }} />
                    </h2>
                    <p className="blog-card-excerpt">
                      {(post.excerpt || '').slice(0, 140)}{(post.excerpt || '').length > 140 ? '…' : ''}
                    </p>
                    <Link to={`/blog/${post.slug}`} className="btn blog-card-btn">Read Article</Link>
                  </div>
                </article>
                )
              })}
            </div>
          )}

          {hasMore && (
            <div className="blog-load-more">
              <button
                type="button"
                className={`btn btn-outline blog-load-more-btn${loadingMore ? ' is-loading' : ''}`}
                onClick={handleLoadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
              >
                Load More
              </button>
            </div>
          )}

        </div>
      </section>

    </main>
  )
}
