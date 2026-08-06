import { useEffect, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaStar } from 'react-icons/fa'
import { apiEnabled, fetchApi } from '../lib/api'

const AUTOPLAY_MS = 4000
const SLIDE_MS = 900

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
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [instant, setInstant] = useState(false)
  const prevPageRef = useRef(0)
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
    prevPageRef.current = 0

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
        prevPageRef.current = 0
      })
      .catch(() => {
        /* keep local testimonials */
      })

    return () => { cancelled = true }
  }, [slug, center?.rating, center?.google_reviews_url, center?.testimonials])

  const reviews = payload.reviews || []
  const pageCount = Math.max(1, reviews.length)
  const safePage = ((page % pageCount) + pageCount) % pageCount

  useEffect(() => {
    const prev = prevPageRef.current
    const dist = Math.abs(safePage - prev)
    // Skip the long reverse scroll when wrapping around the ends
    if (dist > 1) {
      setInstant(true)
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setInstant(false))
      })
      prevPageRef.current = safePage
      return () => window.cancelAnimationFrame(id)
    }
    prevPageRef.current = safePage
    return undefined
  }, [safePage])

  useEffect(() => {
    if (paused || pageCount <= 1) return undefined
    const id = window.setInterval(() => {
      setPage(current => current + 1)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [paused, pageCount])

  const goTo = (index) => setPage(index)
  const goPrev = () => setPage(current => current - 1)
  const goNext = () => setPage(current => current + 1)

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

      <div className="rpd-review-carousel" data-cols="1">
        {pageCount > 1 && (
          <button
            type="button"
            className="rpd-carousel-nav is-prev"
            aria-label="Previous review"
            onClick={goPrev}
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
        )}

        <div className="rpd-review-viewport">
          <div
            className={`rpd-review-track${instant ? ' is-instant' : ''}`}
            role="list"
            style={{
              transform: `translateX(-${safePage * 100}%)`,
              transitionDuration: instant ? '0ms' : `${SLIDE_MS}ms`,
            }}
          >
            {reviews.map((item, index) => (
              <blockquote
                key={`${index}-${item.author || 'r'}`}
                className="rpd-review"
                role="listitem"
                aria-hidden={index !== safePage}
              >
                <Stars rating={item.rating ?? 5} />
                <p>{item.quote}</p>
                <footer className="rpd-review-meta">
                  {item.author && <cite>{item.author}</cite>}
                  {item.relative_time && <span>{item.relative_time}</span>}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>

        {pageCount > 1 && (
          <button
            type="button"
            className="rpd-carousel-nav is-next"
            aria-label="Next review"
            onClick={goNext}
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
              aria-label={`Show review ${i + 1}`}
              className={`rpd-carousel-dot${i === safePage ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
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
