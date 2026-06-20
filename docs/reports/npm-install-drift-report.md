# Report: drift — instalação npm vs realidade (2026-06-20)

**Contexto:** Na grill do plano multi-runtime, assumiu-se que `@dag-flow/skills-mcp` estava publicado no npm registry. **Correção:** nenhum pacote `@dag-flow/*` está publicado hoje. Instalação correta = **clone + build local + `npm link`** (ou path absoluto no MCP config).

**Instalação canônica documentada em:** [`docs/planning/multi-runtime-implementation-plan.md` § Q3](../planning/multi-runtime-implementation-plan.md#q3--instalação-local-npm-link)

---

## Severidade

| Nível | Significado |
|-------|-------------|
| 🔴 **Alta** | Pode levar alguém a `npm install -g @dag-flow/...` e falhar |
| 🟡 **Média** | Sugere registry sem afirmar explicitamente; ou doc quebrada |
| 🟢 **Baixa** | “publicar” no sentido de manifest/skill, não npm |

---

## 🔴 Alta — implica pacote no registry

| Arquivo | Linha / trecho | Problema | Ação sugerida |
|---------|----------------|----------|---------------|
| `mcp/package.json` | `"name": "@dag-flow/skills-mcp"` + `"publishConfig": { "access": "public" }` | Nome scoped + `publishConfig` sugerem pacote publicado ou instalável via `npm i -g @dag-flow/skills-mcp` | Comentar no README que é **local-only** até publish; ou remover `publishConfig` até publicar de fato |
| `mcp/README.md` | Título `# @dag-flow/skills-mcp` | Estilo “pacote npm oficial” sem disclaimer “not published” | Adicionar bloco no topo: *Not on npm registry — build from repo* |

**Nota:** `npm view @dag-flow/skills-mcp` não foi confirmado (rede indisponível no ambiente do agente); você confirmou que **não está publicado**.

---

## 🟡 Média — docs inconsistentes (não afirmam publish, mas quebram ou confundem)

| Arquivo | Trecho | Problema | Ação sugerida |
|---------|--------|----------|---------------|
| `mcp/README.md` | `node dist/main.js` (várias seções) | Build real é `main.js` na **raiz** (`esbuild --outfile=main.js`), não `dist/` | Trocar para `node main.js` ou alinhar build para `dist/main.js` |
| `mcp/README.md` | `npm run start:dev:mcp` | `package.json` só define `start:dev` | Corrigir nome do script na doc |
| `mcp/package.json` | `"description": "The official MCP..."` | “Official” pode implicar distribuição npm | “Official bundled MCP (install from repo)” |
| `CONTRIBUTING.md` | `npm test` no MCP | `mcp/package.json` **não tem** script `"test"` | Adicionar script ou corrigir CONTRIBUTING |
| `CONTRIBUTING.md` | `project.json` e ESLint | Não há `project.json` visível em `mcp/` | Atualizar para `jest.config.ts` + esbuild ou remover referência |
| `docs/reports/dag-flow-postmortem.md` | Snippet `npx -y @tech-leads-club/agent-skills-mcp` | Pacote **terceiro** antigo no histórico — não é `@dag-flow` mas confunde narrativa MCP | Manter como histórico ou nota de legado |

---

## 🟢 Baixa — “publicar” ≠ npm registry

| Arquivo | Trecho | Nota |
|---------|--------|------|
| `docs/design/tdd-multi-runtime-support.md` | “publicar manifest”, Fase 7 “cursor publicado” | Significa **ship do manifest built-in**, não `npm publish` |
| `CONTEXT.md` | “publishing an unvalidated Worker Runtime manifest” | Mesmo sentido — manifest no repo |
| `README.md`, `docs/getting-started.md` | `cd mcp && npm install && npm run build` | ✅ **Correto** — instalação local do monorepo |
| `docs/getting-started.md` | `npm install -g context-mode` | ✅ Ferramenta **externa** — não é pacote dag-flow |

---

## O que **não** encontrei no repo

- Nenhum `npm install -g @dag-flow/skills-mcp` ou `npx @dag-flow/cli` na documentação principal
- Nenhum link para `npmjs.com/package/@dag-flow/...`
- README/getting-started já orientam **git clone** — alinhado com realidade

O erro principal foi **inferência** a partir de `publishConfig` + nome scoped (e comentário na sessão de grill), não uma doc explícita “instale do npm”.

---

## Checklist de correção (sugerido)

- [x] `mcp/README.md` — disclaimer “not on npm”; corrigir `dist/` → `main.js`; corrigir `start:dev:mcp`
- [x] `mcp/package.json` — description atualizada (install from repo)
- [x] `CONTRIBUTING.md` — alinhar test/build com `mcp/package.json` real
- [x] `README.md` / `docs/getting-started.md` — `setup_indexer` deprecated; `npm link` documentado
- [ ] Quando `cli/` existir — `cli/README.md` com mesmo padrão Q3 (link, não registry)
- [x] `README.md` — link para § Q3 do plano

---

## Referências

- Plano V1 Q3: [`multi-runtime-implementation-plan.md`](../planning/multi-runtime-implementation-plan.md#q3--instalação-local-npm-link)
- TDD §4 out of scope: registry comunidade / UI — não exige npm publish em V1
