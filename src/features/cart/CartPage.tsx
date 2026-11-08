import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/api'
import { formatEth } from '@/lib/decimal'
import { useNft, useSetCartQuantity } from '@/features/catalog/hooks'
import type { Quote } from '@/types/contracts'

function Line({ nftId, quantity, unit, total }: { nftId: string; quantity: number; unit: string; total: string }) {
  const { data: nft } = useNft(nftId)
  const setQty = useSetCartQuantity()
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-3">
      <div>
        <p className="font-medium">{nft?.name ?? '…'}</p>
        <p className="text-sm text-muted">{formatEth(unit)} cada</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`q-${nftId}`}>Quantidade de {nft?.name}</label>
        <input id={`q-${nftId}`} type="number" min={1} max={nft?.stock} value={quantity} className="w-20 rounded border border-border bg-surface px-2 py-1"
          onChange={(e) => setQty.mutate({ nftId, quantity: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} />
        <span>{formatEth(total)}</span>
        <button className="underline" onClick={() => setQty.mutate({ nftId, quantity: 0 })}>Remover</button>
      </div>
      {setQty.isError && <p role="alert">{isApiError(setQty.error) ? setQty.error.response?.data.message : 'Falha.'}</p>}
    </li>
  )
}

export function CartPage() {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const quote = useQuery({
    queryKey: ['quote'],
    queryFn: async ({ signal }) => (await api.post<Quote>('/quote', {}, { signal })).data,
    staleTime: 0,
  })
  const coupon = useMutation({
    mutationFn: async (c: string | null) => (await api.post<Quote>('/quote', { couponCode: c })).data,
    onSuccess: (q) => qc.setQueryData(['quote'], q),
  })

  if (quote.isPending) return <main className="page-shell"><div className="skeleton h-64 rounded-xl" aria-busy="true" /></main>
  if (quote.isError) return <main className="p-4" role="alert">Não foi possível carregar o carrinho. <button className="underline" onClick={() => quote.refetch()}>Tentar novamente</button></main>

  const q = quote.data
  return (
    <main className="page-shell">
      <h1 className="section-heading">Carrinho</h1>
      {/* resumo atualiza sozinho quando chega nft.updated; o aria-live avisa leitores de tela */}
      <div aria-live="polite" className="sr-only">{quote.isFetching ? 'Atualizando resumo do carrinho' : ''}</div>
      {q.lines.length === 0 ? <p className="mt-4">Seu carrinho está vazio.</p> : (
        <>
          <ul>{q.lines.map((l) => <Line key={l.nftId} nftId={l.nftId} quantity={l.quantity} unit={l.unitPriceEth} total={l.lineTotalEth} />)}</ul>
          <form className="my-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); coupon.mutate(code || null) }}>
            <label className="flex flex-col text-sm">Cupom
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={coupon.isError} aria-describedby="coupon-err"
                className="rounded border border-border bg-surface px-3 py-2" />
            </label>
            <button className="accent-btn">Aplicar</button>
            {q.couponCode && <button type="button" className="underline" onClick={() => coupon.mutate(null)}>Remover {q.couponCode}</button>}
          </form>
          <p id="coupon-err" role="alert">{coupon.isError && isApiError(coupon.error) ? coupon.error.response?.data.message : ''}</p>
          <dl className="grid grid-cols-2 gap-1">
            <dt>Subtotal</dt><dd className="text-right">{formatEth(q.subtotalEth)}</dd>
            <dt>Desconto</dt><dd className="text-right">−{formatEth(q.discountEth)}</dd>
            <dt>Taxa de rede</dt><dd className="text-right">{formatEth(q.networkFeeEth)}</dd>
            <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{formatEth(q.totalEth)}</dd>
          </dl>
          <Link to="/checkout" className="accent-btn" style={{marginTop:24}}>Continuar para pagamento →</Link>
        </>
      )}
    </main>
  )
}
