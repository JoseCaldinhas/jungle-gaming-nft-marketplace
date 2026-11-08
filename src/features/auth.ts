import { useMutation, useQuery } from '@tanstack/react-query'
import { api, tokenStore } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { mergeGuestCart } from '@/lib/guestCart'
import type { AuthResponse, Session } from '@/types/contracts'

export const AUTH_EVENT = 'kurio:auth-changed'
export const notifyAuthChanged = () => window.dispatchEvent(new Event(AUTH_EVENT))
export const sessionQuery = {
  queryKey: ['session'] as const,
  queryFn: async ({ signal }: { signal: AbortSignal }) => (await api.get<Session>('/session', { signal })).data,
  retry: false,
}
export const useSession = () => useQuery({ ...sessionQuery, enabled: !!tokenStore.get() })

async function onAuthenticated(res: AuthResponse) {
  disconnectSocket()
  queryClient.clear()
  sessionStorage.removeItem('kurio-checkout-attempt-v1')
  tokenStore.set(res.token)
  queryClient.setQueryData(['session'], { user: res.user, expiresAt: res.expiresAt })
  connectSocket(res.token, queryClient)
  notifyAuthChanged()
  await mergeGuestCart().catch(() => undefined)
  queryClient.invalidateQueries({ queryKey: ['quote'] })
}
export const useLogin = () => useMutation({
  mutationFn: async (body: { email: string; password: string }) => (await api.post<AuthResponse>('/auth/login', body)).data,
  onSuccess: onAuthenticated,
})
export const useRegister = () => useMutation({
  mutationFn: async (body: { name: string; email: string; password: string }) => (await api.post<AuthResponse>('/auth/register', body)).data,
  onSuccess: onAuthenticated,
})
export async function logout() {
  await api.post('/auth/logout').catch(() => undefined)
  tokenStore.clear()
  sessionStorage.removeItem('kurio-checkout-attempt-v1')
  disconnectSocket()
  queryClient.clear()
  notifyAuthChanged()
}
