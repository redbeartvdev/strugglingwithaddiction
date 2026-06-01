/** Convert legacy HTML (WordPress-style) into Editor.js block data. */
export function htmlToEditorJs(html) {
  if (!html?.trim()) return { blocks: [{ type: 'paragraph', data: { text: '' } }] }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const blocks = []

  function pushParagraph(htmlText) {
    const text = htmlText?.trim()
    if (!text) return
    blocks.push({ type: 'paragraph', data: { text } })
  }

  function headerLevel(tag) {
    const n = parseInt(tag.replace('h', ''), 10)
    if (n <= 2) return 2
    if (n === 3) return 3
    return 4
  }

  function pushImage(src, caption = '') {
    if (!src) return
    blocks.push({
      type: 'image',
      data: {
        file: { url: src },
        caption: caption || '',
        withBorder: false,
        withBackground: false,
        stretched: false,
      },
    })
  }

  function pushList(node, ordered) {
    const items = [...node.querySelectorAll(':scope > li')]
      .map(li => li.innerHTML.trim() || li.textContent.trim())
      .filter(Boolean)
    if (!items.length) return
    blocks.push({ type: 'list', data: { style: ordered ? 'ordered' : 'unordered', items } })
  }

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim()
      if (t) pushParagraph(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tag = node.tagName.toLowerCase()

    if (tag === 'p') {
      pushParagraph(node.innerHTML)
    } else if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: 'header', data: { text: node.textContent.trim(), level: headerLevel(tag) } })
    } else if (tag === 'ul') {
      pushList(node, false)
    } else if (tag === 'ol') {
      pushList(node, true)
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', data: { text: node.innerHTML.trim(), caption: '' } })
    } else if (tag === 'hr') {
      blocks.push({ type: 'delimiter', data: {} })
    } else if (tag === 'img') {
      pushImage(node.getAttribute('src'), node.getAttribute('alt'))
    } else if (tag === 'figure') {
      const img = node.querySelector('img')
      if (img) pushImage(img.getAttribute('src'), img.getAttribute('alt'))
      else [...node.childNodes].forEach(processNode)
    } else if (tag === 'iframe') {
      const src = node.getAttribute('src') || ''
      if (src) blocks.push({ type: 'embed', data: { service: 'youtube', source: src, embed: src } })
    } else if (tag === 'div' && (node.classList.contains('wp-block-image') || node.classList.contains('wp-block-embed__wrapper'))) {
      const img = node.querySelector('img')
      const iframe = node.querySelector('iframe')
      if (img) pushImage(img.getAttribute('src'), img.getAttribute('alt'))
      else if (iframe) {
        const src = iframe.getAttribute('src') || ''
        if (src) blocks.push({ type: 'embed', data: { service: 'youtube', source: src, embed: src } })
      } else [...node.childNodes].forEach(processNode)
    } else if (tag === 'br') {
      /* skip lone breaks */
    } else if (['div', 'section', 'article', 'span'].includes(tag)) {
      [...node.childNodes].forEach(processNode)
    } else {
      const inner = node.innerHTML?.trim()
      if (inner) pushParagraph(inner)
    }
  }

  [...doc.body.childNodes].forEach(processNode)

  if (!blocks.length) blocks.push({ type: 'paragraph', data: { text: '' } })
  return { blocks, time: Date.now(), version: '2.28.0' }
}

export function editorDataFromPost(post) {
  const json = typeof post.content_json === 'string'
    ? (() => { try { return JSON.parse(post.content_json) } catch { return null } })()
    : post.content_json
  if (json?.blocks?.length) return json
  return htmlToEditorJs(post.content_html || post.content || '')
}
