import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from '@/types/contracts'

const TOKEN_KEY = 'session-token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({ baseURL: '/api', timeout: 8000 })

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

/** Callback registrado pela app para reagir a sessão expirada (sem acoplar ao router) */
let onUnauthorized: (() => void) | null = null
export const setOnUnauthorized = (fn: (() => void) | null) => { onUnauthorized = fn }

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    if (err.response?.status === 401) onUnauthorized?.()
    return Promise.reject(err)
  },
)

export const isApiError = (e: unknown): e is AxiosError<ApiErrorBody> => axios.isAxiosError(e)
