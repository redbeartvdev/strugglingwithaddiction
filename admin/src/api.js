export function getApiBase() {
  const url = import.meta.env.VITE_API_URL
  if (url === undefined || url === null) return ''
  return String(url).replace(/\/$/, '')
}

const API_URL = getApiBase()

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
      'Cannot reach the API. Run: docker compose up -d postgres && cd backend && uvicorn app.main:app --reload --port 8000',
    )
  }

  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('role')
    window.location.href = '/login'
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
    throw new Error('Cannot reach the API — is the backend running on port 8000?')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(parseErrorDetail(data, res.statusText))
  }
  return res.json()
}

export { API_URL }
