import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'
import GlobalSearch from './GlobalSearch'
import Eyebrow from './ui/Eyebrow'
import { applyTheme, getStoredTheme, toggleTheme } from '../theme'
import { getPublicSiteUrl } from '../lib/publicSite'
import {
  IconHome, IconUsers, IconFile, IconBuilding, IconInbox, IconCard, IconImport, IconSettings, IconChart,
} from './Icons'

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin', label: 'Overview', end: true, Icon: IconHome },
    { to: '/admin/analytics', label: 'Analytics', Icon: IconChart },
    { to: '/admin/users', label: 'Users', Icon: IconUsers },
    { to: '/admin/posts', label: 'Posts', Icon: IconFile },
    { to: '/admin/rehab', label: 'Rehab', Icon: IconBuilding },
    { to: '/admin/claims', label: 'Claims', Icon: IconInbox, badgeKey: 'claims' },
    { to: '/admin/submissions', label: 'Submission Center', Icon: IconBuilding, badgeKey: 'submissions' },
    { to: '/admin/leads', label: 'Leads', Icon: IconInbox },
    { to: '/admin/upsells', label: 'Upsells', Icon: IconFile },
    { to: '/admin/billing', label: 'Finance', Icon: IconCard },
    { to: '/admin/import', label: 'Import', Icon: IconImport },
    { to: '/admin/lifecycle', label: 'Lifecycle', Icon: IconSettings },
    { to: '/admin/emails', label: 'Emails', Icon: IconFile },
    { to: '/admin/insurances', label: 'Insurance', Icon: IconCard },
    { to: '/admin/settings', label: 'Settings', Icon: IconSettings },
  ],
  editor: [
    { to: '/editor', label: 'Overview', end: true, Icon: IconHome },
    { to: '/editor/posts', label: 'Posts', Icon: IconFile },
    { to: '/editor/profile', label: 'Settings', Icon: IconSettings },
  ],
  client: [
    { to: '/client', label: 'Overview', end: true, Icon: IconHome },
    { to: '/client/profile', label: 'Profile Page Editor', Icon: IconBuilding },
    { to: '/client/leads', label: 'Leads', Icon: IconInbox },
    { to: '/client/upsells', label: 'Upgrades', Icon: IconFile },
    // Posts hidden for now — reinstate when client blogging ships
    // { to: '/client/posts', label: 'Posts', Icon: IconFile },
    { to: '/client/billing', label: 'Billing', Icon: IconCard },
    { to: '/client/account', label: 'Account', Icon: IconSettings },
  ],
}

function initials(name, email) {
  const n = name || email || 'U'
  const parts = n.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

export default function Shell({ children, pendingClaims = 0, pendingSubmissions = 0, verificationIncomplete = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [subscriptionLocked, setSubscriptionLocked] = useState(false)
  const [theme, setTheme] = useState(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (user?.role !== 'client') {
      setSubscriptionLocked(false)
      return
    }
    api('/api/billing/subscription')
      .then(sub => {
        setSubscriptionLocked(!['active', 'trialing', 'past_due'].includes(sub?.status))
      })
      .catch(() => setSubscriptionLocked(false))
  }, [user?.role])

  let nav = NAV_BY_ROLE[user?.role] || []
  if (subscriptionLocked && user?.role === 'client') {
    nav = NAV_BY_ROLE.client.filter(item => item.to === '/client/billing')
  } else if (verificationIncomplete && user?.role === 'client') {
    nav = NAV_BY_ROLE.client.filter(item => ['/client', '/client/billing', '/client/account'].includes(item.to))
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="wordmark">SWA Studio</div>
        <div className="top-nav-spacer" />
        <GlobalSearch nav={nav} role={user?.role} />
        <button
          type="button"
          className="theme-toggle"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(prev => toggleTheme(prev))}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20.5 14.3A8.2 8.2 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="avatar-btn"
          title={user?.email}
          onClick={() => navigate(
            subscriptionLocked
              ? '/client/billing'
              : user?.role === 'client'
                ? '/client/account'
                : user?.role === 'admin'
                  ? '/admin/settings?tab=account'
                  : `/${user?.role}/profile`,
          )}
        >
          {initials(user?.display_name, user?.email)}
        </button>
      </header>

      <div className="app-body">
        <aside className="left-rail">
          <nav className="rail-nav">
            {nav.map(item => {
              const I = item.Icon
              const badge = item.badgeKey === 'claims' && pendingClaims > 0
                ? pendingClaims
                : item.badgeKey === 'submissions' && pendingSubmissions > 0
                  ? pendingSubmissions
                  : null
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
                >
                  <I size={16} />
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
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={() => {
                const isAdmin = user?.role === 'admin'
                logout()
                if (isAdmin) {
                  navigate('/swa-login')
                } else {
                  window.location.assign(`${getPublicSiteUrl()}/portal`)
                }
              }}
            >
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
