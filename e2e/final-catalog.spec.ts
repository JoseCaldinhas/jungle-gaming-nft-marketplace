import { test, expect } from '@playwright/test'

test('catálogo contém os três NFTs originais sem remover os existentes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Novos lançamentos' }).click()
  await expect(page.getByText('Classic Ape #001')).toBeVisible()
  await expect(page.getByText('Retro Shades #002')).toBeVisible()
  await expect(page.getByText('Bucket Hat #003')).toBeVisible()
})
