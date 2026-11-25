import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { Badge } from '../portal/ui'
import { Pagination } from '../portal/Pagination'
import { simApi, type AccessApprovalsResponse } from '../simulator/api'
import { useI18n } from './i18n'
import {
  downloadStudentImportTemplate,
  parseStudentSpreadsheetFile,
  type ParsedSpreadsheetResult,
} from './spreadsheetImport'

interface Props {
  csrf: string
  defaultClassId?: string
}

type TabKey = 'requests' | 'import' | 'approved'

export function StudentAccessApprovalPanel({ csrf, defaultClassId = '' }: Props) {
  const { lang } = useI18n()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [tab, setTab] = useState<TabKey>('requests')
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [selectedClass, setSelectedClass] = useState(defaultClassId)
  const [decisionRole, setDecisionRole] = useState<Record<string, 'mahasiswa' | 'dosen'>>({})
  const [decisionClass, setDecisionClass] = useState<Record<string, string>>({})

  // Spreadsheet import state
  const [parsed, setParsed] = useState<ParsedSpreadsheetResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Manual quick-approve state
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualRole, setManualRole] = useState<'mahasiswa' | 'dosen'>('mahasiswa')

  // Approved table filter/pagination
  const [approvedSearch, setApprovedSearch] = useState('')
  const [approvedPage, setApprovedPage] = useState(1)
  const [requestPage, setRequestPage] = useState(1)

  const query = useQuery<AccessApprovalsResponse>({
    queryKey: ['portal-access-approvals'],
    queryFn: () => simApi.getAccessApprovals(),
  })

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['portal-access-approvals'] }),
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      qc.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
    ])
  }

  const decideMut = useMutation({
    mutationFn: (vars: {
      requestId: string
      action: 'approve' | 'reject'
      role?: 'mahasiswa' | 'dosen'
      class_id?: string
    }) =>
      simApi.decideAccessRequest(csrf, vars.requestId, {
        action: vars.action,
        role: vars.role,
        class_id: vars.class_id || undefined,
      }),
    onSuccess: async (res) => {
      setNotice({
        tone: 'good',
        text:
          res.status === 'approved'
            ? lang === 'en'
              ? `Approved ${res.email} (${res.role ?? 'mahasiswa'}). They can now sign in.`
              : `Akses ${res.email} (${res.role ?? 'mahasiswa'}) disetujui. Akun kini dapat login.`
            : lang === 'en'
              ? `Rejected access request for ${res.email}.`
              : `Permintaan akses ${res.email} ditolak.`,
      })
      await refreshAll()
    },
    onError: (err: Error) => {
      setNotice({ tone: 'bad', text: err.message || 'Gagal memproses persetujuan.' })
    },
  })

  const importMut = useMutation({
    mutationFn: (payload: {
      default_class_id?: string
      source?: 'excel_import' | 'manual'
      rows: Array<{ email: string; name?: string; nim?: string; class_id?: string; role?: 'mahasiswa' | 'dosen' }>
    }) => simApi.importApprovedStudents(csrf, payload),
    onSuccess: async (res, vars) => {
      const summary =
        lang === 'en'
          ? `Saved: ${res.imported} new, ${res.updated} updated, ${res.skipped} skipped.`
          : `Berhasil disimpan: ${res.imported} baru, ${res.updated} diperbarui, ${res.skipped} dilewati.`
      setNotice({
        tone: res.errors.length > 0 && res.imported + res.updated === 0 ? 'bad' : 'good',
        text: res.errors.length > 0 ? `${summary} (${res.errors[0]})` : summary,
      })
      if (vars.source === 'manual') {
        setManualEmail('')
        setManualName('')
      } else {
        setParsed(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      await refreshAll()
    },
    onError: (err: Error) => {
      setNotice({ tone: 'bad', text: err.message || 'Gagal mengimpor daftar mahasiswa.' })
    },
  })

  const revokeMut = useMutation({
    mutationFn: (email: string) => simApi.revokeApprovedAccount(csrf, email),
    onSuccess: async (res) => {
      setNotice({
        tone: 'good',
        text:
          lang === 'en'
            ? `Revoked login approval for ${res.email} and ended active sessions.`
            : `Persetujuan login untuk ${res.email} dicabut dan sesi aktif dihentikan.`,
      })
      await refreshAll()
    },
    onError: (err: Error) => {
      setNotice({ tone: 'bad', text: err.message || 'Gagal mencabut persetujuan akun.' })
    },
  })

  const data = query.data
  const classes = data?.classes ?? []
  const canApproveDosen = data?.can_approve_dosen ?? false
  const effectiveClass = selectedClass || (defaultClassId && defaultClassId !== 'ALL' ? defaultClassId : '')

  const handleFileChange = async (file: File | null) => {
    setParseError(null)
    setNotice(null)
    if (!file) {
      setParsed(null)
      return
    }
    try {
      const result = await parseStudentSpreadsheetFile(file)
      if (result.rows.length === 0) {
        setParseError(result.warnings[0] ?? 'Tidak ditemukan baris email mahasiswa yang valid.')
        setParsed(null)
        return
      }
      setParsed(result)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Gagal membaca file spreadsheet.')
      setParsed(null)
    }
  }

  const requests = data?.requests ?? []
  const pagedRequests = requests.slice((requestPage - 1) * 10, requestPage * 10)

  const q = approvedSearch.trim().toLowerCase()
  const filteredApproved = (data?.approved_accounts ?? []).filter(
    (a) =>
      !q ||
      a.email.toLowerCase().includes(q) ||
      a.full_name.toLowerCase().includes(q) ||
      (a.nim ?? '').toLowerCase().includes(q) ||
      (a.class_id ?? '').toLowerCase().includes(q),
  )
  const pagedApproved = filteredApproved.slice((approvedPage - 1) * 10, approvedPage * 10)

  return (
    <section className="card" style={{ display: 'grid', gap: 14 }} aria-labelledby="access-approval-heading">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 id="access-approval-heading" style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} aria-hidden="true" />
            {lang === 'en' ? 'Login Approval & Excel Student Import' : 'Persetujuan Login & Impor Excel Mahasiswa'}
          </h2>
          <p className="subtle-note" style={{ margin: 0, fontSize: 13 }}>
            {lang === 'en'
              ? 'All external and institutional (@student.itera.ac.id / @if.itera.ac.id) accounts require approval or spreadsheet pre-registration before signing in.'
              : 'Seluruh akun baru—termasuk @student.itera.ac.id dan @if.itera.ac.id—wajib disetujui atau diimpor melalui Excel/CSV sebelum dapat masuk.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'requests'}
            className={tab === 'requests' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setTab('requests')}
          >
            <Clock size={14} aria-hidden="true" />
            {lang === 'en' ? 'Access Requests' : 'Permintaan Masuk'}
            {(data?.pending_count ?? 0) > 0 ? (
              <span
                style={{
                  marginLeft: 4,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: tab === 'requests' ? 'rgba(255,255,255,0.24)' : 'var(--warn-soft, #fef3c7)',
                  color: tab === 'requests' ? '#fff' : 'var(--warn, #b45309)',
                }}
              >
                {data?.pending_count}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'import'}
            className={tab === 'import' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setTab('import')}
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            {lang === 'en' ? 'Import Excel / CSV' : 'Impor Excel / CSV'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'approved'}
            className={tab === 'approved' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setTab('approved')}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            {lang === 'en' ? 'Approved Accounts' : 'Akun Disetujui'} ({data?.approved_accounts.length ?? 0})
          </button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            border: `1px solid ${notice.tone === 'good' ? 'var(--good)' : 'var(--bad)'}`,
            background: notice.tone === 'good' ? 'var(--good-soft)' : 'var(--bad-soft, #fef2f2)',
            color: notice.tone === 'good' ? 'var(--good)' : 'var(--bad)',
          }}
        >
          {notice.text}
        </div>
      ) : null}

      {query.isLoading ? (
        <p className="subtle-note" style={{ margin: 0 }}>
          {lang === 'en' ? 'Loading access requests...' : 'Memuat daftar persetujuan akses...'}
        </p>
      ) : query.isError ? (
        <p className="subtle-note" style={{ margin: 0, color: 'var(--bad)' }}>
          {lang === 'en' ? 'Unable to load access approvals.' : 'Gagal memuat data persetujuan akses.'}
        </p>
      ) : tab === 'requests' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {requests.length === 0 ? (
            <p className="subtle-note" style={{ margin: 0 }}>
              {lang === 'en'
                ? 'No pending login requests yet. Unapproved accounts that attempt Google Sign-In will appear here.'
                : 'Belum ada permintaan login. Akun belum disetujui yang mencoba masuk lewat Google akan tercatat di sini.'}
            </p>
          ) : (
            <>
              <div className="sim-table-wrap">
                <table className="sim-table">
                  <thead>
                    <tr>
                      <th scope="col">{lang === 'en' ? 'Account' : 'Akun'}</th>
                      <th scope="col">{lang === 'en' ? 'Role' : 'Peran'}</th>
                      <th scope="col">{lang === 'en' ? 'Class' : 'Kelas'}</th>
                      <th scope="col">Status</th>
                      <th scope="col">{lang === 'en' ? 'Actions' : 'Aksi'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRequests.map((req) => {
                      const chosenRole =
                        decisionRole[req.id] ??
                        (canApproveDosen && req.requested_role === 'dosen' ? 'dosen' : 'mahasiswa')
                      const chosenClass = decisionClass[req.id] ?? effectiveClass
                      const disabledByRole = !canApproveDosen && req.requested_role === 'dosen'
                      return (
                        <tr key={req.id}>
                          <td>
                            <strong>{req.name || req.email}</strong>
                            <div className="subtle-note" style={{ fontSize: 12 }}>
                              {req.email}
                              {req.workspace_domain ? ` · ${req.workspace_domain}` : ''}
                            </div>
                          </td>
                          <td>
                            {req.status === 'pending' && canApproveDosen ? (
                              <select
                                aria-label={`Peran untuk ${req.email}`}
                                value={chosenRole}
                                onChange={(e) =>
                                  setDecisionRole((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value as 'mahasiswa' | 'dosen',
                                  }))
                                }
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12.5 }}
                              >
                                <option value="mahasiswa">mahasiswa</option>
                                <option value="dosen">dosen</option>
                              </select>
                            ) : (
                              <span>{req.requested_role}</span>
                            )}
                          </td>
                          <td>
                            {req.status === 'pending' ? (
                              <select
                                aria-label={`Kelas untuk ${req.email}`}
                                value={chosenClass}
                                onChange={(e) =>
                                  setDecisionClass((prev) => ({ ...prev, [req.id]: e.target.value }))
                                }
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12.5 }}
                              >
                                <option value="">{lang === 'en' ? '— Optional —' : '— Opsional —'}</option>
                                {classes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.id} · {c.course}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td>
                            <Badge
                              tone={
                                req.status === 'approved'
                                  ? 'good'
                                  : req.status === 'rejected'
                                    ? 'bad'
                                    : 'warn'
                              }
                            >
                              {req.status === 'approved'
                                ? 'Disetujui'
                                : req.status === 'rejected'
                                  ? 'Ditolak'
                                  : 'Menunggu'}
                            </Badge>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {req.status !== 'approved' ? (
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ minHeight: 30, fontSize: 12 }}
                                  disabled={decideMut.isPending || disabledByRole}
                                  title={
                                    disabledByRole
                                      ? 'Persetujuan akun dosen hanya dapat dilakukan oleh Admin.'
                                      : undefined
                                  }
                                  onClick={() =>
                                    decideMut.mutate({
                                      requestId: req.id,
                                      action: 'approve',
                                      role: chosenRole,
                                      class_id: chosenClass || undefined,
                                    })
                                  }
                                >
                                  <CheckCircle2 size={13} aria-hidden="true" />
                                  {lang === 'en' ? 'Approve' : 'Setujui'}
                                </button>
                              ) : null}
                              {req.status !== 'rejected' ? (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  style={{ minHeight: 30, fontSize: 12 }}
                                  disabled={decideMut.isPending}
                                  onClick={() =>
                                    decideMut.mutate({
                                      requestId: req.id,
                                      action: 'reject',
                                    })
                                  }
                                >
                                  <XCircle size={13} aria-hidden="true" />
                                  {lang === 'en' ? 'Reject' : 'Tolak'}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                totalItems={requests.length}
                page={requestPage}
                pageSize={10}
                onPageChange={setRequestPage}
              />
            </>
          )}
        </div>
      ) : tab === 'import' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              padding: 14,
              borderRadius: 10,
              border: '1px dashed var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 14 }}>
                  {lang === 'en' ? 'Upload Excel (.xlsx) or CSV (.csv)' : 'Unggah File Excel (.xlsx) atau CSV (.csv)'}
                </strong>
                <p className="subtle-note" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
                  {lang === 'en'
                    ? 'Columns supported: email (required), nama/name, nim, kelas/class_id (up to 500 rows).'
                    : 'Kolom yang didukung: email (wajib), nama, nim, kelas (maksimal 500 baris).'}
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => downloadStudentImportTemplate(effectiveClass)}
              >
                <Download size={14} aria-hidden="true" />
                {lang === 'en' ? 'Download Template' : 'Unduh Template CSV/Excel'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span>{lang === 'en' ? 'Default Class:' : 'Kelas Default:'}</span>
                <select
                  value={effectiveClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--line)', fontSize: 13 }}
                >
                  <option value="">{lang === 'en' ? '— Optional —' : '— Opsional —'}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.course}
                    </option>
                  ))}
                </select>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.tsv,.txt"
                aria-label={lang === 'en' ? 'Choose Excel or CSV file' : 'Pilih file Excel atau CSV'}
                onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
            </div>

            {parseError ? (
              <p style={{ margin: 0, color: 'var(--bad)', fontSize: 13 }}>{parseError}</p>
            ) : null}

            {parsed ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13 }}>
                    <strong>{parsed.fileName}</strong> · {parsed.rows.length}{' '}
                    {lang === 'en' ? 'valid accounts ready to import' : 'akun valid siap diimpor'}
                    {parsed.warnings.length > 0 ? ` · ${parsed.warnings.length} peringatan` : ''}
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={importMut.isPending}
                    onClick={() =>
                      importMut.mutate({
                        default_class_id: effectiveClass || undefined,
                        source: 'excel_import',
                        rows: parsed.rows.map((r) => ({
                          email: r.email,
                          name: r.name || undefined,
                          nim: r.nim || undefined,
                          class_id: r.class_id || undefined,
                          role: canApproveDosen ? r.role : 'mahasiswa',
                        })),
                      })
                    }
                  >
                    <Upload size={14} aria-hidden="true" />
                    {importMut.isPending
                      ? lang === 'en'
                        ? 'Importing...'
                        : 'Mengimpor...'
                      : lang === 'en'
                        ? `Import & Approve (${parsed.rows.length})`
                        : `Impor & Setujui (${parsed.rows.length})`}
                  </button>
                </div>

                <div className="sim-table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  <table className="sim-table">
                    <thead>
                      <tr>
                        <th scope="col">Email</th>
                        <th scope="col">Nama</th>
                        <th scope="col">NIM</th>
                        <th scope="col">Kelas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 25).map((r) => (
                        <tr key={r.email}>
                          <td>{r.email}</td>
                          <td>{r.name || '—'}</td>
                          <td>{r.nim || '—'}</td>
                          <td>{r.class_id || effectiveClass || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 25 ? (
                  <p className="subtle-note" style={{ margin: 0, fontSize: 12 }}>
                    Menampilkan 25 dari {parsed.rows.length} baris pratinjau.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!manualEmail.trim()) return
              importMut.mutate({
                default_class_id: effectiveClass || undefined,
                source: 'manual',
                rows: [
                  {
                    email: manualEmail.trim(),
                    name: manualName.trim() || undefined,
                    role: canApproveDosen ? manualRole : 'mahasiswa',
                  },
                ],
              })
            }}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <label style={{ display: 'grid', gap: 4, flex: '1 1 220px', fontSize: 12.5 }}>
              <span>{lang === 'en' ? 'Add single approved email' : 'Setujui email secara manual'}</span>
              <input
                type="email"
                required
                placeholder="123140051@student.itera.ac.id"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line)', fontSize: 13 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, flex: '1 1 170px', fontSize: 12.5 }}>
              <span>{lang === 'en' ? 'Full name (optional)' : 'Nama lengkap (opsional)'}</span>
              <input
                type="text"
                placeholder="Nama Mahasiswa"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line)', fontSize: 13 }}
              />
            </label>
            {canApproveDosen ? (
              <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
                <span>{lang === 'en' ? 'Role' : 'Peran'}</span>
                <select
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value as 'mahasiswa' | 'dosen')}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line)', fontSize: 13 }}
                >
                  <option value="mahasiswa">mahasiswa</option>
                  <option value="dosen">dosen</option>
                </select>
              </label>
            ) : null}
            <button type="submit" className="btn-primary" disabled={importMut.isPending}>
              <UserPlus size={14} aria-hidden="true" />
              {lang === 'en' ? 'Approve Email' : 'Tambah & Setujui'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="search" style={{ minWidth: 240 }}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder={lang === 'en' ? 'Search email, name, NIM...' : 'Cari email, nama, atau NIM...'}
                value={approvedSearch}
                onChange={(e) => {
                  setApprovedSearch(e.target.value)
                  setApprovedPage(1)
                }}
              />
            </label>
            <span className="subtle-note" style={{ fontSize: 12.5 }}>
              {filteredApproved.length} {lang === 'en' ? 'approved accounts' : 'akun disetujui'}
            </span>
          </div>

          <div className="sim-table-wrap">
            <table className="sim-table">
              <thead>
                <tr>
                  <th scope="col">Email &amp; Nama</th>
                  <th scope="col">NIM</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Kelas</th>
                  <th scope="col">Sumber</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pagedApproved.map((acc) => {
                  const canRevoke = canApproveDosen || acc.role !== 'dosen'
                  return (
                    <tr key={acc.email}>
                      <td>
                        <strong>{acc.full_name || acc.email}</strong>
                        <div className="subtle-note" style={{ fontSize: 12 }}>
                          {acc.email}
                        </div>
                      </td>
                      <td>{acc.nim || '—'}</td>
                      <td>{acc.role}</td>
                      <td>{acc.class_id || '—'}</td>
                      <td>
                        <Badge tone={acc.source === 'excel_import' ? 'info' : 'good'}>
                          {acc.source === 'excel_import'
                            ? 'Excel/CSV'
                            : acc.source === 'approval'
                              ? 'Persetujuan'
                              : acc.source === 'manual'
                                ? 'Manual'
                                : 'Terdaftar'}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ minHeight: 28, fontSize: 12 }}
                          disabled={!canRevoke || revokeMut.isPending}
                          onClick={() => revokeMut.mutate(acc.email)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                          {lang === 'en' ? 'Revoke' : 'Cabut'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pagedApproved.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      {lang === 'en' ? 'No approved accounts found.' : 'Belum ada akun disetujui yang cocok.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={filteredApproved.length}
            page={approvedPage}
            pageSize={10}
            onPageChange={setApprovedPage}
          />
        </div>
      )}
    </section>
  )
}
