import { useEffect } from 'react'

export function setPageMeta(name, content, attr = 'name') {
  if (!content) return
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').trim()
}

/** Apply document title + meta/OG tags for a blog post. */
export function usePostSeo(post) {
  useEffect(() => {
    if (!post) return

    const title = stripHtml(post.metaTitle || post.title || 'Blog')
    const description = stripHtml(post.metaDescription || post.excerpt || '')
    const site = 'Struggling With Addiction'
    document.title = `${title} | ${site}`

    setPageMeta('description', description)
    setPageMeta('og:title', title, 'property')
    setPageMeta('og:description', description, 'property')
    setPageMeta('og:type', 'article', 'property')
    if (post.featuredImage) setPageMeta('og:image', post.featuredImage, 'property')

    if (post.seoNoindex) {
      setPageMeta('robots', 'noindex, nofollow')
    } else {
      const robots = document.querySelector('meta[name="robots"]')
      if (robots) robots.remove()
    }

    return () => {
      document.title = site
      ;['description', 'og:title', 'og:description', 'og:type', 'og:image', 'robots'].forEach(name => {
        const attr = name.startsWith('og:') ? 'property' : 'name'
        document.querySelector(`meta[${attr}="${name}"]`)?.remove()
      })
    }
  }, [post])
}
