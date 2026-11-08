export type ScenarioName =
  | 'default' | 'slow' | 'variable-latency' | 'empty'
  | 'server-error' | 'offline' | 'session-expired'
  | 'order-timeout' | 'payment-declined'

export interface Scenario {
  latencyMs: number | [number, number] // fixo ou intervalo (determinístico por contador)
  emptyCatalog?: boolean
  failNftList?: number // status HTTP
  networkError?: boolean
  expireSession?: boolean
  orderTimeoutAfterCreate?: boolean
  declinePayment?: boolean
}

export const scenarios: Record<ScenarioName, Scenario> = {
  default: { latencyMs: 150 },
  slow: { latencyMs: 2500 },
  'variable-latency': { latencyMs: [100, 2000] },
  empty: { latencyMs: 150, emptyCatalog: true },
  'server-error': { latencyMs: 150, failNftList: 503 },
  offline: { latencyMs: 0, networkError: true },
  'session-expired': { latencyMs: 150, expireSession: true },
  'order-timeout': { latencyMs: 150, orderTimeoutAfterCreate: true },
  'payment-declined': { latencyMs: 150, declinePayment: true },
}

const KEY = 'mock-scenario'

/** Seleção: ?scenario=slow na URL > localStorage > VITE_MOCK_SCENARIO > default */
export function getScenarioName(): ScenarioName {
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  if (fromUrl && fromUrl in scenarios) localStorage.setItem(KEY, fromUrl)
  const stored = localStorage.getItem(KEY)
  const name = (stored ?? import.meta.env.VITE_MOCK_SCENARIO ?? 'default') as ScenarioName
  return name in scenarios ? name : 'default'
}

export const getScenario = (): Scenario => scenarios[getScenarioName()]

let tick = 0
/** Latência determinística: intervalo percorrido em ciclo, sem aleatoriedade */
export function latency(): number {
  const l = getScenario().latencyMs
  if (typeof l === 'number') return l
  const [min, max] = l
  tick = (tick + 1) % 5
  return min + ((max - min) * tick) / 4
}
