import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const siteImages = resolve(import.meta.dirname, '../frontend/public/images')
const imageTypes: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

/**
 * Dev only: serves the public site's /images/* straight from frontend/public, so product
 * images show in the admin without the site running. In production the admin loads them
 * from VITE_SITE_URL instead (see imageSrc in src/components/Thumbnail.tsx).
 */
function siteImagesInDev(): Plugin {
  return {
    name: 'site-images-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/images', (req, res, next) => {
        const file = resolve(siteImages, '.' + decodeURIComponent((req.url ?? '').split('?')[0]))
        const type = imageTypes[extname(file).toLowerCase()]
        // Only image files inside frontend/public/images.
        if (!type || !file.startsWith(siteImages + sep)) return next()
        try {
          const { size } = statSync(file)
          res.writeHead(200, { 'content-type': type, 'content-length': size, 'cache-control': 'no-cache' })
          createReadStream(file).pipe(res)
        } catch {
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteImagesInDev()],
  server: { port: 5173, strictPort: true },
})
