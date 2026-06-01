import { useEffect, useState } from 'react'
import Shell from './Shell'
import { api } from '../api'

export function AdminLayout({ children }) {
  const [pendingClaims, setPendingClaims] = useState(0)
  useEffect(() => {
    api('/api/admin/claims')
      .then(list => setPendingClaims(list.filter(c => c.status === 'pending').length))
      .catch(() => {})
  }, [])
  return <Shell pendingClaims={pendingClaims}>{children}</Shell>
}

export function EditorLayout({ children }) {
  return <Shell>{children}</Shell>
}

export function ClientLayout({ children }) {
  return <Shell>{children}</Shell>
}
