import { useEffect, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaStar } from 'react-icons/fa'
import { apiEnabled, fetchApi } from '../lib/api'

function Stars({ rating = 5 }) {
  const value = Math.round(Number(rating) || 0)
  return (
    <span className="rpd-stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <FaStar key={i} className={i < value ? 'is-on' : ''} />
      ))}
    </span>
  )
}

function useVisibleCount() {
  const [count, setCount] = useState(3)
  useEffect(() => {
    const sync = () => {
      if (window.matchMedia('(max-width: 640px)').matches) setCount(1)
      else if (window.matchMedia('(max-width: 900px)').matches) setCount(2)
      else setCount(3)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  return count
}

function normalizeLocal(testimonials = [], defaultRating = 5) {
  return (testimonials || []).map((item) => {
    if (typeof item === 'string') {
      return { quote: item, author: null, rating: defaultRating, source: 'manual' }
    }
    return {
      quote: item.quote || item.text || '',
      author: item.author || item.author_name || null,
      rating: item.rating ?? defaultRating,
      relative_time: item.relative_time || null,
      source: item.source || 'manual',
    }
  }).filter(item => item.quote)
}

export default function ReviewsCarousel({ center }) {
  const slug = center?.slug || center?.id
  const visibleCount = useVisibleCount()
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [payload, setPayload] = useState(() => ({
    source: 'manual',
    rating: center?.rating,
    user_ratings_total: null,
    google_reviews_url: center?.google_reviews_url,
    reviews: normalizeLocal(center?.testimonials, center?.rating),
  }))

  useEffect(() => {
    let cancelled = false
    const local = {
      source: 'manual',
      rating: center?.rating,
      user_ratings_total: null,
      google_reviews_url: center?.google_reviews_url,
      reviews: normalizeLocal(center?.testimonials, center?.rating),
    }
    setPayload(local)
    setPage(0)

    if (!apiEnabled() || !slug) return undefined

    fetchApi(`/api/rehab-centers/${encodeURIComponent(slug)}/reviews`)
      .then((data) => {
        if (cancelled || !data?.reviews?.length) return
        setPayload({
          source: data.source || 'manual',
          rating: data.rating ?? center?.rating,
          user_ratings_total: data.user_ratings_total ?? null,
          google_reviews_url: data.google_reviews_url || center?.google_reviews_url,
          reviews: data.reviews,
        })
        setPage(0)
      })
      .catch(() => {
        /* keep local testimonials */
      })

    return () => { cancelled = true }
  }, [slug, center?.rating, center?.google_reviews_url, center?.testimonials])

  const reviews = payload.reviews || []
  const pageCount = Math.max(1, Math.ceil(reviews.length / visibleCount))
  const safePage = ((page % pageCount) + pageCount) % pageCount
  const start = safePage * visibleCount
  const visible = reviews.slice(start, start + visibleCount)

  useEffect(() => {
    setPage(0)
  }, [visibleCount])

  useEffect(() => {
    if (paused || pageCount <= 1) return undefined
    const id = window.setInterval(() => {
      setPage(current => current + 1)
    }, 7000)
    return () => window.clearInterval(id)
  }, [paused, pageCount])

  if (!reviews.length) {
    return (
      <section id="reviews" className="rpd-section">
        <div className="rpd-reviews-head">
          <h2>Reviews</h2>
        </div>
        <p className="rpd-muted">No testimonials published yet.</p>
        {center?.google_reviews_url && (
          <a className="rpd-text-link" href={center.google_reviews_url} target="_blank" rel="noreferrer">
            Read Google reviews
          </a>
        )}
      </section>
    )
  }

  return (
    <section
      id="reviews"
      className="rpd-section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rpd-reviews-head">
        <div>
          <h2>Reviews</h2>
          {payload.source === 'google' && (
            <p className="rpd-reviews-source">
              Live Google reviews{payload.user_ratings_total ? ` · ${payload.user_ratings_total} ratings` : ''}
            </p>
          )}
          {payload.source === 'manual' && center?.google_reviews_url && (
            <p className="rpd-reviews-source">
              Manual testimonials — add a Google place link to pull live reviews
            </p>
          )}
        </div>
      </div>

      <div className="rpd-review-carousel" data-cols={visibleCount}>
        {pageCount > 1 && (
          <button
            type="button"
            className="rpd-carousel-nav is-prev"
            aria-label="Previous reviews"
            onClick={() => setPage(current => current - 1)}
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
        )}

        <div className="rpd-review-track" role="list">
          {visible.map((item, index) => (
            <blockquote key={`${safePage}-${index}-${item.author || 'r'}`} className="rpd-review" role="listitem">
              <Stars rating={item.rating ?? 5} />
              <p>{item.quote}</p>
              <footer className="rpd-review-meta">
                {item.author && <cite>{item.author}</cite>}
                {item.relative_time && <span>{item.relative_time}</span>}
              </footer>
            </blockquote>
          ))}
          {Array.from({ length: Math.max(0, visibleCount - visible.length) }).map((_, i) => (
            <div key={`pad-${i}`} className="rpd-review is-placeholder" aria-hidden="true" />
          ))}
        </div>

        {pageCount > 1 && (
          <button
            type="button"
            className="rpd-carousel-nav is-next"
            aria-label="Next reviews"
            onClick={() => setPage(current => current + 1)}
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        )}
      </div>

      {pageCount > 1 && (
        <div className="rpd-carousel-dots" role="tablist" aria-label="Review pages">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === safePage}
              aria-label={`Show reviews page ${i + 1}`}
              className={`rpd-carousel-dot${i === safePage ? ' is-active' : ''}`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
      )}

      {payload.google_reviews_url && (
        <a className="rpd-text-link" href={payload.google_reviews_url} target="_blank" rel="noreferrer">
          Read Google reviews
        </a>
      )}
    </section>
  )
}
