import { ApiError } from '../api'

export type LevelId = 'easy' | 'medium' | 'hard' | 'impossible'
export type StepId = 'pahami' | 'uji' | 'perbaiki' | 'verifikasi' | 'refleksi'

export interface OwaspCategory {
  code: string
  name: string
  summary: string
}

export interface LabLevelProgress {
  level: LevelId
  label: string
  xp: number
  passed: boolean
  unlocked?: boolean
  unlock_requirement?: string | null
  best_score: number | null
  active_session_id: string | null
  current_step: StepId | null
}

export interface LabSummary {
  id: string
  track: 'web' | 'iot'
  owasp_code: string | null
  title: string
  subtitle: string
  objective: string
  cwe_id: string
  wstg_ref: string
  asvs_ref: string
  estimated_minutes: number
  prerequisite: string
  publication_status: string
  version: string
  passed_levels: number
  total_levels: number
  levels: LabLevelProgress[]
}

export interface CatalogResponse {
  gamification_enabled?: boolean
  categories: OwaspCategory[]
  labs: LabSummary[]
  recent_session: {
    id: string
    lab_id: string
    level_id: LevelId
    current_step: StepId
    updated_at: string
  } | null
}

export interface TrustNode {
  id: string
  label: string
  zone: string
  role: string
}

export interface TrustEdge {
  from: string
  to: string
  label: string
  boundary?: boolean
  crosses_boundary?: boolean
}

export interface CodeStackSpec {
  stack: string
  vulnerable_file: string
  vulnerable_code: string
  vulnerable_explain: string
  fixed_file: string
  fixed_code: string
  fixed_explain: string
}

export interface LabLevelDetail extends LabLevelProgress {
  title: string
  scenario: string
  initial_control: string
  expected_baseline: string
  expected_exploit: string
}

export interface LabDetailResponse {
  id: string
  track: 'web' | 'iot'
  owasp_code: string | null
  title: string
  subtitle: string
  objective: string
  context: string
  cwe_id: string
  wstg_ref: string
  asvs_ref: string
  estimated_minutes: number
  prerequisite: string
  fixture_actors: string[]
  trust_nodes: TrustNode[]
  trust_edges: TrustEdge[]
  code_stacks: CodeStackSpec[]
  levels: LabLevelDetail[]
  gamification_enabled?: boolean
  solution_unlocked: boolean
  official_summary: string | null
}

export interface PatchOption {
  id: string
  label: string
  summary: string
  is_secure: boolean | null
  feedback: string | null
}

export interface VerificationRow {
  case_id: string
  category: string
  scenario: string
  input: string
  expected: string
  before_result: string
  after_result: string
  evidence: string
  passed: boolean
}

export interface VerificationReport {
  rows: VerificationRow[]
  all_passed: boolean
  passed_count: number
  total_count: number
}

export interface RubricBreakdown {
  pahami: number
  uji: number
  perbaiki: number
  verifikasi: number
  refleksi: number
  total: number
  passed: boolean
}

export interface TraceStep {
  stage: string
  component: string
  decision: string
  detail: string
  tone: 'info' | 'good' | 'warn' | 'bad'
}

export interface ProbeOutcome {
  request: {
    method: string
    path: string
    headers: [string, string][]
    body: string
  }
  response: {
    status: number
    status_text: string
    headers: [string, string][]
    body: string
    correlation_id: string
  }
  events: TraceStep[]
  visual_data: Record<string, unknown>
  baseline_captured: boolean
  exploit_proved: boolean
  is_legitimate: boolean
  updated_state: Record<string, unknown>
}

