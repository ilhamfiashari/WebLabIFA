export interface ParsedStudentImportRow {
  email: string
  name: string
  nim: string
  class_id: string
  role: 'mahasiswa' | 'dosen'
}

export interface ParsedSpreadsheetResult {
  rows: ParsedStudentImportRow[]
  warnings: string[]
  fileName: string
  format: 'xlsx' | 'csv'
}

const HEADER_ALIASES: Record<string, keyof ParsedStudentImportRow> = {
  email: 'email',
  'e-mail': 'email',
  'alamat email': 'email',
  'email mahasiswa': 'email',
  'email itera': 'email',
  'google email': 'email',
  gmail: 'email',
  nama: 'name',
  name: 'name',
  'full name': 'name',
  full_name: 'name',
  'nama lengkap': 'name',
  'nama mahasiswa': 'name',
  mahasiswa: 'name',
  nim: 'nim',
  npm: 'nim',
  'id mahasiswa': 'nim',
  student_id: 'nim',
  'student id': 'nim',
  kelas: 'class_id',
  class: 'class_id',
  class_id: 'class_id',
  'kode kelas': 'class_id',
  role: 'role',
  peran: 'role',
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function looksLikeEmail(value: string): boolean {
  const v = value.trim()
  const at = v.indexOf('@')
  return at > 0 && v.indexOf('.', at + 1) > at + 1 && !/\s/.test(v)
}

function mapMatrixToStudents(
  matrix: string[][],
  fileName: string,
  format: 'xlsx' | 'csv',
): ParsedSpreadsheetResult {
  const nonEmpty = matrix.filter((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmpty.length === 0) {
    return { rows: [], warnings: ['File kosong atau tidak memiliki baris data.'], fileName, format }
  }

  const firstRow = nonEmpty[0]
  const columnMap = new Map<number, keyof ParsedStudentImportRow>()
  firstRow.forEach((cell, idx) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)]
    if (key && !Array.from(columnMap.values()).includes(key)) {
      columnMap.set(idx, key)
    }
  })

  const hasHeader = columnMap.has(0) || Array.from(columnMap.values()).includes('email')
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty
  const warnings: string[] = []
  const rows: ParsedStudentImportRow[] = []
  const seenEmails = new Set<string>()

  dataRows.forEach((cols, i) => {
    const rowNum = hasHeader ? i + 2 : i + 1
    let email = ''
    let name = ''
    let nim = ''
    let class_id = ''
    let roleRaw = ''

    if (hasHeader) {
      columnMap.forEach((field, idx) => {
        const val = (cols[idx] ?? '').trim()
        if (field === 'email') email = val
        else if (field === 'name') name = val
        else if (field === 'nim') nim = val
        else if (field === 'class_id') class_id = val
        else if (field === 'role') roleRaw = val
      })
    } else {
      // Headerless fallback: detect email column automatically, treat remaining columns as name/nim/class
      const emailIdx = cols.findIndex((c) => looksLikeEmail(c))
      if (emailIdx >= 0) {
        email = cols[emailIdx].trim()
        const others = cols.filter((_, idx) => idx !== emailIdx).map((c) => c.trim())
        name = others[0] ?? ''
        nim = others[1] ?? ''
        class_id = others[2] ?? ''
      }
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!looksLikeEmail(cleanEmail)) {
      if (warnings.length < 15) {
        warnings.push(`Baris ${rowNum}: kolom email tidak valid atau kosong.`)
      }
      return
    }
    if (seenEmails.has(cleanEmail)) {
      if (warnings.length < 15) {
        warnings.push(`Baris ${rowNum}: email duplikat (${cleanEmail}) dilewati.`)
      }
      return
    }
    seenEmails.add(cleanEmail)
    const normalizedRole = roleRaw.trim().toLowerCase() === 'dosen' ? 'dosen' : 'mahasiswa'
    rows.push({
      email: cleanEmail,
      name: name.trim(),
      nim: nim.trim(),
      class_id: class_id.trim().toUpperCase(),
      role: normalizedRole,
    })
  })

  return { rows, warnings, fileName, format }
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/, 5).join('\n')
  const commas = (sample.match(/,/g) ?? []).length
  const semis = (sample.match(/;/g) ?? []).length
  const tabs = (sample.match(/\t/g) ?? []).length
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseDelimitedText(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser tidak mendukung DecompressionStream untuk membaca .xlsx. Gunakan file .csv.')
  }
  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  const copy = new Uint8Array(compressed.byteLength)
  copy.set(compressed)
  void writer.write(copy)
  void writer.close()
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
    if (total > 8 * 1024 * 1024) {
      throw new Error('Ukuran konten XML Excel melebihi batas aman 8MB.')
    }
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

