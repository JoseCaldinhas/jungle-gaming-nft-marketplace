import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { initDb } from './db'

export async function startMocks() {
  await initDb()
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true })
}
