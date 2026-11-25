import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  Search,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react'
import { useI18n } from '../shared/i18n'
import { DOC_CATEGORIES, WOKWI_DOCS_SECTIONS, type DocSection } from './wokwiDocsData'

interface IotDocsPageProps {
  role: 'mahasiswa' | 'dosen' | 'admin'
  onOpenStudio?: () => void
}

export function IotDocsPage({ role, onOpenStudio }: IotDocsPageProps) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string>(WOKWI_DOCS_SECTIONS[0].id)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return WOKWI_DOCS_SECTIONS
    return WOKWI_DOCS_SECTIONS.filter((sec) => {
      const hay = [
        sec.id,
        sec.wokwiType ?? '',
        sec.titleId,
        sec.titleEn,
        sec.summaryId,
        sec.summaryEn,
        ...(sec.pins ?? []).map((p) => `${p.pin} ${p.name} ${p.descId} ${p.descEn}`),
        ...(sec.attrs ?? []).map((a) => `${a.attr} ${a.descId} ${a.descEn}`),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [query])

  const activeSection: DocSection = useMemo(() => {
    const exact = filteredSections.find((s) => s.id === activeId)
    return exact ?? filteredSections[0] ?? WOKWI_DOCS_SECTIONS[0]
  }, [activeId, filteredSections])

  const activeIdx = filteredSections.findIndex((s) => s.id === activeSection.id)
  const prevSec = activeIdx > 0 ? filteredSections[activeIdx - 1] : null
  const nextSec = activeIdx >= 0 && activeIdx < filteredSections.length - 1 ? filteredSections[activeIdx + 1] : null

  const copyText = (key: string, text: string) => {
    try {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1600)
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Header Banner */}
      <section
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'grid', gap: 6, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 999,
                background: 'var(--brand-soft, rgba(22,163,74,0.12))',
                color: 'var(--brand, #16a34a)',
              }}
            >
              <BookOpen size={13} aria-hidden="true" />
              {en ? 'Wokwi-Aligned IoT Reference' : 'Dokumentasi Simulator IoT (Standar Wokwi)'}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
              {role === 'admin'
                ? 'Admin'
                : role === 'dosen'
                  ? en
                    ? 'Lecturer'
                    : 'Dosen'
                  : en
                    ? 'Student'
                    : 'Mahasiswa'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            {en ? 'IoT Simulator Documentation' : 'Dokumentasi IoT Simulator'}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            {en
              ? 'Complete reference for boards, diagram.json format, Ohm’s Law circuit physics, interactive parts pinouts, attributes, and Arduino C++ code examples modeled after docs.wokwi.com.'
              : 'Referensi lengkap papan mikrokontroler, format diagram.json, fisika rangkaian Hukum Ohm, pinout & atribut komponen interaktif, serta contoh kode Arduino C++ mengacu pada pedoman docs.wokwi.com.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {onOpenStudio ? (
            <button type="button" className="btn-primary" onClick={onOpenStudio}>
              <Cpu size={15} aria-hidden="true" />
              <span>{en ? 'Open IoT Simulator' : 'Buka IoT Simulator'}</span>
            </button>
          ) : null}
          <a
            href="https://docs.wokwi.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>docs.wokwi.com</span>
          </a>
        </div>
      </section>

      {/* Main Docs Split Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 285px) minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
        className="iot-docs-layout"
      >
        {/* Left Navigation Sidebar */}
        <aside
          className="card"
          aria-label={en ? 'Documentation navigation' : 'Navigasi dokumentasi'}
          style={{
            padding: 14,
            display: 'grid',
            gap: 12,
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 110px)',
            overflowY: 'auto',
          }}
        >
          <label style={{ position: 'relative', display: 'block' }}>
            <Search
              size={14}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-soft)',
              }}
            />
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={en ? 'Search parts, pins, guides...' : 'Cari komponen, pin, panduan...'}
              aria-label={en ? 'Search documentation' : 'Cari dokumentasi'}
              style={{ width: '100%', paddingLeft: 32, minHeight: 34, fontSize: 12.5 }}
            />
          </label>

          {filteredSections.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', padding: '8px 4px' }}>
              {en ? 'No matching documentation topics.' : 'Tidak ada topik dokumentasi yang cocok.'}
            </p>
          ) : (
            <nav style={{ display: 'grid', gap: 12 }}>
              {DOC_CATEGORIES.map((cat) => {
                const items = filteredSections.filter((s) => s.category === cat.id)
                if (items.length === 0) return null
                return (
                  <div key={cat.id} style={{ display: 'grid', gap: 4 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--ink-soft)',
                        padding: '2px 8px',
                      }}
                    >
                      {en ? cat.titleEn : cat.titleId}
                    </div>
                    {items.map((sec) => {
                      const isActive = sec.id === activeSection.id
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setActiveId(sec.id)}
                          style={{
                            textAlign: 'left',
                            padding: '7px 10px',
                            borderRadius: 8,
                            border: isActive ? '1px solid var(--brand, #16a34a)' : '1px solid transparent',
                            background: isActive ? 'var(--brand-soft, rgba(22,163,74,0.12))' : 'transparent',
                            color: isActive ? 'var(--brand, #15803d)' : 'var(--ink)',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 12.5,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {en ? sec.titleEn : sec.titleId}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </nav>
          )}
        </aside>

        {/* Right Article Content */}
        <article className="card" style={{ padding: '22px 24px', display: 'grid', gap: 18 }}>
          <header style={{ display: 'grid', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {activeSection.badge ? (
                  <code
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-soft)',
                      border: '1px solid var(--line)',
                      color: 'var(--brand, #15803d)',
                    }}
                  >
                    {activeSection.badge}
                  </code>
                ) : null}
                {activeSection.wokwiType && activeSection.wokwiType !== activeSection.badge ? (
                  <code style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{activeSection.wokwiType}</code>
                ) : null}
              </div>
              <a
                href={activeSection.wokwiUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--brand, #15803d)',
                  textDecoration: 'none',
                }}
              >
                <span>{en ? 'Official Wokwi Ref' : 'Referensi Resmi Wokwi'}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
            <h2 style={{ margin: 0, fontSize: 21 }}>
              {en ? activeSection.titleEn : activeSection.titleId}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
              {en ? activeSection.summaryEn : activeSection.summaryId}
            </p>
          </header>

          {/* How It Works */}
          <section style={{ display: 'grid', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Zap size={15} aria-hidden="true" />
              <span>{en ? 'How It Works & Interactive Behavior' : 'Cara Kerja & Interaksi Komponen'}</span>
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 7, fontSize: 13.5, lineHeight: 1.55 }}>
              {(en ? activeSection.howItWorksEn : activeSection.howItWorksId).map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </section>

          {/* Pinout Table */}
          {activeSection.pins && activeSection.pins.length > 0 ? (
            <section style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Wrench size={15} aria-hidden="true" />
                <span>{en ? 'Pin Names' : 'Daftar Pin (Pinout)'}</span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Pin</th>
                      <th style={{ padding: '8px 10px' }}>{en ? 'Name' : 'Nama'}</th>
                      <th style={{ padding: '8px 10px' }}>{en ? 'Description' : 'Deskripsi'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSection.pins.map((p) => (
                      <tr key={p.pin} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <code style={{ fontWeight: 700 }}>{p.pin}</code>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--ink-soft)' }}>
                          {en ? p.descEn : p.descId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Attributes Table */}
          {activeSection.attrs && activeSection.attrs.length > 0 ? (
            <section style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={15} aria-hidden="true" />
                <span>{en ? 'Attributes (diagram.json attrs)' : 'Atribut (diagram.json attrs)'}</span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>{en ? 'Attribute' : 'Atribut'}</th>
                      <th style={{ padding: '8px 10px' }}>Default</th>
                      <th style={{ padding: '8px 10px' }}>{en ? 'Description' : 'Keterangan'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSection.attrs.map((a) => (
                      <tr key={a.attr} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <code style={{ fontWeight: 700 }}>{a.attr}</code>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <code>{a.defaultVal}</code>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--ink-soft)' }}>
                          {en ? a.descEn : a.descId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Custom Reference Table */}
          {activeSection.table ? (
            <section style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    {(en ? activeSection.table.headersEn : activeSection.table.headersId).map((h) => (
                      <th key={h} style={{ padding: '8px 10px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSection.table.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid var(--line)' }}>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '8px 10px',
                            fontWeight: cIdx === 0 ? 600 : 400,
                            color: cIdx === 0 ? 'var(--ink)' : 'var(--ink-soft)',
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {/* diagram.json Snippet */}
          {activeSection.diagramSnippet ? (
            <section style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>diagram.json</h3>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 28, padding: '2px 10px', fontSize: 12, gap: 5 }}
                  onClick={() => copyText(`diag-${activeSection.id}`, activeSection.diagramSnippet!)}
                >
                  {copiedKey === `diag-${activeSection.id}` ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === `diag-${activeSection.id}` ? (en ? 'Copied' : 'Disalin') : en ? 'Copy JSON' : 'Salin JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
                <code>{activeSection.diagramSnippet}</code>
              </pre>
            </section>
          ) : null}

          {/* Arduino C++ Code Snippet */}
          {activeSection.codeSnippet ? (
            <section style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>
                  {en ? 'Example Arduino Code (Main.ino)' : 'Contoh Kode Arduino (Main.ino)'}
                </h3>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 28, padding: '2px 10px', fontSize: 12, gap: 5 }}
                  onClick={() => copyText(`code-${activeSection.id}`, activeSection.codeSnippet!)}
                >
                  {copiedKey === `code-${activeSection.id}` ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === `code-${activeSection.id}` ? (en ? 'Copied' : 'Disalin') : en ? 'Copy Code' : 'Salin Kode'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
                <code>{activeSection.codeSnippet}</code>
              </pre>
            </section>
          ) : null}

          {/* Prev / Next Footer */}
          <footer
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              borderTop: '1px solid var(--line)',
              paddingTop: 14,
              marginTop: 4,
              flexWrap: 'wrap',
            }}
          >
            {prevSec ? (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setActiveId(prevSec.id)}
                style={{ fontSize: 12.5 }}
              >
                ← {en ? prevSec.titleEn : prevSec.titleId}
              </button>
            ) : (
              <span />
            )}
            {nextSec ? (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setActiveId(nextSec.id)}
                style={{ fontSize: 12.5 }}
              >
                {en ? nextSec.titleEn : nextSec.titleId} →
              </button>
            ) : null}
          </footer>
        </article>
      </div>
    </div>
  )
}
