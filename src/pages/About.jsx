import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import NewsletterSection from '../components/NewsletterSection'
import team from '../data/team.json'
import './About.css'

const HERO_IMAGE = '/images/blog/SWA_You-Can-Now-Get-Buprenorphine-Treatment-Online_2451838189.webp'

export default function About() {
  useEffect(() => {
    const site = 'Struggling With Addiction'
    document.title = `About | ${site}`
    return () => { document.title = site }
  }, [])

  return (
    <main className="about-page">
      <section className="about-hero">
        <img
          src={HERO_IMAGE}
          alt=""
          className="about-hero-bg"
          aria-hidden="true"
          fetchPriority="high"
        />
        <div className="about-hero-overlay" aria-hidden="true" />
        <div className="container about-hero-content">
          <span className="section-label">The People Behind the Directory</span>
          <h1>About</h1>
          <p>
            Meet the editors and reporters behind Struggling With Addiction — helping you find
            clear information about treatment, recovery, and the directory.
          </p>
        </div>
      </section>

      <section className="about-body">
        <div className="container">
          <h2 className="about-team-heading">Our Team</h2>
          <div className="about-team-grid">
            {team.map(member => (
              <article className="about-team-card" key={member.id}>
                <div className="about-team-photo-wrap">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="about-team-photo"
                    loading="lazy"
                    width={200}
                    height={200}
                  />
                </div>
                <div className="about-team-card-body">
                  <span className="about-team-role">{member.role}</span>
                  <h3>
                    {member.slug
                      ? <Link to={`/author/${member.slug}`}>{member.name}</Link>
                      : member.name}
                  </h3>
                  <p>{member.bio}</p>
                </div>
              </article>
            ))}

            <article className="about-team-card about-team-card--cta">
              <div className="about-team-card-body">
                <h3>Do you want to write for us?</h3>
                <p>
                  Do you have a passion to help people? To keep them informed? Would you like
                  to see your picture here and your articles read by thousands of people every day?
                </p>
                <p>
                  Then feel free to reach out to us about your ideas. You can send an enquiry to{' '}
                  <a href="mailto:writers@strugglingwithaddiction.com">writers@strugglingwithaddiction.com</a>.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="about-directory-cta" aria-labelledby="about-directory-cta-heading">
        <div className="container about-directory-cta-inner">
          <span className="about-directory-cta-eyebrow">Find Help</span>
          <h2 id="about-directory-cta-heading">Ready to find a treatment center?</h2>
          <p>
            Browse our directory of vetted facilities and filter by location, care level,
            and what matters most to you.
          </p>
          <div className="about-directory-cta-actions">
            <Link to="/rehab-centers" className="btn about-directory-cta-btn about-directory-cta-btn--primary">
              Find Help Near You
            </Link>
            <Link to="/rehab-centers" className="btn about-directory-cta-btn about-directory-cta-btn--secondary">
              Browse the Directory
            </Link>
          </div>
        </div>
      </section>

      <NewsletterSection />
    </main>
  )
}
