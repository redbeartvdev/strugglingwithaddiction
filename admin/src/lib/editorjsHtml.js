import edjsHTML from 'editorjs-html'

const parser = edjsHTML()

export function blocksToHtml(data) {
  if (!data?.blocks?.length) return ''
  try {
    const parts = parser.parse(data)
    return Array.isArray(parts) ? parts.join('') : String(parts || '')
  } catch {
    return ''
  }
}

export function parseContentJson(raw) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}
