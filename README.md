# Kurio — NFT Marketplace

Aplicação demonstrativa de marketplace de NFTs construída com React e TypeScript, com catálogo, conta de colecionador e fluxo de compra simulado. Interface baseada no [Figma do desafio](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

> **Ambiente de demonstração:** NFTs, carteiras, cotações, autenticação e pagamentos são simulados. Não conecte uma carteira real nem utilize credenciais pessoais.

## Requisitos e instalação

- Node.js compatível com Vite 8 (Node 20.19+ ou 22.12+; recomendado Node 22 LTS ou superior), npm e Chrome/Chromium para testes e Lighthouse.
- A partir de um checkout limpo, na raiz do projeto:

```bash
npm ci
npx playwright install chromium
npm run dev
```

Abra o endereço indicado pelo Vite (normalmente `http://localhost:5173`). O arquivo `public/mockServiceWorker.js` já está incluído; não é necessário gerar novamente o worker nem instalar componentes shadcn manualmente.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se desejar alterar os padrões:

| Variável | Padrão | Função |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Habilita MSW na inicialização; mantenha `true` na demonstração e no deploy sem backend |
| `VITE_MOCK_SCENARIO` | `default` | Define o cenário inicial, substituível por URL ou armazenamento local |

As variáveis `VITE_*` são incorporadas ao build. Sem MSW, a aplicação espera endpoints REST e Socket.IO reais e não funcionará isoladamente.

## Credenciais fictícias

| Conta | E-mail | Senha |
| --- | --- | --- |
| Ana Colecionadora | `ana@example.com` | `senha123` |
| Bruno Cripto | `bruno@example.com` | `senha456` |

As senhas de demonstração são usadas somente no ambiente simulado. O banco mock persiste hashes SHA-256, não o texto das senhas; este mecanismo **não substitui** autenticação de produção, hashing com salt ou um servidor seguro.

## Comandos disponíveis

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Desenvolvimento com Vite e MSW |
| `npm run build` | TypeScript e build de produção em `dist/` |
| `npm run preview` | Preview do build na porta 4173 |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Testes Playwright desktop e mobile, relatório HTML |
| `npx playwright show-report` | Abre o último relatório HTML de testes |
| `npm run lighthouse` | Auditoria automatizada de início e detalhe, mobile e desktop, 3 execuções cada |
| `npm run audit` | Build e auditoria Lighthouse (preview precisa estar rodando em outro terminal) |

Para auditar: execute `npm run build`, depois `npm run preview` em um terminal; no segundo, execute `npm run lighthouse`. O script grava JSON e medianas em `reports/lighthouse/`. Para criar relatórios HTML adicionais, execute o Lighthouse CLI com `--output=html` e `--output-path` apropriado. A geração e inclusão de resultados reais de auditoria dependem da execução local.

## Cenários de rede reproduzíveis

Selecione `/?scenario=NOME` (por exemplo `/?scenario=slow`). O cenário selecionado fica em `localStorage` sob `mock-scenario`; a seleção por URL tem prioridade, seguida pelo valor armazenado e por `VITE_MOCK_SCENARIO`.

| Cenário | O que simula | Como verificar |
| --- | --- | --- |
| `default` | Respostas normais | Navegue e compre com Ana |
| `slow` | Latência fixa de 2,5 segundos | Observe skeletons e estados de carregamento |
| `variable-latency` | Latência determinística variável | Alterne filtros rapidamente e verifique a URL/resultado |
| `empty` | Catálogo vazio | Abra a página inicial |
| `server-error` | Erro HTTP 503 na listagem | Verifique mensagem e recuperação |
| `offline` | Falha de rede | Verifique estado de erro e tente novamente após mudar o cenário |
| `session-expired` | Sessão inválida | Entre na conta, selecione o cenário e abra uma rota privada |
| `order-timeout` | Timeout após criar pedido | Tente finalizar e recupere a tentativa pela chave de idempotência |
| `payment-declined` | Pagamento recusado | Finalize uma compra simulada e acompanhe o pedido |

Para voltar ao padrão, abra `/?scenario=default`. **Reset do banco simulado:**

```js
await fetch('/api/__mock/reset', { method: 'POST' })
location.reload()
```

O reset restaura NFTs, usuários, favoritos, carrinhos, carteiras, sessões e pedidos no banco mock. Se houver sessão antiga no navegador, faça logout ou limpe os dados do site para reiniciar também o estado do cliente.

Para disparar atualização de preço/estoque (com a aplicação aberta e socket conectado):

```js
await fetch('/api/__mock/nft-update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nftId: 'nft-2', priceEth: '0.2000', stock: 1 }),
})
```

Esse endpoint altera o banco do MSW e emite `nft.updated` pelo canal Socket.IO simulado. A compra utiliza a cotação retornada pelo REST e deve ser revista após mudança de preço ou disponibilidade.

## Fluxos para avaliação

1. **Descoberta:** abra `/`, use busca, categoria, preço, ordenação e paginação; recarregue e use voltar/avançar para conferir parâmetros na URL.
2. **Detalhe:** abra `/nft/nft-1` diretamente, altere edição e quantidade conforme disponibilidade; teste `/nft/nao-existe`.
3. **Conta:** abra `/login` ou use Entrar, autentique com Ana; visite `/profile`, altere os dados e use a janela **Alterar senha** (senha atual, confirmação e nova senha com indicador de força). Teste `/register` e `/wallets`.
4. **Favoritos:** marque/desmarque no detalhe e consulte `/favorites`; confira a persistência após refresh.
5. **Carrinho:** adicione NFTs, ajuste quantidades, teste `WELCOME10` (válido), `OLD50` (expirado) e um código inexistente.
6. **Compra:** acesse `/checkout`, selecione uma carteira cadastrada e rede, revise a cotação e confirme. Consulte `/order/ID` para status e recibo de pedido confirmado.
7. **Falhas:** alterne cenários e use `/api/__mock/nft-update` para testar mudança de preço durante a compra; teste `order-timeout` e `payment-declined` em tentativas distintas.
8. **Sessão:** faça logout, entre com Bruno e confira que dados privados de Ana não aparecem. Recarregue páginas privadas para testar recuperação de sessão.

## Contratos REST

Base URL relativa: `/api`. JSON nas requisições e respostas, salvo exceções. Operações privadas enviam token de sessão via `Authorization: Bearer TOKEN`. Erros usam `{ code, message, fields? }`.

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/auth/register` | Cadastro (`name`, `email`, `password`) |
| POST | `/auth/login` | Login (`email`, `password`) |
| GET | `/session` | Sessão atual |
| POST | `/auth/logout` | Encerrar sessão |
| GET / PUT | `/profile` | Ler/editar perfil (`name`, `email`, `avatarUrl`) |
| PUT | `/profile/password` | Alterar senha (`currentPassword`, `newPassword`) |
| GET | `/nfts` | Catálogo (`q`, `category`, `sort`, `minPrice`, `maxPrice`, `page`) |
| GET | `/nfts/:id` | Detalhe |
| GET | `/favorites` | Favoritos |
| PUT / DELETE | `/favorites/:id` | Adicionar/remover favorito |
| GET | `/cart` | Carrinho do usuário |
| PUT | `/cart/items/:nftId` | Alterar quantidade (zero remove) |
| POST | `/quote` | Cotação e validação de cupom (`couponCode`) |
| GET / PUT | `/wallets` | Listar/salvar carteiras |
| POST | `/orders` | Criar pedido; cabeçalho `Idempotency-Key` obrigatório |
| GET | `/orders/by-key/:key` | Recuperar tentativa pelo identificador idempotente |
| GET | `/orders/:id` | Estado e recibo do pedido |
| POST | `/__mock/reset` | Restaurar estado simulado |
| POST | `/__mock/nft-update` | Atualizar NFT e emitir evento de teste |

**Erros tratados:** 401 (sessão inválida), 403 (permissão), 404 (recurso ausente), 409 (conflito de disponibilidade ou idempotência), 422 (validação) e 5xx/rede (falha transitória). Os valores ETH via API são strings decimais; cálculos utilizam `decimal.js`, quantidades são inteiras.

**Idempotência:** repetir a mesma chave e o mesmo corpo recupera o mesmo pedido; reutilizar a chave com corpo diferente resulta em 409. Recibos confirmados preservam os valores da cotação no momento da compra.

## Socket.IO e sincronização

O cliente `socket.io-client` conecta em `/socket.io` usando transporte `websocket`. MSW intercepta a conexão e `@mswjs/socket.io-binding` implementa o protocolo Socket.IO simulado. Eventos: `nft.updated` (`eventId`, `nftId`, `version`, `priceEth`, `stock`) e `order.updated` (`eventId`, `orderId`, `userId`, `version`, `status`). O cliente deduplica por `eventId`, verifica versão e reconcilia consultas com REST após reconexão. Eventos privados de pedidos são filtrados por usuário. Não há servidor Socket.IO remoto nem fallback long-polling.

## Estado, sessão e persistência

TanStack Router controla rotas, parâmetros de catálogo e proteção de páginas privadas. TanStack Query mantém estado remoto; Axios executa chamadas REST; MSW implementa handlers e banco persistido no navegador. Catálogo usa cache de 30 s; requisições com falha transitória podem tentar novamente até duas vezes, enquanto mutations não têm retry automático. Alterações de favoritos usam atualização otimista com rollback. Logout desconecta o socket e limpa o cache privado. Carrinho visitante é mantido localmente e mesclado ao autenticar. Consulte `ARCHITECTURE.md` para decisões, riscos e limitações.

## Acessibilidade, responsividade e assets

O projeto utiliza componentes locais no padrão shadcn/ui, primitivos Radix para diálogos, Tailwind CSS e ícones Lucide. O cabeçalho tem ícones de busca e carrinho com nomes acessíveis e tooltips; o diálogo de senha mantém foco gerenciado pelo Radix. Layout destinado a desktop e mobile; verifique manualmente 390, 768 e 1440 px, zoom e teclado. Assets estão em `public/images` e `public/figma-assets`; o layout usa a identidade visual do Figma, sem garantia de equivalência pixel a pixel.

## Testes e auditorias: estado da entrega

Os testes existentes ficam em `e2e/` e rodam nos projetos Chromium desktop (1440×900) e mobile (390×844). O relatório HTML é gerado pelo Playwright e traces são preservados em falhas. A execução anterior da revisão V10 registrou **10/10 testes aprovados**, antes das alterações finais de interface. **Essa aprovação não valida os novos campos de senha nem os 12 grupos de cenários exigidos no enunciado.** Não há baselines de regressão visual versionadas neste pacote. Execute novamente os testes após a instalação e registre os resultados atuais.

A medição Lighthouse mobile anteriormente informada para a revisão V10 foi: Performance 86, Accessibility 96, Best Practices 96, SEO 92. São resultados de uma medição da versão anterior, não a mediana exigida para a versão final. O script `scripts/audit-lighthouse.mjs` faz três execuções em `/` e `/nft/nft-1`, em mobile e desktop, registrando medianas e LCP/CLS/TBT. **Não atribua à versão final resultados ainda não medidos.**

## Publicação

O deploy é obrigatório para o desafio e deve ser feito a partir do mesmo commit do repositório entregue. Exemplo na Vercel: importe o repositório, selecione Vite, configure `npm run build`, diretório `dist`, e mantenha `VITE_ENABLE_MOCKS=true`. Configure fallback SPA para servir `index.html` em rotas diretas e confirme que o service worker do MSW e a simulação WebSocket funcionam no domínio publicado. Faça testes reais de login, checkout, refresh e eventos após publicar. **URL pública: ainda não fornecida.**

Consulte `ARCHITECTURE.md` para decisões e limitações técnicas e `RELEASE-NOTES.md` para o resumo desta revisão.


### Métodos de pagamento simulados (V10 final)

Em **Minhas carteiras**, escolha **Adicionar cartão** (somente números fictícios, como `4242424242424242`, validade `12/29` e CVV de teste `123`) ou **Adicionar carteira cripto** (use **Gerar endereço fictício**). Salve, volte ao checkout e selecione o método cadastrado. O CVV não é enviado nem persistido, e o número completo não é salvo. O checkout continua sendo uma simulação de compra em ETH, sem cobranças reais. O catálogo inicial contém 39 NFTs, incluindo três imagens da referência enviada pelo candidato.
