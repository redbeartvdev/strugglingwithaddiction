/**
 * Fetches all posts from the SWA WordPress REST API, downloads every
 * image (featured + inline), rewrites URLs to local /images/blog/ paths,
 * and writes src/data/posts.json.
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMG_DIR = path.join(ROOT, 'public', 'images', 'blog')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'posts.json')
const BASE = 'https://strugglingwithaddiction.com'

fs.mkdirSync(IMG_DIR, { recursive: true })
fs.mkdirSync(path.join(ROOT, 'src', 'data'), { recursive: true })

// ── Helpers ──────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, { headers: { 'User-Agent': 'SWA-migrator/1.0' } }, res => {
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
  } catch (e) {
    console.warn(`  ⚠ failed: ${filename}`)
    return null
  }
}

// Replace all WP upload URLs in HTML with local paths
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

// ── Fetch posts ───────────────────────────────────────────────────────────────

async function fetchPage(page) {
  const url = `${BASE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,slug,date,title,excerpt,content,featured_media,categories,author`
  const buf = await get(url)
  return JSON.parse(buf.toString())
}

async function fetchMedia(id) {
  if (!id) return null
  try {
    const buf = await get(`${BASE}/wp-json/wp/v2/media/${id}?_fields=source_url`)
    return JSON.parse(buf.toString()).source_url || null
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Fetching posts...')
const [page1, page2] = await Promise.all([fetchPage(1), fetchPage(2)])
const raw = [...page1, ...page2]
console.log(`  ${raw.length} posts found`)

const posts = []
let i = 0
for (const p of raw) {
  i++
  process.stdout.write(`  [${i}/${raw.length}] ${p.slug}\n`)

  const featuredSrc = await fetchMedia(p.featured_media)
  const featuredLocal = await downloadImage(featuredSrc)
  const content = await localiseContent(p.content?.rendered || '')
  const excerpt = (p.excerpt?.rendered || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[&hellip;\]|\[…\]/g, '…')
    .trim()

  posts.push({
    id: p.id,
    slug: p.slug,
    date: p.date,
    title: p.title?.rendered || '',
    excerpt,
    content,
    featuredImage: featuredLocal,
    categories: p.categories || [],
  })
}

fs.writeFileSync(OUT_FILE, JSON.stringify(posts, null, 2))
console.log(`\n✓ Saved ${posts.length} posts → src/data/posts.json`)
console.log(`✓ Images → public/images/blog/`)
