import type { Nft } from '@/types/contracts'

const categories = ['arte', 'games', 'musica', 'fotografia']
const collections = ['Kurio Apes', 'Pixel Monkeys', 'Neon Apes', 'Crypto Chimps']
const names = ['Royal Ape','Pixel Punk','Cyber Vision','Golden Crown','Ninja Shadow','Space Explorer','Mutant Bloom','Samurai Spirit','Code Hacker','Beach Club','Rock Star','Angel Wings','Neon Rider','Galaxy King','Retro Wave','Diamond Mind','Sunset Ape','Ocean Blue','Night Owl','Urban Legend','Lunar Explorer','Ruby Eyes','Digital Nomad','Emerald King','Purple Haze','Astro Pilot','Wild West','Crypto Samurai','Future Punk','Firestorm','Blue Horizon','Gold Rush','Moonwalker','Star Collector','Pixel Dream','Electric Ape']
/** Catálogo estável com lançamentos e popularidade simulados, para filtros reproduzíveis. */
export const initialNfts: Nft[] = Array.from({ length: 36 }, (_, i) => ({
  id: `nft-${i + 1}`,
  name: `${names[i]} #${String(i + 1).padStart(3, '0')}`,
  collection: collections[i % 4],
  category: categories[i % 4],
  image: `/images/kurio/collectible-${i+1}.webp`,
  priceEth: (0.18 + ((i * 17) % 47) * 0.0875).toFixed(4),
  stock: i % 11 === 0 ? 0 : (i % 5) + 1,
  createdAt: new Date(Date.UTC(2026, 9, 30) - i * 86400000).toISOString(),
  popularity: (i * 37 + 53) % 1000,
  version: 1,
})).concat([
  {id:'nft-original-1',name:'Classic Ape #001',collection:'Original Apes',category:'arte',image:'/images/kurio/original-ape-1.webp',priceEth:'0.7500',stock:3,createdAt:'2026-11-07T12:00:00.000Z',popularity:940,version:1},
  {id:'nft-original-2',name:'Retro Shades #002',collection:'Original Apes',category:'arte',image:'/images/kurio/original-ape-2.webp',priceEth:'0.8900',stock:2,createdAt:'2026-11-07T12:00:00.000Z',popularity:920,version:1},
  {id:'nft-original-3',name:'Bucket Hat #003',collection:'Original Apes',category:'arte',image:'/images/kurio/original-ape-3.webp',priceEth:'0.6900',stock:4,createdAt:'2026-11-07T12:00:00.000Z',popularity:910,version:1},
])

export const initialUsers = [
  { id: 'u1', name: 'Ana Colecionadora', email: 'ana@example.com', password: 'senha123' },
  { id: 'u2', name: 'Bruno Cripto', email: 'bruno@example.com', password: 'senha456' },
]

export const coupons: Record<string, { percent: number; expired?: boolean }> = {
  WELCOME10: { percent: 10 },
  OLD50: { percent: 50, expired: true },
}

export const NETWORK_FEE_ETH = '0.0021'
