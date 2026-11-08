import { http, HttpResponse, delay } from 'msw'
import Decimal from 'decimal.js'
import type {
  ApiErrorBody, AuthResponse, Cart, CreateOrderBody, Nft, Order, Paginated, Quote, QuoteLine,
} from '@/types/contracts'
import { getDb, persist, resetDb, sha256 } from './db'
import { coupons, NETWORK_FEE_ETH } from './fixtures'
import type { PaymentMethod } from './db'
import { getScenario, latency } from './scenarios'
import { broadcastNftUpdated, broadcastOrderUpdated, socketHandler } from './socket'

const PAGE_SIZE = 12

// Persist the pending order's immutable quote so a page reload can settle it.
// The REST handlers reconcile pending orders even when the original timer was lost.
function reconcilePendingOrders() {
  const db = getDb()
  for (const order of Object.values(db.orders)) {
    const pending = order as typeof order & { settleAt?: number; pendingQuote?: Quote; willDecline?: boolean }
    if (pending.status !== 'pending' || !pending.settleAt || Date.now() < pending.settleAt || !pending.pendingQuote) continue
    const quote = pending.pendingQuote
    if (pending.willDecline) pending.status = 'declined'
    else {
      pending.status = 'confirmed'
      pending.receipt = {
        txHash: `0x${pending.id.padEnd(64, '0')}`,
        lines: quote.lines, subtotalEth: quote.subtotalEth, discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth, totalEth: quote.totalEth, createdAt: new Date(pending.settleAt).toISOString(),
      }
      for (const line of quote.lines) {
        const nft = db.nfts.find(n => n.id === line.nftId)
        if (nft) { nft.stock -= line.quantity; nft.version += 1; broadcastNftUpdated({ nftId: nft.id, version: nft.version, priceEth: nft.priceEth, stock: nft.stock }) }
      }
      const cart = db.carts[pending.userId] ?? { items: [], version: 0 }
      cart.items = cart.items.flatMap(item => {
        const bought = quote.lines.find(line => line.nftId === item.nftId)?.quantity ?? 0
        const remaining = item.quantity - bought
        return remaining > 0 ? [{ ...item, quantity: remaining }] : []
      })
      cart.version += 1
      db.carts[pending.userId] = cart
    }
    pending.version += 1
    delete pending.pendingQuote
    persist()
    broadcastOrderUpdated({ orderId: pending.id, userId: pending.userId, version: pending.version, status: pending.status })
  }
}


const err = (status: number, body: ApiErrorBody) => HttpResponse.json(body, { status })

/** Aplica o cenário (latência, rede fora do ar) a todo handler */
async function gate() {
  const s = getScenario()
  if (s.networkError) return HttpResponse.error()
  await delay(latency())
  return null
}

function authUser(request: Request): string | null {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || getScenario().expireSession) return null
  return getDb().sessions[token] ?? null
}

const unauthorized = () => err(401, { code: 'unauthorized', message: 'Sessão inválida ou expirada.' })

function quoteFor(userId: string): Quote {
  const db = getDb()
  const cart = db.carts[userId] ?? { items: [], version: 0 }
  const lines: QuoteLine[] = cart.items.flatMap((it) => {
    const nft = db.nfts.find((n) => n.id === it.nftId)
    if (!nft) return []
    return [{
      nftId: it.nftId, quantity: it.quantity, unitPriceEth: nft.priceEth,
      lineTotalEth: new Decimal(nft.priceEth).times(it.quantity).toFixed(),
    }]
  })
  const subtotal = lines.reduce((s, l) => s.plus(l.lineTotalEth), new Decimal(0))
  const code = db.coupons[userId]
  const percent = code ? coupons[code]?.percent ?? 0 : 0
  const discount = subtotal.times(percent).div(100)
  const fee = lines.length ? new Decimal(NETWORK_FEE_ETH) : new Decimal(0)
  const total = subtotal.minus(discount).plus(fee)
  return {
    quoteId: `q-${userId}-${cart.version}-${lines.map((l) => `${l.nftId}:${l.unitPriceEth}:${l.quantity}`).join('|')}-${code ?? 'none'}`,
    lines, subtotalEth: subtotal.toFixed(), discountEth: discount.toFixed(),
    networkFeeEth: fee.toFixed(), totalEth: total.toFixed(), couponCode: code,
    version: cart.version,
  }
}

