import { Link } from 'react-router-dom'
import SocialLinks from './SocialLinks'
import './Footer.css'

const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">

        <div className="footer-brand">
          <div className="footer-logo">
            <img
              src="/images/SWA-logo-web-white-small_vSE-1.webp"
              alt="Struggling With Addiction"
              className="footer-logo-img"
            />
          </div>
          <p className="footer-tagline">
            You are not alone. Recovery is possible — one day at a time.
          </p>
          <a href="tel:18005551234" className="btn footer-call-btn">
            Call Us: 1-800-555-1234
          </a>
          <SocialLinks className="footer-socials" iconSize={20} />
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Navigate</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/rehab-centers">Rehab Centers</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="#crisis">Crisis Hotline</a></li>
              <li><a href="#find-help">Find Help Near You</a></li>
              <li><a href="#stories">Recovery Stories</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <ul>
              <li><a href="tel:18005551234">1-800-555-1234</a></li>
              <li><a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a></li>
            </ul>
          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>&copy; {year} Struggling With Addiction. All rights reserved.</p>
          <div className="footer-legal">
            <a href="/privacy">Privacy Policy</a>
            <span aria-hidden="true">·</span>
            <a href="/terms">Terms of Use</a>
            <span aria-hidden="true">·</span>
            <a href="/accessibility">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
