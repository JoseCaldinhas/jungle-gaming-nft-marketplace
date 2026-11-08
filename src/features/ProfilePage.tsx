import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, X } from 'lucide-react'
import { api, isApiError } from '@/lib/api'
import type { User } from '@/types/contracts'

function message(e: unknown) { return isApiError(e) ? e.response?.data.message || 'Falha na requisição.' : 'Não foi possível salvar. Tente novamente.' }
function passwordStrength(value: string): 0 | 1 | 2 | 3 {
  if (!value) return 0
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(value)).length
  if (value.length >= 12 && kinds >= 4) return 3
  if (value.length >= 8 && kinds >= 3) return 2
  return 1
}
export function ProfilePage() {
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.get<User>('/profile')).data })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatar] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrent] = useState('')
  const [confirmCurrentPassword, setConfirmCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const strength = passwordStrength(newPassword)
  const passwordsMatch = currentPassword === confirmCurrentPassword
  // A sincronização inicial ocorre somente após resposta da API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (profile.data) { setName(profile.data.name); setEmail(profile.data.email); setAvatar(profile.data.avatarUrl || '') } }, [profile.data])
  const save = useMutation({ mutationFn: async () => (await api.put<User>('/profile', { name, email, avatarUrl })).data, onSuccess: u => { qc.setQueryData(['profile'], u); qc.invalidateQueries({ queryKey: ['session'] }) } })
  const password = useMutation({ mutationFn: async () => api.put('/profile/password', { currentPassword, newPassword }), onSuccess: () => { setCurrent(''); setConfirmCurrent(''); setNew(''); setPasswordOpen(false); setPasswordSuccess(true) } })
  function closePassword(open: boolean) { if (password.isPending) return; setPasswordOpen(open); if (!open) { setCurrent(''); setConfirmCurrent(''); setNew(''); setShowPasswords(false); password.reset() } else setPasswordSuccess(false) }
  return <main className="page-shell"><section className="account-panel"><h1>Meu perfil</h1><p>Gerencie os dados da sua conta de colecionador.</p>
    {profile.isPending ? <div className="skeleton" style={{ height: 250 }} /> : profile.isError ? <p role="alert">Não foi possível carregar o perfil. <button onClick={() => profile.refetch()}>Tentar novamente</button></p> : <>
      <form onSubmit={e => { e.preventDefault(); save.mutate() }}><h2>Dados pessoais</h2><label>Nome completo<input required value={name} onChange={e => setName(e.target.value)} /></label><label>E-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>URL do avatar (HTTPS)<input type="url" value={avatarUrl} onChange={e => setAvatar(e.target.value)} placeholder="https://..." /></label>{avatarUrl && <img src={avatarUrl} alt="Prévia do avatar" width={76} height={76} style={{ borderRadius: '50%', objectFit: 'cover' }} />}<p><button className="accent-btn" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar perfil'}</button></p>{save.isSuccess && <p role="status">Perfil atualizado.</p>}{save.isError && <p role="alert">{message(save.error)}</p>}</form>
      <div className="password-section"><h2>Segurança da conta</h2><p>Atualize sua senha de acesso quando necessário.</p><button type="button" className="outline-btn" onClick={() => closePassword(true)}>Alterar senha</button>{passwordSuccess && <p role="status">Senha alterada com sucesso.</p>}</div>
      <Dialog.Root open={passwordOpen} onOpenChange={closePassword}><Dialog.Portal><Dialog.Overlay className="password-dialog-overlay" /><Dialog.Content className="password-dialog" aria-describedby="password-dialog-description"><div className="password-dialog-heading"><Dialog.Title>Alterar senha</Dialog.Title><Dialog.Close aria-label="Fechar janela" className="password-dialog-close"><X size={22} /></Dialog.Close></div><Dialog.Description id="password-dialog-description">Informe sua senha atual duas vezes e escolha uma nova senha.</Dialog.Description>
        <form onSubmit={e => { e.preventDefault(); if (passwordsMatch && strength >= 2 && currentPassword) password.mutate() }}>
          <label htmlFor="current-password">Senha atual</label><input id="current-password" autoComplete="current-password" type={showPasswords ? 'text' : 'password'} required value={currentPassword} onChange={e => setCurrent(e.target.value)} />
          <label htmlFor="confirm-current-password">Confirme a senha atual</label><input id="confirm-current-password" autoComplete="off" type={showPasswords ? 'text' : 'password'} required value={confirmCurrentPassword} onChange={e => setConfirmCurrent(e.target.value)} aria-invalid={!!confirmCurrentPassword && !passwordsMatch} aria-describedby="password-match-message" />
          <p id="password-match-message" className="password-field-message" role={confirmCurrentPassword && !passwordsMatch ? 'alert' : undefined}>{confirmCurrentPassword && !passwordsMatch ? 'As senhas atuais não coincidem.' : ''}</p>
          <label htmlFor="new-password">Nova senha</label><input id="new-password" autoComplete="new-password" type={showPasswords ? 'text' : 'password'} minLength={8} required value={newPassword} onChange={e => setNew(e.target.value)} aria-describedby="password-strength-label password-requirements" />
          <div className="password-strength-bars" aria-hidden="true">{[1, 2, 3].map(level => <span key={level} className={strength >= level ? `strength-${strength}` : ''} />)}</div>
          <p id="password-strength-label" className={`password-strength-label strength-text-${strength}`} aria-live="polite">{strength === 0 ? 'Digite uma nova senha' : strength === 1 ? 'Senha fraca' : strength === 2 ? 'Senha média' : 'Senha forte'}</p>
          <p id="password-requirements" className="password-help">Use pelo menos 8 caracteres e combine letras maiúsculas, minúsculas, números e símbolos.</p>
          <button type="button" className="password-visibility" onClick={() => setShowPasswords(v => !v)} aria-pressed={showPasswords}>{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}{showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}</button>
          {password.isError && <p role="alert" className="password-error">{message(password.error)}</p>}
          <div className="password-dialog-actions"><button type="button" className="outline-btn" onClick={() => closePassword(false)}>Cancelar</button><button className="accent-btn" disabled={password.isPending || !currentPassword || !passwordsMatch || strength < 2}>{password.isPending ? 'Salvando…' : 'Salvar nova senha'}</button></div>
        </form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
    </>}
  </section></main>
}