export const handlers = [
  socketHandler,

  // ---------- Ferramentas de mock (dev/demo/testes) ----------
  http.post('/api/__mock/reset', async () => { await resetDb(); return HttpResponse.json({ ok: true }) }),

  /** Altera preço/estoque e emite nft.updated pelo socket (usado em demo e Playwright) */
  http.post('/api/__mock/nft-update', async ({ request }) => {
    const { nftId, priceEth, stock } = (await request.json()) as { nftId: string; priceEth?: string; stock?: number }
    const nft = getDb().nfts.find((n) => n.id === nftId)
    if (!nft) return err(404, { code: 'not_found', message: 'NFT inexistente.' })
    if (priceEth !== undefined) nft.priceEth = priceEth
    if (stock !== undefined) nft.stock = stock
    nft.version += 1
    persist()
    broadcastNftUpdated({ nftId, version: nft.version, priceEth: nft.priceEth, stock: nft.stock })
    return HttpResponse.json(nft)
  }),

  // ---------- Sessão e conta ----------
  http.post('/api/auth/register', async ({ request }) => {
    const down = await gate(); if (down) return down
    const { name, email, password } = (await request.json()) as Record<string, string>
    const db = getDb()
    if (!name || !email?.includes('@') || (password?.length ?? 0) < 6) {
      return err(422, { code: 'validation', message: 'Dados inválidos.', fields: { email: 'E-mail inválido', password: 'Mínimo de 6 caracteres' } })
    }
    if (db.users.some((u) => u.email === email)) {
      return err(409, { code: 'conflict', message: 'E-mail já cadastrado.', fields: { email: 'E-mail já cadastrado' } })
    }
    const user = { id: `u${db.users.length + 1}`, name, email, passwordHash: await sha256(password) }
    db.users.push(user)
    const token = crypto.randomUUID()
    db.sessions[token] = user.id
    persist()
    const body: AuthResponse = { token, user: { id: user.id, name, email }, expiresAt: new Date(Date.now() + 3600_000).toISOString() }
    return HttpResponse.json(body, { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const down = await gate(); if (down) return down
    const { email, password } = (await request.json()) as Record<string, string>
    const db = getDb()
    const user = db.users.find((u) => u.email === email)
    if (!user || user.passwordHash !== (await sha256(password ?? ''))) {
      return err(401, { code: 'unauthorized', message: 'Credenciais inválidas.' })
    }
    const token = crypto.randomUUID()
    db.sessions[token] = user.id
    persist()
    const body: AuthResponse = { token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }, expiresAt: new Date(Date.now() + 3600_000).toISOString() }
    return HttpResponse.json(body)
  }),

  http.get('/api/session', async ({ request }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    const u = getDb().users.find((x) => x.id === uid)!
    return HttpResponse.json({ user: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }, expiresAt: new Date(Date.now() + 3600_000).toISOString() })
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (token) { delete getDb().sessions[token]; persist() }
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Perfil e favoritos: persistidos e isolados por sessão ----------
  http.get('/api/profile', async ({request}) => {
    const down=await gate(); if(down)return down
    const uid=authUser(request); if(!uid)return unauthorized()
    const u=getDb().users.find(u=>u.id===uid)!
    return HttpResponse.json({id:u.id,name:u.name,email:u.email,avatarUrl:u.avatarUrl})
  }),
  http.put('/api/profile', async ({request}) => {
    const down=await gate(); if(down)return down
    const uid=authUser(request); if(!uid)return unauthorized()
    const body=await request.json() as {name:string;email:string;avatarUrl?:string}
    const db=getDb();const u=db.users.find(u=>u.id===uid)!
    if(!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(body.email))return err(422,{code:'validation',message:'Nome ou e-mail inválido.'})
    if(db.users.some(x=>x.id!==uid&&x.email.toLowerCase()===body.email.toLowerCase()))return err(409,{code:'conflict',message:'E-mail já cadastrado.'})
    if(body.avatarUrl && !/^https:\/\//.test(body.avatarUrl))return err(422,{code:'validation',message:'O avatar deve usar HTTPS.'})
    u.name=body.name.trim();u.email=body.email.trim();u.avatarUrl=body.avatarUrl||undefined;persist()
    return HttpResponse.json({id:u.id,name:u.name,email:u.email,avatarUrl:u.avatarUrl})
  }),
  http.put('/api/profile/password', async ({request}) => {
    const down=await gate(); if(down)return down
    const uid=authUser(request); if(!uid)return unauthorized()
    const body=await request.json() as {currentPassword:string;newPassword:string}
    const u=getDb().users.find(u=>u.id===uid)!
    if(u.passwordHash!==await sha256(body.currentPassword??''))return err(422,{code:'validation',message:'Senha atual incorreta.'})
    if((body.newPassword?.length??0)<8)return err(422,{code:'validation',message:'A nova senha deve ter 8 caracteres ou mais.'})
    u.passwordHash=await sha256(body.newPassword);persist();return HttpResponse.json({ok:true})
  }),
  http.get('/api/favorites', async ({request}) => {
    const down=await gate();if(down)return down
    const uid=authUser(request);if(!uid)return unauthorized()
    return HttpResponse.json(getDb().favorites[uid]??[])
  }),
  http.put('/api/favorites/:id', async ({request,params}) => {
    const down=await gate();if(down)return down
    const uid=authUser(request);if(!uid)return unauthorized()
    const db=getDb();const id=String(params.id)
    if(!db.nfts.some(n=>n.id===id))return err(404,{code:'not_found',message:'NFT inexistente.'})
    const favorites=new Set(db.favorites[uid]??[]);favorites.add(id);db.favorites[uid]=[...favorites];persist()
    return HttpResponse.json(db.favorites[uid])
  }),
  http.delete('/api/favorites/:id', async ({request,params}) => {
    const down=await gate();if(down)return down
    const uid=authUser(request);if(!uid)return unauthorized()
    const db=getDb();db.favorites[uid]=(db.favorites[uid]??[]).filter(id=>id!==params.id);persist()
    return HttpResponse.json(db.favorites[uid])
  }),

  // ---------- Carteiras simuladas, isoladas por usuário ----------
  http.get('/api/wallets', async ({request}) => {
    const down=await gate(); if(down)return down
    const uid=authUser(request); if(!uid)return unauthorized()
    return HttpResponse.json(getDb().wallets?.[uid] ?? [])
  }),
  http.put('/api/wallets', async ({request}) => {
    const down=await gate(); if(down)return down
    const uid=authUser(request); if(!uid)return unauthorized()
    const {wallets}=await request.json() as {wallets:PaymentMethod[]}
    if(!Array.isArray(wallets)||wallets.length>2||wallets.some(w=>{
      if(!w.id||!w.name?.trim())return true
      if(w.type==='card')return w.network!=='Card'||!/^\d{4}$/.test(w.last4??'')||! /^(0[1-9]|1[0-2])\/\d{2}$/.test(w.expiry??'')||w.address!==`card-${w.last4}`
      return !/^0x[a-fA-F0-9]{40}$/.test(w.address)||!['Ethereum','Polygon','Sepolia'].includes(w.network)
    }))return err(422,{code:'validation',message:'Confira os dados fictícios do cartão ou o endereço da carteira.'})
    if(wallets.filter(w=>w.primary).length>1)return err(422,{code:'validation',message:'Selecione no máximo um método principal.'})
    const db=getDb();db.wallets ??={};db.wallets[uid]=wallets;persist();return HttpResponse.json(wallets)
  }),

  // ---------- NFTs ----------
  http.get('/api/nfts', async ({ request }) => {
    const down = await gate(); if (down) return down
    const s = getScenario()
    if (s.failNftList) return err(s.failNftList, { code: 'transient', message: 'Serviço indisponível.' })
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const category = url.searchParams.get('category')
    const sort = url.searchParams.get('sort')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')

    let items = s.emptyCatalog ? [] : [...getDb().nfts]
    if (q) items = items.filter((n) => n.name.toLowerCase().includes(q) || n.collection.toLowerCase().includes(q))
    if (category) items = items.filter((n) => n.category === category)
    if (minPrice !== null && minPrice !== '') items = items.filter(n => new Decimal(n.priceEth).gte(minPrice))
    if (maxPrice !== null && maxPrice !== '') items = items.filter(n => new Decimal(n.priceEth).lte(maxPrice))
    if (sort === 'newest') items.sort((a,b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    if (sort === 'trending') items.sort((a,b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    if (sort === 'price_asc') items.sort((a, b) => new Decimal(a.priceEth).cmp(b.priceEth))
    if (sort === 'price_desc') items.sort((a, b) => new Decimal(b.priceEth).cmp(a.priceEth))
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name))

    const body: Paginated<Nft> = {
      items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      page, pageSize: PAGE_SIZE, total: items.length,
    }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    const down = await gate(); if (down) return down
    const nft = getDb().nfts.find((n) => n.id === params.id)
    return nft ? HttpResponse.json(nft) : err(404, { code: 'not_found', message: 'NFT não encontrado.' })
  }),

  // ---------- Carrinho ----------
  http.get('/api/cart', async ({ request }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    return HttpResponse.json(getDb().carts[uid] ?? { items: [], version: 0 })
  }),

  /** Define a quantidade de um item (0 remove). Respeita estoque. */
  http.put('/api/cart/items/:nftId', async ({ request, params }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    const { quantity } = (await request.json()) as { quantity: number }
    const db = getDb()
    const nft = db.nfts.find((n) => n.id === params.nftId)
    if (!nft) return err(404, { code: 'not_found', message: 'NFT não encontrado.' })
    if (!Number.isInteger(quantity) || quantity < 0) return err(422, { code: 'validation', message: 'Quantidade inválida.' })
    if (quantity > nft.stock) return err(409, { code: 'conflict', message: `Apenas ${nft.stock} disponível(is).` })
    const cart: Cart = db.carts[uid] ?? { items: [], version: 0 }
    cart.items = cart.items.filter((i) => i.nftId !== nft.id)
    if (quantity > 0) cart.items.push({ nftId: nft.id, quantity })
    cart.version += 1
    db.carts[uid] = cart
    persist()
    return HttpResponse.json(cart)
  }),

  // ---------- Cotação / cupom ----------
  http.post('/api/quote', async ({ request }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    const { couponCode } = (await request.json().catch(() => ({}))) as { couponCode?: string | null }
    const db = getDb()
    if (couponCode !== undefined) {
      if (couponCode === null || couponCode === '') delete db.coupons[uid]
      else {
        const c = coupons[couponCode]
        if (!c) return err(422, { code: 'validation', message: 'Cupom inválido.', fields: { coupon: 'Cupom inválido' } })
        if (c.expired) return err(422, { code: 'validation', message: 'Cupom expirado.', fields: { coupon: 'Cupom expirado' } })
        db.coupons[uid] = couponCode
      }
      persist()
    }
    return HttpResponse.json(quoteFor(uid))
  }),

  // ---------- Pedidos (idempotentes) ----------
  http.post('/api/orders', async ({ request }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    const key = request.headers.get('Idempotency-Key')
    if (!key) return err(422, { code: 'validation', message: 'Idempotency-Key obrigatório.' })
    const body = (await request.json()) as CreateOrderBody
    const db = getDb()
    const idemKey = `${uid}:${key}`
    const bodyHash = await sha256(JSON.stringify(body))

    const prev = db.idempotency[idemKey]
    if (prev) {
      reconcilePendingOrders()
      if (prev.bodyHash !== bodyHash) return err(409, { code: 'conflict', message: 'Chave de idempotência reutilizada com conteúdo diferente.' })
      return HttpResponse.json(db.orders[prev.orderId], { status: 200 }) // mesma tentativa → mesmo pedido
    }

    // Uma compra só pode usar uma carteira realmente cadastrada pelo usuário.
    const wallet = db.wallets?.[uid]?.find((w) => w.id === body.walletId)
    if (!wallet) return err(422, { code: 'validation', message: 'Selecione uma carteira cadastrada.' })
    if (body.network !== wallet.network || !['Ethereum', 'Polygon', 'Sepolia', 'Card'].includes(body.network)) {
      return err(422, { code: 'validation', message: 'Rede não suportada.' })
    }

    // revalida cotação: preço/estoque podem ter mudado
    const quote = quoteFor(uid)
    if (quote.quoteId !== body.quoteId) return err(409, { code: 'conflict', message: 'Preço ou disponibilidade mudaram. Revise o pedido.' })
    const soldOut = quote.lines.find((l) => (db.nfts.find((n) => n.id === l.nftId)?.stock ?? 0) < l.quantity)
    if (!quote.lines.length || soldOut) return err(409, { code: 'conflict', message: 'Item sem disponibilidade.' })

    const order: Order & { userId: string; settleAt: number; pendingQuote: Quote; willDecline: boolean } = { id: `ord-${Object.keys(db.orders).length + 1}`, userId: uid, status: 'pending', version: 1, settleAt: Date.now() + 1500, pendingQuote: structuredClone(quote), willDecline: !!getScenario().declinePayment }
    db.orders[order.id] = order
    db.idempotency[idemKey] = { bodyHash, orderId: order.id }
    persist()

    // A reconciliação também ocorre nos GETs, inclusive após refresh.
    setTimeout(reconcilePendingOrders, 1500)

    // timeout após criar: o pedido existe, mas o cliente não recebe resposta
    if (getScenario().orderTimeoutAfterCreate) { await delay(9_000) }
    return HttpResponse.json(order, { status: 201 })
  }),

  // Recuperação da tentativa original após perda da resposta HTTP.
  http.get('/api/orders/by-key/:key', async ({ request, params }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    reconcilePendingOrders()
    const record = getDb().idempotency[`${uid}:${String(params.key)}`]
    if (!record) return err(404, { code: 'not_found', message: 'Tentativa não encontrada.' })
    return HttpResponse.json(getDb().orders[record.orderId])
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    const down = await gate(); if (down) return down
    const uid = authUser(request); if (!uid) return unauthorized()
    reconcilePendingOrders()
    const o = getDb().orders[params.id as string]
    if (!o) return err(404, { code: 'not_found', message: 'Pedido não encontrado.' })
    if (o.userId !== uid) return err(403, { code: 'forbidden', message: 'Sem permissão.' })
    return HttpResponse.json(o)
  }),
]
