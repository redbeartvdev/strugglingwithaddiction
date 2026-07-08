import './NewsletterSection.css'

export default function NewsletterSection() {
  return (
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
  )
}
