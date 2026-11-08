import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useLogin } from './auth'
import { isApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('ana@example.com')
  const [password, setPassword] = useState('senha123')
  const [touched, setTouched] = useState(false)

  const emailErr = touched && !email.includes('@') ? 'Informe um e-mail válido' : ''
  const passErr = touched && password.length < 6 ? 'Mínimo de 6 caracteres' : ''

  return (
    <main className="login-page"><div className="login-art" aria-hidden="true"><img src="/images/kurio/ape-0.webp" alt=""/><div><span>MARKETPLACE DE NFTs</span><h2>Descubra um universo de arte digital.</h2><p>Colecione, explore e negocie NFTs exclusivos na Kurio.</p></div></div><div className="login-box"><div className="login-brand">◆ KURIO</div>
      <p className="eyebrow">BEM-VINDO DE VOLTA</p><h1 className="text-2xl font-semibold">Entre na sua conta</h1><p className="login-subtitle">Acesse seu marketplace de NFTs.</p>
      <form noValidate className="mt-4 flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault(); setTouched(true)
        if (!email.includes('@') || password.length < 6) return
        login.mutate({ email, password }, { onSuccess: () => navigate({ to: redirect ?? '/' }) }) // volta ao fluxo anterior
      }}>
        <label className="flex flex-col text-sm">E-mail
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!emailErr} aria-describedby="email-err" className="rounded border border-border bg-surface px-3 py-2" />
          <span id="email-err" role="alert" className="text-red-300">{emailErr}</span>
        </label>
        <label className="flex flex-col text-sm">Senha
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!passErr} aria-describedby="pass-err" className="rounded border border-border bg-surface px-3 py-2" />
          <span id="pass-err" role="alert" className="text-red-300">{passErr}</span>
        </label>
        <Button type="submit" disabled={login.isPending}>{login.isPending ? 'Entrando…' : 'Entrar'}</Button>
        {login.isError && <p role="alert">{isApiError(login.error) ? login.error.response?.data.message : 'Falha de conexão. Tente novamente.'}</p>}
      </form><p className="mt-4">Ainda não tem conta? <Link to="/register" className="underline">Cadastre-se</Link></p><div className="demo-credentials">Conta de demonstração: <strong>ana@example.com</strong> / <strong>senha123</strong></div></div>
    </main>
  )
}
