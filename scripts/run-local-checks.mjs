// Requires TEST_DATABASE_URL; never loads the application's .env or tes.env.
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL wajib menunjuk database uji yang boleh diubah')
const children = []
const node = process.execPath
const env = { ...process.env, APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:5173', BIND_ADDR: '127.0.0.1:3008', IFA_API_URL: 'http://127.0.0.1:3008', DATABASE_URL: process.env.TEST_DATABASE_URL, MIGRATION_DATABASE_URL: process.env.TEST_DATABASE_URL, OIDC_ISSUER: 'http://127.0.0.1:9090', OIDC_CLIENT_ID: 'ifa-fixture', OIDC_CLIENT_SECRET: 'fixture-secret', ALLOWED_EMAILS: 'rani@example.test,bima@example.test', SUPPORT_EMAIL: 'lab@example.test' }
env.ITERA_WORKSPACE_DOMAIN = 'itera.test'
function start(command, args, options = {}) { const child = spawn(command, args, { stdio: 'inherit', env, ...options }); children.push(child); return child }
function run(command, args, options) { return new Promise((resolve, reject) => { const child = start(command, args, options); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} gagal: ${code}`))) }) }
async function ready(url, child) { for (let i = 0; i < 120; i++) { if (child.exitCode !== null) throw new Error('Proses uji berhenti sebelum siap'); try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* wait for owned process */ } await setTimeout(500) } throw new Error(`Layanan tidak siap: ${url}`) }
try {
  await run('cargo', ['test', '--locked'])
  const provider = start(node, ['scripts/oidc-fixture.mjs'])
  await ready('http://127.0.0.1:9090/.well-known/openid-configuration', provider)
  await run('cargo', ['test', '--locked', '--test', 'auth', '--', '--ignored'])
  await run('cargo', ['build', '--locked'])
  await run('./target/debug/ifa-lab-api', ['migrate'])
  const backend = start('./target/debug/ifa-lab-api', [])
  await ready('http://127.0.0.1:3008/api/health', backend)
  await run(node, ['scripts/verify-oidc.mjs'])
  await run(node, ['node_modules/@playwright/test/cli.js', 'test'], { cwd: 'Lab-FrontEnd', env: { ...env, RUN_OIDC_E2E: '1' } })
  if (process.env.ZAP_PROXY) await run(node, ['scripts/verify-zap.mjs'])
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill('SIGTERM')
}
