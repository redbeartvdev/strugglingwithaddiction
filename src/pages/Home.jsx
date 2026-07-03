import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import {
  FaHandsHelping,
  FaClinicMedical,
  FaUsers,
  FaMapMarkerAlt,
  FaBookOpen,
  FaPhoneAlt,
} from 'react-icons/fa'
import { useRecentPosts } from '../hooks/useBlogData'
import './Home.css'

const USStateMap = lazy(() => import('../components/USStateMap'))

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const ICON_STYLE = { color: '#8c1126', fontSize: '2rem', flexShrink: 0 }

const stats = [
  { end: 21, suffix: 'M+', label: 'Americans struggle with addiction' },
  { end: 10, suffix: '%',  label: 'actually receive treatment' },
  { end: 95, suffix: '%',  label: 'recovery rate with proper support' },
  { static: '24/7',        label: 'confidential support available' },
]

function StatNumber({ end, suffix, static: isStatic, triggered }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (isStatic || !triggered) return
    const duration = 1800
    let raf
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * end))
      if (progress < 1) raf = requestAnimationFrame(step)
      else setCount(end)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [triggered, end, isStatic])

  if (isStatic) return <span className="stat-number">{isStatic}</span>
  return <span className="stat-number">{count}{suffix}</span>
}

const services = [
  {
    icon: <FaMapMarkerAlt style={ICON_STYLE} aria-hidden="true" />,
    title: 'Browse by State',
    body: 'Search licensed treatment centers across all 50 states. Use the map or directory filters to see what is available near you.',
  },
  {
    icon: <FaClinicMedical style={ICON_STYLE} aria-hidden="true" />,
    title: 'Filter by Care Type',
    body: 'Narrow results by detox, inpatient, outpatient, medication-assisted treatment, dual diagnosis, and other specialties.',
  },
  {
    icon: <FaHandsHelping style={ICON_STYLE} aria-hidden="true" />,
    title: 'Verified Listings',
    body: 'Every facility is reviewed by our team or maintained by the center itself, so you are not left guessing who is legitimate.',
  },
  {
    icon: <FaUsers style={ICON_STYLE} aria-hidden="true" />,
    title: 'Compare Your Options',
    body: 'Read locations, specialties, and program details side by side before you decide which center to contact.',
  },
  {
    icon: <FaBookOpen style={ICON_STYLE} aria-hidden="true" />,
    title: 'Articles & Guides',
    body: 'Evidence-based articles that explain what different types of treatment involve, so you know what to look for and what to ask.',
  },
  {
    icon: <FaPhoneAlt style={ICON_STYLE} aria-hidden="true" />,
    title: 'Claim Your Listing',
    body: 'Run a treatment facility? Claim your profile to update your information, add photos, and reach people actively searching for care.',
  },
]

const steps = [
  {
    num: '01',
    title: 'Reach Out',
    body: 'Call our helpline or fill out our confidential intake form. No judgment — just compassionate support.',
  },
  {
    num: '02',
    title: 'Get a Plan',
    body: 'Work with our team to identify the right resources and treatment path tailored to your unique situation.',
  },
  {
    num: '03',
    title: 'Begin Recovery',
    body: 'Take the first step with confidence. We stay by your side through treatment, sobriety, and beyond.',
  },
]

const testimonials = [
  {
    quote: 'I was convinced no one could help me. This site connected me to a treatment center that saved my life. I have been sober for three years.',
    name: 'James R.',
    detail: 'Recovered from opioid addiction',
  },
  {
    quote: 'As a mother watching my son struggle, I felt completely lost. The family resources here gave me the tools to support him without losing myself.',
    name: 'Sandra M.',
    detail: 'Family member of a person in recovery',
  },
  {
    quote: 'I called the helpline at 2am not knowing what to say. The counselor stayed with me for two hours and helped me check into a treatment program the next morning.',
    name: 'David T.',
    detail: 'Recovered from alcohol use disorder',
  },
]

const HERO_IMAGES = [
  '/images/Mindfulness-in-Recovery-Cultivating-Inner-Peace-After-Addiction_2426878099.webp',
  '/images/man-8598773_1280.webp',
  '/images/Breaking-the-Cycle-Overcoming-the-Worst-Relapse-Triggers-in-Recovery_1182413176.webp',
  '/images/The-Science-of-Healing-Evidence-Based-Addiction-Treatment_2140317261.webp',
]

