// Writes the PWA icons as PNG files. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** `pixel(x, y)` gets coordinates from 0 to 1 and returns [r, g, b]. */
function png(size, pixel) {
  const stride = size * 3 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size)
      raw.set([r, g, b], y * stride + 1 + x * 3)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const EMERALD = [4, 120, 87]
const INK = [24, 24, 27]
const WHITE = [255, 255, 255]
const CELLS = [
  { from: 0.16, to: 0.36, color: [253, 230, 138] }, // yellow zone
  { from: 0.4, to: 0.6, color: [187, 247, 208] }, // green zone
  { from: 0.64, to: 0.84, color: [233, 213, 255] }, // purple zone
]

// Three track cells on emerald, with a token on the middle cell.
// Everything sits inside the central 80%, so the icon also works as a maskable icon.
function pixel(x, y) {
  const d = Math.hypot(x - 0.5, y - 0.5)
  if (d < 0.07) return WHITE
  if (d < 0.095) return INK
  if (y > 0.38 && y < 0.62) {
    for (const cell of CELLS) if (x > cell.from && x < cell.to) return cell.color
  }
  return EMERALD
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(size, pixel))
  console.log(`public/${name}`)
}
