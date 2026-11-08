import { QueryClient } from '@tanstack/react-query'
import { isApiError } from './api'

/**
 * Política de cache (documentar no ARCHITECTURE.md):
 * - staleTime 30s para catálogo; carrinho/quote/pedido usam staleTime 0
 * - retry só para falhas transitórias (rede/5xx), máx. 2, nunca para 4xx
 * - mutations NÃO fazem retry automático (evita duplicar operação)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => {
        if (count >= 2) return false
        if (isApiError(err) && err.response && err.response.status < 500) return false
        return true
      },
    },
    mutations: { retry: false },
  },
})
