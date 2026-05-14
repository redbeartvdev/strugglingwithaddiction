import './Legal.css'

export default function Accessibility() {
  return (
    <main>

      <section className="legal-hero">
        <div className="container">
          <span className="section-label">Commitment</span>
          <h1>Accessibility</h1>
          <p>We are committed to making our website usable by everyone, regardless of ability.</p>
        </div>
      </section>

      <section className="legal-body">
        <div className="container">
          <div className="legal-content">
            <span className="legal-meta">Last updated: May 2025</span>

            <h2>Our Commitment</h2>
            <p>
              Struggling With Addiction believes that everyone — regardless of disability or
              circumstance — deserves equal access to information and support. We are committed
              to ensuring our website is accessible to people with disabilities, including those
              using assistive technologies such as screen readers, keyboard navigation, or voice
              control software.
            </p>

            <h2>Standards We Target</h2>
            <p>
              We aim to conform to the{' '}
              <strong>Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA</strong>.
              These guidelines explain how to make web content more accessible to people with
              disabilities. Conformance to these guidelines helps us serve all users, including
              those with:
            </p>
            <ul>
              <li>Visual impairments (blindness, low vision, color blindness)</li>
              <li>Hearing impairments</li>
              <li>Motor or physical disabilities</li>
              <li>Cognitive or learning disabilities</li>
              <li>Speech disabilities</li>
            </ul>

            <div className="a11y-standard">
              <div>
                <strong>WCAG 2.1 Level AA</strong>
                Our target standard. This includes criteria for text contrast, keyboard navigation,
                screen reader compatibility, and more.
              </div>
            </div>

            <h2>Features We Have Implemented</h2>
            <p>To support accessible use, we have incorporated the following:</p>
            <ul>
              <li><strong>Semantic HTML</strong> — proper heading hierarchy, landmark regions, and meaningful element structure.</li>
              <li><strong>ARIA labels</strong> — descriptive labels on interactive controls, icons, and navigation elements.</li>
              <li><strong>Keyboard navigation</strong> — all interactive elements are reachable and operable via keyboard.</li>
              <li><strong>Focus indicators</strong> — visible focus states are maintained throughout the interface.</li>
              <li><strong>Color contrast</strong> — text and interactive elements meet or exceed WCAG AA contrast ratios.</li>
              <li><strong>Alt text</strong> — meaningful alternative text is provided for informational images.</li>
              <li><strong>Responsive layout</strong> — the site adapts to different screen sizes and zoom levels without loss of content.</li>
              <li><strong>Skip navigation</strong> — functionality is in place for screen reader users to bypass repetitive navigation.</li>
            </ul>

            <h2>Known Limitations</h2>
            <p>
              While we strive for full accessibility, some areas of the site may not yet meet all
              WCAG 2.1 AA criteria. Known limitations include:
            </p>
            <ul>
              <li>Some older embedded third-party content may not be fully accessible.</li>
              <li>Complex interactive components are actively being reviewed and improved.</li>
            </ul>
            <p>
              We are actively working to identify and address these gaps. If you encounter a
              barrier, please let us know (see below).
            </p>

            <h2>Assistive Technology Support</h2>
            <p>Our site is tested for compatibility with the following assistive technologies:</p>
            <ul>
              <li>NVDA with Firefox (Windows)</li>
              <li>JAWS with Chrome (Windows)</li>
              <li>VoiceOver with Safari (macOS and iOS)</li>
              <li>TalkBack with Chrome (Android)</li>
            </ul>

            <h2>Feedback and Contact</h2>
            <p>
              We welcome feedback on the accessibility of our website. If you experience any
              barriers, cannot access content, or need information in an alternative format,
              please reach out to us. We will do our best to respond within 2 business days.
            </p>
            <ul>
              <li>Email: <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a></li>
              <li>Phone: <a href="tel:18005551234">1-800-555-1234</a></li>
            </ul>
            <p>
              When contacting us, please describe the issue you experienced and the assistive
              technology or browser you were using so we can investigate and improve.
            </p>

            <h2>Ongoing Efforts</h2>
            <p>
              Accessibility is an ongoing process, not a one-time project. We conduct periodic
              audits, incorporate user feedback, and work to integrate accessible design into
              every update we make. We are committed to continual improvement.
            </p>
          </div>
        </div>
      </section>

      <section className="legal-cta">
        <div className="container">
          <h2>Need Help Right Now?</h2>
          <p>Our confidential helpline is free, available 24/7, and staffed by real people who care.</p>
          <a href="tel:18005551234" className="btn">Call 1-800-555-1234</a>
        </div>
      </section>

    </main>
  )
}
