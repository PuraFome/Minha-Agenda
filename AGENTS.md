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

