// Gera os PNGs do PWA a partir do favicon.svg (fonte única do ícone).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(root, 'public', 'favicon.svg')
const outDir = path.join(root, 'public', 'icons')

await mkdir(outDir, { recursive: true })
for (const size of [192, 512]) {
  const out = path.join(outDir, `icon-${size}.png`)
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(out)
  console.log(`✔ ${out}`)
}
