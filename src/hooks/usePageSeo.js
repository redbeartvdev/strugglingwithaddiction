import { useEffect } from 'react'

function setMeta(name, content, attr = 'name') {
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

const SITE = 'Struggling With Addiction'

/**
 * Generic page SEO (title, description, OG). Pass null/undefined to skip.
 * @param {{ title?: string, description?: string, image?: string, type?: string, noindex?: boolean }} seo
 */
export function usePageSeo(seo) {
  useEffect(() => {
    if (!seo) return
    const title = stripHtml(seo.title || '')
    const description = stripHtml(seo.description || '')
    if (title) document.title = `${title} | ${SITE}`
    else document.title = SITE

    if (description) setMeta('description', description)
    if (title) setMeta('og:title', title, 'property')
    if (description) setMeta('og:description', description, 'property')
    setMeta('og:type', seo.type || 'website', 'property')
    if (seo.image) setMeta('og:image', seo.image, 'property')

    if (seo.noindex) {
      setMeta('robots', 'noindex, nofollow')
    } else {
      document.querySelector('meta[name="robots"]')?.remove()
    }

    return () => {
      document.title = SITE
      ;['description', 'og:title', 'og:description', 'og:type', 'og:image', 'robots'].forEach(name => {
        const attr = name.startsWith('og:') ? 'property' : 'name'
        document.querySelector(`meta[${attr}="${name}"]`)?.remove()
      })
    }
  }, [seo?.title, seo?.description, seo?.image, seo?.type, seo?.noindex])
}

/** Apply document title + meta/OG tags for a blog post. */
export function usePostSeo(post) {
  usePageSeo(
    post
      ? {
          title: post.metaTitle || post.title || 'Blog',
          description: post.metaDescription || post.excerpt || '',
          image: post.featuredImage || undefined,
          type: 'article',
          noindex: Boolean(post.seoNoindex),
        }
      : null,
  )
}
