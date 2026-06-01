/**
 * Fetches WordPress users and writes src/data/users.json for DB import.
 * Merges author titles/bios from authors.json when present.
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'src', 'data', 'users.json')
const AUTHORS = path.join(ROOT, 'src', 'data', 'authors.json')
const BASE = 'https://strugglingwithaddiction.com'

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SWA-migrator/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function emailFor(wp) {
  const name = (wp.name || '').trim()
  if (name.includes('@')) return name.toLowerCase()
  return `${wp.slug}@strugglingwithaddiction.com`.toLowerCase()
}

function roleFor(wp) {
  if (emailFor(wp) === 'pj@redbear.tv') return 'admin'
  return 'editor'
}

async function main() {
  const raw = await get(`${BASE}/wp-json/wp/v2/users?per_page=100`)
  const wpUsers = JSON.parse(raw)
  const authors = fs.existsSync(AUTHORS) ? JSON.parse(fs.readFileSync(AUTHORS, 'utf8')) : []
  const byId = Object.fromEntries(authors.map(a => [a.id, a]))

  const users = wpUsers.map(wp => {
    const author = byId[wp.id]
    return {
      id: wp.id,
      slug: wp.slug,
      email: emailFor(wp),
      name: wp.name,
      role: roleFor(wp),
      is_active: true,
      title: author?.title ?? null,
      bio: author?.bio ?? wp.description?.replace(/<[^>]+>/g, '') ?? null,
    }
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(users, null, 2) + '\n')
  console.log(`Wrote ${users.length} users → ${OUT}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
