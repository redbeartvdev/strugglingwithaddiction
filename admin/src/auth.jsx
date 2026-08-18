import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { consumeAuthHandoff } from './lib/authHandoff'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  consumeAuthHandoff()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    consumeAuthHandoff()
    const token = localStorage.getItem('access_token')
    const role = localStorage.getItem('role')
    if (token && role) {
      api('/api/me/profile')
        .then(p => setUser({ role, ...p }))
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('role')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function authenticate(path, email, password) {
    const data = await api(path, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('role', data.role)
    const profile = await api('/api/me/profile')
    setUser({ role: data.role, ...profile })
    return data.role
  }

  function login(email, password) {
    return authenticate('/api/auth/login', email, password)
  }

  function adminLogin(email, password) {
    return authenticate('/api/auth/admin-login', email, password)
  }

  function logout() {
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
