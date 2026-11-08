# Arquitetura e decisões técnicas — Kurio

## Visão geral

Aplicação SPA React/TypeScript com Vite. TanStack Router gerencia navegação e estado de busca na URL; TanStack Query gerencia estado remoto; Axios transporta requisições; MSW intercepta `/api` no navegador; `@mswjs/socket.io-binding` intercepta WebSocket do `socket.io-client`. Tailwind CSS e componentes locais no padrão shadcn/ui compõem a interface; Radix Dialog controla modais.

## Contratos e responsabilidades

- `src/types/contracts.ts`: tipos de NFTs, listagem, carrinho, cotação, pedido e eventos.
- `src/lib/api.ts`: cliente Axios, token e tratamento de 401.
- `src/lib/queryClient.ts`: configuração de cache e retries.
- `src/lib/socket.ts`: conexão, descarte de eventos repetidos e reconciliação.
- `src/mocks/handlers.ts`: handlers REST e regras de negócio simuladas.
- `src/mocks/db.ts`, `fixtures.ts`, `scenarios.ts`, `socket.ts`: persistência, dados determinísticos, falhas e eventos.
- `src/features/`: telas e interações; `src/routes/router.tsx`: rotas e proteção.

## Política de cache e respostas obsoletas

O QueryClient usa `staleTime: 30_000` ms por padrão; chaves de listagem incluem parâmetros de filtro e paginação. Queries podem tentar novamente até duas vezes para falhas transitórias, não para respostas 4xx. Mutations não repetem automaticamente. Listagens passam sinal de cancelamento ao Axios, evitando que uma resposta de filtro antigo substitua a consulta ativa. Eventos invalidam recursos dependentes (catálogo, detalhe, cotação, carrinho). Favoritos usam atualização otimista com rollback.

## Sessão e dados privados

O catálogo é público. Perfil, carteiras, favoritos, carrinho e checkout dependem de token. O token é persistido no cliente para recuperação após refresh. Um 401 limpa token, desconecta Socket.IO, limpa o cache TanStack Query e encaminha ao login com retorno. Logout também limpa dados privados do cache. O banco MSW associa carrinho, favoritos, carteiras e pedidos a IDs de usuário; a consulta de pedido verifica propriedade. Senhas são persistidas como hashes SHA-256 apenas para a simulação: não é um sistema de autenticação de produção. O formulário de alteração de senha verifica a confirmação no cliente, enquanto a API valida a senha atual.

## Carrinho, ETH e pedido

O carrinho autenticado é mantido no banco MSW, persistido em localStorage; carrinho visitante é armazenado separadamente e mesclado após autenticação. Quantidades são inteiras e limitadas pelo estoque. Cotação REST é a referência para subtotal, desconto, taxa e total. ETH trafega como string decimal; `decimal.js` evita erros de ponto flutuante. Cupom é validado no mock (`WELCOME10` válido, `OLD50` expirado). Pedido exige `Idempotency-Key`: mesma chave e mesmo corpo retornam o mesmo pedido; corpo diferente resulta em 409. A cotação é revalidada antes da criação. O pedido passa por `pending` e termina em `confirmed` ou `declined`. Recibo confirmado guarda snapshot de linhas e valores; catálogo posterior não altera o recibo.

## Tempo real e reconciliação

O transporte é `websocket` puro com protocolo Socket.IO compatível via binding MSW; não há fallback polling. `nft.updated` inclui identidade, versão, preço e estoque; `order.updated` inclui pedido, usuário, versão e estado. `eventId` deduplica mensagens; versões impedem aplicação de dados antigos. Eventos de pedido são enviados somente ao usuário correspondente e verificados novamente no cliente. Na reconexão, o cliente invalida as queries para reconciliar com REST. A conexão é desligada no logout.

## Cenários de rede e reset

