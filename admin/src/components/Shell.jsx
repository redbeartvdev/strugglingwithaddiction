import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import GlobalSearch from './GlobalSearch'
import Eyebrow from './ui/Eyebrow'
import {
  IconHome, IconUsers, IconFile, IconBuilding, IconInbox, IconCard, IconScrape, IconSettings,
} from './Icons'

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin', label: 'Overview', end: true, Icon: IconHome },
    { to: '/admin/users', label: 'Users', Icon: IconUsers },
    { to: '/admin/posts', label: 'Posts', Icon: IconFile },
    { to: '/admin/rehab', label: 'Rehab', Icon: IconBuilding },
    { to: '/admin/directory', label: 'Directory SEO', Icon: IconFile },
    { to: '/admin/claims', label: 'Claims', Icon: IconInbox, badgeKey: 'claims' },
    { to: '/admin/billing', label: 'Billing', Icon: IconCard },
    { to: '/admin/scrape', label: 'Scrape', Icon: IconScrape },
    { to: '/admin/profile', label: 'Settings', Icon: IconSettings },
  ],
  editor: [
    { to: '/editor', label: 'Overview', end: true, Icon: IconHome },
    { to: '/editor/posts', label: 'Posts', Icon: IconFile },
    { to: '/editor/profile', label: 'Settings', Icon: IconSettings },
  ],
  client: [
    { to: '/client', label: 'Overview', end: true, Icon: IconHome },
    { to: '/client/center', label: 'Center', Icon: IconBuilding },
    { to: '/client/landing', label: 'Landing', Icon: IconFile },
    { to: '/client/posts', label: 'Posts', Icon: IconFile },
    { to: '/client/billing', label: 'Billing', Icon: IconCard },
    { to: '/client/profile', label: 'Settings', Icon: IconSettings },
  ],
}

function initials(name, email) {
  const n = name || email || 'U'
  const parts = n.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

export default function Shell({ children, pendingClaims = 0 }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = NAV_BY_ROLE[user?.role] || []

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="wordmark">SWA Studio</div>
        <div className="top-nav-spacer" />
        <GlobalSearch nav={nav} role={user?.role} />
        <button
          type="button"
          className="avatar-btn"
          title={user?.email}
          onClick={() => navigate(`/${user?.role}/profile`)}
        >
          {initials(user?.display_name, user?.email)}
        </button>
      </header>

      <div className="app-body">
        <aside className="left-rail">
          <nav className="rail-nav">
            {nav.map(item => {
              const I = item.Icon
              const badge = item.badgeKey === 'claims' && pendingClaims > 0 ? pendingClaims : null
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
                >
                  <I size={18} />
                  <span>{item.label}</span>
                  {badge != null && <span className="rail-badge">{badge}</span>}
                </NavLink>
              )
            })}
          </nav>
          <div className="rail-divider" />
          <div className="rail-footer">
            <Eyebrow className="rail-eyebrow">Account</Eyebrow>
            <p className="rail-user-name">{user?.display_name || user?.email}</p>
            <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={() => { logout(); navigate('/login') }}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="main-column">
          <main className="main-content">{children}</main>
          <footer className="studio-footer">Developed by RedbearTV Dev Team</footer>
        </div>
      </div>
    </div>
  )
}
