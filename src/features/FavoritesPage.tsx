import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, tokenStore } from '@/lib/api'
import { formatEth } from '@/lib/decimal'

/** Favorites are read from the authenticated MSW REST API, never shared between accounts. */
export function FavoritesPage() {
  const navigate = useNavigate()
  const signedIn = Boolean(tokenStore.get())
  const favorites = useQuery({
    queryKey: ['favorites'],
    queryFn: async ({ signal }) => (await api.get<string[]>('/favorites', { signal })).data,
    enabled: signedIn,
  })
  // Fetch favorites individually, so saved NFTs remain visible beyond the first catalog page.
  const allFavorites = useQuery({
    queryKey: ['favorite-nfts', favorites.data],
    enabled: signedIn && favorites.isSuccess,
    queryFn: async ({ signal }) => Promise.all((favorites.data ?? []).map(async id =>
      (await api.get<import('@/types/contracts').Nft>(`/nfts/${id}`, { signal })).data
    )),
  })
  const items = allFavorites.data ?? []
  if (!signedIn) {
    return <main className="page-shell"><h1 className="section-heading">Meus favoritos</h1><p>Entre na sua conta para acessar os NFTs salvos.</p><button className="accent-btn" onClick={() => navigate({to:'/login', search:{redirect:'/favorites'}})}>Entrar</button></main>
  }
  return <main className="page-shell">
    <h1 className="section-heading">Meus favoritos</h1>
    <p className="text-muted">Sua coleção de NFTs favoritos fica vinculada à sua conta e permanece após atualizar a página.</p>
    {(favorites.isPending || allFavorites.isPending) && <div className="nft-grid" aria-busy="true" aria-label="Carregando favoritos">{Array.from({length:4},(_,i)=><div key={i} className="skeleton" style={{height:300}} />)}</div>}
    {(favorites.isError || allFavorites.isError) && <div role="alert">Não foi possível carregar seus favoritos. <button className="outline-btn" onClick={()=>{void favorites.refetch();void allFavorites.refetch()}}>Tentar novamente</button></div>}
    {favorites.isSuccess && allFavorites.isSuccess && items.length===0 && <section className="panel"><p>Você ainda não favoritou nenhum NFT.</p><Link className="accent-btn" to="/">Explorar NFTs</Link></section>}
    {allFavorites.isSuccess && items.length>0 && <ul className="nft-grid">{items.map(nft=><li className="nft-card" key={nft.id}><Link to="/nft/$id" params={{id:nft.id}}><img src={nft.image} alt={`Arte de ${nft.name}`} loading="lazy" width={400} height={400}/><h2>{nft.name}</h2><div className="price">{formatEth(nft.priceEth)}</div><p className="collection-name">{nft.collection}</p><span className="nft-tag">♥ Salvo</span></Link></li>)}</ul>}
  </main>
}