export interface SessionDetailResponse {
  session: {
    id: string
    lab_id: string
    level_id: LevelId
    level_label: string
    xp_reward: number
    gamification_enabled?: boolean
    scenario_version: string
    current_step: StepId
    selected_patch: string | null
    hypothesis: string | null
    diagnosis: string | null
    hints_opened: number
    baseline_recorded: boolean
    exploit_proved: boolean
    verification_passed: boolean
    reflection_submitted: boolean
    score: number | null
    passed: boolean
    state: Record<string, unknown>
    verification: VerificationRow[]
    reflection: {
      root_cause?: string
      evidence?: string
      transfer?: string
      rubric?: RubricBreakdown
    }
    row_version: number
    started_at: string
    updated_at: string
    completed_at: string | null
  }
  lab: {
    id: string
    track: 'web' | 'iot'
    owasp_code: string | null
    title: string
    subtitle: string
    objective: string
    context: string
    cwe_id: string
    wstg_ref: string
    asvs_ref: string
    fixture_actors: string[]
    trust_nodes: TrustNode[]
    trust_edges: TrustEdge[]
    code_stacks: CodeStackSpec[]
    patch_options: PatchOption[]
    unlocked_hints: string[]
    total_hints: number
    level_spec: {
      title: string
      scenario: string
      initial_control: string
      pahami_prompt: string
      hypothesis_options: string[]
      probe_instruction: string
      diagnosis_options: string[]
      expected_baseline: string
      expected_exploit: string
      correct_hypothesis: number | null
      correct_diagnosis: number | null
    }
    reflection_spec: {
      root_cause_prompt: string
      evidence_prompt: string
      transfer_question: string
      official_summary: string | null
      key_takeaways: string[] | null
    }
  }
}

export interface ProbeInput {
  action?: string
  actor?: string
  target?: string
  payload?: string
  secondary?: string
  stack?: string
  parallel?: boolean
  advance_minutes?: number
}

export interface StudentDashboardResponse {
  kpis: {
    labs_completed: number
    labs_total: number
    levels_passed: number
    levels_total: number
    assignments_done: number
    assignments_total: number
    xp: number
  }
  continue_session: {
    id: string
    lab_id: string
    lab_title: string
    level_id: LevelId
    current_step: StepId
    updated_at: string
  } | null
  activity_series: Array<{ label: string; value: number }>
  score_series: Array<{
    session_id: string
    lab_id: string
    level_id: LevelId
    score: number
    passed: boolean
    date: string
  }>
  owasp_map: Array<{
    code: string
    name: string
    done_levels: number
    total_levels: number
    status: string
  }>
  assignments: Array<{
    id: string
    class_id: string
    title: string
    lab_id: string
    required_level: LevelId
    due_at: string
    pass_threshold: number
    status: string
    session_id: string | null
  }>
  badges: Array<{ id: string; title: string; detail: string; earned: boolean }>
  recent_sessions: Array<{
    id: string
    lab_id: string
    lab_title: string
    level_id: LevelId
    current_step: StepId
    score: number | null
    passed: boolean
    updated_at: string
  }>
}

export interface InstructorLeaderboardEntry {
  rank: number
  user_id: string
  name: string
  email: string
  nim?: string
  class_id: string
  xp: number
  total_xp?: number
  badges_count: number
  levels_passed: number
  web_passed: number
  iot_passed: number
  sessions_completed: number
  avg_score: number
  graded_count?: number
  last_active: string | null
  is_self?: boolean
}

export interface StudentLeaderboardResponse {
  classes: Array<{ id: string; name: string; course: string }>
  selected_class: string
  my_rank: {
    rank: number | null
    total_students: number
    xp: number
    avg_score: number
    levels_passed: number
    badges_count: number
  }
  entries: InstructorLeaderboardEntry[]
}

export interface InstructorDashboardResponse {
  classes: Array<{ id: string; name: string; course: string; semester: string; timezone: string }>
  selected_class: string
  kpis: {
    students_enrolled: number
    active_students: number
    assignments_passed: number
    assignments_total: number
    avg_score: number | null
  }
  assignments: Array<{
    id: string
    title: string
    lab_id: string
    required_level: LevelId
    due_at: string
    pass_threshold: number
    not_started: number
    running: number
    passed: number
    denominator: number
  }>
  score_histogram: Array<{ label: string; count: number }>
  ungraded_count: number
  weekly_activity?: Array<{ label: string; value: number }>
  track_breakdown?: { web_sessions: number; iot_sessions: number; web_passed: number; iot_passed: number }
  owasp_mastery?: Array<{ code: string; title: string; passed_count: number; total_attempts: number }>
  leaderboard?: InstructorLeaderboardEntry[]
  student_rows: Array<{
    session_id: string | null
    user_id: string
    name: string
    email: string
    class_id?: string | null
    track?: 'web' | 'iot' | null
    lab_id: string | null
    level_id: LevelId | null
    current_step: StepId | null
    score: number | null
    passed: boolean
    reflection_submitted: boolean
    updated_at: string | null
  }>
}

