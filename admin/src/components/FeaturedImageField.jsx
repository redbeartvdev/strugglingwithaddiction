import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { apiUpload } from '../api'
import { resolveMediaUrl } from '../lib/mediaUrl'

async function getCroppedImg(imageSrc, pixelCrop, aspect) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const outW = aspect >= 1 ? 1200 : Math.round(1200 * aspect)
  const outH = aspect >= 1 ? Math.round(1200 / aspect) : 1200
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function urlToDataUrl(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function FeaturedImageField({ imageUrl, imageKey, onChange, onUploading }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [uploading, setUploading] = useState(false)
  const aspect = 16 / 9

  const resolvedUrl = resolveMediaUrl(imageUrl || imageKey)
  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  const onFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageSrc(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const startRecrop = async () => {
    if (!resolvedUrl) return
    try {
      const dataUrl = await urlToDataUrl(resolvedUrl)
      setImageSrc(dataUrl)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch {
      /* fetch failed */
    }
  }

  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    onUploading?.(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, aspect)
      const file = new File([blob], 'featured.jpg', { type: 'image/jpeg' })
      const res = await apiUpload('/api/editor/uploads', file)
      onChange({ key: res.file.key, url: resolveMediaUrl(res.file.url) })
      setImageSrc(null)
    } finally {
      setUploading(false)
      onUploading?.(false)
    }
  }

  const preview = imageSrc || resolvedUrl

  return (
    <div className="featured-field">
      <div className="featured-field-head">
        <label>Featured image</label>
        <span className="muted">16:9 · crop before upload</span>
      </div>

      {preview ? (
        <div className="featured-preview-wrap">
          {imageSrc ? (
            <div className="crop-wrap featured-crop">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          ) : (
            <img src={preview} alt="Featured" className="featured-preview-img" />
          )}
        </div>
      ) : (
        <div className="featured-empty">
          <p className="muted">No featured image yet.</p>
        </div>
      )}

      {imageSrc ? (
        <>
          <label>Zoom</label>
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          <div className="form-actions form-actions-tight">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveCrop} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Apply crop & upload'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImageSrc(null)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="form-actions form-actions-tight">
          <label className="btn btn-ghost btn-sm featured-upload-btn">
            {resolvedUrl ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={onFileChange} hidden />
          </label>
          {resolvedUrl && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={startRecrop}>Re-crop</button>
              <button type="button" className="btn btn-link btn-sm" onClick={() => onChange({ key: null, url: null })}>
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
