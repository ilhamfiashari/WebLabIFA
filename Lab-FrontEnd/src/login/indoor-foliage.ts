// Smooth AC-breeze displacement animation for the top-left indoor potted plant.
// Uses a precomputed, polygon-bounded, softly feathered leaf mask and bilinear
// inverse sampling so leaves and hanging vines sway organically without moving
// the nearby switch rack or laptop bezel.

export const INDOOR_PLANT_X = 0
export const INDOOR_PLANT_Y = 0
export const INDOOR_PLANT_W = 190
export const INDOOR_PLANT_H = 216

export interface IndoorFoliageAnimator {
  load(photo: HTMLImageElement): void
  draw(ctx: CanvasRenderingContext2D, t: number): number
  reset(): void
}

function insidePlantPolygon(x: number, y: number): boolean {
  // Keeps 100% clear of the switch rack on the right and the laptop bezel below y=216.
  if (x < 0 || y < 0 || x >= INDOOR_PLANT_W || y >= INDOOR_PLANT_H) return false
  let maxX: number
  if (y < 58) {
    maxX = 186
  } else if (y < 145) {
    // Taper gently along the left edge of the black rack
    maxX = 186 - ((y - 58) / 87) * 26
  } else {
    // Taper away from the lower rack and above the laptop top-left corner
    maxX = 160 - ((y - 145) / 71) * 32
  }
  return x <= maxX
}

function isIndoorLeafPixel(r: number, g: number, b: number): boolean {
  // Detects bright/mid green leaves (day, sunrise, rainy, snowy), warm olive/amber
  // leaves under sunset lighting, and dimly lit dark green leaves at night.
  if (g > b * 1.18 && g >= r * 0.70 && g > 16) return true
  if (r > 28 && g > 24 && b < Math.min(r, g) * 0.72) return true
  return false
}

function buildSoftLeafMask(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const size = w * h
  const raw = new Uint8Array(size)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!insidePlantPolygon(x, y)) continue
      const idx = (y * w + x) * 4
      if (isIndoorLeafPixel(data[idx], data[idx + 1], data[idx + 2])) {
        raw[y * w + x] = 1
      }
    }
  }

  // Dilate by 4px so the leaf perimeter moves smoothly into adjacent background space.
  const dilated = new Float32Array(size)
  const dilateR = 4
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - dilateR)
    const y1 = Math.min(h - 1, y + dilateR)
    for (let x = 0; x < w; x++) {
      if (!insidePlantPolygon(x, y)) continue
      let hit = 0
      const x0 = Math.max(0, x - dilateR)
      const x1 = Math.min(w - 1, x + dilateR)
      for (let yy = y0; yy <= y1 && !hit; yy++) {
        const row = yy * w
        for (let xx = x0; xx <= x1; xx++) {
          if (raw[row + xx]) {
            hit = 1
            break
          }
        }
      }
      dilated[y * w + x] = hit
    }
  }

  // Two-pass separable box blur (radius 3) for seamless feathered transitions.
  const tmp = new Float32Array(size)
  const out = new Float32Array(size)
  const blurR = 3
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let sum = 0
      let count = 0
      for (let k = -blurR; k <= blurR; k++) {
        const xx = x + k
        if (xx >= 0 && xx < w) {
          sum += dilated[row + xx]
          count++
        }
      }
      tmp[row + x] = sum / count
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let count = 0
      for (let k = -blurR; k <= blurR; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) {
          sum += tmp[yy * w + x]
          count++
        }
      }
      // Fade cleanly near the bottom & right polygon margins so edges never clip.
      const edgeFadeY = y > h - 10 ? (h - 1 - y) / 9 : 1
      const edgeFadeX = x > w - 8 ? (w - 1 - x) / 7 : 1
      out[y * w + x] = (sum / count) * Math.max(0, edgeFadeY) * Math.max(0, edgeFadeX)
    }
  }
  return out
}

