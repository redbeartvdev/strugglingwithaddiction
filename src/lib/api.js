/** API base: empty string uses Vite proxy (/api → backend). Set VITE_API_URL in production. */
export function getApiBase() {
  const url = import.meta.env.VITE_API_URL
  if (url === undefined || url === null) return ''
  return String(url).replace(/\/$/, '')
}

export function apiEnabled() {
  if (import.meta.env.DEV) return true
  return Boolean(getApiBase())
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

export async function fetchApi(path, options = {}) {
  const base = getApiBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  let res
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error(
      'Cannot reach the API. Start the backend: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000',
    )
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
