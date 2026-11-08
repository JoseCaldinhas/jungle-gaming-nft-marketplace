import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError, tokenStore } from '@/lib/api'
import { formatEth } from '@/lib/decimal'
import type { Order, Quote, CreateOrderBody } from '@/types/contracts'
type Wallet={id:string;name:string;address:string;network:string;primary:boolean;type?:'card'|'crypto';last4?:string}
type Attempt={key:string;body:CreateOrderBody;sessionToken:string}
const ATTEMPT_KEY='kurio-checkout-attempt-v1'
function loadAttempt():Attempt|null {try{const attempt=JSON.parse(sessionStorage.getItem(ATTEMPT_KEY)||'null') as Attempt|null;return attempt?.sessionToken===tokenStore.get()?attempt:null}catch{return null}}
async function findAttempt(attempt:Attempt):Promise<Order|null>{
 try{return (await api.get<Order>(`/orders/by-key/${encodeURIComponent(attempt.key)}`)).data}
 catch(e){if(isApiError(e)&&e.response?.status===404)return null;throw e}
}
export function CheckoutPage(){
 const nav=useNavigate();const qc=useQueryClient()
 const [walletId,setWalletId]=useState('')
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [review,setReview]=useState(false)
 const [attempt,setAttempt]=useState<Attempt|null>(loadAttempt)
 const [notice,setNotice]=useState('')
 const quote=useQuery({queryKey:['quote','checkout'],queryFn:async()=> (await api.post<Quote>('/quote',{})).data,staleTime:0})
 const wallets=useQuery({queryKey:['wallets'],queryFn:async()=> (await api.get<Wallet[]>('/wallets')).data})
 const purchase=useMutation({mutationFn:async()=>{
   // Resolve a tentativa anterior ANTES de criar outra, inclusive após refresh.
   if(attempt){const found=await findAttempt(attempt);if(found)return found
     return (await api.post<Order>('/orders',attempt.body,{headers:{'Idempotency-Key':attempt.key}})).data
   }
   const fresh=(await api.post<Quote>('/quote',{})).data
   if(fresh.quoteId!==quote.data?.quoteId){await quote.refetch();setReview(false);throw Error('Os valores mudaram. Revise a nova cotação antes de confirmar.')}
   const selected=wallets.data?.find(w=>w.id===(walletId||wallets.data?.find(x=>x.primary)?.id||wallets.data?.[0]?.id))
   const body:CreateOrderBody={quoteId:fresh.quoteId,walletId:selected?.id||'',network:selected?.network||'Ethereum'}
   const created={key:crypto.randomUUID(),body,sessionToken:tokenStore.get()||''}
   sessionStorage.setItem(ATTEMPT_KEY,JSON.stringify(created));setAttempt(created)
   return (await api.post<Order>('/orders',body,{headers:{'Idempotency-Key':created.key}})).data
 },onSuccess:o=>{sessionStorage.removeItem(ATTEMPT_KEY);setAttempt(null);void qc.invalidateQueries({queryKey:['quote']});void nav({to:'/order/$id',params:{id:o.id}})},onError:e=>{setNotice(isApiError(e)?e.response?.data.message||'A conexão falhou. Recupere a tentativa antes de reenviar.':e instanceof Error?e.message:'Erro de conexão.')}})

 const w=wallets.data??[]
 return <main className="page-shell"><section className="account-panel"><h1>Finalizar compra</h1>
 {quote.isPending||wallets.isPending?<div className="skeleton" style={{height:220}} aria-busy="true"/>:quote.isError||wallets.isError?<p role="alert">Erro ao carregar dados. <button onClick={()=>{void quote.refetch();void wallets.refetch()}}>Tentar novamente</button></p>:<>
 {!w.length?<p className="status-note">Cadastre um método de pagamento antes de comprar. <Link to="/wallets">Ir para métodos de pagamento</Link></p>:null}
 <form onSubmit={e=>{e.preventDefault();if(!review&&!attempt){setReview(true);return}purchase.mutate()}}>
 <label>Nome do colecionador<input required value={name} onChange={e=>{setName(e.target.value);setReview(false)}}/></label>
 <label>E-mail<input required type="email" value={email} onChange={e=>{setEmail(e.target.value);setReview(false)}}/></label>
 <label>Método de pagamento<select required value={walletId||w.find(x=>x.primary)?.id||w[0]?.id||''} onChange={e=>{setWalletId(e.target.value);setReview(false)}}>{w.map(x=><option key={x.id} value={x.id}>{x.type==='card'?`Cartão •••• ${x.last4} — ${x.name}`:`${x.name} — ${x.network} (${x.address.slice(0,10)}…)`}</option>)}</select></label>
 <p className="status-note">Pagamento totalmente simulado. Total exibido em ETH como referência; nenhuma cobrança será realizada.</p>
 <div className="status-note"><strong>Resumo do pedido</strong><p>{quote.data?.lines.length} itens · Subtotal {formatEth(quote.data?.subtotalEth??'0')}</p><p>Desconto {formatEth(quote.data?.discountEth??'0')} · Taxa {formatEth(quote.data?.networkFeeEth??'0')}</p><h2>Total: {formatEth(quote.data?.totalEth??'0')}</h2></div>
 {review&&!attempt&&<p role="status">Revise os dados acima. Ao confirmar, uma compra simulada será enviada.</p>}
 <button className="accent-btn" disabled={!w.length||(!attempt&&!quote.data?.lines.length)||purchase.isPending}>{purchase.isPending?'Processando…':attempt?'Recuperar pedido anterior':review?'Confirmar pedido simulado':'Revisar pedido'}</button>
 {attempt&&<p role="status">Há uma tentativa de compra anterior. Recupere o pedido antes de iniciar outra compra.</p>}{notice&&<p role="alert">{notice}</p>}</form></>}</section></main>
}
export function OrderPage(){
 const {id}=useParams({from:'/order/$id'})
 const order=useQuery({queryKey:['order',id],queryFn:async()=> (await api.get<Order>(`/orders/${id}`)).data,refetchInterval:q=>q.state.data?.status==='pending'?1500:false})
 return <main className="page-shell"><section className="account-panel"><h1>Pedido {id}</h1>
 {order.isPending?<div className="skeleton" style={{height:170}} aria-busy="true"/>:order.isError?<p role="alert">Não foi possível recuperar o pedido. <button onClick={()=>void order.refetch()}>Tentar novamente</button></p>:<>
 <p role="status">{order.data?.status==='pending'?'Pagamento pendente. Aguardando confirmação simulada…':order.data?.status==='confirmed'?'Pedido confirmado!':'Pagamento recusado. Seu carrinho foi preservado.'}</p>
 {order.data?.status==='confirmed'&&order.data.receipt&&<div className="status-note"><p>Transação simulada: {order.data.receipt.txHash}</p>
 <ul>{order.data.receipt.lines.map(l=><li key={l.nftId}>{l.nftId} · {l.quantity} × {formatEth(l.unitPriceEth)} = {formatEth(l.lineTotalEth)}</li>)}</ul>
 <p>Subtotal: {formatEth(order.data.receipt.subtotalEth)}</p><p>Desconto: {formatEth(order.data.receipt.discountEth)}</p><p>Taxa: {formatEth(order.data.receipt.networkFeeEth)}</p><strong>Total: {formatEth(order.data.receipt.totalEth)}</strong></div>}
 <Link to="/" className="accent-btn">Voltar ao catálogo</Link></>}</section></main>
}
