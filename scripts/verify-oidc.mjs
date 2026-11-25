// Run against a disposable, migrated PostgreSQL database and the local fixture/API.
import assert from 'node:assert/strict'

const api = process.env.IFA_API_URL ?? 'http://127.0.0.1:3008'
const origin = 'http://127.0.0.1:5173'
const cookieJar = new Map()
const cookies = () => [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; ')
async function request(path, options = {}, jar = cookieJar) {
  const response = await fetch(new URL(path, api), { redirect: 'manual', ...options, headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...options.headers } })
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';'); const [key, ...value] = pair.split('=')
    if (cookie.includes('Max-Age=0')) jar.delete(key); else jar.set(key, value.join('='))
  }
  assert.equal(response.headers.get('cache-control'), 'no-store')
  return response
}
async function begin(scenario = 'success') {
  const response = await request('/api/auth/google/start')
  assert.equal(response.status, 303)
  const auth = new URL(response.headers.get('location'))
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(auth.searchParams.get('scope').split(' ').sort().join(' '), 'email openid profile')
  auth.searchParams.set('scenario', scenario)
  const provider = await fetch(auth, { redirect: 'manual' })
  const callback = new URL(provider.headers.get('location'))
  return callback.pathname + callback.search
}
for (const scenario of ['cancelled', 'wrong_nonce', 'wrong_audience', 'wrong_issuer', 'expired_token', 'wrong_signature']) {
  const callback = await begin(scenario)
  const response = await request(callback)
  assert.match(response.headers.get('location'), /\/login\?status=(expired|cancelled)/)
  assert.equal((await request('/api/me')).status, 401)
  console.log(`PASS ${scenario}`)
}
const missing = await request('/api/auth/google/callback?code=invalid')
assert.equal(missing.headers.get('location'), '/login?status=expired')
const callback = await begin()
const altered = new URL(callback, api); altered.searchParams.set('state', 'wrong')
assert.equal((await request(altered.pathname + altered.search)).headers.get('location'), '/login?status=expired')
assert.equal((await request(callback)).headers.get('location'), '/login?status=expired')
console.log('PASS missing/wrong state and cleared browser binding')

const unauthorized = await begin('unauthorized_account')
assert.equal((await request(unauthorized)).headers.get('location'), '/login?status=unauthorized')
assert.equal((await request('/api/me')).status, 401)
console.log('PASS email outside allowlist is rejected')

const success = await begin()
const stolen = await request(success, {}, new Map())
assert.equal(stolen.headers.get('location'), '/login?status=expired')
assert.equal((await request(success)).headers.get('location'), '/lab')
const firstCookie = cookies()
const me = await request('/api/me')
assert.equal(me.status, 200)
const user = await me.json()
assert.equal(user.name, 'Rani'); assert.equal(user.role, 'dosen')
assert.deepEqual(user.allowed_roles, ['admin', 'dosen']); assert.equal(user.home_route, '/lab/dosen')
assert.equal((await request(success)).headers.get('location'), '/login?status=expired')
console.log('PASS browser binding, successful login, replay and default role')

const relogin = await begin()
assert.equal((await request(relogin)).headers.get('location'), '/lab')
assert.notEqual(cookies(), firstCookie)
const oldCookieResponse = await fetch(`${api}/api/me`, { headers: { Cookie: firstCookie } })
assert.equal(oldCookieResponse.status, 401)
console.log('PASS session rotation and revocation of previous cookie')

const fresh = await (await request('/api/me')).json()
assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.test', 'X-CSRF-Token': fresh.csrf_token } })).status, 403)
assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': 'wrong' } })).status, 403)
assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': fresh.csrf_token } })).status, 204)
assert.equal((await request('/api/me')).status, 401)
console.log('PASS logout CSRF/origin and revoked session')

const bimaCallback = await begin('second_account')
assert.equal((await request(bimaCallback)).headers.get('location'), '/lab')
const bima = await (await request('/api/me')).json()
assert.notEqual(bima.id, user.id); assert.equal(bima.name, 'Bima')
await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': bima.csrf_token } })
console.log('PASS two distinct accounts; no cross-account identity')

const rebound = await begin('rebound_subject')
assert.equal((await request(rebound)).headers.get('location'), '/login?status=unauthorized')
for (const scenario of ['student_wrong_hd', 'student_missing_hd', 'student_wrong_program', 'student_alias', 'student_unverified']) {
  assert.equal((await request(await begin(scenario))).headers.get('location'), '/login?status=unauthorized')
  assert.equal((await request('/api/me')).status, 401)
}
// Unapproved institutional student must be blocked into pending_approval before Dosen/Admin approves
assert.equal((await request(await begin('student_success'))).headers.get('location'), '/login?status=pending_approval')
assert.equal((await request('/api/me')).status, 401)
console.log('PASS unapproved student blocked into pending_approval')

// Dosen approves pending student and tests bulk import API
assert.equal((await request(await begin())).headers.get('location'), '/lab')
const approver = await (await request('/api/me')).json()
const approvalsRes = await request('/api/portal/access-requests')
assert.equal(approvalsRes.status, 200)
const approvalsBody = await approvalsRes.json()
const pendingReq = approvalsBody.requests.find(r => r.email === '123140051@student.itera.ac.id' && r.status === 'pending')
assert(pendingReq, 'Permintaan persetujuan mahasiswa harus tercatat')
const decideRes = await request(`/api/portal/access-requests/${pendingReq.id}/decide`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': approver.csrf_token },
  body: JSON.stringify({ action: 'approve', role: 'mahasiswa' }),
})
assert.equal(decideRes.status, 200)
await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': approver.csrf_token } })

assert.equal((await request(await begin('student_success'))).headers.get('location'), '/lab')
const student = await (await request('/api/me')).json()
assert.equal(student.role, 'mahasiswa'); assert.deepEqual(student.allowed_roles, ['mahasiswa'])
assert.equal(student.home_route, '/lab')
const switchRole = (role, csrf = student.csrf_token) => request('/api/session/context', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ role }) })
assert.equal((await switchRole('admin')).status, 403)
await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': student.csrf_token } })
assert.equal((await request(await begin())).headers.get('location'), '/lab')
const teacher = await (await request('/api/me')).json()
const previous = cookies()
assert.equal((await switchRole('admin', 'wrong')).status, 403)
const switched = await switchRole('admin', teacher.csrf_token)
assert.equal(switched.status, 200); assert.equal((await switched.json()).home_route, '/lab/admin')
assert.equal((await fetch(`${api}/api/me`, { headers: { Cookie: previous } })).status, 401)
const admin = await (await request('/api/me')).json()
assert.equal(admin.role, 'admin'); assert.notEqual(admin.csrf_token, teacher.csrf_token)
await request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': admin.csrf_token } })
console.log('PASS exact student policy, Workspace claims, subject binding, role escalation denied, context rotation')
