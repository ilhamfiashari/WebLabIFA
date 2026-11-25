export type QuadPoint = [number, number]

export interface QuadProjector {
  project: (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    corners: QuadPoint[],
    columns?: number,
    rows?: number,
  ) => void
  dispose: () => void
}

function project2dSeamFree(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  corners: QuadPoint[],
  columns: number,
  rows: number,
  g: number,
  h: number,
) {
  const [a, b, c, d] = corners
  const tm = ctx.getTransform()
  const pxScale = Math.max(0.15, Math.hypot(tm.a, tm.b))
  // Dilate interior clip triangles by >1 device pixel so WebKit/CoreGraphics clip AA never leaks seams.
  const bleed = Math.min(6, 1.35 / pxScale)

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

  // Outer quad clip strictly prevents dilated triangles from spilling onto the laptop bezel.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(a[0], a[1])
  ctx.lineTo(b[0], b[1])
  ctx.lineTo(c[0], c[1])
  ctx.lineTo(d[0], d[1])
  ctx.closePath()
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
}

interface GlState {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | WebGL2RenderingContext
  isWebGl2: boolean
  program: WebGLProgram
  buffer: WebGLBuffer
  texture: WebGLTexture
  aPosLoc: number
  aUvLoc: number
  maxAniso: number
  anisoExt: EXT_texture_filter_anisotropic | null
}

function initGlState(): GlState | null {
  try {
    const canvas = document.createElement('canvas')
    const attrs: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    }
    const gl2 = canvas.getContext('webgl2', attrs)
    const gl = gl2 ?? canvas.getContext('webgl', attrs)
    if (!gl) return null

    const vsSrc = `
      attribute vec4 a_pos;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      void main() {
        gl_Position = a_pos;
        v_uv = a_uv;
      }
    `
    const fsSrc = `
      precision highp float;
      uniform sampler2D u_tex;
      varying vec2 v_uv;
      void main() {
        gl_FragColor = texture2D(u_tex, v_uv);
      }
    `
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }
    const vs = compile(gl.VERTEX_SHADER, vsSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null

    const buffer = gl.createBuffer()
    const texture = gl.createTexture()
    if (!buffer || !texture) return null

    const aPosLoc = gl.getAttribLocation(program, 'a_pos')
    const aUvLoc = gl.getAttribLocation(program, 'a_uv')
    const anisoExt =
      gl.getExtension('EXT_texture_filter_anisotropic') ??
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
    const maxAniso = anisoExt
      ? Math.min(4, Number(gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1))
      : 1

    gl.useProgram(program)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)

    return {
      canvas,
      gl,
      isWebGl2: Boolean(gl2),
      program,
      buffer,
      texture,
      aPosLoc,
      aUvLoc,
      maxAniso,
      anisoExt,
    }
  } catch {
    return null
  }
}

export function createQuadProjector(): QuadProjector {
  let state: GlState | null = initGlState()
  const verts = new Float32Array(6 * 6)

  const projectWithGl = (
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    corners: QuadPoint[],
    g: number,
    h: number,
  ): boolean => {
    if (!state || state.gl.isContextLost()) return false
    const wA = 1
    const wB = 1 + g
    const wC = 1 + g + h
    const wD = 1 + h
    if (wB <= 0.05 || wC <= 0.05 || wD <= 0.05) return false

    const [a, b, c, d] = corners
    const minX = Math.floor(Math.min(a[0], b[0], c[0], d[0])) - 1
    const minY = Math.floor(Math.min(a[1], b[1], c[1], d[1])) - 1
    const maxX = Math.ceil(Math.max(a[0], b[0], c[0], d[0])) + 1
    const maxY = Math.ceil(Math.max(a[1], b[1], c[1], d[1])) + 1
    const boxW = Math.max(1, maxX - minX)
    const boxH = Math.max(1, maxY - minY)

    const tm = ctx.getTransform()
    const pxScale = Math.max(0.25, Math.min(3, Math.hypot(tm.a, tm.b)))
    const pixelW = Math.max(2, Math.round(boxW * pxScale))
    const pixelH = Math.max(2, Math.round(boxH * pxScale))

    const { canvas, gl, program, buffer, texture, aPosLoc, aUvLoc, isWebGl2, anisoExt, maxAniso } = state
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW
      canvas.height = pixelH
    }

    const ndcX = (x: number) => ((x - minX) / boxW) * 2 - 1
    const ndcY = (y: number) => 1 - ((y - minY) / boxH) * 2
    const writeVertex = (idx: number, pt: QuadPoint, w: number, u: number, v: number) => {
      const o = idx * 6
      verts[o] = ndcX(pt[0]) * w
      verts[o + 1] = ndcY(pt[1]) * w
      verts[o + 2] = 0
      verts[o + 3] = w
      verts[o + 4] = u
      verts[o + 5] = v
    }

    writeVertex(0, a, wA, 0, 0)
    writeVertex(1, b, wB, 1, 0)
    writeVertex(2, c, wC, 1, 1)
    writeVertex(3, a, wA, 0, 0)
    writeVertex(4, c, wC, 1, 1)
    writeVertex(5, d, wD, 0, 1)

    gl.viewport(0, 0, pixelW, pixelH)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    if (isWebGl2) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.generateMipmap(gl.TEXTURE_2D)
      if (anisoExt && maxAniso > 1) {
        gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso)
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW)
    gl.enableVertexAttribArray(aPosLoc)
    gl.vertexAttribPointer(aPosLoc, 4, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(aUvLoc)
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 24, 16)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    ctx.drawImage(canvas, minX, minY, boxW, boxH)
    return true
  }

  return {
    project(ctx, source, corners, columns = 10, rows = 8) {
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

      if (projectWithGl(ctx, source, corners, g, h)) return
      project2dSeamFree(ctx, source, corners, columns, rows, g, h)
    },
    dispose() {
      if (!state) return
      state.gl.getExtension('WEBGL_lose_context')?.loseContext()
      state = null
    },
  }
}
