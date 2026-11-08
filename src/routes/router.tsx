/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { NftDetailPage } from '@/features/catalog/NftDetailPage'
import { CartPage } from '@/features/cart/CartPage'
import { WalletsPage } from '@/features/WalletsPage'
import { ProfilePage } from '@/features/ProfilePage'
import { FavoritesPage } from '@/features/FavoritesPage'
import { CheckoutPage, OrderPage } from '@/features/CheckoutPage'
import { RegisterPage } from '@/features/RegisterPage'
import { LoginPage } from '@/features/LoginPage'
import { logout, useSession, AUTH_EVENT, notifyAuthChanged } from '@/features/auth'
import { setOnUnauthorized, tokenStore } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import type { NftListParams } from '@/types/contracts'
import { Button } from '@/components/ui/button'
import { Search, ShoppingCart } from 'lucide-react'

const RootLayout = () => {
  const pathname = useRouterState({ select: s => s.location.pathname })
  const [, refreshAuth] = useState(0)
  useEffect(() => { const update = () => refreshAuth(v => v + 1); window.addEventListener(AUTH_EVENT, update); return () => window.removeEventListener(AUTH_EVENT, update) }, [])
  const { data: session, isPending: sessionLoading } = useSession()
  const authenticated = !!tokenStore.get() && !!session?.user
  const authScreen = pathname === '/register'
  const loginModal = pathname === '/login'
  return (
    <>
      {!authScreen && <header className="site-header"><div className="site-header-inner">
        <Link to="/" className="brand">KURIO</Link>
        <nav aria-label="Principal" className="site-nav"><Link to="/" activeProps={{className:'active'}}>Início</Link><Link to="/" hash="explorar">Explorar</Link><Link to="/wallets">Carteira</Link><Link to="/favorites">Favoritos</Link></nav>
        <div className="header-actions"><Link to="/" hash="explorar" className="header-icon-link" aria-label="Buscar NFT" data-tooltip="Buscar NFT"><Search size={25} strokeWidth={2.1} aria-hidden="true" /></Link><Link to="/cart" className="header-icon-link" aria-label="Carrinho" data-tooltip="Carrinho"><ShoppingCart size={25} strokeWidth={2.1} aria-hidden="true" /></Link>
          {authenticated ? <><Link to="/profile" className="outline-btn">{session.user.name}</Link><Button variant="outline" onClick={async () => { await logout(); router.navigate({to:'/'}) }}>Sair</Button></> : sessionLoading && tokenStore.get() ? <span aria-live="polite">Carregando…</span> : <Link to="/login" search={{}} className="accent-btn">↪ Entrar</Link>}
        </div>
      </div></header>}
      {loginModal ? <><CatalogPage /><LoginDialog /></> : <Outlet />}
      {!authScreen && <footer className="site-footer"><div className="footer-inner"><div><strong className="brand">KURIO</strong><p>Um espaço para descobrir, colecionar e explorar arte digital. Marketplace demonstrativo com dados simulados.</p></div><div><strong>EXPLORAR</strong><p>Mercado · Coleções · Criadores</p></div><div><strong>INFORMAÇÕES</strong><p>Sobre · Ajuda · Termos</p></div></div></footer>}
    </>
  )
}
function LoginDialog() {
  return <Dialog.Root open onOpenChange={open=>{if(!open)void router.navigate({to:'/'})}}>
    <Dialog.Portal>
      <Dialog.Overlay className="auth-overlay" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.78)'}} />
      <Dialog.Content className="auth-dialog" style={{position:'fixed',zIndex:1001,top:'50%',left:'50%',transform:'translate(-50%,-50%)',maxHeight:'90vh',overflowY:'auto'}} aria-describedby="auth-description">
        <Dialog.Title className="sr-only">Entrar na Kurio</Dialog.Title>
        <Dialog.Description id="auth-description" className="sr-only">Acesse sua conta de colecionador.</Dialog.Description>
        <Dialog.Close className="auth-close" aria-label="Fechar login">×</Dialog.Close>
        <LoginPage />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
const root = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <main className="p-4"><h1 className="text-xl">Página não encontrada</h1><Link to="/" className="underline">Ir para o início</Link></main>,
})

// Busca, filtros, ordenação e página vivem na URL (sobrevivem a refresh e histórico)
const requireAuth = () => {
  if (!tokenStore.get()) throw redirect({ to: '/login', search: { redirect: location.pathname + location.search } })
}

const home = createRoute({
  getParentRoute: () => root, path: '/', component: CatalogPage,
  validateSearch: (s: Record<string, unknown>): NftListParams => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    sort: ['price_asc', 'price_desc', 'name', 'newest', 'trending'].includes(s.sort as string) ? (s.sort as NftListParams['sort']) : undefined,
    minPrice: typeof s.minPrice === 'string' && s.minPrice !== '' ? s.minPrice : undefined,
    maxPrice: typeof s.maxPrice === 'string' && s.maxPrice !== '' ? s.maxPrice : undefined,
    page: Number(s.page) > 0 ? Math.trunc(Number(s.page)) : 1,
  }),
})

const detail = createRoute({ getParentRoute: () => root, path: '/nft/$id', component: NftDetailPage })

const cart = createRoute({ getParentRoute: () => root, path: '/cart', beforeLoad: requireAuth, component: CartPage })

const favorites = createRoute({getParentRoute:()=>root,path:'/favorites',beforeLoad:requireAuth,component:FavoritesPage})
const profile = createRoute({getParentRoute:()=>root,path:'/profile',beforeLoad:requireAuth,component:ProfilePage})
const wallets = createRoute({getParentRoute:()=>root,path:'/wallets',beforeLoad:requireAuth,component:WalletsPage})
const checkout = createRoute({getParentRoute:()=>root,path:'/checkout',beforeLoad:requireAuth,component:CheckoutPage})
const order = createRoute({getParentRoute:()=>root,path:'/order/$id',beforeLoad:requireAuth,component:OrderPage})
const register = createRoute({getParentRoute:()=>root,path:'/register',component:RegisterPage})
const login = createRoute({
  getParentRoute: () => root, path: '/login', component: LoginPage,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined }),
})

export const router = createRouter({ routeTree: root.addChildren([home, detail, cart, login, wallets, profile, favorites, checkout, order, register]) })

declare module '@tanstack/react-router' { interface Register { router: typeof router } }

// sessão expirada em qualquer chamada → limpa dados privados e volta ao login com retorno
setOnUnauthorized(() => {
  if (!tokenStore.get()) return
  tokenStore.clear(); disconnectSocket(); queryClient.clear(); notifyAuthChanged()
  router.navigate({ to: '/login', search: { redirect: location.pathname + location.search } })
})

// recarregar a página com sessão salva → reconecta o socket
const token = tokenStore.get()
if (token) connectSocket(token, queryClient)
