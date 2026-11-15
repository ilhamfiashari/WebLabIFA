import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, channel: process.env.CI ? 'chromium' : 'chrome', trace: 'retain-on-failure', ...(process.env.ZAP_PROXY ? { proxy: { server: process.env.ZAP_PROXY, bypass: '<-loopback>' }, launchOptions: { args: ['--proxy-bypass-list=<-loopback>'] } } : {}) },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: process.env.IFA_EXTERNAL_PREVIEW === '1' || !process.env.CI },
})
