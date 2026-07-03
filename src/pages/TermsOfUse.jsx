import './Legal.css'
import { Link } from 'react-router-dom'

export default function TermsOfUse() {
  return (
    <main>

      <section className="legal-hero">
        <div className="container">
          <span className="section-label">Legal</span>
          <h1>Terms of Use</h1>
          <p>Please read these terms carefully before using our website or services.</p>
        </div>
      </section>

      <section className="legal-body">
        <div className="container">
          <div className="legal-content">
            <span className="legal-meta">Last updated: May 2025</span>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Struggling With Addiction website (the "Site"), you agree
              to be bound by these Terms of Use. If you do not agree to these terms, you may not
              use the Site. We reserve the right to update these terms at any time; continued use
              of the Site after changes are posted constitutes your acceptance of the revised terms.
            </p>

            <h2>2. Use of the Site</h2>
            <p>
              You agree to use the Site only for lawful purposes and in accordance with these Terms.
              You agree not to:
            </p>
            <ul>
              <li>Use the Site in any way that violates applicable federal, state, or local laws.</li>
              <li>Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Site.</li>
              <li>Attempt to gain unauthorized access to any portion of the Site or its related systems.</li>
              <li>Use automated means (bots, scrapers) to access or collect content without our express written permission.</li>
              <li>Upload or transmit viruses or any other malicious code.</li>
            </ul>

            <h2>3. Medical Disclaimer</h2>
            <p>
              The content on this Site is provided for general informational and educational purposes
              only. It is not intended to be a substitute for professional medical advice, diagnosis,
              or treatment. Always seek the advice of your physician, therapist, or other qualified
              health provider with any questions you may have regarding a medical condition or
              addiction treatment.
            </p>
            <p>
              Never disregard professional medical advice or delay in seeking it because of something
              you have read on this Site. If you are in crisis or believe you may be having a medical
              emergency, call 988 or 911 immediately.
            </p>

            <h2>4. Intellectual Property</h2>
            <p>
              All content on the Site — including text, graphics, logos, images, and software — is
              the property of Struggling With Addiction or its content suppliers and is protected by
              applicable copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              You may access and view content for personal, non-commercial use only. You may not
              reproduce, distribute, modify, create derivative works, publicly display, or exploit
              any content from the Site without our prior written permission.
            </p>

            <h2>5. Third-Party Links and Resources</h2>
            <p>
              The Site may contain links to third-party websites, treatment centers, and resources.
              These links are provided for your convenience and informational purposes only. We do
              not endorse, control, or assume responsibility for the content or practices of any
              third-party sites. Access to linked sites is at your own risk.
            </p>

            <h2>6. Disclaimer of Warranties</h2>
            <p>
              The Site and its content are provided on an "as is" and "as available" basis without
              warranties of any kind, either express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, or
              non-infringement. We do not warrant that the Site will be uninterrupted, error-free,
              or free of viruses or other harmful components.
            </p>

            <h2>7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Struggling With Addiction and its affiliates,
              officers, employees, and agents shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising out of or related to your use of,
              or inability to use, the Site or its content — even if we have been advised of the
              possibility of such damages.
            </p>

            <h2>8. Communications</h2>
            <p>
              This Site is a treatment center directory. We do not operate a treatment helpline
              or provide clinical services. Contact information shown on listing pages belongs to
              the listed facilities. For crisis support, call or text{' '}
              <a href="tel:988" aria-label="988 Suicide and Crisis Lifeline">988</a>.
              To find treatment, visit{' '}
              <a
                href="https://findtreatment.gov"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="FindTreatment.gov (opens in new tab)"
              >
                FindTreatment.gov
              </a>.
            </p>

            <h2>9. Governing Law</h2>
            <p>
              These Terms of Use are governed by and construed in accordance with the laws of the
              United States and the state in which we operate, without regard to conflict of law
              principles.
            </p>

            <h2>10. Contact Us</h2>
            <p>
              If you have questions about these Terms of Use, please contact us at:
            </p>
            <ul>
              <li>Email: <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a></li>
              <li>Phone: <a href="tel:18005551234">1-800-555-1234</a></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="legal-cta">
        <div className="container">
          <h2>Need Help Right Now?</h2>
          <p>
            In crisis? Call or text{' '}
            <a href="tel:988" aria-label="988 Suicide and Crisis Lifeline">988</a>{' '}
            (free, 24/7). Browse verified treatment centers in our{' '}
            <Link to="/rehab-centers">directory</Link>.
          </p>
          <Link to="/rehab-centers" className="btn">Search Treatment Centers</Link>
        </div>
      </section>

    </main>
  )
}
