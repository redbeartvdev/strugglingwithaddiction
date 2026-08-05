import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Shell from './Shell'
import { api } from '../api'
import { useAuth } from '../auth'

export function AdminLayout({ children }) {
  const [pendingClaims, setPendingClaims] = useState(0)
  const [pendingSubmissions, setPendingSubmissions] = useState(0)
  useEffect(() => {
    api('/api/admin/claims')
      .then(list => setPendingClaims(list.filter(c => c.status === 'pending' || c.status === 'under_review').length))
      .catch(() => {})
    api('/api/admin/center-submissions/pending-count')
      .then(data => setPendingSubmissions(data?.count || 0))
      .catch(() => {})
  }, [])
  return <Shell pendingClaims={pendingClaims} pendingSubmissions={pendingSubmissions}>{children}</Shell>
}

export function EditorLayout({ children }) {
  return <Shell>{children}</Shell>
}

export function ClientLayout({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const [subscription, setSubscription] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (user?.role !== 'client') {
      setLoaded(true)
      return
    }
    api('/api/billing/subscription')
      .then(setSubscription)
      .catch(() => setSubscription({ status: 'unknown' }))
      .finally(() => setLoaded(true))
  }, [user?.role, location.pathname])

  const paymentOk = user?.role === 'client'
    && loaded
    && ['active', 'trialing', 'past_due', 'unknown'].includes(subscription?.status)

  const inactive = user?.role === 'client' && loaded && !paymentOk

  // Paid but listing not yet verified/claimed — allow Overview + Billing only
  const verificationIncomplete = paymentOk
    && subscription
    && subscription.status !== 'unknown'
    && !subscription.listing_claimed
    && !subscription.verification_complete

  const allowedWhileVerifying = ['/client', '/client/billing', '/client/account']
  if (inactive && location.pathname !== '/client/billing') {
    return <Navigate to="/client/billing" replace />
  }
  if (
    verificationIncomplete
    && !allowedWhileVerifying.some(p => location.pathname === p || location.pathname.startsWith(`${p}/`))
  ) {
    return <Navigate to="/client" replace />
  }

  return <Shell verificationIncomplete={verificationIncomplete}>{children}</Shell>
}
