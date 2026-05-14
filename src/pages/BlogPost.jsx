import { useMemo } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import posts from '../data/posts.json'
import authors from '../data/authors.json'
import './BlogPost.css'

const authorMap = Object.fromEntries(authors.map(a => [a.id, a]))

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = useMemo(() => posts.find(p => p.slug === slug), [slug])
  const author = useMemo(() => post ? authorMap[post.authorId] : null, [post])
  const related = useMemo(() => {
    if (!post) return []
    const catSet = new Set(post.categories)
    const matches = posts.filter(p => p.slug !== slug && p.categories.some(c => catSet.has(c)))
    // fill up to 3 with recent posts if not enough category matches
    if (matches.length >= 3) return matches.slice(0, 3)
    const fallback = posts.filter(p => p.slug !== slug && !matches.includes(p))
    return [...matches, ...fallback].slice(0, 3)
  }, [slug, post])

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
            dangerouslySetInnerHTML={{ __html: post.content }}
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
            <h3>Need Help Right Now?</h3>
            <p>Our confidential helpline is available 24/7. A real person is always on the other end — free of charge.</p>
            <a href="tel:18005551234" className="btn">Call 1-800-555-1234</a>
          </div>
        </article>

        {/* ── Sidebar ──────────────────────────────── */}
        <aside className="post-sidebar">
          <div className="sidebar-widget sidebar-cta">
            <h3>Get Help Today</h3>
            <p>Free, confidential support available 24/7.</p>
            <a href="tel:18005551234" className="btn">Call Now</a>
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
