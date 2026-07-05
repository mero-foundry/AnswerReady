import { expect, test } from '@playwright/test'

test('scans a public URL and exposes checkout state', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'AI Search Readiness Score' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Audit a website' }).fill('https://example.com')
  await page.getByRole('button', { name: /scan website/i }).click()

  await expect(page.getByText(/Heuristic report generated|AI-enhanced report generated/)).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.locator('#audit-url')).toHaveValue('https://example.com/')
  await expect(page.locator('.big-score')).toContainText('/100')

  await page.getByRole('button', { name: /^Unlock full report$/i }).click()
  await expect(page.getByText(/Add STRIPE_PAYMENT_LINK/)).toBeVisible()
  expect(consoleErrors).toEqual([])
})
