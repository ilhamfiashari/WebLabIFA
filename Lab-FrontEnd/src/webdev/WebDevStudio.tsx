import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlignLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  FilePlus2,
  FolderOpen,
  Lock,
  Play,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import { simApi } from '../simulator/api'
import { BLANK_WEBDEV_FILES, WEBDEV_MISSIONS } from './missions'
import { collectVirtualElements, parseHtmlPreview } from './htmlAst'
import type { JsElementPatch, JsSandboxSession } from './jsRuntime'
import {
  analyzeJavaScriptAndReact,
  executeSafePython,
  executeSafeSql,
} from './sandboxEngine'
import type {
  SavedWebDevProject,
  WebDevFastApiRoute,
  WebDevFile,
  WebDevHttpLog,
  WebDevSqlTable,
} from './types'
import { WebDevPreviewPane, type PreviewSubTab } from './WebDevPreviewPane'
import { formatWebDevCode } from './webEditorHelpers'
import { webDevSnippets } from './cmWebDev'
import { lintWebDevCode } from './webDiagnostics'
import type { CodeDiagnostic } from '../shared/editorDiagnostics'
import { CodeMirrorEditor, type CodeMirrorHandle } from '../shared/CodeMirrorEditor'
import { editorIndentSize, editorLanguageLabel, languageForFileName } from '../shared/codemirrorSetup'
import {
  EditorDiagnosticsList,
  EditorStatusDiagnosticPill,
} from '../shared/EditorDiagnosticsUi'
import './webdev.css'

function useDarkTheme(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      setDark(el.dataset.theme === 'dark')
    })
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

interface ExecSnapshot {
  runId: number
  renderReady: boolean
  consoleLines: string[]
  pythonLines: string[]
  initialDomUpdates: Record<string, string>
  initialPatches: Record<string, JsElementPatch>
  jsSession: JsSandboxSession
  bindings: ReturnType<typeof analyzeJavaScriptAndReact>['bindings']
  reactModel: ReturnType<typeof analyzeJavaScriptAndReact>['reactModel']
  apiRoutes: WebDevFastApiRoute[]
  sqlTables: WebDevSqlTable[]
  sqlLogs: string[]
  sqlExecuted: boolean
}

let nextRunCounter = 1

function runSandboxFiles(files: WebDevFile[], markReady: boolean): ExecSnapshot {
  const htmlFile =
    files.find((f) => f.name.toLowerCase() === 'index.html') ??
    files.find((f) => /\.html?$/i.test(f.name)) ??
    null
  const htmlParsed = htmlFile ? parseHtmlPreview(htmlFile.content) : null
  const virtualElements = htmlParsed ? collectVirtualElements(htmlParsed.nodes, 'wd-html') : []
  const jsFiles = files.filter(
    (f) => /\.(js|mjs|cjs|ts|mts|cts)$/i.test(f.name),
  )
  const jsxFiles = files.filter(
    (f) => f.name.toLowerCase().endsWith('.jsx') || f.name.toLowerCase().endsWith('.tsx'),
  )
  const pyText = files
    .filter((f) => f.name.toLowerCase().endsWith('.py'))
    .map((f) => f.content)
    .join('\n')
  const sqlText = files
    .filter((f) => f.name.toLowerCase().endsWith('.sql'))
    .map((f) => f.content)
    .join('\n')

  const jsRes = analyzeJavaScriptAndReact(
    jsFiles,
    jsxFiles,
    virtualElements,
    htmlParsed?.scripts ?? [],
  )
  const pyRes = pyText ? executeSafePython(pyText) : { outputLines: [], routes: [] }
  const sqlRes = sqlText
    ? executeSafeSql(sqlText)
    : { tables: [], logs: [], selectResults: [] }

  return {
    runId: nextRunCounter++,
    renderReady: markReady,
    consoleLines: jsRes.consoleLines,
    pythonLines: pyRes.outputLines,
    initialDomUpdates: jsRes.initialDomUpdates,
    initialPatches: jsRes.initialPatches,
    jsSession: jsRes.jsSession,
    bindings: jsRes.bindings,
    reactModel: jsRes.reactModel,
    apiRoutes: pyRes.routes,
    sqlTables: sqlRes.tables,
    sqlLogs: sqlRes.logs,
    sqlExecuted: Boolean(sqlText && (sqlRes.tables.length > 0 || sqlRes.logs.length > 0)),
  }
}

