/** Valores em ETH sempre como string decimal (ex.: "0.125"). Nunca number. */
export type EthString = string

export interface Nft {
  id: string
  name: string
  collection: string
  category: string
  image: string
  priceEth: EthString
  stock: number
  createdAt?: string
  popularity?: number
  version: number // incrementa a cada alteração (usado por REST e eventos)
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface NftListParams {
  q?: string
  category?: string
  sort?: 'price_asc' | 'price_desc' | 'name' | 'newest' | 'trending'
  minPrice?: string
  maxPrice?: string
  page?: number
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface Session {
  user: User
  expiresAt: string
}

export interface AuthResponse extends Session {
  token: string
}

export interface CartItem { nftId: string; quantity: number }
export interface Cart { items: CartItem[]; version: number }

export interface QuoteLine {
  nftId: string
  quantity: number
  unitPriceEth: EthString
  lineTotalEth: EthString
}

export interface Quote {
  quoteId: string
  lines: QuoteLine[]
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  couponCode?: string
  version: number
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface Receipt {
  txHash: string
  lines: QuoteLine[]
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  createdAt: string
}

export interface Order {
  id: string
  status: OrderStatus // confirmed e declined são terminais
  receipt?: Receipt // snapshot imutável
  version: number
}

export interface CreateOrderBody {
  quoteId: string
  walletId: string
  network: string
}

export type ApiErrorCode =
  | 'validation' | 'unauthorized' | 'forbidden'
  | 'not_found' | 'conflict' | 'transient'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fields?: Record<string, string>
}

/** Eventos Socket.IO: eventId estável + recurso + versão */
export interface NftUpdatedEvent {
  eventId: string
  nftId: string
  version: number
  priceEth: EthString
  stock: number
}

export interface OrderUpdatedEvent {
  userId: string
  eventId: string
  orderId: string
  version: number
  status: OrderStatus
}
