import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Badge } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import { simApi, type PlatformSettings } from '../simulator/api'

const DEFAULT_SETTINGS: PlatformSettings = {
  active_tracks: ['web', 'iot'],
  enforce_sequential_unlock: true,
  strict_deadline_lock: true,
  block_concurrent_attempts: true,
  max_import_questions: 100,
  allow_dosen_question_import: true,
  allow_student_hints: true,
  hide_answer_explanations_until_due: true,
}

export function PlatformPolicySettings({
  csrf,
  initialSettings,
}: {
  csrf: string
  initialSettings?: PlatformSettings
}) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const queryClient = useQueryClient()

  const settingsQ = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => simApi.getAdminSettings(),
    retry: false,
  })

  const serverSettings = settingsQ.data?.settings ?? initialSettings ?? DEFAULT_SETTINGS
  const [draftOverride, setDraftOverride] = useState<PlatformSettings | null>(null)
  const draft = draftOverride ?? serverSettings
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const saveM = useMutation({
    mutationFn: (next: PlatformSettings) => simApi.updateAdminSettings(csrf, next),
    onSuccess: (res) => {
      setDraftOverride(res.settings)
      setErrorMsg(null)
      setNotice(
        en
          ? 'Platform security & learning policies saved.'
          : 'Kebijakan keamanan, jalur, dan anti-kecurangan berhasil disimpan.',
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['latihan'] })
    },
    onError: (err) => {
      setNotice(null)
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : en
            ? 'Failed to update platform settings.'
            : 'Gagal menyimpan kebijakan platform.',
      )
    },
  })

  const toggleTrack = (track: 'web' | 'iot') => {
    setNotice(null)
    setDraftOverride((prev) => {
      const base = prev ?? serverSettings
      const exists = base.active_tracks.includes(track)
      if (exists && base.active_tracks.length <= 1) {
        setErrorMsg(en ? 'At least 1 track must remain active.' : 'Minimal 1 jalur (Cyber Security atau IoT) harus aktif.')
        return base
      }
      setErrorMsg(null)
      const nextTracks = exists
        ? base.active_tracks.filter((t) => t !== track)
        : (['web', 'iot'] as Array<'web' | 'iot'>).filter(
            (t) => t === track || base.active_tracks.includes(t),
          )
      return { ...base, active_tracks: nextTracks }
    })
  }

  const toggleFlag = (
    key: Exclude<keyof PlatformSettings, 'active_tracks' | 'max_import_questions'>,
  ) => {
    setNotice(null)
    setErrorMsg(null)
    setDraftOverride((prev) => {
      const base = prev ?? serverSettings
      return { ...base, [key]: !base[key] }
    })
  }

  return (
    <section
      className="card"
      aria-labelledby="platform-policy-heading"
      style={{ marginTop: 18, display: 'grid', gap: 16 }}
    >
      <header className="card-head">
        <div>
          <h2 id="platform-policy-heading">
            <SlidersHorizontal size={17} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            {en
              ? 'Platform Policy, Active Tracks & Anti-Cheat Control'
              : 'Kebijakan Platform, Jalur Aktif & Anti-Kecurangan'}
          </h2>
          <p>
            {en
              ? 'Enforced server-side across Student & Lecturer endpoints; mahasiswa cannot bypass.'
              : 'Diterapkan di server untuk seluruh endpoint Mahasiswa & Dosen sehingga tidak dapat diakali lewat peramban.'}
          </p>
        </div>
        <Badge tone="good">{en ? 'Server-enforced' : 'Proteksi Server'}</Badge>
      </header>

      <div className="grid-2" style={{ gap: 14 }}>
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            background: 'var(--surface-2)',
            display: 'grid',
            gap: 10,
            alignContent: 'start',
          }}
        >
          <div>
            <strong style={{ fontSize: 14 }}>
              {en ? 'Active Learning Tracks (2 Core Tracks)' : 'Jalur Pembelajaran Aktif (Maksimal 2 Jalur)'}
            </strong>
            <p className="subtle-note" style={{ marginTop: 2 }}>
              {en
                ? 'Strictly Cyber Security and IoT.'
                : 'Ditetapkan hanya 2 jalur resmi: Cyber Security dan IoT.'}
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.active_tracks.includes('web')}
              onChange={() => toggleTrack('web')}
            />
            <span>
              <strong>Cyber Security</strong>{' '}
              <span className="subtle-note">(OWASP Top 10 &amp; AppSec)</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.active_tracks.includes('iot')}
              onChange={() => toggleTrack('iot')}
            />
            <span>
              <strong>IoT</strong>{' '}
              <span className="subtle-note">(Embedded Firmware, Sensor &amp; Aktuator)</span>
            </span>
          </label>

          <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'grid', gap: 6 }}>
            <label htmlFor="admin-max-import" style={{ fontSize: 13, fontWeight: 600 }}>
              {en ? 'Max Moodle questions per import batch (10–500)' : 'Batas soal Moodle LMS per impor (10–500)'}
            </label>
            <input
              id="admin-max-import"
              type="number"
              min={10}
              max={500}
              value={draft.max_import_questions}
              onChange={(e) => {
                const n = Number(e.target.value)
                setNotice(null)
                setDraftOverride((prev) => ({
                  ...(prev ?? serverSettings),
                  max_import_questions: Number.isFinite(n) ? Math.min(500, Math.max(10, Math.trunc(n))) : 100,
                }))
              }}
              style={{
                maxWidth: 160,
                minHeight: 38,
                borderRadius: 8,
                border: '1px solid var(--line-strong)',
                padding: '0 10px',
                background: 'var(--surface)',
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            background: 'var(--surface-2)',
            display: 'grid',
            gap: 10,
            alignContent: 'start',
          }}
        >
          <strong style={{ fontSize: 14 }}>
            <ShieldCheck size={15} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            {en ? 'Exam Integrity & Anti-Bypass Controls' : 'Integritas Ujian & Kontrol Anti-Bypass'}
          </strong>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.enforce_sequential_unlock}
              onChange={() => toggleFlag('enforce_sequential_unlock')}
            />
            <span>
              <strong>{en ? 'Sequential Level Lock' : 'Kunci progres berurutan level demi level'}</strong>
              <br />
              <small className="subtle-note">
                {en
                  ? 'Students must complete previous levels before locked items open on server.'
                  : 'Mahasiswa wajib menyelesaikan soal sebelumnya; API menolak loncat level (HTTP 409).'}
              </small>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.strict_deadline_lock}
              onChange={() => toggleFlag('strict_deadline_lock')}
            />
            <span>
              <strong>{en ? 'Strict Deadline Assignment Lock' : 'Kunci otomatis penugasan lewat tenggat'}</strong>
              <br />
              <small className="subtle-note">
                {en
                  ? 'Blocks starting or resuming overdue practicum sessions unless late submission is enabled.'
                  : 'Menolak mulai/lanjut sesi praktikum saat melewati tenggat bila izin terlambat mati.'}
              </small>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.block_concurrent_attempts}
              onChange={() => toggleFlag('block_concurrent_attempts')}
            />
            <span>
              <strong>{en ? 'Guard Concurrent Session Abuse' : 'Blokir lonjakan percobaan & sesi paralel'}</strong>
              <br />
              <small className="subtle-note">
                {en
                  ? 'Enforces attempt caps and logs anomalous bursts.'
                  : 'Menegakkan batas maksimal percobaan dan mencatat anomali keamanan.'}
              </small>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.allow_student_hints}
              onChange={() => toggleFlag('allow_student_hints')}
            />
            <span>
              <strong>{en ? 'Allow Student Hints (50% XP Penalty)' : 'Izinkan Petunjuk (Hint) Mahasiswa'}</strong>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.hide_answer_explanations_until_due}
              onChange={() => toggleFlag('hide_answer_explanations_until_due')}
            />
            <span>
              <strong>
                {en
                  ? 'Withhold Explanations Until Solved'
                  : 'Sembunyikan pembahasan sampai latihan terjawab benar'}
              </strong>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.allow_dosen_question_import}
              onChange={() => toggleFlag('allow_dosen_question_import')}
            />
            <span>
              <strong>
                {en ? 'Allow Moodle LMS Import by Lecturers' : 'Izinkan Dosen Impor Bank Soal Moodle LMS'}
              </strong>
            </span>
          </label>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          paddingTop: 6,
          borderTop: '1px solid var(--line)',
        }}
      >
        <p className="subtle-note" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Lock size={14} aria-hidden="true" />
          {en
            ? 'Student access to Admin/Dosen APIs or XXE XML payloads is blocked & logged.'
            : 'Akses Mahasiswa ke endpoint Admin/Dosen serta XML berbahaya (XXE/script) diblokir dan dicatat ke audit anomali.'}
        </p>

        <button
          type="button"
          className="btn-primary"
          disabled={saveM.isPending}
          onClick={() => saveM.mutate(draft)}
        >
          <Check size={15} aria-hidden="true" />
          {saveM.isPending
            ? en
              ? 'Saving...'
              : 'Menyimpan...'
            : en
              ? 'Save Platform Policies'
              : 'Simpan Kebijakan Platform'}
        </button>
      </div>

      {notice && (
        <p className="status-ok" role="status" style={{ margin: 0 }}>
          {notice}
        </p>
      )}
      {errorMsg && (
        <p className="feedback wrong" role="alert" style={{ margin: 0 }}>
          {errorMsg}
        </p>
      )}
    </section>
  )
}
