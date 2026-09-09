import { useEffect, useState } from 'react'
import { apiEnabled, fetchApi } from '../lib/api'
import staticRecent from '../data/recentPosts.json'

function normalize(post) {
  if (!post) return post
  return {
    ...post,
    excerpt: post.excerpt ?? '',
    featuredImage: post.featuredImage ?? post.featured_image_url ?? null,
  }
}

/** Homepage teaser list — do not import useBlogData (that pulls posts.json). */
export function useRecentPosts() {
  const [posts, setPosts] = useState(() => staticRecent.slice(0, 3).map(normalize))
  useEffect(() => {
    if (!apiEnabled()) return undefined
    fetchApi('/api/posts?limit=3')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setPosts(rows.map(normalize).slice(0, 3))
      })
      .catch(() => {})
    return undefined
  }, [])
  return posts
}
