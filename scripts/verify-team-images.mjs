import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = new URL('..', import.meta.url).pathname
const team = JSON.parse(readFileSync(join(root, 'src/data/team.json'), 'utf8'))
const missing = []

for (const member of team) {
  const image = member.image
  if (!image?.startsWith('/images/team/')) {
    missing.push(`${member.name}: image must be a local /images/team/ path (got ${image})`)
    continue
  }
  const file = join(root, 'public', image)
  if (!existsSync(file)) missing.push(`${member.name}: missing file ${image}`)
}

if (missing.length) {
  console.error('Team image verification failed:\n' + missing.map(m => `  - ${m}`).join('\n'))
  process.exit(1)
}

console.log(`Team images OK (${team.length} members)`)
