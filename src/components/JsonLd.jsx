import { useEffect } from 'react'

export default function JsonLd({ data }) {
  useEffect(() => {
    if (!data) return undefined
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'swa-json-ld'
    script.text = JSON.stringify(data)
    document.head.appendChild(script)
    return () => {
      document.getElementById('swa-json-ld')?.remove()
    }
  }, [data])
  return null
}
