import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useNft, useSetCartQuantity } from './hooks'
import { addGuestItem } from '@/lib/guestCart'
import { formatEth } from '@/lib/decimal'
import { isApiError, tokenStore } from '@/lib/api'

export function NftDetailPage() {
  const { id } = useParams({ from: '/nft/$id' })
  const { data: nft, isPending, isError, error } = useNft(id)
  const add = useSetCartQuantity()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const authenticated = !!tokenStore.get()
  const favorites = useQuery({queryKey:['favorites'],queryFn:async()=> (await api.get<string[]>('/favorites')).data,enabled:authenticated})
  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if(favorites.data?.includes(id)) await api.delete(`/favorites/${id}`)
      else await api.put(`/favorites/${id}`)
    },
    onMutate:async()=>{
      await qc.cancelQueries({queryKey:['favorites']})
      const previous=qc.getQueryData<string[]>(['favorites'])
      qc.setQueryData<string[]>(['favorites'],old=>old?.includes(id)?old.filter(x=>x!==id):[...(old??[]),id])
      return {previous}
    },
    onError:(_error,_vars,context)=>qc.setQueryData(['favorites'],context?.previous),
    onSettled:()=>qc.invalidateQueries({queryKey:['favorites']})
  })
  const [qty, setQty] = useState(1)

  if (isPending) return <main className="mx-auto max-w-4xl p-4"><div className="skeleton h-96 rounded-xl" aria-busy="true" /></main>
  if (isError) {
    const notFound = isApiError(error) && error.response?.status === 404
    return (
      <main className="mx-auto max-w-4xl p-4" role="alert">
        <h1 className="text-xl font-semibold">{notFound ? 'NFT não encontrado' : 'Erro ao carregar o NFT'}</h1>
        <Link to="/" className="underline">Voltar ao catálogo</Link>
      </main>
    )
  }

  const onAdd = () => {
    if (!tokenStore.get()) { addGuestItem(nft.id, qty, nft.stock); return navigate({ to: '/login', search: { redirect: `/cart` } }) }
    add.mutate({ nftId: nft.id, quantity: qty })
  }

  return (
    <main className="page-shell detail-layout">
      <img src={nft.image} alt={`${nft.name}, coleção ${nft.collection}`} className="detail-image" width={600} height={600} />
      <section>
        <h1 className="detail-title">{nft.name}</h1>
        <p className="text-muted">{nft.collection}</p>
        <p className="detail-price">{formatEth(nft.priceEth)}</p>
        <button className="outline-btn" aria-pressed={!!favorites.data?.includes(id)} disabled={toggleFavorite.isPending} onClick={()=>{
          if(!authenticated)void navigate({to:'/login',search:{redirect:`/nft/${id}`}})
          else toggleFavorite.mutate()
        }}>{favorites.data?.includes(id)?'♥ Remover dos favoritos':'♡ Adicionar aos favoritos'}</button>
        {toggleFavorite.isError&&<p role="alert">Não foi possível salvar o favorito.</p>}
        {nft.stock === 0 ? (
          <p role="status">Edição esgotada</p>
        ) : (
          <>
            <label className="flex flex-col text-sm">
              Quantidade (máx. {nft.stock})
              <input type="number" min={1} max={nft.stock} value={qty}
                onChange={(e) => setQty(Math.min(nft.stock, Math.max(1, Math.trunc(Number(e.target.value) || 1))))}
                className="w-24 rounded border border-border bg-surface px-3 py-2" />
            </label>
            <button onClick={onAdd} disabled={add.isPending} className="accent-btn">
              {add.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
            </button>
          </>
        )}
        <div aria-live="polite">
          {add.isSuccess && <p>Adicionado ao carrinho.</p>}
          {add.isError && <p role="alert">{isApiError(add.error) ? add.error.response?.data.message : 'Falha ao adicionar.'}</p>}
        </div>
      </section>
    </main>
  )
}
