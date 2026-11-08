import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/api'
import type { PaymentMethod } from '@/mocks/db'

type Method = PaymentMethod
const blank = (type: 'crypto' | 'card'): Method => ({
  id: crypto.randomUUID(), name: '', address: '',
  network: type === 'card' ? 'Card' : 'Ethereum', primary: false, type,
})
const digitsOnly = (value: string) => value.replace(/\D/g, '')
const validExpiry = (value: string) => {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false
  const [month, year] = value.split('/').map(Number)
  const now = new Date()
  const expiryYear = 2000 + year
  return expiryYear > now.getFullYear() || (expiryYear === now.getFullYear() && month >= now.getMonth() + 1)
}

export function WalletsPage() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Method[] | null>(null)
  const [cardNumbers, setCardNumbers] = useState<Record<string, string>>({})
  const [cvvs, setCvvs] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: async () => (await api.get<Method[]>('/wallets')).data })
  const save = useMutation({
    mutationFn: async (methods: Method[]) => (await api.put<Method[]>('/wallets', { wallets: methods })).data,
    onSuccess: (data) => {
      qc.setQueryData(['wallets'], data)
      setDraft(null)
      setCardNumbers({})
      setCvvs({})
      setFeedback('Salvo com sucesso! Seu método de pagamento já está disponível no checkout.')
    },
  })
  const list = draft ?? wallets.data ?? []
  const edit = (id: string, patch: Partial<Method>) => {
    setFeedback('')
    save.reset()
    setDraft(list.map((method) => method.id === id ? { ...method, ...patch } : patch.primary ? { ...method, primary: false } : method))
  }
  const add = (type: 'card' | 'crypto') => {
    setFeedback('')
    save.reset()
    setDraft([...list, { ...blank(type), primary: list.length === 0 }])
  }
  const remove = (id: string) => {
    setFeedback('')
    save.reset()
    setCardNumbers((prev) => { const next = { ...prev }; delete next[id]; return next })
    setCvvs((prev) => { const next = { ...prev }; delete next[id]; return next })
    setDraft(list.filter((method) => method.id !== id))
  }
  const validate = (method: Method): string | null => {
    if (!method.name.trim()) return 'Preencha o nome do método de pagamento.'
    if (method.type === 'card') {
      const number = cardNumbers[method.id]
      if (number !== undefined && number.length !== 16) return 'O número do cartão de teste deve ter 16 dígitos.'
      if (!/^\d{4}$/.test(method.last4 ?? '')) return 'Informe os 16 dígitos do cartão de teste.'
      if (!validExpiry(method.expiry ?? '')) return 'Informe uma validade futura no formato MM/AA.'
      if (number !== undefined && !/^\d{3,4}$/.test(cvvs[method.id] ?? '')) return 'Informe um CVV fictício de 3 ou 4 dígitos.'
      return null
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(method.address)) return 'Informe ou gere um endereço fictício válido (0x + 40 caracteres).'
    return null
  }
  const invalid = list.map(validate).find(Boolean)
  const submit = () => {
    setFeedback('')
    if (invalid) { setFeedback(invalid); return }
    // Nunca envia o número completo ou CVV para a API simulada.
    save.mutate(list.map((method) => ({ ...method, name: method.name.trim() })))
  }
  return <main className="page-shell"><section className="account-panel">
    <h1>Minhas carteiras</h1>
    <p>Cadastre até dois métodos de pagamento fictícios. Nenhuma cobrança ou conexão com blockchain é realizada. Nunca use dados reais.</p>
    {wallets.isPending ? <div className="skeleton" style={{ height: 200 }} /> : wallets.isError ?
      <p role="alert">Não foi possível carregar os métodos. <button onClick={() => void wallets.refetch()}>Tentar novamente</button></p> : <>
      {list.map((method) => <fieldset key={method.id} style={{ borderBottom: '1px solid #593623', paddingBottom: 20 }}>
        <legend>{method.primary ? 'Método principal' : 'Método secundário'} — {method.type === 'card' ? 'Cartão simulado' : 'Carteira cripto'}</legend>
        <label>{method.type === 'card' ? 'Nome no cartão' : 'Nome da carteira'}
          <input value={method.name} onChange={(event) => edit(method.id, { name: event.target.value })} placeholder={method.type === 'card' ? 'Nome fictício' : 'Minha carteira simulada'} />
        </label>
        {method.type === 'card' ? <>
          <label>Número do cartão de teste (16 dígitos)
            <input inputMode="numeric" autoComplete="off" placeholder={method.last4 && cardNumbers[method.id] === undefined ? `Cartão salvo •••• ${method.last4} — deixe em branco para manter` : '4242 4242 4242 4242'}
              value={cardNumbers[method.id] ?? ''} onChange={(event) => {
                const digits = digitsOnly(event.target.value).slice(0, 16)
                setCardNumbers((prev) => ({ ...prev, [method.id]: digits }))
                edit(method.id, { last4: digits.length === 16 ? digits.slice(-4) : '', address: digits.length === 16 ? `card-${digits.slice(-4)}` : '' })
              }} />
          </label>
          <label>Validade (MM/AA)
            <input inputMode="numeric" placeholder="12/29" value={method.expiry ?? ''} onChange={(event) => {
              const digits = digitsOnly(event.target.value).slice(0, 4)
              edit(method.id, { expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits })
            }} />
          </label>
          <label>CVV fictício (não armazenado)
            <input inputMode="numeric" autoComplete="off" type="password" placeholder={cardNumbers[method.id] === undefined && method.last4 ? 'Não necessário para cartão já salvo' : '123'}
              value={cvvs[method.id] ?? ''} onChange={(event) => { setCvvs((prev) => ({ ...prev, [method.id]: digitsOnly(event.target.value).slice(0, 4) })); setFeedback('') }} />
          </label>
          <p className="status-note">Somente os quatro últimos dígitos e a validade fictícia serão salvos. O número completo e o CVV não são enviados à API.</p>
        </> : <>
          <label>Endereço fictício (0x + 40 caracteres)<input value={method.address} onChange={(event) => edit(method.id, { address: event.target.value })} placeholder="0x..." /></label>
          <label>Rede<select value={method.network} onChange={(event) => edit(method.id, { network: event.target.value })}><option>Ethereum</option><option>Polygon</option><option>Sepolia</option></select></label>
          <button type="button" className="outline-btn" onClick={() => edit(method.id, { address: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, '0')).join('') })}>Gerar endereço fictício</button>
        </>}
        <fieldset style={{ marginTop: 12 }}><legend>Preferência de pagamento</legend>
          <label><input style={{ display: 'inline', width: 'auto' }} type="radio" name={`primary-${method.id}`} checked={method.primary} onChange={() => edit(method.id, { primary: true })} /> Definir como principal</label>
          <label><input style={{ display: 'inline', width: 'auto' }} type="radio" name={`primary-${method.id}`} checked={!method.primary} onChange={() => edit(method.id, { primary: false })} /> Não definir como principal</label>
        </fieldset>
        <button type="button" className="outline-btn" onClick={() => remove(method.id)}>Remover</button>
      </fieldset>)}
      {list.length < 2 && <><button type="button" className="outline-btn" onClick={() => add('card')}>+ Adicionar cartão</button>{' '}<button type="button" className="outline-btn" onClick={() => add('crypto')}>+ Adicionar carteira cripto</button></>}
      <p><button type="button" className="accent-btn" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Salvando…' : 'Salvar'}</button></p>
      {feedback && <p role={invalid ? 'alert' : 'status'}>{feedback}</p>}
      {save.isError && <p role="alert">{isApiError(save.error) ? save.error.response?.data.message : 'Falha de conexão. Tente novamente.'}</p>}
    </>}
  </section></main>
}
