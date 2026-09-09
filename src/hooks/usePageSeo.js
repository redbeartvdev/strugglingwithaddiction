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
 * Generic page SEO (title, description, OG, Twitter, canonical).
 * Server HTML from FastAPI already includes these; this keeps the SPA in sync after client navigation.
 * @param {{ title?: string, description?: string, image?: string, type?: string, noindex?: boolean, path?: string }} seo
 */
export function usePageSeo(seo) {
  useEffect(() => {
    if (!seo) return
    const title = stripHtml(seo.title || '')
    const description = stripHtml(seo.description || '').replace(/\s+/g, ' ').trim()
    const clipped = description.length > 160
      ? `${description.slice(0, 159).replace(/\s+\S*$/, '').replace(/[.,;:]+$/, '')}.`
      : description
    if (title) document.title = `${title} | ${SITE}`
    else document.title = SITE

    if (clipped) setMeta('description', clipped)
    if (title) setMeta('og:title', title, 'property')
    if (clipped) setMeta('og:description', clipped, 'property')
    setMeta('og:type', seo.type || 'website', 'property')
    const origin = window.location.origin
    const path = seo.path || window.location.pathname.replace(/\/+$/, '') || '/'
    const canonical = `${origin}${path === '/' ? '/' : path}`
    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', canonical)
    setMeta('og:url', canonical, 'property')
    const image = seo.image || '/images/The-Science-of-Healing-Evidence-Based-Addiction-Treatment_2140317261.webp'
    const absImage = image.startsWith('http') ? image : `${origin}${image.startsWith('/') ? image : `/${image}`}`
    setMeta('og:image', absImage, 'property')
    setMeta('twitter:card', 'summary_large_image')
    if (title) setMeta('twitter:title', title)
    if (clipped) setMeta('twitter:description', clipped)
    setMeta('twitter:image', absImage)

    if (seo.noindex) {
      setMeta('robots', 'noindex, nofollow')
    } else {
      document.querySelector('meta[name="robots"]')?.remove()
    }

    return () => {
      document.title = SITE
      ;['description', 'og:title', 'og:description', 'og:type', 'og:image', 'og:url', 'robots', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach(name => {
        const attr = name.startsWith('og:') ? 'property' : 'name'
        document.querySelector(`meta[${attr}="${name}"]`)?.remove()
      })
    }
  }, [seo?.title, seo?.description, seo?.image, seo?.type, seo?.noindex, seo?.path])
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