async function extractZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1
  const minOffset = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) {
    throw new Error('File .xlsx tidak valid (signature ZIP tidak ditemukan).')
  }

  const entryCount = view.getUint16(eocdOffset + 10, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)
  const entries = new Map<string, Uint8Array>()
  const decoder = new TextDecoder('utf-8')

  let pos = cdOffset
  for (let i = 0; i < Math.min(entryCount, 200); i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) break
    const method = view.getUint16(pos + 10, true)
    const compressedSize = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localHeaderOffset = view.getUint32(pos + 42, true)
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen))
    pos += 46 + nameLen + extraLen + commentLen

    if (
      name === 'xl/sharedStrings.xml' ||
      (name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml'))
    ) {
      if (localHeaderOffset + 30 > bytes.length) continue
      const lhNameLen = view.getUint16(localHeaderOffset + 26, true)
      const lhExtraLen = view.getUint16(localHeaderOffset + 28, true)
      const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen
      const slice = bytes.subarray(dataStart, dataStart + compressedSize)
      if (method === 0) {
        entries.set(name, slice)
      } else if (method === 8) {
        entries.set(name, await inflateRaw(slice))
      }
    }
  }
  return entries
}

function colRefToIndex(ref: string): number {
  const letters = ref.replace(/[0-9]+$/g, '').toUpperCase()
  let idx = 0
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64)
  }
  return Math.max(0, idx - 1)
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const entries = await extractZipEntries(buffer)
  const decoder = new TextDecoder('utf-8')
  const parser = new DOMParser()

  const sharedStrings: string[] = []
  const ssBytes = entries.get('xl/sharedStrings.xml')
  if (ssBytes) {
    const ssDoc = parser.parseFromString(decoder.decode(ssBytes), 'application/xml')
    const siNodes = Array.from(ssDoc.getElementsByTagName('si'))
    for (const si of siNodes) {
      const textParts = Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '')
      sharedStrings.push(textParts.join(''))
    }
  }

  const sheetKey =
    entries.has('xl/worksheets/sheet1.xml')
      ? 'xl/worksheets/sheet1.xml'
      : Array.from(entries.keys())
          .filter((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'))
          .sort()[0]

  if (!sheetKey) {
    throw new Error('Worksheet Excel (sheet1.xml) tidak ditemukan pada file .xlsx.')
  }

  const sheetDoc = parser.parseFromString(decoder.decode(entries.get(sheetKey)!), 'application/xml')
  const rowNodes = Array.from(sheetDoc.getElementsByTagName('row'))
  const matrix: string[][] = []

  for (const rNode of rowNodes) {
    const cells = Array.from(rNode.getElementsByTagName('c'))
    const rowValues: string[] = []
    for (const cNode of cells) {
      const ref = cNode.getAttribute('r') ?? ''
      const colIdx = ref ? colRefToIndex(ref) : rowValues.length
      while (rowValues.length < colIdx) rowValues.push('')
      const cellType = cNode.getAttribute('t') ?? ''
      let val = ''
      if (cellType === 's') {
        const vNode = cNode.getElementsByTagName('v')[0]
        const ssIdx = Number.parseInt(vNode?.textContent ?? '', 10)
        val = Number.isFinite(ssIdx) ? (sharedStrings[ssIdx] ?? '') : ''
      } else if (cellType === 'inlineStr') {
        const tNodes = Array.from(cNode.getElementsByTagName('t'))
        val = tNodes.map((t) => t.textContent ?? '').join('')
      } else {
        const vNode = cNode.getElementsByTagName('v')[0]
        val = vNode?.textContent ?? ''
      }
      rowValues[colIdx] = val
    }
    matrix.push(rowValues)
  }
  return matrix
}

export async function parseStudentSpreadsheetFile(file: File): Promise<ParsedSpreadsheetResult> {
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 4MB.')
  }
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx')) {
    const matrix = await parseXlsxBuffer(await file.arrayBuffer())
    return mapMatrixToStudents(matrix, file.name, 'xlsx')
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = await file.text()
    const matrix = parseDelimitedText(text)
    return mapMatrixToStudents(matrix, file.name, 'csv')
  }
  throw new Error('Format file harus Excel (.xlsx) atau CSV (.csv).')
}

export function downloadStudentImportTemplate(defaultClassId = '') {
  const sampleClass = defaultClassId || 'IF-3A'
  const csv = [
    'email,nama,nim,kelas',
    `123140001@student.itera.ac.id,Ayu Pratama,123140001,${sampleClass}`,
    `123140002@student.itera.ac.id,Budi Santoso,123140002,${sampleClass}`,
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'template-import-mahasiswa.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
