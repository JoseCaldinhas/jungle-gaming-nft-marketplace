/** Carrinho do visitante, persistido até a autenticação. */
import { api } from './api'
import type { CartItem } from '@/types/contracts'
const KEY = 'kurio-guest-cart-v1'
export function guestItems(): CartItem[] {
  try { const data = JSON.parse(localStorage.getItem(KEY) || '[]') as CartItem[]; return Array.isArray(data) ? data : [] } catch { return [] }
}
export function addGuestItem(nftId: string, quantity: number, stock: number) {
  const items = guestItems(); const existing = items.find(i => i.nftId === nftId)
  const next = Math.min(stock, (existing?.quantity ?? 0) + quantity)
  localStorage.setItem(KEY, JSON.stringify([...items.filter(i => i.nftId !== nftId), { nftId, quantity: next }]))
}
export async function mergeGuestCart() {
  const items = guestItems()
  if (!items.length) return
  const { data: cart } = await api.get<{ items: CartItem[] }>('/cart')
  for (const item of items) {
    const current = cart.items.find(i => i.nftId === item.nftId)?.quantity ?? 0
    try { await api.put(`/cart/items/${item.nftId}`, { quantity: current + item.quantity }) }
    catch { return } // preserve unsynced items; do not silently lose purchases
  }
  localStorage.removeItem(KEY)
}
