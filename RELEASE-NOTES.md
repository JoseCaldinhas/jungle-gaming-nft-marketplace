# Kurio — Notas da revisão final candidata

## Interface

- Cabeçalho simplificado: ícones de busca e carrinho maiores, com nomes acessíveis e tooltips no mouse ou teclado.
- Perfil: ação de alteração de senha em diálogo, confirmação da senha atual, validação e indicador de força da nova senha.
- Adicionados favicon SVG e `robots.txt`.

## Documentação

- README consolidado com instalação, variáveis de ambiente, contas de teste, seleção/reset de cenários, contratos REST, eventos Socket.IO, fluxos de falha, comandos de teste, auditoria e orientações de publicação.
- ARCHITECTURE documenta políticas de sessão, cache, carrinho, sincronização, UX e limitações.

## Verificações

- A revisão anterior registrou 10 testes Playwright aprovados e Lighthouse mobile 86/96/96/92 (Performance/Acessibilidade/Boas Práticas/SEO).
- Os resultados anteriores não são evidência de validação das mudanças desta revisão. É necessário executar os testes, a auditoria completa e validar o deploy antes da submissão.


## Ajuste do cadastro de pagamento (V10)
- Botão **Salvar** com mensagens de validação e confirmação.
- Cartão fictício: número com 16 dígitos, validade futura e CVV de teste; número completo e CVV não são persistidos.
- Opções **Definir como principal** e **Não definir como principal**; o checkout permite escolher um método mesmo sem principal.
- Configuração TypeScript sem `baseUrl` e teste do catálogo com ordenação por lançamentos.
