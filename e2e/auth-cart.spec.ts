import { test, expect } from '@playwright/test'

test('visitante vê Entrar, autentica e vê Sair', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /entrar/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
  await page.getByRole('link', { name: /entrar/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
})

test('carrinho exige autenticação e volta ao destino após login', async ({ page }) => {
  await page.goto('/cart')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/cart/)
  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
})
