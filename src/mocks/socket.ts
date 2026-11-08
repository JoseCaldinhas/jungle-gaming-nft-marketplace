import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/types/contracts'
import { getDb } from './db'

/**
 * Transporte: WebSocket interceptado pelo MSW, falando o protocolo Socket.IO
 * via @mswjs/socket.io-binding. O socket.io-client real conecta normalmente.
 * Limitação: sem fallback de long-polling; só transporte "websocket".
 */
const link = ws.link(`${location.origin.replace(/^http/, 'ws')}/socket.io/`)

type Emitter = { userId: string; emit: (ev: string, data: unknown) => void }
const clients = new Set<Emitter>()

export const socketHandler = link.addEventListener('connection', (connection) => {
  const io = toSocketIo(connection)
  const entry: Emitter = { userId: 'unknown', emit: (ev, data) => io.client.emit(ev, data) }
  io.client.on('authenticate', (_event, token: string) => {
    entry.userId = getDb().sessions[token] ?? 'unknown'
  })
  clients.add(entry)
  connection.client.addEventListener('close', () => clients.delete(entry))
})

let seq = 0
const eventId = (p: string) => `${p}-${++seq}`

/** Chamado pelos handlers REST: mudou o estado → emite o evento correspondente */
export function broadcastNftUpdated(e: Omit<NftUpdatedEvent, 'eventId'>) {
  const payload: NftUpdatedEvent = { eventId: eventId('nft'), ...e }
  clients.forEach((c) => c.emit('nft.updated', payload))
  return payload
}

export function broadcastOrderUpdated(e: Omit<OrderUpdatedEvent, 'eventId'>) {
  const payload: OrderUpdatedEvent = { eventId: eventId('ord'), ...e }
  clients.forEach((c) => {
    if (c.userId === e.userId && Object.values(getDb().sessions).includes(c.userId)) c.emit('order.updated', payload)
  })
  return payload
}
