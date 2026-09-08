import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PrivacyPolicyContent, TermsOfUseContent } from './LegalCopy'
import '../pages/Legal.css'
import './LegalPopup.css'

const DOCS = {
  privacy: { title: 'Privacy Policy', Content: PrivacyPolicyContent },
  terms: { title: 'Terms of Use', Content: TermsOfUseContent },
}

export default function LegalPopup({ doc, onClose }) {
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const spec = DOCS[doc]
  onCloseRef.current = onClose

  useEffect(() => {
    if (!spec) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKey(event) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [spec])

  if (!spec) return null

  const { title, Content } = spec

  return createPortal(
    <div className="legal-popup-backdrop" onClick={onClose}>
      <div
        className="legal-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-popup-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="legal-popup-top">
          <p className="legal-popup-eyebrow">Legal</p>
          <h2 id="legal-popup-title">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="legal-popup-close"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        <div className="legal-popup-body legal-content">
          <Content />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function openLegalDocument(event, open) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  open()
}
