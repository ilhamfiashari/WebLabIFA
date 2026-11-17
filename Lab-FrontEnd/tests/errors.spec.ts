import { expect, test } from '@playwright/test'
import { ERROR_STATUSES, ERROR_VISUALS } from '../src/shared/errors/error-status'

for (const status of [400, 403, 405, 408, 409, 410, 413, 415, 422, 423, 429, 500, 501, 502, 503, 504, 507, 508, 511]) {
  test(`shared error layout HTTP ${status} and retry`, async ({ page }) => {
    let calls = 0
    await page.route('**/api/me', route => { calls++; return route.fulfill({ status, json: { message: 'fixture' } }) })
    await page.goto('/lab')
    await expect(page.getByText(`HTTP ${status}`, { exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('.err-illustration')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kembali ke Beranda' })).toHaveAttribute('href', '/login')
    const before = calls
    await page.getByRole('button', { name: 'Coba Lagi', exact: true }).click()
    await expect.poll(() => calls).toBeGreaterThan(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('all error examples have distinct artwork, localized copy and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const artworks = new Set<string>()
  for (const status of ERROR_STATUSES) {
    await page.goto(`/__preview/errors?status=${status}`)
    await expect(page.getByText(`HTTP ${status}`, { exact: true })).toBeVisible()
    const art = page.locator('.err-illustration')
    await expect(art).toHaveAttribute('data-error-art', ERROR_VISUALS[status])
    artworks.add(await art.evaluate(el => el.innerHTML))
    expect(await page.locator('.err-browser-float').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
    await page.screenshot({ path: `/private/tmp/lab-error-${status}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Switch language to English' }).click()
    await expect(page.getByRole('button', { name: 'Try Again', exact: true })).toBeVisible()
    await expect(page).not.toHaveTitle(/undefined/)
    await page.getByRole('button', { name: 'Ganti bahasa ke Indonesia' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Coba Lagi', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  expect(artworks.size).toBe(ERROR_STATUSES.length)
})

test('404 layout, localization, links and reduced motion at all widths', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Dokumentasi|Praktikum|Modul/ })).toHaveCount(0)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Coba Lagi', exact: true })).toBeVisible()
    await page.screenshot({ path: `/private/tmp/lab-error-404-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Switch language to English' }).click()
  await expect(page.getByRole('heading', { name: 'Page Not Found', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Page Not Found · IFA Lab')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.err-browser-float').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/')
})
