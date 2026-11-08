import type { Cart, Nft, Order, Receipt } from '@/types/contracts'
import { initialNfts, initialUsers } from './fixtures'

export interface PaymentMethod {id:string;name:string;address:string;network:string;primary:boolean;type?:'crypto'|'card';last4?:string;expiry?:string}
interface DbUser { id: string; name: string; email: string; passwordHash: string; avatarUrl?: string }

interface Db {
  wallets?: Record<string, PaymentMethod[]>
  nfts: Nft[]
  users: DbUser[]
  carts: Record<string, Cart> // por userId (isolamento)
  coupons: Record<string, string | undefined> // userId -> cupom
  favorites: Record<string, string[]>
  orders: Record<string, Order & { userId: string }>
  idempotency: Record<string, { bodyHash: string; orderId: string }>
  sessions: Record<string, string> // token -> userId
}

const KEY = 'mock-db-kurio-v2'

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function seed(): Promise<Db> {
  const users: DbUser[] = []
  for (const u of initialUsers) {
    users.push({ id: u.id, name: u.name, email: u.email, passwordHash: await sha256(u.password) })
  }
  return {
    nfts: structuredClone(initialNfts), users,
    wallets: {}, carts: {}, coupons: {}, favorites: {}, orders: {}, idempotency: {}, sessions: {},
  }
}

let db: Db

export async function initDb() {
  const raw = localStorage.getItem(KEY)
  db = raw ? (JSON.parse(raw) as Db) : await seed()
  // Migração não destrutiva: novas obras aparecem em instalações V10 existentes.
  for (const nft of initialNfts) if (!db.nfts.some(n => n.id === nft.id)) db.nfts.push(structuredClone(nft))
  persist()
}

export const getDb = () => db
export const persist = () => localStorage.setItem(KEY, JSON.stringify(db))

/** Reset restaura integralmente o cenário conhecido */
export async function resetDb() {
  db = await seed()
  persist()
}

export type { Receipt }
