import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import type { Nft, NftUpdatedEvent, OrderUpdatedEvent, Order } from '@/types/contracts'

let socket: Socket | null = null
const seenEvents = new Set<string>() // deduplicação por eventId

export function connectSocket(token: string, qc: QueryClient) {
  disconnectSocket()
  seenEvents.clear()
  socket = io({ path: '/socket.io', auth: { token }, transports: ['websocket'] })

  socket.on('connect', () => socket?.emit('authenticate', token))

  socket.on('nft.updated', (e: NftUpdatedEvent) => {
    if (seenEvents.has(e.eventId)) return
    seenEvents.add(e.eventId)
    // só aplica se a versão for mais nova que a do cache
    qc.setQueryData<Nft>(['nft', e.nftId], (old) =>
      old && e.version > old.version
        ? { ...old, priceEth: e.priceEth, stock: e.stock, version: e.version }
        : old,
    )
    qc.invalidateQueries({ queryKey: ['nfts'] })
    qc.invalidateQueries({ queryKey: ['quote'] })
    qc.invalidateQueries({ queryKey: ['cart'] })
  })

  socket.on('order.updated', (e: OrderUpdatedEvent) => {
    if (seenEvents.has(e.eventId)) return
    const session = qc.getQueryData<{ user: { id: string } }>(['session'])
    if (!session || session.user.id !== e.userId) return
    seenEvents.add(e.eventId)
    const cur = qc.getQueryData<Order>(['order', e.orderId])
    if (cur && (cur.version >= e.version || cur.status !== 'pending')) return // terminais não regridem
    qc.invalidateQueries({ queryKey: ['order', e.orderId] }) // reconcilia com REST
  })

  // reconexão: reconcilia recursos ativos com a API REST
  socket.io.on('reconnect', () => qc.invalidateQueries())
}

export function disconnectSocket() {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}
