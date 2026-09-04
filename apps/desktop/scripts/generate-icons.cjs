const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

if (!process.versions.electron) {
  const child = spawnSync(require('electron'), [__filename], { stdio: 'inherit', windowsHide: true })
  if (child.error) throw child.error
  process.exitCode = child.status ?? 1
} else {
  const { app, nativeImage } = require('electron')
  try {
    const source = nativeImage.createFromPath(resolve(__dirname, '../../../docs/assets/brand/chuanshengtong-logo-transparent.png'))
    if (source.isEmpty()) throw new Error('The approved transparent app icon is missing')
    const { width, height } = source.getSize()
    const pixels = source.toBitmap()
    let left = width, top = height, right = -1, bottom = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] < 16) continue
        left = Math.min(left, x); top = Math.min(top, y)
        right = Math.max(right, x); bottom = Math.max(bottom, y)
      }
    }
    if (right < left) throw new Error('The approved app icon is fully transparent')
    // Include antialiasing around the visible artwork, excluding faint export specks.
    left = Math.max(0, left - 2); top = Math.max(0, top - 2)
    right = Math.min(width - 1, right + 2); bottom = Math.min(height - 1, bottom + 2)
    const bounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
    const cropped = source.crop(bounds)
    const edge = 512
    const scale = (edge - 16) / Math.max(bounds.width, bounds.height)
    const scaled = cropped.resize({ width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale), quality: 'best' })
    const size = scaled.getSize()
    const content = scaled.toBitmap()
    const square = Buffer.alloc(edge * edge * 4)
    const offsetX = Math.floor((edge - size.width) / 2)
    const offsetY = Math.floor((edge - size.height) / 2)
    for (let y = 0; y < size.height; y++) {
      content.copy(square, ((offsetY + y) * edge + offsetX) * 4, y * size.width * 4, (y + 1) * size.width * 4)
    }
    const icon = nativeImage.createFromBitmap(square, { width: edge, height: edge })
    const output = resolve(__dirname, '../src/assets')
    mkdirSync(output, { recursive: true })
    writeFileSync(resolve(output, 'app-icon.png'), icon.toPNG())

    const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    const frames = sizes.map(size => icon.resize({ width: size, height: size, quality: 'best' }).toPNG())
    const directory = Buffer.alloc(6 + sizes.length * 16)
    directory.writeUInt16LE(1, 2)
    directory.writeUInt16LE(sizes.length, 4)
    let offset = directory.length
    for (let index = 0; index < sizes.length; index++) {
      const entry = 6 + index * 16
      directory[entry] = directory[entry + 1] = sizes[index] % 256
      directory.writeUInt16LE(1, entry + 4)
      directory.writeUInt16LE(32, entry + 6)
      directory.writeUInt32LE(frames[index].length, entry + 8)
      directory.writeUInt32LE(offset, entry + 12)
      offset += frames[index].length
    }
    writeFileSync(resolve(output, 'app-icon.ico'), Buffer.concat([directory, ...frames]))
    console.log(JSON.stringify({ output, sourceBounds: bounds, png: edge, ico: sizes }))
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
}
