import { useEffect, useState, useCallback } from 'react'
import { apiEnabled, fetchApi, getApiBase } from '../lib/api'
import staticPosts from '../data/posts.json'
import staticCategories from '../data/categories.json'
import staticAuthors from '../data/authors.json'
import staticRecent from '../data/recentPosts.json'

/** Normalize API + static post shapes for list/filter UI. */
export function normalizePost(p) {
  if (!p) return p
  const categoryNames = p.categoryNames ?? []
  const categories = p.categories ?? categoryNames.map(c => c.id)
  return {
    ...p,
    categoryNames,
    categories,
    excerpt: p.excerpt ?? '',
    featuredImage: p.featuredImage ?? p.featured_image_url ?? null,
  }
}

function normalizePosts(list) {
  return Array.isArray(list) ? list.map(normalizePost) : []
}

/** Prefer API posts; fill in any JSON-only entries not yet synced to the database. */
function mergeWithStaticPosts(apiPosts, staticList) {
  const api = normalizePosts(apiPosts)
  if (!api.length) return normalizePosts(staticList)
  const apiSlugs = new Set(api.map(p => p.slug))
  const extras = normalizePosts(staticList).filter(p => !apiSlugs.has(p.slug))
  if (!extras.length) return api
  return [...api, ...extras].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function usePosts(options = {}) {
  const [posts, setPosts] = useState(() => normalizePosts(staticPosts))
  const [loading, setLoading] = useState(apiEnabled())

  useEffect(() => {
    if (!apiEnabled()) {
      setLoading(false)
      return
    }
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', String(options.limit))
    if (options.category) params.set('category', options.category)
    if (options.search) params.set('search', options.search)
    if (options.page) params.set('page', String(options.page))
    if (options.perPage) params.set('per_page', String(options.perPage))
    const qs = params.toString()
    fetchApi(`/api/posts${qs ? `?${qs}` : ''}`)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setPosts(mergeWithStaticPosts(data, staticPosts))
        else if (Array.isArray(data)) setPosts(normalizePosts(staticPosts))
      })
      .catch(() => setPosts(normalizePosts(staticPosts)))
      .finally(() => setLoading(false))
  }, [options.limit, options.category, options.search, options.page, options.perPage])

  return { posts, loading }
}

export function usePost(slug, password) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRequired, setPasswordRequired] = useState(false)

  const load = useCallback(async (pwd) => {
    if (!slug) return
    setLoading(true)
    setPasswordRequired(false)
    const fallback = () => {
      const found = staticPosts.find(p => p.slug === slug)
      setPost(found ? normalizePost({ ...found, content: found.content }) : null)
    }
    if (!apiEnabled()) {
      fallback()
      setLoading(false)
      return
    }
    const params = pwd ? `?password=${encodeURIComponent(pwd)}` : ''
    const base = getApiBase()
    const url = `${base}/api/posts/${encodeURIComponent(slug)}${params}`
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      const text = await res.text()
      let data = null
      if (text) data = JSON.parse(text)
      if (res.status === 403) {
        setPasswordRequired(true)
        setPost(null)
        return
      }
      if (!res.ok) {
        fallback()
        return
      }
      setPost(data ? normalizePost(data) : null)
    } catch {
      fallback()
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load(password) }, [load, password])

  return { post, loading, passwordRequired, reload: load }
}

export function useCategories() {
  const [categories, setCategories] = useState(staticCategories)
  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/categories').then(d => { if (d) setCategories(d) }).catch(() => {})
  }, [])
  return categories
}

export function useAuthors() {
  const [authors, setAuthors] = useState(staticAuthors)
  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/authors').then(d => { if (d) setAuthors(d) }).catch(() => {})
  }, [])
  return authors
}

export function useRecentPosts() {
  const [posts, setPosts] = useState(staticRecent)
  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/posts?limit=3')
      .then(d => {
        if (Array.isArray(d) && d.length) setPosts(mergeWithStaticPosts(d, staticRecent))
      })
      .catch(() => {})
  }, [])
  return posts
}
