// Local test provider only. No imports from the application runtime.
import { createServer } from 'node:http'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

const issuer = 'http://127.0.0.1:9090'
const redirectUri = 'http://127.0.0.1:5173/api/auth/google/callback'
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture-key', use: 'sig', alg: 'RS256' }
const codes = new Map()
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const server = createServer(async (req, res) => {
  const url = new URL(req.url, issuer)
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  if (url.pathname === '/.well-known/openid-configuration') return json(200, {
    issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid', 'email', 'profile'],
  })
  if (url.pathname === '/jwks') return json(200, { keys: [jwk] })
  if (url.pathname === '/authorize') {
    if (url.searchParams.get('client_id') !== 'ifa-fixture' || url.searchParams.get('redirect_uri') !== redirectUri || url.searchParams.get('code_challenge_method') !== 'S256' || url.searchParams.get('response_type') !== 'code') return json(400, { error: 'invalid_request' })
    const target = new URL(redirectUri)
    target.searchParams.set('state', url.searchParams.get('state') ?? '')
    const scenario = url.searchParams.get('scenario') ?? 'success'
    if (scenario === 'cancelled') target.searchParams.set('error', 'access_denied')
    else {
      const code = randomBytes(32).toString('hex')
      codes.set(code, { nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge'), scenario, expires: Date.now() + 60_000 })
      target.searchParams.set('code', code)
    }
    res.writeHead(302, { Location: target.href }); return res.end()
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    if (req.headers.authorization !== `Basic ${Buffer.from('ifa-fixture:fixture-secret').toString('base64')}`) return json(401, { error: 'invalid_client' })
    let raw = ''
    for await (const chunk of req) { raw += chunk; if (raw.length > 8192) { res.writeHead(413); return res.end() } }
    const body = new URLSearchParams(raw)
    const record = codes.get(body.get('code')); codes.delete(body.get('code'))
    if (!record || record.expires < Date.now() || body.get('redirect_uri') !== redirectUri || body.get('grant_type') !== 'authorization_code' || createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url') !== record.challenge) return json(400, { error: 'invalid_grant' })
    const scenario = record.scenario
    const now = Math.floor(Date.now() / 1000)
    const claims = { iss: scenario === 'wrong_issuer' ? 'https://invalid.test' : issuer, sub: scenario === 'inactive_account' ? 'inactive-fixture' : scenario === 'second_account' ? 'bima-fixture' : scenario === 'unauthorized_account' ? 'outsider-fixture' : 'rani-fixture', aud: scenario === 'wrong_audience' ? 'wrong-client' : 'ifa-fixture', exp: scenario === 'expired_token' ? now - 600 : now + 300, iat: now, nonce: scenario === 'wrong_nonce' ? 'wrong' : record.nonce, email: scenario === 'second_account' ? 'bima@example.test' : scenario === 'unauthorized_account' ? 'orang-lain@example.test' : 'rani@example.test', email_verified: true, name: scenario === 'second_account' ? 'Bima' : scenario === 'unauthorized_account' ? 'Orang Lain' : 'Rani' }
    if (scenario.startsWith('inactive_account_')) {
      claims.sub = scenario; claims.email = `${scenario}@example.test`
    }
    if (scenario.startsWith('student')) {
      claims.sub = 'student-fixture'; claims.name = 'Mahasiswa Uji'
      claims.email = '123140051@student.itera.ac.id'; claims.hd = 'itera.test'
      if (scenario === 'student_wrong_hd') claims.hd = 'other.test'
      if (scenario === 'student_missing_hd') delete claims.hd
      if (scenario === 'student_wrong_program') claims.email = '123141051@student.itera.ac.id'
      if (scenario === 'student_alias') claims.email = '123140051+alias@student.itera.ac.id'
      if (scenario === 'student_unverified') claims.email_verified = false
    }
    if (scenario === 'rebound_subject') claims.sub = 'rani-another-subject'
    const payload = `${encode({ alg: 'RS256', kid: 'fixture-key', typ: 'JWT' })}.${encode(claims)}`
    const signature = sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')
    return json(200, { access_token: randomBytes(32).toString('hex'), token_type: 'Bearer', expires_in: 300, id_token: `${payload}.${scenario === 'wrong_signature' ? signature.slice(0, -8) + 'AAAAAAAA' : signature}` })
  }
  return json(404, { error: 'not_found' })
})
server.listen(9090, '127.0.0.1', () => console.log('OIDC fixture ready on loopback:9090'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
