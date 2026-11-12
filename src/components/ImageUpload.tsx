import { useState, type DragEvent } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { Icon } from './icons'
import { Thumbnail } from './Thumbnail'
import { useToast } from './Toast'
import { Button } from './ui'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 5 * 1024 * 1024

type SignedUpload = { bucket: string; path: string; token: string; publicUrl: string }

/** Image picker: drop a file on it or browse; shows the current image with Replace and Remove. */
export function ImageUpload({
  value,
  onChange,
  folder,
  allowRemove = true,
}: {
  value: string | null
  onChange: (url: string | null) => void
  folder: 'products' | 'pages' | 'misc'
  /** False where a photo is required (page photos): only Replace is offered. */
  allowRemove?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const toast = useToast()

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) return toast.error('The image must be JPG, PNG, WebP or AVIF.')
    if (file.size > MAX_BYTES) return toast.error('The image must be 5 MB or smaller.')

    setUploading(true)
    try {
      const signed = await api<SignedUpload>('/uploads/sign', { method: 'POST', body: { folder, contentType: file.type } })
      const { error } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: file.type,
      })
      if (error) throw error
      onChange(signed.publicUrl)
      toast.success('Photo uploaded. Save to keep it.')
    } catch (error) {
      toast.error(error)
    } finally {
      setUploading(false)
    }
  }

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setDragOver(true)
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && !uploading) upload(file)
    },
  }

  const fileInput = (
    <input
      type="file"
      accept={ACCEPTED.join(',')}
      className="sr-only"
      disabled={uploading}
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) upload(file)
      }}
    />
  )

  if (value) {
    return (
      <div className="flex flex-col gap-3">
        <div {...dropProps} className={`relative overflow-hidden rounded-lg ${dragOver ? 'ring-2 ring-brand-600 ring-offset-2' : ''}`}>
          <Thumbnail url={value} className="aspect-square w-full" />
          {(uploading || dragOver) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-medium text-stone-700">
              {uploading ? 'Uploading…' : 'Drop to replace'}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <label
            className={`inline-flex flex-1 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium shadow-xs transition hover:bg-stone-50 focus-within:ring-2 focus-within:ring-brand-100 ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            Replace
            {fileInput}
          </label>
          {allowRemove && (
            <Button variant="danger" disabled={uploading} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <label
      {...dropProps}
      className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition focus-within:ring-2 focus-within:ring-brand-100 ${
        dragOver ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100/60'
      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-white text-stone-500 shadow-xs">
        <Icon name="image" size={20} />
      </span>
      <span className="text-sm font-medium text-stone-700">{uploading ? 'Uploading…' : 'Drop an image here or browse'}</span>
      <span className="text-xs text-stone-500">JPG, PNG, WebP or AVIF, up to 5 MB</span>
      {fileInput}
    </label>
  )
}
