import { useMemo, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import postsStatic from '../data/posts.json'
import { usePost, usePosts, useAuthors } from '../hooks/useBlogData'
import { usePostSeo } from '../hooks/usePageSeo'
import GuidedFinder from '../components/GuidedFinder'
import './BlogPost.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BlogPost() {
  const { slug } = useParams()
  const [passwordInput, setPasswordInput] = useState('')
  const [submittedPassword, setSubmittedPassword] = useState('')
  const { post, loading, passwordRequired } = usePost(slug, submittedPassword || undefined)
  usePostSeo(post)
  const allPosts = usePosts().posts
  const authors = useAuthors()
  const authorMap = useMemo(() => Object.fromEntries(authors.map(a => [a.id, a])), [authors])
  const author = useMemo(() => {
    if (post?.author) return post.author
    return post ? authorMap[post.authorId] : null
  }, [post, authorMap])
  const related = useMemo(() => {
    if (!post) return []
    const catIds = new Set((post.categoryNames || []).map(c => c.id))
    const catLegacy = new Set(post.categories || [])
    const pool = allPosts.length ? allPosts : postsStatic
    const matches = pool.filter(p => {
      if (p.slug === slug) return false
      if (p.categoryNames?.some(c => catIds.has(c.id))) return true
      return p.categories?.some(c => catLegacy.has(c))
    })
    // fill up to 3 with recent posts if not enough category matches
    if (matches.length >= 3) return matches.slice(0, 3)
    const fallback = pool.filter(p => p.slug !== slug && !matches.includes(p))
    return [...matches, ...fallback].slice(0, 3)
  }, [slug, post, allPosts])

  if (loading) return <main style={{ padding: '4rem', textAlign: 'center' }}>Loading…</main>

  if (passwordRequired) {
    return (
      <main className="post-page">
        <div className="container" style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem' }}>
          <Link to="/blog" className="post-back">← Back to Blog</Link>
          <h1 style={{ marginTop: '1.5rem' }}>Password protected</h1>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted, #666)' }}>
            This article is private. Enter the password to continue.
          </p>
          <form
            onSubmit={e => {
              e.preventDefault()
              setSubmittedPassword(passwordInput)
            }}
          >
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Password"
              required
              style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem' }}
            />
            <button type="submit" className="btn">View article</button>
          </form>
        </div>
      </main>
    )
  }

  if (!post) return <Navigate to="/blog" replace />

  return (
    <main className="post-page">

      {/* ── Post Hero ────────────────────────────── */}
      <section
        className="post-hero"
        style={post.featuredImage ? { backgroundImage: `url(${post.featuredImage})` } : {}}
      >
        <div className="post-hero-overlay" />
        <div className="container post-hero-content">
          <Link to="/blog" className="post-back">← Back to Blog</Link>
          <h1 dangerouslySetInnerHTML={{ __html: post.title }} />
          <div className="post-hero-meta">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {author && (
              <Link to={`/author/${author.slug}`} className="post-author-link">
                By {author.name}
              </Link>
            )}
            {post.categoryNames?.filter(c => c.name !== 'Uncategorized').map(c => (
              <Link key={c.id} to={`/blog?category=${c.id}`} className="post-cat-tag">{c.name}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ──────────────────────────────── */}
      <div className="container post-layout">
        <article className="post-body">
          <div
            className="post-content wp-content"
            dangerouslySetInnerHTML={{ __html: post.content || post.content_html }}
          />

          {/* Author bio */}
          {author && (
            <div className="post-author-box">
              <div className="post-author-info">
                <Link to={`/author/${author.slug}`} className="post-author-name">{author.name}</Link>
                <p className="post-author-title">{author.title}</p>
                <p className="post-author-bio">{author.bio}</p>
                <Link to={`/author/${author.slug}`} className="post-author-all-link">
                  View all articles by {author.name} →
                </Link>
              </div>
            </div>
          )}

          {/* CTA mid-article */}
          <div className="post-cta-box">
            <h3>Looking for Treatment?</h3>
            <p>
              Browse verified treatment centers by state, level of care, and insurance accepted.
              Contact facilities directly — on your terms.
            </p>
            <Link to="/rehab-centers" className="btn">Search Treatment Centers</Link>
          </div>
        </article>

        {/* ── Sidebar ──────────────────────────────── */}
        <aside className="post-sidebar">
          <div className="sidebar-widget sidebar-finder">
            <GuidedFinder variant="sidebar" />
          </div>

          <div className="sidebar-widget">
            <h4>More Articles</h4>
            <ul className="sidebar-posts">
              {related.map(r => (
                <li key={r.id}>
                  <Link to={`/blog/${r.slug}`} dangerouslySetInnerHTML={{ __html: r.title }} />
                </li>
              ))}
            </ul>
            <Link to="/blog" className="btn btn-outline sidebar-all-btn">View All Articles</Link>
          </div>
        </aside>
      </div>

      {/* ── Related posts ────────────────────────── */}
      <section className="related-section">
        <div className="container">
          <h2>Related Posts</h2>
          <div className="related-grid">
            {related.map(r => (
              <article className="related-card" key={r.id}>
                {r.featuredImage && (
                  <Link to={`/blog/${r.slug}`} className="related-img-wrap">
                    <img src={r.featuredImage} alt="" loading="lazy" />
                  </Link>
                )}
                <div className="related-body">
                  <time>{formatDate(r.date)}</time>
                  <h3><Link to={`/blog/${r.slug}`} dangerouslySetInnerHTML={{ __html: r.title }} /></h3>
                  <Link to={`/blog/${r.slug}`} className="btn related-btn">Read More</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
