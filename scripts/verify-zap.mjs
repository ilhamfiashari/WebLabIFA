import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

const proxy = process.env.ZAP_PROXY
assert.equal(proxy, 'http://127.0.0.1:8090', 'ZAP harus memakai loopback fixture')
async function api(path, params = {}) {
  const url = new URL(path, proxy)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  assert(response.ok, 'ZAP API tidak tersedia')
  const body = await response.json()
  assert(!body.code, 'ZAP API mengembalikan kegagalan')
  return body
}
await mkdir('reports', { recursive: true })
// Keep only aggregate coverage evidence, never request bodies/cookies.
const traffic = await api('/JSON/core/view/messages/', { baseurl: 'http://127.0.0.1:5173/api/me', start: '0', count: '1000' })
const authenticated = (traffic.messages ?? []).filter(message => /^HTTP\/\S+ 200\b/.test(message.responseHeader))
assert(authenticated.length > 0, 'Cakupan terautentikasi /api/me belum tercatat melalui ZAP')
await writeFile('reports/zap-auth-coverage.json', JSON.stringify({ endpoint: '/api/me', authenticated_responses: authenticated.length, environment: 'loopback-oidc-fixture', timestamp: new Date().toISOString() }, null, 2))
const started = await api('/JSON/automation/action/runPlan/', { filePath: '/zap/wrk/security/zap.yaml' })
assert(started.planId !== undefined, 'ZAP tidak mengembalikan planId')
let finished = false
for (let i = 0; i < 600; i++) {
  const progress = await api('/JSON/automation/view/planProgress/', { planId: String(started.planId) })
  if (progress.finished) {
    assert.equal((progress.errors ?? []).length, 0, 'Automation Framework belum lengkap')
    finished = true; break
  }
  await setTimeout(1000)
}
assert(finished, 'Automation Framework kehabisan waktu')
const alerts = await api('/JSON/core/view/alerts/', { baseurl: 'http://127.0.0.1:5173', start: '0', count: '10000' })
const findings = (alerts.alerts ?? []).map(({ alert, risk, url, pluginId }) => ({ alert, risk, path: new URL(url).pathname, pluginId }))
await writeFile('reports/zap-findings.json', JSON.stringify(findings, null, 2))
assert(!findings.some(finding => finding.risk === 'High'), 'DAST menemukan risiko High')
console.log('ZAP selesai; cakupan sesi terautentikasi tersedia pada reports/')
