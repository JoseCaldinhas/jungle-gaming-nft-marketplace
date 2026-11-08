# Checklist da entrega final — Jungle Gaming

## Alterações desta versão
- Recuperação de pedido pendente após refresh usando cotação persistida e reconciliação REST.
- Tentativas de checkout isoladas por token de sessão; limpeza em login/logout.
- Documentação da estratégia e das limitações em `ARCHITECTURE.md`.

## Verificações obrigatórias no computador de entrega

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm run lighthouse
```

**Atenção:** esta revisão não foi validada com a execução completa acima neste ambiente; não declare resultados de Lighthouse ou testes que não tenham sido medidos. Use Node >= 22.19 para Lighthouse 13.

## Antes de enviar
- Conferir os relatórios de Playwright e Lighthouse; corrigir falhas reais antes da entrega.
- Verificar que os mocks funcionam no deploy e que rotas privadas sobrevivem ao refresh.
- Subir código, lockfile e assets ao GitHub e publicar a mesma versão no Vercel.
- Testar compra, timeout, recusa e troca de usuário no endereço publicado.
