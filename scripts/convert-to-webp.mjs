/**
 * Converts all JPEG/PNG/GIF under public/ to WebP, removes originals,
 * rewrites /images/... and /favicon references in source files.
 * Run: node scripts/convert-to-webp.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

const RASTER_EXT = /\.(jpg|jpeg|png|gif)$/i

/** Root-relative /images/... only; skips https://.../images/... */
function rewriteImageRefs(text) {
  let out = text.replace(
    /(?<![a-zA-Z0-9.])(\/images\/[a-zA-Z0-9_.\-/]+)\.(jpg|jpeg|png|gif)\b/gi,
    (_, base) => `${base}.webp`
  )
  out = out.replace(/(\/favicon)\.(png|jpg|jpeg|gif)\b/gi, '$1.webp')
  return out
}

function collectRasterFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) collectRasterFiles(full, out)
    else if (RASTER_EXT.test(ent.name)) out.push(full)
  }
  return out
}

const FILES_TO_REWRITE = [
  path.join(ROOT, 'src', 'data', 'posts.json'),
  path.join(ROOT, 'src', 'pages', 'Home.jsx'),
  path.join(ROOT, 'src', 'pages', 'About.jsx'),
  path.join(ROOT, 'src', 'pages', 'RehabCenters.jsx'),
  path.join(ROOT, 'src', 'pages', 'Blog.css'),
  path.join(ROOT, 'src', 'pages', 'About.css'),
  path.join(ROOT, 'src', 'pages', 'RehabCenters.css'),
  path.join(ROOT, 'index.html'),
]

async function main() {
  const files = collectRasterFiles(PUBLIC)
  let bytesIn = 0
  let bytesOut = 0
  let ok = 0
  let fail = 0

  console.log(`Found ${files.length} raster files under public/`)

  for (const file of files) {
    const outPath = file.replace(RASTER_EXT, '.webp')
    try {
      const st = fs.statSync(file)
      bytesIn += st.size
      await sharp(file).webp({ quality: 82, effort: 4 }).toFile(outPath)
      const ost = fs.statSync(outPath)
      bytesOut += ost.size
      fs.unlinkSync(file)
      ok++
      if (ok % 100 === 0) console.log(`  converted ${ok}/${files.length}…`)
    } catch (e) {
      console.error('FAIL', path.relative(ROOT, file), e.message)
      fail++
    }
  }

  console.log(`\nConversion: ${ok} ok, ${fail} failed`)
  const saved = bytesIn - bytesOut
  const pct = bytesIn ? ((saved / bytesIn) * 100).toFixed(1) : '0'
  console.log(
    `Raster bytes before: ${bytesIn.toLocaleString()} (${(bytesIn / 1024 / 1024).toFixed(2)} MB)`
  )
  console.log(
    `WebP bytes after:  ${bytesOut.toLocaleString()} (${(bytesOut / 1024 / 1024).toFixed(2)} MB)`
  )
  console.log(
    `Saved: ${saved.toLocaleString()} bytes (${(saved / 1024 / 1024).toFixed(2)} MB, ${pct}% smaller)`
  )

  for (const f of FILES_TO_REWRITE) {
    if (!fs.existsSync(f)) continue
    const raw = fs.readFileSync(f, 'utf8')
    const next = rewriteImageRefs(raw)
    if (next !== raw) {
      fs.writeFileSync(f, next)
      console.log('updated', path.relative(ROOT, f))
    }
  }

  // index.html favicon type
  const idx = path.join(ROOT, 'index.html')
  if (fs.existsSync(idx)) {
    let html = fs.readFileSync(idx, 'utf8')
    const html2 = html.replace(
      /<link rel="icon" type="image\/png" href="\/favicon\.webp"/,
      '<link rel="icon" type="image/webp" href="/favicon.webp"'
    )
    if (html2 !== html) fs.writeFileSync(idx, html2)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
