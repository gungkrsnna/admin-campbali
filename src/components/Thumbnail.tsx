import { useState } from 'react'
import { env } from '../lib/env'
import { Icon } from './icons'

/**
 * Images from the public site's folder are stored as "/images/…"; uploads are full URLs.
 * In development the admin's own dev server serves "/images/…" (see vite.config.ts),
 * so they show even when the site isn't running; in production they come from the site.
 */
export function imageSrc(url: string | null) {
  if (!url) return null
  if (!url.startsWith('/')) return url
  return import.meta.env.DEV ? url : `${env.siteUrl}${url}`
}

/**
 * Product image with a placeholder when there is no image or it fails to load
 * (e.g. images from the public site while the site itself isn't running).
 */
export function Thumbnail({ url, className = 'size-14' }: { url: string | null; className?: string }) {
  const src = imageSrc(url)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== null && failedSrc === src

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 text-stone-400 ${className}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <span title={src ? 'Image could not be loaded' : 'No image'}>
          <Icon name="image" size={20} />
        </span>
      )}
    </div>
  )
}
