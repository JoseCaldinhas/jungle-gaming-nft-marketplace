import { useState } from 'react'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { scenarios, getScenarioName, type ScenarioName } from '@/mocks/scenarios'
export function DemoPage(){
 const [scenario,setScenario]=useState<ScenarioName>(getScenarioName());const[status,setStatus]=useState('')
 const change=(s:ScenarioName)=>{localStorage.setItem('mock-scenario',s);setScenario(s);queryClient.invalidateQueries();setStatus(`Cenário ${s} ativado. Recarregue para reproduzir a sessão.`)}
 const reset=async()=>{localStorage.setItem('mock-scenario','default');setScenario('default');await api.post('/__mock/reset');queryClient.clear();setStatus('Dados simulados restaurados. Faça login novamente após recarregar.')}
 const update=async()=>{try{await api.post('/__mock/nft-update',{nftId:'nft-1',priceEth:(Math.random()*2+0.1).toFixed(4),stock:2});setStatus('Evento nft.updated emitido pelo servidor simulado.')}catch{setStatus('Falha ao atualizar NFT.')}}
 return <main className="page-shell"><section className="account-panel"><h1>Laboratório de testes</h1><p>Controles exclusivos da demonstração para reproduzir falhas e eventos, sem usar atalhos na interface de compra.</p><label>Cenário de rede e pagamento<select value={scenario} onChange={e=>change(e.target.value as ScenarioName)}>{Object.keys(scenarios).map(s=><option key={s} value={s}>{s}</option>)}</select></label><p><button className="outline-btn" onClick={update}>Simular mudança de preço do NFT #1</button></p><p><button className="accent-btn" onClick={()=>void reset()}>Restaurar dados simulados</button></p><p role="status">{status}</p></section></main>
}
