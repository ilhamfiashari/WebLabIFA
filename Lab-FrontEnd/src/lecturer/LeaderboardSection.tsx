import { useMemo, useState } from 'react'
import { Award, Layers, Medal, Search, ShieldAlert, Trophy } from 'lucide-react'
import { Pagination } from '../portal/Pagination'
import { Badge, Select } from '../portal/ui'
import { AnimatedMeterRow, AnimatedNumber } from '../shared/charts/AnimatedCharts'
import { useI18n } from '../shared/i18n'
import type { InstructorLeaderboardEntry } from '../simulator/api'

interface LeaderboardProps {
  entries: InstructorLeaderboardEntry[]
  classes: Array<{ id: string; name: string }>
  hide: boolean
  limit?: number
  highlightSelf?: boolean
  onOpenFull?: () => void
}

function safeNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function LeaderboardSection({ entries, classes, hide, limit, highlightSelf, onOpenFull }: LeaderboardProps) {
  const { lang } = useI18n()
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'xp' | 'avg_score' | 'levels_passed'>('xp')
  const [page, setPage] = useState(1)

  const normalized = useMemo(
    () =>
      entries.map((e, i) => ({
        ...e,
        rank: safeNum(e.rank) || i + 1,
        xp: safeNum(e.xp ?? e.total_xp),
        avg_score: safeNum(e.avg_score),
        graded_count: e.graded_count !== undefined ? safeNum(e.graded_count) : undefined,
        levels_passed: safeNum(e.levels_passed),
        web_passed: safeNum(e.web_passed),
        iot_passed: safeNum(e.iot_passed),
        badges_count: safeNum(e.badges_count),
      })),
    [entries],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = normalized.filter((e) => {
      if (classFilter !== 'ALL' && e.class_id !== classFilter) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.nim ?? '').toLowerCase().includes(q)
      )
    })
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'avg_score') return b.avg_score - a.avg_score || b.xp - a.xp
      if (sortBy === 'levels_passed') return b.levels_passed - a.levels_passed || b.xp - a.xp
      return b.xp - a.xp || b.avg_score - a.avg_score
    })
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
  }, [normalized, query, classFilter, sortBy, limit])

  const topThree = filtered.slice(0, 3)
  const maxXp = Math.max(100, ...normalized.map((e) => e.xp))

  return (
    <section className="card" style={{ display: 'grid', gap: 16 }} aria-label={lang === 'en' ? 'Student Leaderboard' : 'Leaderboard Mahasiswa'}>
      <div className="card-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={18} color="var(--brand)" aria-hidden="true" />
            {lang === 'en' ? 'Pentester Leaderboard & Ranking' : 'Leaderboard & Peringkat Praktikum Mahasiswa'}
          </h2>
          <p>
            {lang === 'en'
              ? 'Live XP, Web/IoT level mastery, badges, and average rubric scores across classes.'
              : 'Peringkat berdasarkan perolehan XP, level Web/IoT lulus, lencana, dan rata-rata skor rubrik.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge tone="info">{entries.length} {lang === 'en' ? 'students' : 'mahasiswa'}</Badge>
          {onOpenFull ? (
            <button type="button" className="btn-outline" style={{ minHeight: 34, fontSize: 13 }} onClick={onOpenFull}>
              {lang === 'en' ? 'View Full Leaderboard' : 'Lihat Leaderboard Penuh'}
            </button>
          ) : null}
        </div>
      </div>

      {topThree.length > 0 ? (
        <div className="sim-podium-grid">
          {topThree.map((entry, idx) => {
            const podiumCls = idx === 0 ? 'is-first' : idx === 1 ? 'is-second' : 'is-third'
            return (
              <article
                key={entry.user_id}
                className={`sim-podium-card ${podiumCls}`}
                style={
                  highlightSelf && entry.is_self
                    ? { outline: '2px solid var(--brand)', background: 'var(--brand-soft)' }
                    : undefined
                }
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={idx === 0 ? 'good' : idx === 1 ? 'info' : 'warn'}>
                      <Medal size={13} aria-hidden="true" /> #{idx + 1}
                    </Badge>
                    {highlightSelf && entry.is_self ? (
                      <Badge tone="good">{lang === 'en' ? 'You' : 'Anda'}</Badge>
                    ) : null}
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {entry.class_id}
                  </span>
                </div>
                <div>
                  <strong style={{ fontSize: 15, display: 'block' }}>
                    {hide ? `Mahasiswa #${entry.rank}` : entry.name}
                  </strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {hide ? '••••••••@student.itera.ac.id' : entry.email}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    <AnimatedNumber value={entry.xp} /> <small style={{ fontSize: 12, fontWeight: 600 }}>XP</small>
                  </span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Avg {entry.graded_count === 0 ? '—' : entry.avg_score.toFixed(1)} · {entry.badges_count}{' '}
                    {lang === 'en' ? 'badges' : 'lencana'}
                  </span>
                </div>
                <AnimatedMeterRow
                  label={`Web ${entry.web_passed} · IoT ${entry.iot_passed}`}
                  value={entry.xp}
                  max={maxXp}
                  tone={idx === 0 ? 'good' : 'brand'}
                  note={`${entry.levels_passed} lvl`}
                />
              </article>
            )
          })}
        </div>
      ) : null}

      <div className="sim-filter-bar">
        <div className="search" style={{ flex: '1 1 220px' }}>
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={lang === 'en' ? 'Search name, NIM (xxx140xxx), or email...' : 'Cari nama, NIM (xxx140xxx), atau email...'}
            aria-label={lang === 'en' ? 'Search leaderboard' : 'Cari mahasiswa di leaderboard'}
          />
        </div>
        {classes.length > 0 ? (
          <Select
            label={lang === 'en' ? 'Class filter' : 'Filter kelas'}
            icon={Layers}
            value={classFilter}
            onChange={(v) => {
              setClassFilter(v)
              setPage(1)
            }}
            options={[
              { value: 'ALL', label: lang === 'en' ? 'All Classes' : 'Semua Kelas' },
              ...classes.map((c) => ({ value: c.id, label: c.id })),
            ]}
          />
        ) : null}
        <Select
          label={lang === 'en' ? 'Sort leaderboard' : 'Urutkan leaderboard'}
          value={sortBy}
          onChange={(v) => {
            setSortBy(v as 'xp' | 'avg_score' | 'levels_passed')
            setPage(1)
          }}
          icon={Award}
          options={[
            { value: 'xp', label: lang === 'en' ? 'Highest XP' : 'XP Tertinggi' },
            { value: 'avg_score', label: lang === 'en' ? 'Highest Avg Score' : 'Rata-rata Skor' },
            { value: 'levels_passed', label: lang === 'en' ? 'Most Levels Passed' : 'Level Lulus Terbanyak' },
          ]}
        />
      </div>

      <div className="sim-table-wrap">
        <table className="sim-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{lang === 'en' ? 'Student' : 'Mahasiswa'}</th>
              <th>{lang === 'en' ? 'Class' : 'Kelas'}</th>
              <th className="num">XP</th>
              <th>{lang === 'en' ? 'Track Split' : 'Web / IoT'}</th>
              <th className="num">{lang === 'en' ? 'Badges' : 'Lencana'}</th>
              <th className="num">{lang === 'en' ? 'Avg Score' : 'Rata Skor'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((page - 1) * 10, page * 10).map((row, idx) => (
              <tr
                key={row.user_id}
                style={
                  highlightSelf && row.is_self
                    ? { background: 'var(--brand-soft)', outline: '1px solid var(--brand)' }
                    : undefined
                }
              >
                <td>
                  <strong>#{row.rank || idx + 1}</strong>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong>{hide ? `Mahasiswa #${row.rank || idx + 1}` : row.name}</strong>
                    {highlightSelf && row.is_self ? (
                      <Badge tone="good">{lang === 'en' ? 'You' : 'Anda'}</Badge>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {hide ? '••••••••' : row.email}
                  </div>
                </td>
                <td>
                  <Badge tone="muted">{row.class_id}</Badge>
                </td>
                <td className="num">
                  <strong>{row.xp}</strong> XP
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <ShieldAlert size={13} aria-hidden="true" /> Web {row.web_passed} · IoT {row.iot_passed}
                  </span>
                </td>
                <td className="num">{row.badges_count}</td>
                <td className="num">
                  <Badge tone={row.graded_count === 0 ? 'muted' : row.avg_score >= 85 ? 'good' : row.avg_score >= 70 ? 'warn' : 'muted'}>
                    {row.graded_count === 0 ? '—' : row.avg_score.toFixed(1)}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  {lang === 'en'
                    ? 'No matching student entries. Trigger the Demo Seed to populate 12 ITERA students.'
                    : 'Belum ada data leaderboard yang cocok. Gunakan tombol Isi Seed Demo untuk menambahkan 12 mahasiswa ITERA.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!limit ? (
        <Pagination totalItems={filtered.length} page={page} pageSize={10} onPageChange={setPage} />
      ) : null}
    </section>
  )
}
