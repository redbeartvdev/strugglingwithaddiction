import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './Header.css'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="container header-inner">

        <Link to="/" className="logo" onClick={close} aria-label="Struggling With Addiction – home">
          <img
            src="/images/SWA-logo-web-white-small_vSE-1.webp"
            alt="Struggling With Addiction"
            className="logo-img"
          />
        </Link>

        <nav className={`nav${menuOpen ? ' open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={close}>
            Home
          </NavLink>
          <NavLink to="/rehab-centers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={close}>
            Directory
          </NavLink>
          <NavLink to="/blog" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={close}>
            Blog
          </NavLink>
          <NavLink to="/portal" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={close}>
            Portal
          </NavLink>
          <a href="tel:18005551234" className="btn btn-header" onClick={close}>
            Get Help Now
          </a>
        </nav>

        <button
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>

      </div>
    </header>
  )
}
