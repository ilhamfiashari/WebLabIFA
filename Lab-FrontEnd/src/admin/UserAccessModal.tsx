import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ShieldAlert, UserCog } from 'lucide-react'
import { Drawer } from '../portal/ui'
import {
  simApi,
  type AdminDashboardResponse,
  type UserAccessPermissions,
} from '../simulator/api'

type RoleName = 'mahasiswa' | 'dosen' | 'admin'
type LiveUser = AdminDashboardResponse['users'][number]
type LiveClass = AdminDashboardResponse['classes'][number]

function defaultPermissionsForRoles(roles: string[]): UserAccessPermissions {
  const isAdmin = roles.includes('admin')
  const isDosen = roles.includes('dosen')
  return {
    can_access_web_labs: true,
    can_access_iot_studio: true,
    can_submit_assignments: true,
    can_import_questions: isAdmin || isDosen,
    can_manage_assignments: isAdmin || isDosen,
    can_view_class_analytics: isAdmin || isDosen,
    can_export_reports: isAdmin || isDosen,
  }
}

export function UserAccessModal({
  user,
  classes,
  csrf,
  onClose,
  onSaved,
}: {
  user: LiveUser
  classes: LiveClass[]
  csrf: string
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const qc = useQueryClient()
  const [roles, setRoles] = useState<RoleName[]>(
    (user.roles.filter((r): r is RoleName => r === 'mahasiswa' || r === 'dosen' || r === 'admin')
      .length > 0
      ? user.roles.filter((r): r is RoleName => r === 'mahasiswa' || r === 'dosen' || r === 'admin')
      : ['mahasiswa']),
  )
  const [classIds, setClassIds] = useState<string[]>(user.class_ids ?? [])
  const [perms, setPerms] = useState<UserAccessPermissions>(
    user.permissions ?? defaultPermissionsForRoles(user.roles),
  )
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const saveM = useMutation({
    mutationFn: () =>
      simApi.updateUserAccess(csrf, user.id, {
        roles,
        class_ids: classIds,
        permissions: perms,
      }),
    onSuccess: async () => {
      setErrMsg(null)
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      onSaved(`Peran dan hak akses ${user.name} berhasil diperbarui.`)
      onClose()
    },
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : 'Gagal memperbarui peran dan hak akses pengguna.')
    },
  })

  const toggleRole = (r: RoleName) => {
    setErrMsg(null)
    setRoles((prev) => {
      const has = prev.includes(r)
      if (has && prev.length <= 1) {
        setErrMsg('Setiap pengguna wajib memiliki minimal 1 peran aktif.')
        return prev
      }
      return has ? prev.filter((x) => x !== r) : [...prev, r]
    })
  }

  const toggleClass = (cid: string) => {
    setClassIds((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]))
  }

  const applyPreset = (preset: RoleName) => {
    setErrMsg(null)
    if (preset === 'mahasiswa') {
      setRoles(['mahasiswa'])
      setPerms(defaultPermissionsForRoles(['mahasiswa']))
    } else if (preset === 'dosen') {
      setRoles(['mahasiswa', 'dosen'])
      setPerms(defaultPermissionsForRoles(['dosen']))
    } else {
      setRoles(['dosen', 'admin'])
      setPerms(defaultPermissionsForRoles(['dosen', 'admin']))
    }
  }

  return (
    <Drawer title={`Atur Peran & Hak Akses · ${user.name}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <strong>{user.name}</strong>
          <div className="subtle-note" style={{ fontSize: 13 }}>
            {user.email}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline"
            style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }}
            onClick={() => applyPreset('mahasiswa')}
          >
            Preset Mahasiswa
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }}
            onClick={() => applyPreset('dosen')}
          >
            Preset Dosen
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }}
            onClick={() => applyPreset('admin')}
          >
            Preset Admin
          </button>
        </div>

        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--surface-2)',
            display: 'grid',
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 13 }}>
            <UserCog size={14} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 5 }} />
            Assignment Role Pengguna
          </strong>
          {(['mahasiswa', 'dosen', 'admin'] as const).map((r) => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={() => toggleRole(r)}
              />
              <span className="capitalize">{r}</span>
            </label>
          ))}
        </div>

        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--surface-2)',
            display: 'grid',
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 13 }}>Penugasan Kelas (Keamanan Web &amp; IoT)</strong>
          {classes.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={classIds.includes(c.id)}
                onChange={() => toggleClass(c.id)}
              />
              <span>
                <strong>{c.id}</strong> · {c.course}
              </span>
            </label>
          ))}
        </div>

        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--surface-2)',
            display: 'grid',
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 13 }}>Hak Akses Granular</strong>
          {(
            [
              ['can_access_web_labs', 'Akses Simulator & Lab Keamanan Web'],
              ['can_access_iot_studio', 'Akses Simulator & Misi IoT Studio'],
              ['can_submit_assignments', 'Kumpul Praktikum & Misi IoT'],
              ['can_import_questions', 'Impor Bank Soal Moodle LMS (Dosen)'],
              ['can_manage_assignments', 'Terbitkan & Kelola Penugasan Kelas'],
              ['can_view_class_analytics', 'Lihat Analitik & Progres Mahasiswa'],
              ['can_export_reports', 'Ekspor Laporan Nilai CSV'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={perms[key]}
                onChange={() => setPerms((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <p className="subtle-note" style={{ fontSize: 12, margin: 0 }}>
          <ShieldAlert size={13} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
          Mencabut role aktif otomatis mencabut sesi login pengguna agar hak akses baru langsung berlaku.
        </p>

        {errMsg && (
          <p className="feedback wrong" role="alert" style={{ margin: 0 }}>
            {errMsg}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn-outline" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            <Check size={15} aria-hidden="true" />
            {saveM.isPending ? 'Menyimpan...' : 'Simpan Hak Akses'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