export interface AdminDashboardResponse {
  kpis: {
    active_accounts: number
    total_accounts: number
    active_classes: number
    published_labs: number
    owasp_covered: number
    total_sessions: number
  }
  role_counts: {
    mahasiswa: number
    dosen: number
    admin: number
  }
  users: Array<{
    id: string
    name: string
    email: string
    active: boolean
    roles: string[]
    created_at: string
  }>
  classes: Array<{
    id: string
    name: string
    course: string
    semester: string
    timezone: string
    leaderboard_enabled: boolean
    active: boolean
  }>
  modules: Array<{
    lab_id: string
    title: string
    track: string
    owasp_code: string | null
    status: string
    version: string
  }>
  audit_logs: Array<{
    id: string
    kind: string
    title: string
    target: string
    result: string
    created_at: string
  }>
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}

async function postJson<T>(url: string, csrf: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}

async function deleteJson<T>(url: string, csrf: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrf },
  })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}

export interface AccountPasskey {
  id: string
  credential_id: string
  device_name: string
  transports: string
  created_at: string
  last_used_at: string | null
}

export interface ActiveSessionRow {
  session_id: string
  active_role: string
  ip_address: string | null
  device_label: string | null
  location_label: string | null
  current_path: string | null
  mfa_verified: boolean
  created_at: string
  last_seen_at: string
  expires_at: string
  is_current?: boolean
  user_id?: string
  user_name?: string
  email?: string
}

export interface EmailNotificationRow {
  id: string
  recipient_email: string
  category: 'assignment' | 'feedback' | 'security_alert' | 'system'
  subject: string
  body_preview: string
  status: string
  created_at: string
  sent_at: string | null
  read_at: string | null
}

export interface UserActivityLogRow {
  id: string
  user_id: string | null
  actor_email: string | null
  user_name: string | null
  action: string
  route_path: string | null
  ip_address: string | null
  device_label: string | null
  location_label: string | null
  anomaly_flag: boolean
  detail: string
  created_at: string
}

export interface SecurityAnomalyRow {
  id: string
  user_id: string | null
  actor_email: string | null
  user_name: string | null
  kind: string
  severity: 'low' | 'medium' | 'high'
  summary: string
  ip_address: string | null
  device_label: string | null
  location_label: string | null
  acknowledged: boolean
  created_at: string
}

export interface AccountSecurityResponse {
  primary_email: string
  secondary_email: string | null
  notify_assignments: boolean
  notify_feedback: boolean
  notify_security_alerts: boolean
  mfa_enabled: boolean
  totp_verified: boolean
  backup_codes_remaining: number
  backup_hash_algorithm?: string
  passkeys: AccountPasskey[]
  sessions: ActiveSessionRow[]
  notifications: EmailNotificationRow[]
  recent_activity: UserActivityLogRow[]
}

export interface AdminSecurityMonitorResponse {
  summary: {
    active_sessions: number
    unacknowledged_anomalies: number
    mfa_enabled_users: number
    emails_sent_total: number
  }
  active_sessions: ActiveSessionRow[]
  activity_logs: UserActivityLogRow[]
  anomalies: SecurityAnomalyRow[]
}

