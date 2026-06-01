import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
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
    icon: <FaHandsHelping style={ICON_STYLE} aria-hidden="true" />,
    title: 'Peer Support',
    body: 'Connect with others who have walked the same path. Our peer network offers understanding, accountability, and hope drawn from lived experience.',
  },
  {
    icon: <FaClinicMedical style={ICON_STYLE} aria-hidden="true" />,
    title: 'Treatment Guidance',
    body: 'We help you navigate the complex landscape of addiction treatment — from detox and inpatient programs to outpatient therapy and medication-assisted treatment.',
  },
  {
    icon: <FaUsers style={ICON_STYLE} aria-hidden="true" />,
    title: 'Family Resources',
    body: 'Addiction affects the whole family. Our resources help loved ones understand addiction, set healthy boundaries, and heal together.',
  },
  {
    icon: <FaMapMarkerAlt style={ICON_STYLE} aria-hidden="true" />,
    title: 'Local Finder',
    body: 'Find accredited treatment centers, support groups, and counselors near you with our comprehensive, verified directory.',
  },
  {
    icon: <FaBookOpen style={ICON_STYLE} aria-hidden="true" />,
    title: 'Education & Tools',
    body: 'Access evidence-based articles, self-assessment tools, and guides to help you understand addiction and take the next right step.',
  },
  {
    icon: <FaPhoneAlt style={ICON_STYLE} aria-hidden="true" />,
    title: 'Crisis Support',
    body: 'When you need someone right now, we are here. Our crisis line connects you to a compassionate counselor 24 hours a day, 7 days a week.',
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
          <h1>Recovery Starts With<br />One Brave Step</h1>
          <p className="hero-sub">
            Whether you are struggling yourself or watching someone you love suffer,
            real help is available right now — free, confidential, and compassionate.
          </p>
          <div className="hero-ctas">
            <a href="tel:18005551234" className="btn">Call the Helpline</a>
          </div>
          <p className="hero-note">
            Available 24/7 · Free &amp; Confidential · No Insurance Required
          </p>
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
              <a href="/about" className="btn">Learn About Our Mission</a>
              <a href="#services" className="btn btn-outline">Explore Resources</a>
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
            <span className="section-label">What We Offer</span>
            <h2>Resources Built for Every Step of Recovery</h2>
            <p className="section-desc">
              Whether you are just starting to think about recovery or have been
              on this road for years, we have tools and support for where you are right now.
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
            <a href="#find-help" className="btn">Find Help Now</a>
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
            <a href="tel:18005551234" className="btn">Call Now — It's Free</a>
            <a href="#find-help" className="btn btn-outline">Search Treatment Centers</a>
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

      {/* ── Crisis Banner ─────────────────────────── */}
      <section className="crisis-banner" id="crisis">
        <div className="container crisis-inner">
          <div className="crisis-content">
            <span className="crisis-badge">CRISIS SUPPORT</span>
            <h2>Are You in Crisis Right Now?</h2>
            <p>
              If you or someone you know is in immediate danger or experiencing
              a mental health emergency, please call or text for help immediately.
              You do not have to face this alone.
            </p>
          </div>
          <div className="crisis-ctas">
            <a href="tel:988" className="btn btn-white">
              Call 988 — Suicide &amp; Crisis Lifeline
            </a>
            <a href="tel:18005551234" className="btn btn-white-outline">
              Call Our Helpline: 1-800-555-1234
            </a>
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
