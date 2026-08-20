import { useEffect, useId, useRef, useState } from 'react'
import NewsletterSection from '../components/NewsletterSection'
import { usePageSeo } from '../hooks/usePageSeo'
import {
  VIDEOS,
  VIDEOS_CHANNEL_URL,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from '../data/videos'
import './Videos.css'

function PlayIcon() {
  return (
    <svg className="videos-play-icon" viewBox="0 0 68 48" aria-hidden="true" focusable="false">
      <path
        className="videos-play-icon-bg"
        d="M66.52 7.74a8.12 8.12 0 0 0-5.72-5.75C55.5.85 34 .85 34 .85s-21.5 0-26.8 1.14A8.12 8.12 0 0 0 1.48 7.74C.34 13.05.34 24 .34 24s0 10.95 1.14 16.26a8.12 8.12 0 0 0 5.72 5.75C12.5 47.15 34 47.15 34 47.15s21.5 0 26.8-1.14a8.12 8.12 0 0 0 5.72-5.75C67.66 34.95 67.66 24 67.66 24s0-10.95-1.14-16.26z"
      />
      <path className="videos-play-icon-tri" d="M45 24 27.1 14.5v19L45 24z" />
    </svg>
  )
}

export default function Videos() {
  const [active, setActive] = useState(null)
  const closeBtnRef = useRef(null)
  const titleId = useId()

  usePageSeo({
    title: 'Videos',
    description:
      'Watch videos about addiction, rehab, warning signs, and recovery from Struggling With Addiction.',
  })

  useEffect(() => {
    if (!active) return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [active])

  return (
    <main className="videos-page">
      <section className="videos-hero">
        <div className="container videos-hero-inner">
          <span className="section-label">Video series</span>
          <h1>Videos</h1>
          <p>
            Short explainers on addiction, treatment, and recovery — from denial and warning signs to
            rehab, CBT, and medication-assisted treatment.
          </p>
          <div className="videos-hero-actions">
            <a
              className="btn"
              href={VIDEOS_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube channel
            </a>
          </div>
        </div>
      </section>

      <section className="videos-body" id="video-list">
        <div className="container">
          <div className="videos-section-head">
            <h2>Watch &amp; learn</h2>
            <p>
              Short talks on addiction, treatment, and recovery. Choose a video to watch it here.
            </p>
          </div>

          <ul className="videos-grid">
            {VIDEOS.map((video) => (
              <li key={video.id}>
                <article className="videos-card">
                  <button
                    type="button"
                    className="videos-thumb"
                    onClick={() => setActive(video)}
                    aria-label={`Play video: ${video.title}`}
                  >
                    <img
                      src={youtubeThumbnailUrl(video.id)}
                      alt=""
                      loading="lazy"
                      width={480}
                      height={360}
                    />
                    <span className="videos-thumb-shade" aria-hidden="true" />
                    <PlayIcon />
                  </button>
                  <div className="videos-card-body">
                    <h3>
                      <button type="button" onClick={() => setActive(video)}>
                        {video.title}
                      </button>
                    </h3>
                    {video.description ? <p>{video.description}</p> : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {active ? (
        <div
          className="videos-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setActive(null)}
        >
          <div
            className="videos-lightbox-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="videos-lightbox-top">
              <h2 id={titleId}>{active.title}</h2>
              <button
                ref={closeBtnRef}
                type="button"
                className="videos-lightbox-close"
                onClick={() => setActive(null)}
                aria-label="Close video"
              >
                ×
              </button>
            </div>
            <div className="videos-lightbox-embed">
              <iframe
                src={youtubeEmbedUrl(active.id)}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        </div>
      ) : null}

      <NewsletterSection />
    </main>
  )
}