export const simApi = {
  getCatalog(params?: { q?: string; track?: string; category?: string }) {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.track) sp.set('track', params.track)
    if (params?.category) sp.set('category', params.category)
    const qs = sp.toString()
    return getJson<CatalogResponse>(`/api/labs/catalog${qs ? `?${qs}` : ''}`)
  },
  getLabDetail(labId: string) {
    return getJson<LabDetailResponse>(`/api/labs/${encodeURIComponent(labId)}`)
  },
  startSession(csrf: string, labId: string, levelId: LevelId, forceNew = false) {
    return postJson<{ session_id: string; resumed: boolean }>('/api/labs/sessions', csrf, {
      lab_id: labId,
      level_id: levelId,
      force_new: forceNew,
    })
  },
  getSession(sessionId: string) {
    return getJson<SessionDetailResponse>(`/api/labs/sessions/${encodeURIComponent(sessionId)}`)
  },
  updateStep(
    csrf: string,
    sessionId: string,
    body: {
      row_version: number
      current_step?: StepId
      hypothesis?: string
      diagnosis?: string
      selected_patch?: string
    },
  ) {
    return postJson<{ row_version: number; current_step: StepId; selected_patch: string | null }>(
      `/api/labs/sessions/${encodeURIComponent(sessionId)}/step`,
      csrf,
      body,
    )
  },
  probe(csrf: string, sessionId: string, rowVersion: number, input: ProbeInput) {
    return postJson<{
      row_version: number
      baseline_recorded: boolean
      exploit_proved: boolean
      outcome: ProbeOutcome
    }>(`/api/labs/sessions/${encodeURIComponent(sessionId)}/probe`, csrf, {
      row_version: rowVersion,
      input,
    })
  },
  unlockHint(csrf: string, sessionId: string, rowVersion: number) {
    return postJson<{ row_version: number; hints_opened: number; unlocked_hints: string[] }>(
      `/api/labs/sessions/${encodeURIComponent(sessionId)}/hint`,
      csrf,
      { row_version: rowVersion },
    )
  },
  verify(csrf: string, sessionId: string, rowVersion: number) {
    return postJson<{ row_version: number; report: VerificationReport }>(
      `/api/labs/sessions/${encodeURIComponent(sessionId)}/verify`,
      csrf,
      { row_version: rowVersion },
    )
  },
  reflect(
    csrf: string,
    sessionId: string,
    body: { row_version: number; root_cause: string; evidence: string; transfer: string },
  ) {
    return postJson<{
      row_version: number
      rubric: RubricBreakdown
      xp_awarded_now: number
      badges_unlocked_now: string[]
      official_summary: string | null
      key_takeaways: string[] | null
    }>(`/api/labs/sessions/${encodeURIComponent(sessionId)}/reflect`, csrf, body)
  },
  resetSession(csrf: string, sessionId: string, rowVersion: number) {
    return postJson<{ row_version: number; state: Record<string, unknown> }>(
      `/api/labs/sessions/${encodeURIComponent(sessionId)}/reset`,
      csrf,
      { row_version: rowVersion },
    )
  },
  getStudentDashboard() {
    return getJson<StudentDashboardResponse>('/api/dashboard/student')
  },
  getStudentLeaderboard(classId?: string) {
    const qs = classId ? `?class_id=${encodeURIComponent(classId)}` : ''
    return getJson<StudentLeaderboardResponse>(`/api/student/leaderboard${qs}`)
  },
  getStudentHistory() {
    return getJson<{
      items: Array<{
        id: string
        lab_id: string
        lab_title: string
        owasp_code: string | null
        level_id: LevelId
        current_step: StepId
        selected_patch: string | null
        score: number | null
        passed: boolean
        verification: VerificationRow[]
        reflection: Record<string, unknown>
        updated_at: string
        completed_at: string | null
      }>
    }>('/api/student/history')
  },
  getInstructorDashboard(classId?: string) {
    const qs = classId ? `?class_id=${encodeURIComponent(classId)}` : ''
    return getJson<InstructorDashboardResponse>(`/api/dashboard/instructor${qs}`)
  },
  createAssignment(
    csrf: string,
    body: {
      class_id: string
      title: string
      lab_id: string
      required_level: LevelId
      due_in_days: number
      pass_threshold: number
    },
  ) {
    return postJson<{ id: string; class_id: string; title: string }>(
      '/api/dosen/assignments',
      csrf,
      body,
    )
  },
  addFeedback(csrf: string, sessionId: string, comment: string) {
    return postJson<{ id: string; comment: string }>(
      `/api/dosen/sessions/${encodeURIComponent(sessionId)}/feedback`,
      csrf,
      { comment },
    )
  },
  getDosenLabs() {
    return getJson<{ labs: unknown[] }>('/api/dosen/labs')
  },
  triggerDosenSeed(csrf: string) {
    return postJson<{
      students_seeded: number
      sessions_seeded: number
      assignments_seeded: number
      message: string
    }>('/api/dosen/seed', csrf, {})
  },
  getAdminDashboard() {
    return getJson<AdminDashboardResponse>('/api/dashboard/admin')
  },
  triggerAdminSeed(csrf: string) {
    return postJson<{
      students_seeded: number
      sessions_seeded: number
      assignments_seeded: number
      message: string
    }>('/api/admin/seed', csrf, {})
  },
  setUserStatus(csrf: string, userId: string, active: boolean) {
    return postJson<{ user_id: string; email: string; active: boolean }>(
      `/api/admin/users/${encodeURIComponent(userId)}/status`,
      csrf,
      { active },
    )
  },
  saveClass(csrf: string, body: { id: string; name: string; course: string; semester: string }) {
    return postJson<{ id: string; name: string }>('/api/admin/classes', csrf, body)
  },
  setModuleStatus(csrf: string, labId: string, status: string) {
    return postJson<{ lab_id: string; status: string }>(
      `/api/admin/catalog/${encodeURIComponent(labId)}/status`,
      csrf,
      { status },
    )
  },
  getSecuritySettings() {
    return getJson<AccountSecurityResponse>('/api/account/security')
  },
  updateEmailPrefs(
    csrf: string,
    body: {
      secondary_email: string | null
      notify_assignments: boolean
      notify_feedback: boolean
      notify_security_alerts: boolean
    },
  ) {
    return postJson<{ ok: boolean; secondary_email: string | null }>(
      '/api/account/security/preferences',
      csrf,
      body,
    )
  },
  enrollTotp(csrf: string) {
    return postJson<{ secret: string; otpauth_uri: string; issuer: string; account: string }>(
      '/api/account/security/totp/enroll',
      csrf,
      {},
    )
  },
  verifyTotpEnable(csrf: string, code: string) {
    return postJson<{ mfa_enabled: boolean; totp_verified: boolean }>(
      '/api/account/security/totp/verify',
      csrf,
      { code },
    )
  },
  disableTotp(csrf: string) {
    return postJson<{ mfa_enabled: boolean; totp_verified: boolean }>(
      '/api/account/security/totp/disable',
      csrf,
      {},
    )
  },
  regenerateBackupCodes(csrf: string) {
    return postJson<{ codes: string[]; remaining: number }>(
      '/api/account/security/backup-codes/regenerate',
      csrf,
      {},
    )
  },
  verifyMfaCode(csrf: string, code: string) {
    return postJson<{ verified: boolean; method: string }>(
      '/api/account/security/mfa/verify',
      csrf,
      { code },
    )
  },
  challengePasskey(csrf: string) {
    return postJson<{
      challenge: string
      rp_name: string
      user_id: string
      user_name: string
      user_display_name: string
    }>('/api/account/security/passkeys/challenge', csrf, {})
  },
  registerPasskey(
    csrf: string,
    body: { credential_id: string; device_name: string; transports?: string },
  ) {
    return postJson<{ id: string; device_name: string }>(
      '/api/account/security/passkeys',
      csrf,
      body,
    )
  },
  deletePasskey(csrf: string, passkeyId: string) {
    return deleteJson<{ deleted: boolean }>(
      `/api/account/security/passkeys/${encodeURIComponent(passkeyId)}`,
      csrf,
    )
  },
  revokeMySession(csrf: string, sessionId: string) {
    return postJson<{ revoked: boolean }>(
      `/api/account/sessions/${encodeURIComponent(sessionId)}/revoke`,
      csrf,
      {},
    )
  },
  updatePresence(csrf: string, path: string) {
    return postJson<{ ok: boolean; path: string }>('/api/account/presence', csrf, { path })
  },
  getNotifications() {
    return getJson<{ items: EmailNotificationRow[]; unread: number }>('/api/notifications')
  },
  markNotificationsRead(csrf: string, id?: string) {
    return postJson<{ ok: boolean }>('/api/notifications/read', csrf, { id: id ?? null })
  },
  getAdminSecurityMonitor() {
    return getJson<AdminSecurityMonitorResponse>('/api/admin/security-monitor')
  },
  adminRevokeSession(csrf: string, sessionId: string) {
    return postJson<{ revoked: boolean; session_id: string }>(
      `/api/admin/sessions/${encodeURIComponent(sessionId)}/revoke`,
      csrf,
      {},
    )
  },
  adminAckAnomaly(csrf: string, anomalyId: string) {
    return postJson<{ acknowledged: boolean; id: string }>(
      `/api/admin/anomalies/${encodeURIComponent(anomalyId)}/ack`,
      csrf,
      {},
    )
  },
  exportAccountBackup() {
    return getJson<Record<string, unknown>>('/api/account/backup')
  },
  exportAdminBackup() {
    return getJson<Record<string, unknown>>('/api/admin/backup')
  },
}
