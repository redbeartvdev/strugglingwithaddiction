/**
 * Reads src/data/posts.json, sorts by date descending,
 * and writes the 3 most recent posts to src/data/recentPosts.json.
 * Run automatically as a prebuild step.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const POSTS_FILE = path.join(ROOT, 'src', 'data', 'posts.json')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'recentPosts.json')
const COUNT = 3

const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'))

const recent = posts
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, COUNT)
  .map(({ id, slug, date, title, excerpt, featuredImage, categoryNames }) => ({
    id, slug, date, title, excerpt, featuredImage, categoryNames,
  }))

fs.writeFileSync(OUT_FILE, JSON.stringify(recent, null, 2))
console.log(`✓ recentPosts.json updated with ${COUNT} latest posts`)