`VITE_MOCK_SCENARIO`, parâmetro `?scenario=` e localStorage selecionam latência, indisponibilidade, erro de catálogo, sessão expirada, timeout de pedido e recusa de pagamento. `/api/__mock/reset` reinicializa o banco de dados, e `/api/__mock/nft-update` atualiza o NFT no REST e emite evento no Socket.IO. As condições são simuladas no navegador. Pedidos pendentes armazenam cotação imutável, resultado simulado e prazo de conclusão; após reload, consultas REST reconciliam e finalizam o pedido, mesmo que o timer anterior tenha sido perdido.

## UX, acessibilidade e relação com o Figma

A composição segue a linguagem visual escura, tipografia monoespaçada e assets disponíveis. Ações do cabeçalho usam ícones de 25 px com área mínima de 44 px, tooltip em hover/foco e `aria-label`. O formulário de senha abre em diálogo com foco gerenciado, três campos e indicador textual/colorido de força. Os estados de interface não desenhados no Figma seguem o mesmo padrão visual. Favicon e `robots.txt` foram adicionados. A fonte Space Mono é carregada do Google Fonts, portanto requer acesso externo; imagens de NFTs ficam no projeto. **Desvio/limitação:** a fidelidade visual exata aos frames Figma não foi auditada pixel a pixel; o indicador de força é uma heurística de interface, não garantia criptográfica.

## Limitações e validações pendentes

- A revisão entregue ainda requer validação pós-alterações: `npm ci`, typecheck, build, lint, Playwright e auditoria Lighthouse completa.
- A suíte Playwright incluída não cobre os 12 grupos obrigatórios nem inclui baselines de regressão visual versionadas; ampliar antes de considerar conformidade integral.
- A mediana Lighthouse em início/detalhe e mobile/desktop, com relatórios HTML e JSON, precisa ser executada no ambiente final. Métricas anteriores não comprovam esta revisão.
- O deploy público e o teste dos mocks WebSocket no domínio publicado ainda dependem de publicação e validação.
- A resolução assíncrona do pedido usa timer no mock; uma interrupção/reload durante `pending` pode impedir a conclusão automática. Este cenário exige teste e eventual mecanismo de recuperação.
- O banco simulado e os tokens em armazenamento do navegador são adequados somente para demonstração. Não usar com dados ou pagamentos reais.


## V10 final: métodos de pagamento e catálogo original

Três imagens de macacos foram recortadas da imagem fornecida pelo candidato e adicionadas como `original-ape-{1,2,3}.webp`, com IDs estáveis e dados fictícios de preço/estoque. A migração acrescenta esses registros ao banco local já existente sem apagar carrinhos ou contas. O reset de cenários continua recriando a fixture completa.

`GET /api/wallets` e `PUT /api/wallets` mantêm o contrato de métodos de pagamento por usuário (até dois). Para carteiras cripto, `type` é `crypto` ou ausente e `address` usa o formato `0x` + 40 hexadecimais. Para cartões fictícios, `type=card`, `network=Card`, `address=card-XXXX`, `last4=XXXX`, `expiry=MM/AA`. A API não recebe nem persiste PAN completo ou CVV. Não há integração bancária ou liquidação em moeda real; o preço da cotação permanece em ETH para manter os contratos de compra.

O checkout utiliza `walletId` como identificador genérico do método e `network` como rede ou `Card`. A API confirma que ambos correspondem ao método cadastrado. As regras de idempotência, cotação e estado do carrinho permanecem inalteradas. Limitação: os cartões de demonstração não representam autorização de pagamento real, e a validade é apenas validação de formato.

## Ajustes finais de segurança da sessão e pedidos

- Tentativas de checkout armazenadas na aba incluem o token da sessão; tentativas de outro login não são recuperadas. Login e logout limpam a tentativa anterior.
- O mock grava o snapshot da cotação no pedido pendente, e o reconcilia na consulta do pedido ou da chave idempotente após o prazo. A mesma chave continua apontando para o mesmo pedido; a confirmação remove somente as quantidades compradas.
- Limitação: esta é uma simulação local no navegador, não um backend compartilhado entre dispositivos.