export function createIndoorFoliage(): IndoorFoliageAnimator {
  const canvas = document.createElement('canvas')
  canvas.width = INDOOR_PLANT_W
  canvas.height = INDOOR_PLANT_H
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true })!

  let source: Uint8ClampedArray | null = null
  let mask: Float32Array | null = null
  let frameImage: ImageData | null = null
  let lastTick = -1

  return {
    reset() {
      source = null
      mask = null
      frameImage = null
      lastTick = -1
    },
    load(photo: HTMLImageElement) {
      ctx2d.clearRect(0, 0, INDOOR_PLANT_W, INDOOR_PLANT_H)
      ctx2d.drawImage(
        photo,
        INDOOR_PLANT_X,
        INDOOR_PLANT_Y,
        INDOOR_PLANT_W,
        INDOOR_PLANT_H,
        0,
        0,
        INDOOR_PLANT_W,
        INDOOR_PLANT_H,
      )
      const img = ctx2d.getImageData(0, 0, INDOOR_PLANT_W, INDOOR_PLANT_H)
      source = new Uint8ClampedArray(img.data)
      mask = buildSoftLeafMask(source, INDOOR_PLANT_W, INDOOR_PLANT_H)
      frameImage = ctx2d.createImageData(INDOOR_PLANT_W, INDOOR_PLANT_H)
      lastTick = -1
    },
    draw(target: CanvasRenderingContext2D, t: number): number {
      if (!source || !mask || !frameImage) return 0

      // Gentle indoor AC draft: slow rhythmic louver cycle + soft leaf-tip flutter.
      const gust = 0.58 + 0.42 * Math.sin(t * 0.48 + 0.65)
      const tick = Math.floor(t * 24)
      if (tick !== lastTick) {
        lastTick = tick
        const src = source
        const dst = frameImage.data
        const w = INDOOR_PLANT_W
        const h = INDOOR_PLANT_H

        for (let y = 0; y < h; y++) {
          const row = y * w
          const yNorm = y / h
          const baseWaveX = Math.sin(t * 1.45 + y * 0.024) * 2.65
          const baseWaveY = Math.cos(t * 1.15 + y * 0.032) * 0.65
          for (let x = 0; x < w; x++) {
            const m = mask[row + x]
            const outIdx = (row + x) * 4
            if (m < 0.015) {
              dst[outIdx + 3] = 0
              continue
            }

            // Leaves further from the top-left stem/anchor sway slightly more freely.
            const tipFactor = 0.45 + 0.55 * (0.55 * (x / w) + 0.45 * yNorm)
            const flutterX = Math.sin(t * 2.85 + x * 0.048 - y * 0.032) * 0.95
            const flutterY = Math.sin(t * 2.15 + x * 0.038 + 0.9) * 0.9
            const dx = (baseWaveX + flutterX) * gust * tipFactor * m
            const dy = (baseWaveY + flutterY) * gust * tipFactor * m

            const sx = Math.max(0, Math.min(w - 1.001, x - dx))
            const sy = Math.max(0, Math.min(h - 1.001, y - dy))
            const x0 = Math.floor(sx)
            const y0 = Math.floor(sy)
            const fx = sx - x0
            const fy = sy - y0
            const i00 = (y0 * w + x0) * 4
            const i10 = i00 + 4
            const i01 = i00 + w * 4
            const i11 = i01 + 4
            const w00 = (1 - fx) * (1 - fy)
            const w10 = fx * (1 - fy)
            const w01 = (1 - fx) * fy
            const w11 = fx * fy

            dst[outIdx] = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11
            dst[outIdx + 1] = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11
            dst[outIdx + 2] = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11
            dst[outIdx + 3] = Math.round(Math.min(1, m * 1.45) * 255)
          }
        }
        ctx2d.putImageData(frameImage, 0, 0)
      }

      target.drawImage(canvas, INDOOR_PLANT_X, INDOOR_PLANT_Y, INDOOR_PLANT_W, INDOOR_PLANT_H)
      return Math.sin(t * 1.45) * gust
    },
  }
}
