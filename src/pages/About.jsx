import {
  FaHeart,
  FaFlask,
  FaLock,
  FaHandHoldingHeart,
} from 'react-icons/fa'
import './About.css'

const ICON_STYLE = { color: '#8c1126', fontSize: '2rem' }

const values = [
  {
    icon: <FaHeart style={ICON_STYLE} aria-hidden="true" />,
    title: 'Compassion First',
    body: 'We approach every person — and every family — with empathy, respect, and zero judgment. Shame has no place in recovery.',
  },
  {
    icon: <FaFlask style={ICON_STYLE} aria-hidden="true" />,
    title: 'Evidence-Based',
    body: 'Every resource and recommendation we provide is grounded in current medical research and addiction science.',
  },
  {
    icon: <FaLock style={ICON_STYLE} aria-hidden="true" />,
    title: 'Confidential',
    body: 'Your privacy matters deeply. All calls and inquiries are 100% confidential and HIPAA-compliant.',
  },
  {
    icon: <FaHandHoldingHeart style={ICON_STYLE} aria-hidden="true" />,
    title: 'Accessible to All',
    body: 'Our services are free. We believe that financial barriers should never stand between a person and the help they need.',
  },
]

const team = [
  {
    name: 'PJ Haarsma',
    role: 'Executive Editor',
    bio: 'Award winning creative and producer that creates and empowers people who want to and deserve to tell stories – from original content to comic books to digital marketing to video games to commercials.',
    photo: '/images/team-pj-haarsma.webp',
  },
  {
    name: 'Drew Lewis',
    role: 'Executive Editor',
    bio: 'Wants to help an industry that can truly make our world a better place. Many treatment centers are owned by individuals who have struggled with addiction themselves and to see them rise from the ashes is truly inspirational.',
    photo: '/images/team-drew-lewis.webp',
  },
  {
    name: 'Kreed Kleinkopf',
    role: 'Lead Investigative Reporter',
    bio: 'Graduating with a political science degree from Boise State University, Kreed has been involved in politics running for local seats, as well as playing in many local & successful bands. Sci-fi fan, video game fan, TRON fan, & someone who genuinely cares about fixing what\'s wrong with modern drug rehabilitation.',
    photo: '/images/team-kreed-kleinkopf.webp',
  },
  {
    name: 'Alexandra LaFollette',
    role: 'Lead Investigative Reporter',
    bio: 'Involved in organizing & hosting music festival events, venue design by night, she also works as a CNA for terminal & non-terminal in-home care. Experienced with many forms of addiction from different environments, she brings an insightful look into when people\'s addiction can cross the line.',
    photo: '/images/team-alexandra-lafollette.webp',
  },
  {
    name: 'Olivia Kibaba',
    role: 'Investigative Reporter',
    bio: 'Writer, social media marketing expert, and unshakable optimist dedicated to helping you become the person you most want to be. She has plenty of experience in mental health and addiction-related issues and uses her writing skills to educate, motivate, and empower her audience.',
    photo: '/images/team-olivia-kibaba.webp',
  },
]

export default function About() {
  return (
    <main className="about-page">

      {/* ── Page Hero ────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero-overlay" />
        <div className="container about-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Our Team</span>
          <h1>Struggling With Addiction?<br />Meet Our Team.</h1>
          <p>
            A drug use &amp; rehabilitation resource that lists potential danger sites,
            and highlights facilities that reach high levels of accreditation
            &amp; have good track records of treatment.
          </p>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────── */}
      <section className="mission-section">
        <div className="container mission-inner">
          <div className="mission-text">
            <span className="section-label">Our Mission</span>
            <h2>Connecting People to the Help That Changes Lives</h2>
            <p>
              We exist to close the gap between addiction and recovery. The United
              States is facing an addiction crisis, yet the vast majority of people
              who need treatment never receive it — often because they do not know
              where to turn, fear judgment, or cannot afford care.
            </p>
            <p>
              Our mission is to make the path to recovery clear, accessible, and
              free for every person who seeks it — no matter their background,
              income, or how many times they have tried before.
            </p>
            <a href="tel:18005551234" className="btn" style={{ marginTop: '1.75rem', display: 'inline-block' }}>
              Talk to Someone Today
            </a>
          </div>
          <div className="mission-image">
            <img
              src="/images/recovery-community-hope-v2.jpg"
              alt="A diverse group of people smiling together outdoors, supporting one another in recovery"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────── */}
      <section className="values-section">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">What We Believe</span>
            <h2>Our Core Values</h2>
            <p className="section-desc">
              These principles guide every resource, every conversation, and every
              decision we make.
            </p>
          </div>
          <div className="values-grid">
            {values.map(v => (
              <div className="value-card" key={v.title}>
                <div className="value-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────── */}
      <section className="team-section">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-label">The People Behind the Work</span>
            <h2>Meet Our Team</h2>
            <p className="section-desc">
              Our team combines investigative journalism, lived experience, and
              compassionate advocacy — because real change requires both truth and heart.
            </p>
          </div>
          <div className="team-grid">
            {team.map(t => (
              <div className="team-card" key={t.name}>
                <div className="team-photo-wrap">
                  <img
                    src={t.photo}
                    alt={t.name}
                    className="team-photo"
                    loading="lazy"
                  />
                </div>
                <h3>{t.name}</h3>
                <span className="team-role">{t.role}</span>
                <p>{t.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About CTA ────────────────────────────── */}
      <section className="about-cta-section">
        <div className="container about-cta-inner">
          <div className="about-cta-text">
            <h2>Ready to Take the Next Step?</h2>
            <p>
              Whether you need help for yourself or a loved one, our team is
              standing by. Every call is free, confidential, and answered by a
              real human being who cares.
            </p>
          </div>
          <div className="about-cta-buttons">
            <a href="tel:18005551234" className="btn">Call 1-800-555-1234</a>
          </div>
        </div>
      </section>

    </main>
  )
}
