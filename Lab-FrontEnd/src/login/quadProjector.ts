export type QuadPoint = [number, number]
export type CornerRadii = [number, number, number, number]

export interface QuadProjector {
  project: (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    corners: QuadPoint[],
    columns?: number,
    rows?: number,
    cornerRadii?: CornerRadii,
  ) => void
  dispose: () => void
}

function traceRoundedQuad(
  ctx: CanvasRenderingContext2D,
  corners: QuadPoint[],
  radii: CornerRadii,
) {
  const [a, b, c, d] = corners
  const pts = [a, b, c, d]
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4]
    const curr = pts[i]
    const next = pts[(i + 1) % 4]
    const r = radii[i]
    if (r <= 0) {
      if (i === 0) ctx.moveTo(curr[0], curr[1])
      else ctx.lineTo(curr[0], curr[1])
      continue
    }
    const v1x = prev[0] - curr[0]
    const v1y = prev[1] - curr[1]
    const v2x = next[0] - curr[0]
    const v2y = next[1] - curr[1]
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const pStartX = curr[0] + (v1x / l1) * Math.min(r, l1 * 0.25)
    const pStartY = curr[1] + (v1y / l1) * Math.min(r, l1 * 0.25)
    const pEndX = curr[0] + (v2x / l2) * Math.min(r, l2 * 0.25)
    const pEndY = curr[1] + (v2y / l2) * Math.min(r, l2 * 0.25)
    if (i === 0) ctx.moveTo(pStartX, pStartY)
    else ctx.lineTo(pStartX, pStartY)
    ctx.quadraticCurveTo(curr[0], curr[1], pEndX, pEndY)
  }
  ctx.closePath()
}

export function createQuadProjector(): QuadProjector {
  return {
    project(ctx, source, corners, columns = 10, rows = 8, cornerRadii = [0, 0, 0, 0]) {
      const [a, b, c, d] = corners
      const dx1 = b[0] - c[0]
      const dx2 = d[0] - c[0]
      const dx3 = a[0] - b[0] + c[0] - d[0]
      const dy1 = b[1] - c[1]
      const dy2 = d[1] - c[1]
      const dy3 = a[1] - b[1] + c[1] - d[1]
      const det = dx1 * dy2 - dx2 * dy1
      if (Math.abs(det) < 1e-6) return
      const g = (dx3 * dy2 - dx2 * dy3) / det
      const h = (dx1 * dy3 - dx3 * dy1) / det

      const tm = ctx.getTransform()
      const pxScale = Math.max(0.15, Math.hypot(tm.a, tm.b))
      // Dilate interior clip triangles by ~1.75 device pixels so WebKit/CoreGraphics clip AA never leaks seams.
      const bleed = Math.min(8, 1.75 / pxScale)

      const point = (u: number, v: number): QuadPoint => {
        const denom = g * u + h * v + 1
        return [
          ((b[0] - a[0] + g * b[0]) * u + (d[0] - a[0] + h * d[0]) * v + a[0]) / denom,
          ((b[1] - a[1] + g * b[1]) * u + (d[1] - a[1] + h * d[1]) * v + a[1]) / denom,
        ]
      }

      const expandFromCentroid = (pts: [QuadPoint, QuadPoint, QuadPoint]): [QuadPoint, QuadPoint, QuadPoint] => {
        const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3
        const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3
        return pts.map(([px, py]) => {
          const dx = px - cx
          const dy = py - cy
          const len = Math.hypot(dx, dy) || 1
          return [px + (dx / len) * bleed, py + (dy / len) * bleed] as QuadPoint
        }) as [QuadPoint, QuadPoint, QuadPoint]
      }

      const tri = (uv: [QuadPoint, QuadPoint, QuadPoint]) => {
        const p = uv.map(([u, v]) => point(u, v)) as [QuadPoint, QuadPoint, QuadPoint]
        const s = uv.map(([u, v]) => [u * source.width, v * source.height] as QuadPoint)
        const [s0, s1, s2] = s
        const [p0, p1, p2] = p
        const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1])
        if (Math.abs(den) < 1e-6) return
        const aa = ((p1[0] - p0[0]) * (s2[1] - s0[1]) - (p2[0] - p0[0]) * (s1[1] - s0[1])) / den
        const bb = ((p1[1] - p0[1]) * (s2[1] - s0[1]) - (p2[1] - p0[1]) * (s1[1] - s0[1])) / den
        const cc = ((p2[0] - p0[0]) * (s1[0] - s0[0]) - (p1[0] - p0[0]) * (s2[0] - s0[0])) / den
        const dd = ((p2[1] - p0[1]) * (s1[0] - s0[0]) - (p1[1] - p0[1]) * (s2[0] - s0[0])) / den
        const [cp0, cp1, cp2] = expandFromCentroid(p)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cp0[0], cp0[1])
        ctx.lineTo(cp1[0], cp1[1])
        ctx.lineTo(cp2[0], cp2[1])
        ctx.closePath()
        ctx.clip()
        ctx.transform(aa, bb, cc, dd, p0[0] - aa * s0[0] - cc * s0[1], p0[1] - bb * s0[0] - dd * s0[1])
        ctx.drawImage(source, 0, 0)
        ctx.restore()
      }

      // Smoothly anti-aliased outer bezel clip keeps corners rounded and edges straight without jagged steps.
      ctx.save()
      traceRoundedQuad(ctx, corners, cornerRadii)
      ctx.clip()

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const u = x / columns
          const v = y / rows
          const uu = (x + 1) / columns
          const vv = (y + 1) / rows
          tri([[u, v], [uu, v], [uu, vv]])
          tri([[u, v], [uu, vv], [u, vv]])
        }
      }
      ctx.restore()
    },
    dispose() {
      // Pure 2D canvas path holds no WebGL context to dispose.
    },
  }
}