export default function Home() {
  const recentPosts = useRecentPosts()
  const [slide, setSlide] = useState(0)
  const [statsTriggered, setStatsTriggered] = useState(false)
  const statsRef = useRef(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_IMAGES.length), 7000)
    return () => clearInterval(t)
  }, [])


  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          setStatsTriggered(true)
          observer.disconnect()
        }
      },
      { threshold: 0.8 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <main>

      {/* ── Hero ─────────────────────────────────── */}
      <section className="hero" id="hero">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="hero-slide"
            style={{
              backgroundImage: `url(${src})`,
              opacity: i === slide ? 1 : 0,
            }}
          />
        ))}
        <div className="hero-overlay" />
        <div className="container hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>You Are Not Alone</span>
          <h1>You don't have to figure this out alone.</h1>
          <p className="hero-sub">
            Find a licensed treatment center near you, browse by state or by the kind of care you need,
            and get straight answers about what recovery actually looks like.
          </p>
          <div className="hero-ctas">
            <Link to="/rehab-centers" className="btn">Find a treatment center</Link>
          </div>
        </div>
        <div className="hero-dots">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              className={`hero-dot${i === slide ? ' active' : ''}`}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────── */}
      <section className="stats-bar" ref={statsRef}>
        <div className="container stats-grid">
          {stats.map(s => (
            <div className="stat-item" key={s.label}>
              <StatNumber end={s.end} suffix={s.suffix} static={s.static} triggered={statsTriggered} />
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hope section ─────────────────────────── */}
      <section className="hope-section">
        <div className="container hope-inner">
          <div className="hope-text">
            <span className="section-label">Why It Matters</span>
            <h2>Addiction Is a Disease,<br />Not a Moral Failing</h2>
            <p>
              Millions of people across America are caught in the grip of addiction —
              not because they are weak or broken, but because addiction is a complex
              brain disease that requires real medical support.
            </p>
            <p>
              At Struggling With Addiction, we believe that every person deserves
              access to accurate information, compassionate guidance, and a clear
              path toward healing. We exist to bridge the gap between suffering
              and recovery.
            </p>
            <div className="hope-ctas">
              <a href="#services" className="btn">Explore Resources</a>
            </div>
          </div>
          <div className="hope-image" aria-hidden="true">
            <img
              src="/images/Physician-discussing-pain-management-leading-to-opioid-addiction-with-a-patient-receiving-prescription-painkillers_2184907001.webp"
              alt="A patient speaking with a doctor about treatment and medical care"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── State Map ───────────────────────────── */}
      <section className="home-state-map-section" id="find-by-state">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">Treatment Directory</span>
            <h2>Browse Treatment by State</h2>
            <p className="section-desc">
              Hover over a state to preview, then click to view accredited rehab centers in that region.
            </p>
          </div>
          <Suspense fallback={<div className="us-state-map-loading">Loading map…</div>}>
            <USStateMap />
          </Suspense>
          <div className="home-provider-upsell">
            <div className="home-provider-upsell-inner">
              <div>
                <h2>Run a treatment facility?</h2>
                <p>
                  Your facility may already be listed. Claim your profile to update your information,
                  add photos, and get seen by the people searching for care right now.
                </p>
              </div>
              <Link to="/rehab-centers" className="btn btn-outline">Claim your listing</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Blog Slider ─────────────────────────── */}
      <section className="home-blog-section">
        <div className="container">
          <div className="home-blog-header">
            <div>
              <span className="section-label">From the Blog</span>
              <h2>Latest Articles &amp; Resources</h2>
            </div>
            <Link to="/blog" className="btn btn-outline">View All Articles</Link>
          </div>
          <div className="home-blog-grid">
            {recentPosts.map(post => (
              <article className="home-blog-card" key={post.id}>
                <Link to={`/blog/${post.slug}`} className="home-blog-img-wrap" tabIndex={-1} aria-hidden="true">
                  {post.featuredImage
                    ? <img src={post.featuredImage} alt="" loading="lazy" />
                    : <div className="home-blog-img-placeholder" />
                  }
                </Link>
                <div className="home-blog-body">
                  <time>{formatDate(post.date)}</time>
                  <h3><Link to={`/blog/${post.slug}`} dangerouslySetInnerHTML={{ __html: post.title }} /></h3>
                  <p>{post.excerpt.slice(0, 120)}{post.excerpt.length > 120 ? '…' : ''}</p>
                  <Link to={`/blog/${post.slug}`} className="btn home-blog-btn">Read More</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────── */}
      <section className="services-section" id="services">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">The Directory</span>
            <h2>Find the right treatment center, faster</h2>
            <p className="section-desc">
              We do not provide treatment ourselves. We help you search licensed facilities,
              compare types of care, and understand your options before you reach out.
            </p>
          </div>
          <div className="services-grid">
            {services.map(s => (
              <div className="service-card" key={s.title}>
                <div className="service-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}

          </div>
          <div className="text-center" style={{ marginTop: '3rem' }}>
            <Link to="/rehab-centers" className="btn">Find a treatment center</Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────── */}
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">Getting Started</span>
            <h2>Three Steps to a Different Life</h2>
          </div>
          <div className="steps-grid">
            {steps.map(s => (
              <div className="step" key={s.num}>
                <div className="step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
          <div className="how-ctas">
            <Link to="/rehab-centers" className="btn">Search Treatment Centers</Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────── */}
      <section className="testimonials-section">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">Real Stories</span>
            <h2>Recovery Happens Every Day</h2>
            <p className="section-desc">
              These are the voices of people who found a way through. Their stories
              are proof that a better life is possible — for you too.
            </p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map(t => (
              <figure className="testimonial-card" key={t.name}>
                <blockquote>"{t.quote}"</blockquote>
                <figcaption>
                  <strong>{t.name}</strong>
                  <span>{t.detail}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Newsletter / Final CTA ─────────────────── */}
      <section className="newsletter-section">
        <div className="container newsletter-inner">
          <div className="newsletter-text">
            <span className="section-label">Stay Connected</span>
            <h2>Get Recovery Resources<br />Delivered to Your Inbox</h2>
            <p>
              Weekly guidance, stories of hope, and practical tools — all free and
              sent with care. No spam, ever. Unsubscribe any time.
            </p>
          </div>
          <form className="newsletter-form" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder="Your email address" aria-label="Email address" />
            <button type="submit" className="btn">Subscribe Free</button>
          </form>
        </div>
      </section>

    </main>
  )
}
