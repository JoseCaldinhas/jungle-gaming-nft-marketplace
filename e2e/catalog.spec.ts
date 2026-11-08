import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('busca e filtro ficam na URL e sobrevivem ao refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Categoria').selectOption('games')
  await expect(page).toHaveURL(/category=games/)
  await page.reload()
  await expect(page.getByLabel('Categoria')).toHaveValue('games')
  await expect(page.locator('.nft-card h2').first()).toContainText('Pixel Punk #002')
})

test('NFT inexistente mostra erro tratado', async ({ page }) => {
  await page.goto('/nft/nao-existe')
  await expect(page.getByRole('alert')).toContainText('NFT não encontrado')
})

test('carrinho exige login e volta ao fluxo anterior', async ({ page }) => {
  await page.goto('/cart')
  await expect(page).toHaveURL(/\/login/)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/cart/)
  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
})
