/** Resolve image paths for admin preview (legacy /images/* and /uploads/*). */
export function resolveMediaUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/')) return path
  return `/uploads/${path}`
}
