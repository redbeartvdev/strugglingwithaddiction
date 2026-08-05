import { getPublicSiteUrl } from './lib/publicSite'

export function getApiBase() {
  const url = import.meta.env.VITE_API_URL
  if (url === undefined || url === null) return ''
  return String(url).replace(/\/$/, '')
}

const API_URL = getApiBase()

function loginRedirectHref(role = localStorage.getItem('role')) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  if (role === 'admin') return `${base}/swa-login`
  const publicBase = getPublicSiteUrl()
  return `${publicBase}/portal`
}

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('role')
}

function getToken() {
  return localStorage.getItem('access_token')
}

function parseErrorDetail(data, statusText) {
  if (!data) return statusText || 'Request failed'
  const detail = data.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ')
  }
  return data.message || statusText || 'Request failed'
}

export async function api(path, options = {}) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch {
    throw new Error(
      'Cannot reach the API. Run: docker compose up -d postgres && cd backend && uvicorn app.main:app --reload --port 8317',
    )
  }

  const isLoginRequest = path.includes('/auth/login') || path.includes('/auth/admin-login')
  if (res.status === 401 && !isLoginRequest) {
    const role = localStorage.getItem('role')
    clearSession()
    window.location.href = loginRedirectHref(role)
    throw new Error('Session expired — please sign in again')
  }

  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('Invalid response from server')
    }
  }

  if (!res.ok) throw new Error(parseErrorDetail(data, res.statusText))
  return data
}

export async function apiUpload(path, file) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
  const form = new FormData()
  form.append('file', file)
  const token = getToken()

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
  } catch {
    throw new Error('Cannot reach the API — is the backend running on port 8317?')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(parseErrorDetail(data, res.statusText))
  }
  return res.json()
}

/** Fetch a binary response (PDF, etc.) with auth. */
export async function apiBlob(path) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
  const token = getToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: 'follow',
  })
  if (res.status === 401) {
    const role = localStorage.getItem('role')
    clearSession()
    window.location.href = loginRedirectHref(role)
    throw new Error('Session expired — please sign in again')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(parseErrorDetail(data, res.statusText))
  }
  return {
    blob: await res.blob(),
    filename: (() => {
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      return match?.[1] || 'download.pdf'
    })(),
  }
}

export { API_URL }
