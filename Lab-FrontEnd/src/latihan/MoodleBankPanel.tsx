import { useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Eye, FileUp, Lock, ShieldAlert, Upload } from 'lucide-react'
import {
  errorText,
  exportQuestionsUrl,
  importQuestions,
  type Catalog,
  type ImportFormat,
  type ImportQuestionsResult,
} from './api'

const SAMPLE_MOODLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/top/Cyber Security/Level 2</text></category>
  </question>
  <question type="multichoice">
    <name><text>Validasi Parameter Redirect</text></name>
    <questiontext format="html"><text><![CDATA[<p>Mengapa URL parameter <code>?next=</code> perlu divalidasi memakai allowlist domain internal?</p>]]></text></questiontext>
    <generalfeedback format="html"><text><![CDATA[<p>Mencegah Open Redirect (OWASP A01) menuju situs phishing eksternal.</p>]]></text></generalfeedback>
    <defaultgrade>20</defaultgrade>
    <single>true</single>
    <answer fraction="100"><text>Mencegah penyerang mengarahkan korban ke domain eksternal berbahaya (Open Redirect)</text></answer>
    <answer fraction="0"><text>Mempercepat kompresi aset CSS statis</text></answer>
    <answer fraction="0"><text>Menggantikan kebutuhan sesi HttpOnly</text></answer>
    <tags><tag><text>OWASP-A01</text></tag><tag><text>Redirect</text></tag></tags>
  </question>