export function WebDevStudio({
  csrf,
  initialLabId,
  mode = 'mahasiswa',
}: {
  csrf: string
  initialLabId?: string | null
  mode?: 'mahasiswa' | 'dosen'
}) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const isDark = useDarkTheme()
  const qc = useQueryClient()
  const isInstructor = mode === 'dosen'

  const initialMission = useMemo(
    () =>
      (initialLabId
        ? WEBDEV_MISSIONS.find((m) => m.id === initialLabId || m.codeTag.toLowerCase() === initialLabId.toLowerCase())
        : undefined) ?? WEBDEV_MISSIONS[0],
    [initialLabId],
  )

  const [activeMissionId, setActiveMissionId] = useState<string | null>(initialMission.id)
  const [projectTitle, setProjectTitle] = useState(() =>
    en ? initialMission.titleEn : initialMission.titleId,
  )
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [files, setFiles] = useState<WebDevFile[]>(() => initialMission.starterFiles)
  const [activeFileName, setActiveFileName] = useState<string>(
    () => initialMission.starterFiles[0]?.name ?? 'index.html',
  )
  const [execState, setExecState] = useState<ExecSnapshot>(() =>
    runSandboxFiles(initialMission.starterFiles, false),
  )
  const [previewSubTab, setPreviewSubTab] = useState<PreviewSubTab>(
    () => initialMission.defaultFocusTab ?? 'preview',
  )
  const [httpLogs, setHttpLogs] = useState<WebDevHttpLog[]>([])
  const [apiTested, setApiTested] = useState(false)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)

  const [showMissionDrawer, setShowMissionDrawer] = useState(false)
  const [showBadgesDrawer, setShowBadgesDrawer] = useState(false)
  const [showSavedDrawer, setShowSavedDrawer] = useState(false)
  const [savedTab, setSavedTab] = useState<'mine' | 'students'>('mine')
  const [savedSearch, setSavedSearch] = useState('')

  const [focusMode, setFocusMode] = useState<'normal' | 'editor' | 'preview'>('normal')
  const [splitWidth, setSplitWidth] = useState(500)
  const workbenchRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<CodeMirrorHandle | null>(null)
  const [editorEpoch, setEditorEpoch] = useState(0)

  const [newFileMode, setNewFileMode] = useState(false)
  const [newFileDraft, setNewFileDraft] = useState('')
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 })
  const projectsQ = useQuery({
    queryKey: ['webdev-projects'],
    queryFn: () => simApi.listWebDevProjects(),
    retry: false,
  })

  const studentProjectsQ = useQuery({
    queryKey: ['dosen-student-webdev-projects'],
    queryFn: () => simApi.listDosenStudentWebDevProjects(),
    enabled: isInstructor && showSavedDrawer && savedTab === 'students',
    retry: false,
  })

  const completedSet = useMemo(
    () => new Set((projectsQ.data?.completed_missions ?? []).map((m) => m.mission_id)),
    [projectsQ.data?.completed_missions],
  )
  const portalXp = projectsQ.data?.portal_xp ?? 0
  const studioAccess = projectsQ.data?.access
  const canAccessStudio = isInstructor || (studioAccess?.can_access_web_labs ?? true)
  const canSubmit = isInstructor || (studioAccess?.can_submit_assignments ?? true)

  const serverMissionMap = useMemo(
    () => new Map((projectsQ.data?.mission_states ?? []).map((s) => [s.mission_id, s])),
    [projectsQ.data?.mission_states],
  )

  const getMissionUnlock = useCallback(
    (missionId: string): { unlocked: boolean; reason: string | null } => {
      if (isInstructor) return { unlocked: true, reason: null }
      if (!canAccessStudio) {
        return {
          unlocked: false,
          reason: en
            ? 'Web Dev Studio access is disabled by Admin.'
            : 'Hak akses Lab Pengembangan Web dikunci oleh Admin.',
        }
      }
      const srv = serverMissionMap.get(missionId)
      if (srv) return { unlocked: srv.unlocked, reason: srv.lock_reason ?? null }
      const spec = WEBDEV_MISSIONS.find((m) => m.id === missionId)
      if (!spec) return { unlocked: false, reason: null }
      if (spec.prerequisiteId && !completedSet.has(spec.prerequisiteId)) {
        const prev = WEBDEV_MISSIONS.find((m) => m.id === spec.prerequisiteId)
        return {
          unlocked: false,
          reason: en
            ? `Complete "${prev?.titleEn ?? spec.prerequisiteId}" first.`
            : `Selesaikan terlebih dahulu "${prev?.titleId ?? spec.prerequisiteId}".`,
        }
      }
      if (portalXp < spec.requiredXp) {
        return {
          unlocked: false,
          reason: en
            ? `Requires at least ${spec.requiredXp} XP Experience (currently ${portalXp} XP).`
            : `Butuh minimal ${spec.requiredXp} XP Experience (saat ini ${portalXp} XP).`,
        }
      }
      return { unlocked: true, reason: null }
    },
    [canAccessStudio, completedSet, en, isInstructor, portalXp, serverMissionMap],
  )

  const activeMission = useMemo(
    () => WEBDEV_MISSIONS.find((m) => m.id === activeMissionId) ?? null,
    [activeMissionId],
  )

  const activeFile = useMemo(
    () => files.find((f) => f.name === activeFileName) ?? files[0] ?? { name: 'index.html', content: '' },
    [activeFileName, files],
  )

  const executeAll = (targetFiles = files) => {
    const next = runSandboxFiles(targetFiles, true)
    setExecState(next)
  }

  const selectMission = (missionId: string) => {
    const spec = WEBDEV_MISSIONS.find((m) => m.id === missionId)
    if (!spec) return
    const lock = getMissionUnlock(spec.id)
    if (!lock.unlocked) {
      setStatusNotice(lock.reason ?? (en ? 'Mission locked.' : 'Misi masih terkunci.'))
      return
    }
    setActiveMissionId(spec.id)
    setActiveProjectId(null)
    setProjectTitle(en ? spec.titleEn : spec.titleId)
    setEditorEpoch((epoch) => epoch + 1)
    setFiles(spec.starterFiles)
    setActiveFileName(spec.starterFiles[0]?.name ?? 'index.html')
    setExecState(runSandboxFiles(spec.starterFiles, false))
    setPreviewSubTab(spec.defaultFocusTab ?? 'preview')
    setHttpLogs([])
    setApiTested(false)
    setShowMissionDrawer(false)
    setStatusNotice(null)
  }

  const startBlankProject = () => {
    setActiveMissionId(null)
    setActiveProjectId(null)
    setProjectTitle(en ? 'Blank Web App' : 'Proyek Web Baru')
    setEditorEpoch((epoch) => epoch + 1)
    setFiles(BLANK_WEBDEV_FILES)
    setActiveFileName('index.html')
    setExecState(runSandboxFiles(BLANK_WEBDEV_FILES, false))
    setPreviewSubTab('preview')
    setHttpLogs([])
    setApiTested(false)
    setStatusNotice(en ? 'Opened clean Web Blank Canvas.' : 'Blank Canvas Web App dibuka.')
  }

  const loadSavedProject = (p: SavedWebDevProject) => {
    const nextFiles = Array.isArray(p.files) && p.files.length > 0 ? p.files : BLANK_WEBDEV_FILES
    setActiveMissionId(p.mission_id ?? null)
    setActiveProjectId(isInstructor && savedTab === 'students' ? null : p.id)
    setProjectTitle(p.title)
    setEditorEpoch((epoch) => epoch + 1)
    setFiles(nextFiles)
    setActiveFileName(nextFiles[0].name)
    setExecState(runSandboxFiles(nextFiles, false))
    setHttpLogs([])
    setApiTested(false)
    setShowSavedDrawer(false)
    setStatusNotice(
      en
        ? `Loaded Web project "${p.title}" (${nextFiles.length} file(s)).`
        : `Proyek "${p.title}" dimuat (${nextFiles.length} file).`,
    )
  }

  const saveMut = useMutation({
    mutationFn: () =>
      simApi.saveWebDevProject(csrf, {
        id: activeProjectId ?? undefined,
        title: projectTitle.trim() || 'Proyek Web',
        mission_id: activeMissionId,
        files,
      }),
    onSuccess: (res) => {
      setActiveProjectId(res.id)
      setStatusNotice(
        en ? `Project "${res.title}" saved to database.` : `Proyek "${res.title}" tersimpan ke database.`,
      )
      void qc.invalidateQueries({ queryKey: ['webdev-projects'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => simApi.deleteWebDevProject(csrf, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webdev-projects'] })
    },
  })

  const missionChecks = useMemo(() => {
    if (!activeMission) return []
    return activeMission.evaluate({
      files,
      renderReady: execState.renderReady,
      apiTested,
      sqlExecuted: execState.sqlExecuted,
      activeUrl: '/',
      apiRoutes: execState.apiRoutes,
      sqlTables: execState.sqlTables,
      consoleLines: execState.consoleLines,
      pythonLines: execState.pythonLines,
    })
  }, [activeMission, apiTested, execState, files])

  const allChecksPassed = missionChecks.length > 0 && missionChecks.every((c) => c.passed)

  const submitMut = useMutation({
    mutationFn: () =>
      simApi.submitWebDevMission(csrf, {
        mission_id: activeMission?.id ?? '',
        files,
        checks_passed: missionChecks.filter((c) => c.passed).length,
        checks_total: missionChecks.length,
        render_ready: execState.renderReady,
        api_tested: apiTested,
        sql_executed: execState.sqlExecuted,
      }),
    onSuccess: async (res) => {
      const badgeNote =
        res.newly_unlocked && res.newly_unlocked.length > 0
          ? en
            ? ` · Badge unlocked: ${res.newly_unlocked.join(', ')}`
            : ` · Lencana terbuka: ${res.newly_unlocked.join(', ')}`
          : ''
      setStatusNotice(
        en
          ? `Mission verified! +${res.xp_awarded} XP Experience (Total ${res.portal_xp} XP)${badgeNote}.`
          : `Misi Web lulus! +${res.xp_awarded} XP Experience (Total ${res.portal_xp} XP)${badgeNote}.`,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['webdev-projects'] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['student-leaderboard'] }),
        qc.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
      ])
    },
  })

  const handleCodeChange = (nextContent: string) => {
    const nextFiles = files.map((file) =>
      file.name === activeFile.name ? { ...file, content: nextContent } : file,
    )
    setFiles(nextFiles)
    if (execState.renderReady) setExecState(runSandboxFiles(nextFiles, true))
  }

  const createNewFile = () => {
    const clean = newFileDraft.trim().replace(/[/\\]/g, '')
    if (!clean || !clean.includes('.')) {
      setStatusNotice(
        en ? 'Enter filename with extension (e.g. api.py or script.js).' : 'Masukkan nama file beserta ekstensi (mis. api.py atau style.css).',
      )
      return
    }
    const existing = files.find((file) => file.name.toLowerCase() === clean.toLowerCase())
    if (existing) {
      setActiveFileName(existing.name)
      setNewFileMode(false)
      setNewFileDraft('')
      return
    }
    const starter = {
      html: '<section>\n  <h2>Bagian Baru</h2>\n</section>\n',
      css: '.box { padding: 12px; }\n',
      javascript: 'console.log("Loaded");\n',
      typescript: 'const title: string = "Halaman Web";\n',
      jsx: 'export default function App() {\n  return <h1>Halaman Web</h1>;\n}\n',
      tsx: 'export default function App() {\n  return <h1>Halaman Web</h1>;\n}\n',
      python: 'print("Module ready")\n',
      sql: 'SELECT 1;\n',
      json: '{}\n',
      cpp: '',
      plain: '',
    }[languageForFileName(clean)]
    const nextFiles = [...files, { name: clean, content: starter }]
    setFiles(nextFiles)
    setActiveFileName(clean)
    setNewFileMode(false)
    setNewFileDraft('')
  }

  const editorLanguage = languageForFileName(activeFile.name)
  const languageLabel = editorLanguageLabel(editorLanguage, en)
  const snippets = useMemo(() => webDevSnippets(activeFile.name, en), [activeFile.name, en])
  const editorDiagnostics = useMemo(
    () => lintWebDevCode(activeFile.content, editorLanguage),
    [activeFile.content, editorLanguage],
  )
  const editorSnapshot = useRef<{ files: WebDevFile[]; active: string } | null>(null)
  useLayoutEffect(() => {
    editorSnapshot.current = { files, active: activeFile.name }
    return () => { editorSnapshot.current = null }
  }, [files, activeFile.name, execState.renderReady])

  const formatCurrentFile = async () => {
    const requested = editorSnapshot.current
    try {
      const formatted = await formatWebDevCode(activeFile.content, editorLanguage)
      if (requested !== editorSnapshot.current) return
      if (formatted !== activeFile.content) handleCodeChange(formatted)
    } catch {
      if (requested !== editorSnapshot.current) return
      setStatusNotice(en ? 'Check the syntax before formatting this file.' : 'Periksa sintaks sebelum merapikan file ini.')
    }
  }

  const jumpToDiagnostic = (diag: CodeDiagnostic) => {
    editorRef.current?.jumpTo(diag.line, diag.col)
  }

  const achievements = projectsQ.data?.achievements ?? []
  const earnedAchCount = achievements.filter((a) => a.earned).length
  const myProjects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data?.projects])
  const studentProjects = useMemo(
    () => studentProjectsQ.data?.projects ?? [],
    [studentProjectsQ.data?.projects],
  )
  const explorerProjects = useMemo(() => {
    const src = isInstructor && savedTab === 'students' ? studentProjects : myProjects
    const term = savedSearch.trim().toLowerCase()
    if (!term) return src
    return src.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        (p.owner_name ?? '').toLowerCase().includes(term) ||
        p.files.some((f) => f.name.toLowerCase().includes(term)),
    )
  }, [isInstructor, myProjects, savedSearch, savedTab, studentProjects])

  const activeMissionLock = activeMission ? getMissionUnlock(activeMission.id) : { unlocked: true, reason: null }

  return (
    <div className="wd-studio">
      {/* Compact Header Toolbar */}
      <header className="card wd-topbar">
        <div className="wd-topbar-left">
          <div className="wd-title-row">
            <Code2 size={18} />
            <h1>{en ? 'Web App Development Lab' : 'Lab Virtual Pengembangan Aplikasi Web'}</h1>
          </div>
          <Badge tone={isInstructor ? 'info' : 'good'}>
            {isInstructor ? (en ? 'Lecturer' : 'Dosen') : (en ? 'Student' : 'Mahasiswa')}
          </Badge>
        </div>

        <div className="wd-topbar-controls">
          <div className="iot-focus-seg" role="group" aria-label={en ? 'Workspace focus mode' : 'Mode tampilan studio'}>
            <button type="button" className={focusMode === 'normal' ? 'is-active' : ''} onClick={() => setFocusMode('normal')}>
              Normal
            </button>
            <button type="button" className={focusMode === 'editor' ? 'is-active' : ''} onClick={() => setFocusMode('editor')}>
              {en ? 'Editor' : 'Fokus Kode'}
            </button>
            <button type="button" className={focusMode === 'preview' ? 'is-active' : ''} onClick={() => setFocusMode('preview')}>
              {en ? 'Preview' : 'Fokus Web'}
            </button>
          </div>

          <button type="button" className="btn-outline iot-mini-btn" onClick={startBlankProject}>
            <FilePlus2 size={13} /> New File
          </button>
          <button
            type="button"
            className={`btn-outline iot-mini-btn ${showSavedDrawer ? 'is-active' : ''}`}
            onClick={() => setShowSavedDrawer((v) => !v)}
          >
            <FolderOpen size={13} /> {en ? 'Saved' : 'Tersimpan'} ({myProjects.length})
          </button>
          <button
            type="button"
            className="btn-outline iot-mini-btn"
            disabled={!canAccessStudio || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            <Save size={13} /> {en ? 'Save' : 'Simpan'}
          </button>

          <select
            aria-label={en ? 'Select Web Dev mission' : 'Pilih misi pengembangan web'}
            className="sim-select-full wd-select"
            value={activeMissionId ?? ''}
            onChange={(e) => {
              if (e.target.value) selectMission(e.target.value)
            }}
          >
            <option value="">{en ? '— Custom Project —' : '— Proyek Bebas —'}</option>
            {WEBDEV_MISSIONS.map((m) => {
              const lock = getMissionUnlock(m.id)
              const label = en ? m.titleEn : m.titleId
              return (
                <option key={m.id} value={m.id} disabled={!lock.unlocked}>
                  {!lock.unlocked ? `🔒 ${label} (${m.requiredXp} XP)` : label}
                </option>
              )
            })}
          </select>

          <input
            aria-label={en ? 'Project title' : 'Nama proyek web'}
            className="input wd-project-input"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
          />

          <button type="button" className="btn-primary iot-mini-btn" onClick={() => executeAll()}>
            <Play size={13} /> {en ? 'Run Web' : 'Jalankan'}
          </button>
        </div>
      </header>

      {statusNotice ? (
        <div className="iot-notice-banner" role="status">
          <CheckCircle2 size={15} />
          <span>{statusNotice}</span>
        </div>
      ) : null}

      {/* Minimalist Single-Line Collapsible Mission Bar */}
      <section className="card wd-mission-bar" aria-label={en ? 'Web Dev Missions Bar' : 'Bar Misi Pengembangan Web'}>
        {!isInstructor && (!canAccessStudio || !canSubmit) ? (
          <div className="feedback wrong" role="alert">
            <Lock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {!canAccessStudio
              ? en ? 'Web Dev Lab access disabled by Admin.' : 'Hak akses Lab Pengembangan Web dikunci Admin.'
              : en ? 'Submission is disabled by Admin.' : 'Hak kirim misi Anda sedang dikunci Admin.'}
          </div>
        ) : null}

        <div className="wd-mission-row">
          <div className="wd-mission-summary">
            <span className="wd-mission-active-name">
              {activeMission
                ? `${en ? activeMission.titleEn : activeMission.titleId}`
                : en ? 'Sandbox Project (P1–P16)' : 'Proyek Bebas (P1–P16)'}
            </span>
            <Badge tone={isInstructor ? 'info' : 'muted'}>
              {isInstructor
                ? en ? 'Lecturer · All 14 Missions Open' : 'Dosen · Semua 14 Misi Terbuka'
                : `Experience: ${portalXp} XP · ${completedSet.size}/${WEBDEV_MISSIONS.length}`}
            </Badge>
            {activeMission && (
              <div className="wd-checks-inline">
                {missionChecks.map((ck) => (
                  <span key={ck.id} className={`wd-check-chip ${ck.passed ? 'is-pass' : ''}`}>
                    {ck.passed ? '✓' : '○'} {en ? ck.labelEn : ck.labelId}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="wd-mission-actions">
            {achievements.length > 0 && (
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                onClick={() => setShowBadgesDrawer((v) => !v)}
              >
                <Award size={13} /> {earnedAchCount}/{achievements.length} {en ? 'Badges' : 'Lencana'}
              </button>
            )}
            <button
              type="button"
              className="btn-outline iot-mini-btn"
              onClick={() => setShowMissionDrawer((v) => !v)}
              aria-expanded={showMissionDrawer}
            >
              {en ? `Missions (${WEBDEV_MISSIONS.length})` : `Daftar Misi (${WEBDEV_MISSIONS.length})`}{' '}
              {showMissionDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {activeMission && (
              <button
                type="button"
                className="btn-primary iot-mini-btn"
                disabled={!allChecksPassed || !canSubmit || !activeMissionLock.unlocked || submitMut.isPending}
                onClick={() => submitMut.mutate()}
              >
                <Sparkles size={13} />{' '}
                {completedSet.has(activeMission.id)
                  ? en ? 'Completed ✓' : 'Lulus ✓'
                  : en ? `Submit (+${activeMission.xp} XP)` : `Kumpulkan (+${activeMission.xp} XP)`}
              </button>
            )}
          </div>
        </div>

        {activeMission && (
          <p className="wd-mission-objective">
            <strong>{activeMission.stackBadge}:</strong>{' '}
            {en ? activeMission.objectiveEn : activeMission.objectiveId}
          </p>
        )}

        {showBadgesDrawer && achievements.length > 0 && (
          <div className="wd-badges-drawer" aria-label={en ? 'Web Dev Badges' : 'Lencana Pengembangan Web'}>
            {achievements.map((a) => (
              <span key={a.id} title={`${a.detail} (+${a.xp} XP)`}>
                <Badge tone={a.earned ? 'good' : 'muted'}>
                  {a.earned ? '★ ' : '○ '}
                  {a.title}
                </Badge>
              </span>
            ))}
          </div>
        )}

        {showMissionDrawer && (
          <div className="wd-mission-drawer" role="region" aria-label={en ? 'Mission List P1-P16' : 'Daftar Misi P1-P16'}>
            {WEBDEV_MISSIONS.map((m) => {
              const lock = getMissionUnlock(m.id)
              const done = completedSet.has(m.id)
              const active = activeMissionId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!lock.unlocked}
                  title={lock.reason ?? (en ? m.objectiveEn : m.objectiveId)}
                  className={`wd-mission-card-btn ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                  onClick={() => selectMission(m.id)}
                >
                  <div className="wd-mission-card-head">
                    <span>{en ? m.titleEn : m.titleId}</span>
                    {!lock.unlocked ? (
                      <Lock size={12} />
                    ) : done ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Badge tone="muted">+{m.xp} XP</Badge>
                    )}
                  </div>
                  <span className="wd-mission-card-sub">
                    {!lock.unlocked
                      ? en
                        ? `Requires ${m.requiredXp} XP & previous mission`
                        : `Butuh ${m.requiredXp} XP Experience & prasyarat`
                      : m.stackBadge}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {submitMut.isError && (
          <p className="feedback wrong" role="alert">
            {submitMut.error instanceof Error
              ? submitMut.error.message
              : en
                ? 'Verification rejected by server.'
                : 'Verifikasi misi ditolak server.'}
          </p>
        )}
      </section>

      {/* Saved Multi-File Explorer Drawer */}
      {showSavedDrawer && (
        <section className="card wd-mission-bar" aria-label={en ? 'Saved Web Projects' : 'Proyek Web Tersimpan'}>
          <div className="wd-mission-row">
            <strong>{en ? 'Saved Web Projects & Multi-Files' : 'Daftar Proyek & File Tersimpan'}</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={savedTab === 'mine' ? 'btn-primary iot-mini-btn' : 'btn-outline iot-mini-btn'}
                onClick={() => setSavedTab('mine')}
              >
                <FolderOpen size={12} /> {en ? 'My Projects' : 'Proyek Saya'} ({myProjects.length})
              </button>
              {isInstructor && (
                <button
                  type="button"
                  className={savedTab === 'students' ? 'btn-primary iot-mini-btn' : 'btn-outline iot-mini-btn'}
                  onClick={() => setSavedTab('students')}
                >
                  <Users size={12} /> {en ? 'Student Projects' : 'Proyek Mahasiswa'} ({studentProjects.length})
                </button>
              )}
              <label className="iot-explorer-search" style={{ minWidth: 200 }}>
                <Search size={13} />
                <input
                  type="search"
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                  placeholder={en ? 'Search project or file...' : 'Cari judul proyek / file...'}
                />
              </label>
            </div>
          </div>

          {explorerProjects.length === 0 ? (
            <p className="wd-muted">{en ? 'No saved Web projects yet.' : 'Belum ada proyek Web tersimpan.'}</p>
          ) : (
            <div className="wd-mission-drawer">
              {explorerProjects.map((p) => (
                <div key={p.id} className="wd-mission-card-btn" style={{ cursor: 'default' }}>
                  <div className="wd-mission-card-head">
                    <span>{p.title}</span>
                    <Badge tone="muted">{p.files.length} file</Badge>
                  </div>
                  {p.owner_name && (
                    <span className="wd-mission-card-sub">
                      {p.owner_name} · {p.class_id ?? ''}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button type="button" className="btn-primary iot-mini-btn" onClick={() => loadSavedProject(p)}>
                      {en ? 'Open' : 'Buka'}
                    </button>
                    {(!isInstructor || savedTab === 'mine') && (
                      <button
                        type="button"
                        className="btn-outline iot-mini-btn"
                        onClick={() => deleteMut.mutate(p.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dual-Pane Interactive IDE + Right Web Preview */}
      <div className="wd-workbench" ref={workbenchRef}>
          <section
            className="wd-editor-pane"
            hidden={focusMode === 'preview'}
            style={focusMode === 'normal' ? { flex: `0 0 ${splitWidth}px` } : { flex: '1 1 100%' }}
            aria-label={en ? 'Web Code Editor' : 'Editor Kode Aplikasi Web'}
          >
            <div className="wd-file-tabs" role="tablist">
              {files.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  role="tab"
                  aria-selected={activeFile.name === f.name}
                  className={`wd-file-tab ${activeFile.name === f.name ? 'is-active' : ''}`}
                  onClick={() => setActiveFileName(f.name)}
                >
                  {f.name}
                </button>
              ))}
            </div>

            <div className="wd-editor-actions">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => setNewFileMode((v) => !v)}
                >
                  <Plus size={12} /> {en ? 'Add File' : 'Tambah File'}
                </button>
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => editorRef.current?.find()}
                  title={en ? 'Find and replace (Ctrl/⌘+F)' : 'Cari dan ganti (Ctrl/⌘+F)'}
                >
                  <Search size={12} /> {en ? 'Find' : 'Cari'}
                </button>
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  title={en ? 'Format code (Shift+Alt+F)' : 'Rapikan indentasi kode (Shift+Alt+F)'}
                  onClick={() => void formatCurrentFile()}
                  disabled={editorLanguage === 'plain' || editorLanguage === 'cpp'}
                >
                  <AlignLeft size={12} /> {en ? 'Format' : 'Rapikan'}
                </button>
                {files.length > 1 && (
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={() => {
                      const remaining = files.filter((f) => f.name !== activeFile.name)
                      setFiles(remaining)
                      setActiveFileName(remaining[0].name)
                    }}
                  >
                    <Trash2 size={12} /> {en ? 'Remove' : 'Hapus'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {editorDiagnostics.length > 0 && (
                  <Badge tone="bad">
                    {editorDiagnostics.length} {en ? 'Error' : 'Error'}
                  </Badge>
                )}
                <Badge tone="info">{languageLabel}</Badge>
              </div>
            </div>

            {newFileMode && (
              <div className="iot-file-prompt">
                <input
                  type="text"
                  className="iot-file-prompt-input"
                  value={newFileDraft}
                  onChange={(e) => setNewFileDraft(e.target.value)}
                  placeholder="api.py / App.jsx / schema.sql"
                  aria-label={en ? 'New file name' : 'Nama file baru'}
                />
                <button type="button" className="btn-primary iot-mini-btn" onClick={createNewFile}>
                  {en ? 'Create' : 'Buat'}
                </button>
              </div>
            )}

            {editorDiagnostics.length > 0 && (
              <div className="wd-compile-error" role="alert">
                <EditorDiagnosticsList
                  diagnostics={editorDiagnostics}
                  en={en}
                  onJump={jumpToDiagnostic}
                />
              </div>
            )}

            <CodeMirrorEditor
              key={editorEpoch}
              ref={editorRef}
              className={`wd-code-shell ${isDark ? 'theme-dark' : 'theme-light'}`}
              docKey={activeFile.name}
              value={activeFile.content}
              language={editorLanguage}
              dark={isDark}
              ariaLabel={en ? 'Web source code editor' : 'Kode program aplikasi web'}
              diagnostics={editorDiagnostics}
              en={en}
              context={snippets}
              onChange={handleCodeChange}
              onCursorChange={setCursorPos}
              onFormat={() => void formatCurrentFile()}
            />
            <div className="wd-editor-statusbar" aria-label={en ? 'Editor status bar' : 'Status bar editor'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  Ln {cursorPos.line}, Col {cursorPos.col} · {languageLabel} · UTF-8 · Spaces: {editorIndentSize(editorLanguage)}
                </span>
                <EditorStatusDiagnosticPill
                  diagnostics={editorDiagnostics}
                  en={en}
                  onJump={jumpToDiagnostic}
                />
              </span>
              <span>
                {en ? 'Ctrl+Space Suggest · Shift+Alt+F Format' : 'Ctrl+Space Saran · Shift+Alt+F Rapikan'}
              </span>
            </div>
          </section>

        {focusMode === 'normal' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={en ? 'Resize code editor and preview panes' : 'Geser untuk memperlebar editor atau hasil render web'}
            className="iot-split-resizer"
            onDoubleClick={() => setSplitWidth(500)}
            onPointerDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = splitWidth
              const maxW = Math.max(480, Math.round((workbenchRef.current?.clientWidth ?? 1200) * 0.65))
              document.body.style.cursor = 'col-resize'
              const onMove = (ev: PointerEvent) => {
                setSplitWidth(Math.max(300, Math.min(maxW, Math.round(startWidth + (ev.clientX - startX)))))
              }
              const onUp = () => {
                document.body.style.cursor = ''
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          >
            <span className="iot-split-grip" aria-hidden="true" />
          </div>
        )}

        {focusMode !== 'editor' && (
          <WebDevPreviewPane
            key={activeMissionId ?? activeProjectId ?? 'blank'}
            files={files}
            lang={lang}
            execRunId={execState.runId}
            renderReady={execState.renderReady}
            activeSubTab={previewSubTab}
            onSubTabChange={setPreviewSubTab}
            consoleLines={execState.consoleLines}
            pythonLines={execState.pythonLines}
            initialDomUpdates={execState.initialDomUpdates}
            initialPatches={execState.initialPatches}
            jsSession={execState.jsSession}
            bindings={execState.bindings}
            reactModel={execState.reactModel}
            apiRoutes={execState.apiRoutes}
            sqlTables={execState.sqlTables}
            sqlLogs={execState.sqlLogs}
            httpLogs={httpLogs}
            onExecuteAll={() => executeAll()}
            onHttpTested={(entry) => {
              setApiTested(true)
              setHttpLogs((prev) => [entry, ...prev].slice(0, 20))
            }}
            onConsoleLogAdded={(line) => {
              setExecState((prev) => ({
                ...prev,
                consoleLines: [...prev.consoleLines, line],
              }))
            }}
          />
        )}
      </div>
    </div>
  )
}
