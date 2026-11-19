export type WebDevFileLang = 'html' | 'css' | 'js' | 'jsx' | 'python' | 'sql' | 'json' | 'text'

export interface WebDevFile {
  name: string
  content: string
}

export interface WebDevCheckItem {
  id: string
  labelId: string
  labelEn: string
  passed: boolean
}

export interface WebDevExecutionContext {
  files: WebDevFile[]
  renderReady: boolean
  apiTested: boolean
  sqlExecuted: boolean
  activeUrl: string
  apiRoutes: WebDevFastApiRoute[]
  sqlTables: WebDevSqlTable[]
  consoleLines: string[]
  pythonLines: string[]
}

export interface WebDevMissionSpec {
  id: string
  order: number
  codeTag: string
  titleId: string
  titleEn: string
  stackBadge: string
  xp: number
  requiredXp: number
  prerequisiteId: string | null
  objectiveId: string
  objectiveEn: string
  requiresApiTest?: boolean
  requiresSql?: boolean
  defaultFocusTab?: 'preview' | 'console' | 'api' | 'db'
  starterFiles: WebDevFile[]
  evaluate: (ctx: WebDevExecutionContext) => WebDevCheckItem[]
}

export interface WebDevFastApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  handlerName: string
  summary: string
  sampleResponse: unknown
}

export interface WebDevSqlTable {
  name: string
  columns: string[]
  rows: Array<Record<string, string | number | boolean | null>>
}

export interface WebDevHttpLog {
  id: string
  method: 'GET' | 'POST'
  path: string
  status: number
  body: string
  at: string
}

export interface WebDevMissionAccessState {
  mission_id: string
  order: number
  title: string
  xp: number
  required_xp: number
  unlocked: boolean
  completed: boolean
  lock_reason?: string | null
}

export interface WebDevAchievementBadge {
  id: string
  key: string
  title: string
  detail: string
  xp: number
  earned: boolean
}

export interface SavedWebDevProject {
  id: string
  title: string
  mission_id?: string | null
  files: WebDevFile[]
  updated_at: string
  owner_id?: string
  owner_name?: string
  owner_email?: string
  class_id?: string
}

export interface WebDevStudioAccess {
  can_access_web_labs: boolean
  can_submit_assignments: boolean
  is_instructor: boolean
}
