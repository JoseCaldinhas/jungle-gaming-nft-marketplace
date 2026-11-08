import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRegister } from './auth'
import { isApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RegisterPage() {
  const navigate = useNavigate()
  const signup = useRegister()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6 && password === confirm
  return <main className="page-shell"><section className="account-panel"><h1>Crie sua conta Kurio</h1>
    <form noValidate onSubmit={e => { e.preventDefault(); setSubmitted(true); if (valid) signup.mutate({ name: name.trim(), email: email.trim().toLowerCase(), password }, { onSuccess: () => navigate({ to: '/' }) }) }}>
      <label>Nome<Input autoComplete="name" value={name} onChange={e => setName(e.target.value)} aria-invalid={submitted && name.trim().length < 2} /></label>
      {submitted && name.trim().length < 2 && <p role="alert">Informe pelo menos 2 caracteres.</p>}
      <label>E-mail<Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} /></label>
      {submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && <p role="alert">Informe um e-mail válido.</p>}
      <label>Senha (mínimo 6 caracteres)<Input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Confirmar senha<Input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      {submitted && (password.length < 6 || password !== confirm) && <p role="alert">A senha deve ter pelo menos 6 caracteres e coincidir com a confirmação.</p>}
      <Button type="submit" disabled={signup.isPending}>{signup.isPending ? 'Criando conta…' : 'Criar conta'}</Button>
      {signup.isError && <p role="alert">{isApiError(signup.error) ? signup.error.response?.data.message : 'Falha ao cadastrar.'}</p>}
    </form><p>Já possui conta? <Link to="/login" search={{}}>Entrar</Link></p>
  </section></main>
}
