import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const size = Math.min(pixelCrop.width, pixelCrop.height, 512)
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)
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

export default function ImageCropUpload({ onCropped }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  const onFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageSrc(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
    onCropped(new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
    setImageSrc(null)
  }

  if (!imageSrc) {
    return (
      <label className="btn btn-ghost btn-sm featured-upload-btn">
        Choose photo
        <input type="file" accept="image/*" onChange={onFileChange} hidden />
      </label>
    )
  }

  return (
    <div>
      <div className="crop-wrap">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <label>Zoom</label>
      <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
      <div className="form-actions form-actions-tight">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImageSrc(null)}>Cancel</button>
      </div>
    </div>
  )
}
