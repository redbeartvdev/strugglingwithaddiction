import { useState, useMemo } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import posts from '../data/posts.json'
import authors from '../data/authors.json'
import './AuthorPage.css'

const PER_PAGE = 12

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AuthorPage() {
  const { slug } = useParams()
  const [page, setPage] = useState(1)

  const author = useMemo(() => authors.find(a => a.slug === slug), [slug])
  const authorPosts = useMemo(() => {
    if (!author) return []
    return posts.filter(p => p.authorId === author.id)
  }, [author])

  if (!author) return <Navigate to="/blog" replace />

  const totalPages = Math.ceil(authorPosts.length / PER_PAGE)
  const visible = authorPosts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <main className="author-page">

      <section className="author-hero">
        <div className="container author-hero-inner">
          <div className="author-hero-text">
            <span className="section-label">Author</span>
            <h1>{author.name}</h1>
            <p className="author-title">{author.title}</p>
            <p className="author-bio">{author.bio}</p>
            <p className="author-post-count">{authorPosts.length} article{authorPosts.length !== 1 ? 's' : ''} published</p>
          </div>
        </div>
      </section>

      <section className="author-archive">
        <div className="container">
          <h2 className="author-archive-heading">Articles by {author.name}</h2>

          {visible.length === 0 ? (
            <p className="author-empty">No articles found.</p>
          ) : (
            <div className="author-grid">
              {visible.map(post => (
                <article className="author-card" key={post.id}>
                  <Link to={`/blog/${post.slug}`} className="author-card-img-wrap" tabIndex={-1} aria-hidden="true">
                    {post.featuredImage
                      ? <img src={post.featuredImage} alt="" loading="lazy" className="author-card-img" />
                      : <div className="author-card-img author-card-img-placeholder" />
                    }
                  </Link>
                  <div className="author-card-body">
                    <div className="author-card-meta">
                      <time className="author-card-date" dateTime={post.date}>{formatDate(post.date)}</time>
                      {post.categoryNames?.filter(c => c.name !== 'Uncategorized').slice(0, 1).map(c => (
                        <span key={c.id} className="author-cat-tag">{c.name}</span>
                      ))}
                    </div>
                    <h3>
                      <Link to={`/blog/${post.slug}`} dangerouslySetInnerHTML={{ __html: post.title }} />
                    </h3>
                    <p className="author-card-excerpt">{post.excerpt.slice(0, 130)}{post.excerpt.length > 130 ? '…' : ''}</p>
                    <Link to={`/blog/${post.slug}`} className="btn author-card-btn">Read Article</Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="author-pagination">
              <button
                className="btn btn-outline"
                onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0) }}
                disabled={page === 1}
              >
                ← Previous
              </button>
              <span className="author-page-info">Page {page} of {totalPages}</span>
              <button
                className="btn btn-outline"
                onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0) }}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
