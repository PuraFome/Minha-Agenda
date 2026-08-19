# AGENTS.md — Minha-Agenda

## Regra obrigatória: consulte o graphify ANTES de ler arquivos

Este projeto usa **graphify** como fonte primária de conhecimento sobre o codebase.
O grafo persistente vive em `graphify-out/graph.json` e responde perguntas sobre
arquitetura, relações entre arquivos, dependências e conceitos.

**Antes de ler qualquer arquivo do projeto** (via Read, Grep, Glob, edit ou delegação
de exploração), o agente DEVE:

1. Verificar se `graphify-out/graph.json` existe.
2. Se existir, consultar o grafo primeiro com:

   ```
   /graphify query "<pergunta>"
   ```

3. Usar a resposta do grafo como contexto base.
4. Só então ler arquivos individuais se o grafo não tiver a informação necessária.

Exceções: arquivos de configuração trivial (`package.json`, `angular.json`,
`tsconfig.json`) e comandos de build/teste podem ser consultados diretamente.

## Stack

- Angular 21 (standalone components, signals)
- TypeScript 5.9, SCSS
- Vitest para testes
- Sem SSR

## Comandos

```bash
npm start        # dev server (http://localhost:4200)
npm run build    # build de produção
npm test         # testes (vitest)
```

## Atualizar o grafo (economia máxima de tokens)

O grafo é atualizado automaticamente e de forma barata:

1. **A cada commit**: o hook `post-commit` do git re-executa a extração AST
   apenas nos arquivos alterados e reconstrói `graph.json`, `graph.html` e
   `GRAPH_REPORT.md` em background — **zero tokens de LLM**.

2. **Após editar código sem commitar** (durante uma sessão de trabalho): rode
   o comando determinístico, que NÃO gasta tokens:

   ```
   graphify update .
   ```

   Ele re-extrai apenas os arquivos de código alterados (AST puro) e faz merge
   com o grafo existente, preservando os nós semânticos do cache.

3. **Somente se alterou docs/papers/imagens** (`.md`, `.html`, `.pdf`, etc.):
   aí sim rode a re-extração semântica com LLM (cara):

   ```
   /graphify --update
   ```

**Regra de ouro**: código → `graphify update .` (grátis). Docs → `/graphify --update`
(caro, evite). O hook de commit já cobre o caso 1 automaticamente.

Verifique o status do hook a qualquer momento:

```
graphify hook status
```

## Estado atual do projeto (contexto entre sessões)

- **Projeto**: "Minha Agenda" — app Angular 21 standalone + signals + SCSS.
- **Tela home implementada** com header sticky (branding + botão toggle de tema no
  canto superior direito), footer com copyright dinâmico e conteúdo hero + feature cards.
- **Tema claro/escuro**: `ThemeService` (`src/app/theme/theme.service.ts`) com signal
  `preference` ('light' | 'dark' | 'system'), `computed` `theme`, `toggle()` e
  `followSystem()`. Segue o tema do SO via `matchMedia('(prefers-color-scheme: dark)')`
  reagindo ao vivo; escolha manual persiste em `localStorage` (key `theme`); aplica
  `data-theme` no `<html>`. Script inline anti-FOUC no `index.html`.
- **Design tokens** em `src/styles.scss`: CSS custom properties por tema
  (`--color-bg/surface/text/border/primary/accent`, sombras, espaçamento, raios),
  direção "papel editorial" (creme+terracota claro / carvão+brasa escuro),
  `prefers-reduced-motion` respeitado.
- **Estrutura de pastas**: `src/app/layout/` (header, footer), `src/app/pages/home/`,
  `src/app/theme/`.
- **Rotas**: `''` → HomeComponent, `'**'` → redirect `''`.
- **Layout shell**: `App` (app.ts) renderiza `<app-header />` + `<main><router-outlet /></main>` + `<app-footer />`.
- **Build/testes**: `npx ng build` OK; `npx ng test --watch=false` OK (2/2).
- **Git**: commit inicial `424ad57` feito. Nada pendente de commit no momento
  (verificar `git status` antes de continuar).

## Validação visual com Playwright (OBRIGATÓRIA após mudanças de UI)

Qualquer alteração de UI (layout, tema, componentes, estilos) DEVE ser validada com
o Playwright MCP antes de ser declarada concluída:

1. Subir o dev server:

   ```
   Start-Process -FilePath "npx.cmd" -ArgumentList "ng","serve","--port","4200","--host","127.0.0.1" -WorkingDirectory "C:\Users\Pura Fome\Documents\portifolio\Minha-Agenda" -WindowStyle Hidden
   ```

2. Usar a skill `/playwright` e navegar para `http://127.0.0.1:4200/`.
3. Verificar: header com toggle no canto superior direito, conteúdo da rota, footer.
4. **Testar o toggle de tema**: clicar no botão, confirmar que `data-theme` no `<html>`
   muda entre `light`/`dark` e que o localStorage (key `theme`) persiste o valor.
5. Capturar screenshots (`browser_take_screenshot`) dos dois temas para conferência visual.
6. Rodar `browser_console_messages` com nível `error` — não pode haver erros de console.

Artefatos do Playwright ficam em `.playwright-mcp/` (ignorado pelo git).

