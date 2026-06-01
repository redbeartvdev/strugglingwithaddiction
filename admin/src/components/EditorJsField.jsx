import { useEffect, useRef } from 'react'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Paragraph from '@editorjs/paragraph'
import Image from '@editorjs/image'
import Quote from '@editorjs/quote'
import Delimiter from '@editorjs/delimiter'
import Embed from '@editorjs/embed'
import InlineCode from '@editorjs/inline-code'
import { apiUpload } from '../api'

const TOOLS = {
  header: { class: Header, config: { levels: [2, 3, 4], defaultLevel: 2 } },
  paragraph: { class: Paragraph, inlineToolbar: true },
  list: { class: List, inlineToolbar: true },
  quote: { class: Quote, inlineToolbar: true },
  delimiter: Delimiter,
  embed: { class: Embed, config: { services: { youtube: true, coub: true } } },
  inlineCode: InlineCode,
  image: {
    class: Image,
    config: {
      uploader: {
        async uploadByFile(file) {
          const res = await apiUpload('/api/editor/uploads', file)
          return { success: 1, file: { url: res.file.url } }
        },
      },
    },
  },
}

export default function EditorJsField({ holderId = 'editorjs', initialData, onReady, onChange }) {
  const editorRef = useRef(null)
  const readyRef = useRef(onReady)
  const changeRef = useRef(onChange)
  const dataRef = useRef(initialData)

  readyRef.current = onReady
  changeRef.current = onChange
  dataRef.current = initialData

  useEffect(() => {
    let destroyed = false
    let editor

    const init = async () => {
      editor = new EditorJS({
        holder: holderId,
        autofocus: false,
        data: dataRef.current || undefined,
        tools: TOOLS,
        onChange: async () => {
          if (destroyed || !editorRef.current) return
          try {
            const saved = await editorRef.current.save()
            changeRef.current?.(saved)
          } catch {
            /* not ready */
          }
        },
        onReady: () => {
          editorRef.current = editor
          if (!destroyed) readyRef.current?.(editor)
        },
      })
      await editor.isReady
    }

    init()

    return () => {
      destroyed = true
      if (editor?.destroy) {
        editor.destroy()
        editorRef.current = null
      }
    }
  }, [holderId])

  return <div id={holderId} className="editorjs-holder" />
}
