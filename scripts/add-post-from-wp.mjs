/**
 * Fetch a single WordPress post by slug, download images, and append to posts.json.
 * Usage: node scripts/add-post-from-wp.mjs <slug>
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMG_DIR = path.join(ROOT, 'public', 'images', 'blog')
const POSTS_FILES = [
  path.join(ROOT, 'src', 'data', 'posts.json'),
  path.join(ROOT, 'backend', 'seed-data', 'posts.json'),
]
const CATEGORIES_FILE = path.join(ROOT, 'src', 'data', 'categories.json')
const BASE = 'https://strugglingwithaddiction.com'
const slug = process.argv[2]

if (!slug) {
  console.error('Usage: node scripts/add-post-from-wp.mjs <slug>')
  process.exit(1)
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SWA-migrator/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function downloadImage(srcUrl) {
  if (!srcUrl) return null
  const full = srcUrl.startsWith('http') ? srcUrl : BASE + srcUrl
  const filename = path.basename(full.split('?')[0])
  const dest = path.join(IMG_DIR, filename)
  if (fs.existsSync(dest)) return `/images/blog/${filename}`
  try {
    const buf = await get(full)
    fs.writeFileSync(dest, buf)
    return `/images/blog/${filename}`
  } catch {
    console.warn(`  ⚠ failed: ${filename}`)
    return null
  }
}

async function localiseContent(html) {
  if (!html) return ''
  const urlPattern = /https?:\/\/strugglingwithaddiction\.com\/wp-content\/uploads\/[^\s"')>]+/g
  const matches = [...new Set(html.match(urlPattern) || [])]
  const map = {}
  for (const url of matches) {
    const local = await downloadImage(url)
    if (local) map[url] = local
  }
  let out = html
  for (const [remote, local] of Object.entries(map)) {
    out = out.replaceAll(remote, local)
  }
  return out
}

const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'))
const catById = Object.fromEntries(categories.map(c => [c.id, c]))

const url = `${BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`
const raw = JSON.parse((await get(url)).toString())
if (!raw.length) {
  console.error(`Post not found: ${slug}`)
  process.exit(1)
}
const p = raw[0]
const yoast = p.yoast_head_json || {}

if (JSON.parse(fs.readFileSync(POSTS_FILES[0], 'utf8')).some(x => x.slug === slug || x.id === p.id)) {
  console.log(`Post already in posts.json: ${slug}`)
  process.exit(0)
}

console.log(`Adding: ${p.title?.rendered || slug}`)

const featuredSrc = p.featured_media
  ? JSON.parse((await get(`${BASE}/wp-json/wp/v2/media/${p.featured_media}?_fields=source_url`)).toString()).source_url
  : null
const featuredLocal = await downloadImage(featuredSrc)
const content = await localiseContent(p.content?.rendered || '')
const excerpt = (p.excerpt?.rendered || '')
  .replace(/<[^>]+>/g, '')
  .replace(/\[&hellip;\]|\[…\]/g, '…')
  .trim()

const categoryIds = p.categories || []
const categoryNames = categoryIds.map(id => catById[id]).filter(Boolean)

const metaTitle = (yoast.title || p.title?.rendered || '')
  .replace(/\s*[-|–—]\s*Struggling With Addiction\s*$/i, '')
  .trim()
const metaDescription = (yoast.description || excerpt).trim()

const post = {
  id: p.id,
  slug: p.slug,
  date: p.date,
  title: p.title?.rendered || '',
  excerpt,
  content,
  featuredImage: featuredLocal,
  categories: categoryIds,
  categoryNames,
  authorId: p.author,
  metaTitle: metaTitle || undefined,
  metaDescription: metaDescription || undefined,
}

for (const file of POSTS_FILES) {
  const posts = JSON.parse(fs.readFileSync(file, 'utf8'))
  posts.push(post)
  fs.writeFileSync(file, JSON.stringify(posts, null, 2))
  console.log(`✓ Updated ${file}`)
}

console.log(`✓ authorId=${post.authorId}, categories=${categoryNames.map(c => c.name).join(', ')}`)
if (post.metaDescription) console.log(`✓ metaDescription: ${post.metaDescription.slice(0, 80)}…`)