</quiz>`

const SAMPLE_MOODLE_GIFT = `// Bank Soal IoT - Protokol Aman
::Proteksi Broker MQTT:: [html]Apa tujuan autentikasi mTLS pada perangkat sensor IoT sebelum terhubung ke broker MQTT? {
  =Memastikan perangkat dan broker saling memverifikasi sertifikat identitas
  ~Menghapus kebutuhan enkripsi payload
  ~Menurunkan konsumsi RAM mikrokontroler tanpa TLS
  ####mTLS mewajibkan sertifikat klien dan server tervalidasi sebelum publikasi telemetri.
}`

const SAMPLE_AIKEN = `Protokol komunikasi terenkripsi mana yang dianjurkan untuk menggantikan HTTP polos pada ESP32?
A. Telnet tanpa autentikasi
B. HTTPS/TLS dengan verifikasi sertifikat CA
C. UDP broadcast polos
D. FTP anonymous
ANSWER: B`

const MAX_FILE_BYTES = 950_000

export function MoodleBankPanel({
  catalog,
  csrf,
  defaultTrack,
}: {
  catalog: Catalog
  csrf: string
  defaultTrack: 'web' | 'iot'
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ImportFormat>('auto')
  const [track, setTrack] = useState<'web' | 'iot'>(defaultTrack)
  const [level, setLevel] = useState<number>(1)
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<ImportQuestionsResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [exportTrack, setExportTrack] = useState<'all' | 'web' | 'iot'>('all')

  const importDisabled = catalog.policy?.allow_dosen_question_import === false
  const maxImport = catalog.policy?.max_import_questions ?? 100

  const importM = useMutation({
    mutationFn: (dryRun: boolean) =>
      importQuestions(csrf, {
        format,
        track,
        default_level: level,
        content,
        dry_run: dryRun,
      }),
    onSuccess: (res, dryRun) => {
      setErrMsg(null)
      setPreview(res)
      if (!dryRun) {
        setNotice(`Berhasil mengimpor ${res.imported ?? res.previews.length} soal (${res.format}) ke Bank Latihan.`)
        void queryClient.invalidateQueries({ queryKey: ['latihan'] })
      } else {
        setNotice(`Pratinjau siap: ${res.count ?? res.previews.length} soal terdeteksi (format: ${res.format}).`)
      }
    },
    onError: (err) => {
      setNotice(null)
      setErrMsg(errorText(err))
    },
  })

  const onFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setErrMsg('Ukuran berkas melebihi batas aman 950 KB.')
      return
    }
    const text = await file.text()
    setContent(text)
    setPreview(null)
    setErrMsg(null)
    setNotice(`Berkas "${file.name}" dimuat. Klik Pratinjau Soal atau Impor ke Bank Soal.`)
  }

  return (
    <section className="card" aria-labelledby="moodle-bank-title" style={{ display: 'grid', gap: 14 }}>
      <header className="card-head" style={{ alignItems: 'center' }}>
        <div>
          <h2 id="moodle-bank-title">Impor &amp; Ekspor Bank Soal (Kompatibel Moodle LMS)</h2>
          <p>
            Mendukung Moodle XML, GIFT, Aiken, dan JSON dengan sanitasi XSS/XXE untuk jalur{' '}
            <strong>Cyber Security</strong> dan <strong>IoT</strong> (batas {maxImport} soal per impor).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <Upload size={15} aria-hidden="true" />
            {open ? 'Tutup Panel Impor Moodle' : 'Impor Soal Moodle LMS'}
          </button>
          <select
            aria-label="Filter jalur ekspor"
            value={exportTrack}
            onChange={(e) => setExportTrack(e.target.value as 'all' | 'web' | 'iot')}
            style={{
              minHeight: 36,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              padding: '0 10px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <option value="all">Semua Jalur (Cyber Security &amp; IoT)</option>
            <option value="web">Hanya Cyber Security</option>
            <option value="iot">Hanya IoT</option>
          </select>
          <a
            href={exportQuestionsUrl('moodle_xml', exportTrack)}
            download={`bank-soal-${exportTrack}.xml`}
            className="btn-outline"
          >
            <Download size={15} aria-hidden="true" />
            Moodle XML
          </a>
          <a
            href={exportQuestionsUrl('gift', exportTrack)}
            download={`bank-soal-${exportTrack}.gift.txt`}
            className="btn-outline"
          >
            <Download size={15} aria-hidden="true" />
            GIFT
          </a>
        </div>
      </header>

      {open && (
        <div style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {importDisabled && (
            <div className="feedback wrong" role="alert">
              <Lock size={16} aria-hidden="true" />
              Impor Bank Soal sementara dinonaktifkan oleh kebijakan Admin.
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 10,
            }}
          >
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Format Berkas Moodle</span>
              <select
                aria-label="Format berkas Moodle"
                value={format}
                onChange={(e) => setFormat(e.target.value as ImportFormat)}
                style={{ minHeight: 38, borderRadius: 8, border: '1px solid var(--line-strong)', padding: '0 10px' }}
              >
                <option value="auto">Deteksi Otomatis (XML / GIFT / Aiken / JSON)</option>
                <option value="moodle_xml">Moodle XML (&lt;quiz&gt;)</option>
                <option value="moodle_gift">Moodle GIFT (::judul:: ... &#123;=...&#125;)</option>
                <option value="aiken">Aiken Format (A./B./ANSWER:)</option>
                <option value="json">JSON Bank Soal</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Jalur Target</span>
              <select
                aria-label="Jalur target soal"
                value={track}
                onChange={(e) => setTrack(e.target.value as 'web' | 'iot')}
                style={{ minHeight: 38, borderRadius: 8, border: '1px solid var(--line-strong)', padding: '0 10px' }}
              >
                <option value="web">Cyber Security</option>
                <option value="iot">IoT</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Level Bawaan</span>
              <select
                aria-label="Level bawaan soal"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                style={{ minHeight: 38, borderRadius: 8, border: '1px solid var(--line-strong)', padding: '0 10px' }}
              >
                <option value={1}>Level 1 · Mudah (10 XP)</option>
                <option value={2}>Level 2 · Menengah (20 XP)</option>
                <option value={3}>Level 3 · Sulit (35 XP)</option>
                <option value={4}>Level 4 · Ahli (50 XP)</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Unggah File (.xml / .gift / .txt / .json)</span>
              <input
                type="file"
                accept=".xml,.gift,.txt,.json,text/xml,application/xml,text/plain,application/json"
                onChange={onFilePick}
                disabled={importDisabled}
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className="subtle-note" style={{ fontSize: 12 }}>
              Muat contoh cepat:
            </span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setFormat('moodle_xml')
                setTrack('web')
                setContent(SAMPLE_MOODLE_XML)
                setPreview(null)
                setNotice('Templat Moodle XML dimuat (Cyber Security).')
                setErrMsg(null)
              }}
            >
              <FileUp size={14} aria-hidden="true" /> Contoh Moodle XML
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setFormat('moodle_gift')
                setTrack('iot')
                setContent(SAMPLE_MOODLE_GIFT)
                setPreview(null)
                setNotice('Templat Moodle GIFT dimuat (IoT).')
                setErrMsg(null)
              }}
            >
              <FileUp size={14} aria-hidden="true" /> Contoh GIFT (IoT)
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setFormat('aiken')
                setTrack('iot')
                setContent(SAMPLE_AIKEN)
                setPreview(null)
                setNotice('Templat Aiken dimuat (IoT).')
                setErrMsg(null)
              }}
            >
              <FileUp size={14} aria-hidden="true" /> Contoh Aiken
            </button>
          </div>

          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Konten Soal Moodle XML / GIFT / Aiken / JSON</span>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tempel isi Moodle XML, GIFT, Aiken, atau JSON di sini..."
              disabled={importDisabled}
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid var(--line-strong)',
                padding: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                background: 'var(--surface)',
                color: 'var(--ink)',
              }}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn-outline"
              disabled={importDisabled || !content.trim() || importM.isPending}
              onClick={() => importM.mutate(true)}
            >
              <Eye size={15} aria-hidden="true" />
              {importM.isPending ? 'Memeriksa...' : 'Pratinjau Soal'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={importDisabled || !content.trim() || importM.isPending}
              onClick={() => importM.mutate(false)}
            >
              <Check size={15} aria-hidden="true" />
              {importM.isPending ? 'Mengimpor...' : 'Simpan ke Bank Soal'}
            </button>
            <span className="subtle-note" style={{ fontSize: 12 }}>
              <ShieldAlert size={13} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
              DOCTYPE / ENTITY XML &amp; tag HTML berbahaya otomatis ditolak server.
            </span>
          </div>

          {notice && (
            <p className="status-ok" role="status" style={{ margin: 0 }}>
              {notice}
            </p>
          )}
          {errMsg && (
            <p className="feedback wrong" role="alert" style={{ margin: 0 }}>
              {errMsg}
            </p>
          )}

          {preview && preview.previews.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Judul Soal</th>
                    <th scope="col">Jalur</th>
                    <th scope="col">Level</th>
                    <th scope="col">Format</th>
                    <th scope="col">Jenis</th>
                    <th scope="col">Kunci Jawaban</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.previews.map((item, idx) => (
                    <tr key={`${item.title}-${idx}`}>
                      <td className="strong">
                        {item.title}
                        <div className="subtle-note" style={{ fontWeight: 400, fontSize: 12 }}>
                          {item.question.slice(0, 96)}
                          {item.question.length > 96 ? '…' : ''}
                        </div>
                      </td>
                      <td>{item.track === 'iot' ? 'IoT' : 'Cyber Security'}</td>
                      <td>Level {item.level}</td>
                      <td>
                        <code>{item.source_format}</code>
                      </td>
                      <td>
                        {item.kind === 'isian'
                          ? 'Isian singkat'
                          : `Pilihan ganda (${item.options_count} opsi)`}
                      </td>
                      <td>
                        <code>{item.answer_preview.join(', ')}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
