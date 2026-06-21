# TDD — Suporte Multi-Runtime no dag-flow

| Campo              | Valor                          |
|--------------------|--------------------------------|
| Tech Lead          | A definir                      |
| Status             | **Accepted** — decisões fechadas na grill 2026-06-20; pronto para implementação |
| Criado em          | 2026-06-20                     |
| Última atualização | 2026-06-20 (enriquecimento pós-grill) |
| Audiência          | **Agente implementador em sessão zerada** — não assume conversas prévias |

---

## Leia isto primeiro (agente implementador)

Você está entrando neste projeto **sem contexto de conversas anteriores**. Este TDD é a fonte única de verdade para **o quê** implementar e **por quê**. Não invente decisões arquiteturais não documentadas aqui.

**Ordem de leitura obrigatória:**
1. Este documento inteiro
2. `CONTEXT.md` (glossário do domínio)
3. ADRs listados na seção [ADRs](#11-adrs-a-criar-antes-da-implementação) — criar antes de codar; **ADR-0017 já aceito** (flags worker)
4. Arquivos citados como evidência (`scripts/dag_runner.py`, `SKILL.md`, etc.)

**Regras para você:**
- **Não** trate `docs/planning/archive/agent_planner_v2_implementation_plan.md` como fonte de verdade sobre código existente — ele afirma que `hooks/dag-flow-src-guard.sh` e `DAG_FLOW_WORKER` estão implementados, mas **não estão no disco** (drift documental — ver [Apêndice A](#apêndice-a--evidência-de-drift-documental)).
- **Não** reintroduza `hooks/setup_indexer.sh` no fluxo de `dag init` — decisão explícita de separar dag-flow de context-mode (D10).
- **Não** compile `docs/getting-started.md` na Compiled Skill (D3).
- **Não** hardcode lógica por nome de runtime no CLI (`if cursor`, `if antigravity`) — use campos do manifest e adapters declarativos (ver [Apêndice C](#apêndice-c--anti-padrões-de-implementação)).
- **Gate de ouro:** `dag init --orchestrator=antigravity` deve passar no script de paridade (§5.11, §6). **Não avance da Fase 2 sem isso.**
- Decisões fechadas estão em §3 (D1–D13) e histórico em §12 ✅. Única ação pendente antes de publicar manifests worker não validados: **S1** (§5.12).

### Modelo mental (leia antes de codar)

Você está implementando um **compilador de produto**, não um fork por runtime:

```
Repo dev (Source Skill)          CLI npm (dag)                 Projeto do usuário
───────────────────────          ─────────────                 ──────────────────
SKILL.md + <<<DAG:>>>      ──►   Runtime Compiler       ──►   Compiled Skill
cli/manifests/{runtime}/         + manifest resolver           + Project Scaffold
cli/hooks/                     + hook wiring                 + hook config upsert
```

**Por que isso importa:** o dag-flow hoje é copiado manualmente para `.agents/skills/` com `agy` e `run_command` hardcoded. Cada novo runtime (Cursor, Claude) exigiria duplicar o repo inteiro. A compilação mantém **um** Source Skill e **N** outputs — o mesmo padrão que ADR-0005 aplicou aos vaults com `chmod`, estendido agora a CLI commands, tool names e hook wiring.

**Duas roles, dois manifests (quando necessário):**
- **Orchestrator Runtime** — IDE/agente onde o usuário conversa e carrega a skill (tools, install path, hooks).
- **Worker Runtime** — CLI que `dag_runner.py` spawna para executar tasks e `done_when_gate` LLM.

Quando `--worker` é omitido, um manifest serve ambos (caso Antigravity: `agy`; caso Cursor: `cursor agent`). Quando differem (ex. `--orchestrator=cursor --worker=agy` em testes), Category A vem do **worker**; B/C e hooks do **orchestrator** (D1).

**Roadmap V1 (ordem de produto):**
1. Infra multi-runtime (compilador, `dag init`, hooks, scaffold)
2. Paridade `antigravity` (gate de ouro)
3. Ship **`cursor`** — primeiro runtime além do legado
4. `claude` — **pós-V1** (desejos futuros; sem manifest built-in)

---

## 1. Contexto do problema

### 1.1 O que é o dag-flow

O dag-flow é um sistema de orquestração de agentes de IA distribuído como **Agent Skill** — markdown + scripts Python que ensinam um Orchestrator a:

1. **Specify** — refinar requisitos com o usuário
2. **Design** — definir interfaces e padrões
3. **Tasks** — gerar `dag.json` (DAG executável)
4. **Execute** — o usuário roda `run_dag.sh`; workers CLI executam tasks em paralelo

O Orchestrator **não escreve código de aplicação diretamente** — delega a workers via DAG. Essa separação é invariante arquitetural (ver ADR-0005, ADR-0006).

### 1.2 Estado atual (evidência no codebase)

**Instalação manual hoje:** o usuário copia o repo para `.agents/skills/dag-flow/` (Antigravity) ou equivalente. Não há compilação.

**Acoplamento hardcoded ao Antigravity:**

```python
# scripts/dag_runner.py ~linha 139
worker_cmd = ['agy', '--dangerously-skip-permissions', '--prompt', prompt]
```

```markdown
# references/tasks.md — templates que o Subagent Planner replica em done_when_gate
agy --dangerously-skip-permissions --prompt "Role: Independent Auditor..."
```

```markdown
# SKILL.md e references/*.md
use the `run_command` tool ...
Spawn the Subagent Planner (`define_subagent`) ...
```

**Por que isso é crítico:** cada novo runtime (Cursor, Claude) exigiria fork manual de todo o repo. Com N runtimes, cada feature = N PRs. O dag-flow é **produto de desenvolvimento** sendo tratado como **produto de instalação**.

### 1.3 Solução em uma frase

Introduzir **compilação**: o repo de desenvolvimento mantém a **Source Skill** (placeholders `<<<DAG:NAME>>>`); `dag init` produz a **Compiled Skill** (valores resolvidos por runtime) no path de skills do orchestrator escolhido.

---

## 2. Três categorias de acoplamento

Cada categoria exige estratégia diferente na compilação:

| Cat. | O que é | Exemplo | Onde aparece |
|------|---------|---------|--------------|
| **A — CLI** | Comando shell executado pelo worker ou auditor | `agy --prompt "..."` | `references/*.md` (`done_when_gate` templates), `dag-config.json` |
| **B — Tools** | Nome de tool que o LLM invoca | `run_command`, `Task` | `SKILL.md`, `references/*.md` |
| **C — Descritivo** | Nome do runtime em prosa | "Gemini CLI workers" | `references/tasks.md` |
| **Partial** | Parágrafo inteiro de instrução | spawn subagent API | `SKILL.md`, `references/tasks.md` |

**Por que parciais existem:** trocar `define_subagent` por `Task` no Cursor não basta — a API inteira é diferente (parâmetros, modelo de execução). Ver seção [Compilador](#5-runtime-compiler).

---

## 3. Decisões arquiteturais (com porquê)

Cada decisão abaixo foi debatida explicitamente. **Implemente conforme documentado.** Alternativas rejeitadas estão listadas para você não reintroduzi-las.

---

### D1 — Dual Manifest Compilation

**Problema:** `dag init --orchestrator=cursor --worker=claude` mistura dois mundos:
- O **Orchestrator** (Cursor) usa tools `Shell`, `Task`, path `.cursor/skills/`
- O **Worker** (`claude` CLI) executa tasks e gates no shell

**Cenário que quebra se tudo vier do orchestrator:**

```
Orchestrator = Cursor → references/tasks.md compilado com "cursor agent --prompt ..."
Worker real     = claude → dag_runner spawna "claude -p ..."
Auditor executa done_when_gate do DAG → comando cursor, worker é claude → INCONSISTENTE
```

**Decisão:**

| Placeholder / dado | Manifest |
|------------------|----------|
| `CLI_COMMAND_PREFIX`, `AUDITOR_COMMAND_TEMPLATE` | **Worker** |
| `TOOL_RUN_COMMAND`, `TOOL_VIEW_FILE`, `RUNTIME_NAME` | **Orchestrator** |
| `SPAWN_SUBAGENT_*` (partials — inventário §5.2) | **Orchestrator** |
| `SKILL_INSTALL_PATH` | **Orchestrator** |
| `dag-config.json` → `command_template` | **Worker** |

`--worker` omitido → um manifest serve ambos (paridade Antigravity).

**Alternativa rejeitada:** compilar tudo do orchestrator — quebra `done_when_gate` quando orchestrator ≠ worker.

---

### D2 — Pending DAG Guard e status no vault

**Problema que `dag update` resolve:** usuário gera DAG com templates da versão N da skill, depois atualiza skill para N+1 sem executar — DAG stale com comandos CLI antigos.

**Bug no codebase atual (você deve corrigir):**

```
1. Vault:     .specs/dags/feature.json     ← gerado pelo Orchestrator
2. Runner copia para: .specs/runs/feature/dag.json
3. update_task_status.py atualiza SÓ a cópia em runs/
4. Vault permanece "Pending" mesmo após execução bem-sucedida
```

**Decisão:**
- Guard varre `.specs/dags/*.json` (não `dag.json` como nome fixo — arquivos são `[feature].json`)
- Bloqueia se **qualquer** task tem status sem `"Done"` (inclui `Pending`, `Failed`, ausente)
- **`Failed` bloqueia igual `Pending`** — DAG incompleto; usuário deve resolver via Escalation Phase ou remover o DAG do vault antes de `dag update`
- `dag_runner.py` / `update_task_status.py` devem atualizar o **vault** com unlock `chmod` temporário (padrão dos Bash Gates em `commit_spec.sh` — ver linhas 30–35)

**Cenário `Failed` (por que não permitir update):**
```
1. DAG feature-X.json → task T3 status Failed (esgotou tentativas)
2. Usuário roda dag update → skill N+1 com template AUDITOR_COMMAND_TEMPLATE novo
3. DAG no vault ainda referencia gates da skill N
4. Escalation Phase assume skill + DAG da mesma geração → estado inconsistente
```
Permitir update com `Failed` mistura templates novos com execução velha — pior que skill desatualizada.

**Por que abort total (não só avisar):** update parcial = skill nova + DAG antigo = estado pior que desatualizado.

**Alternativa rejeitada:** checar só `.specs/runs/` — ignora DAGs gerados e nunca executados.

---

### D3 — Compiled Skill = só pacote Agent Skill

**O que é Agent Skill:** artefatos que o **Orchestrator lê** para conduzir o fluxo dag-flow.

**Inclui:**
- `SKILL.md`, `references/` (compilado), `scripts/` (operacionais), `dag-config.json`

**Não inclui:**
- `docs/getting-started.md` → README do npm / repo dev
- Hooks → pacote npm CLI (`cli/hooks/`)
- Task Skills → skills opcionais referenciadas em nodes do DAG (`skill: "coding-guidelines"`)

**Por que separar Task Skills:** o dag-flow skill ensina orquestração. Skills de domínio no DAG são responsabilidade do usuário disponibilizar no ambiente dos workers (via MCP, path local, etc.). Confundir os dois levou a erro de design na discussão inicial (achar que MCP deveria servir a Compiled Skill do dag-flow).

**Por que não compilar getting-started:** o Orchestrator não lê onboarding humano; aumenta superfície sem benefício cognitivo.

---

### D4 — Init Prerequisites Gate (CLI, não SKILL)

**Decisão:** `dag init` aborta se `context-mode` ou `rtk` não estão no PATH.

**Por quê:** são Core Infrastructure (`CONTEXT.md`). O Orchestrator usa `ctx_search` e workers usam `rtk` nos gates. Validar na instalação evita falha opaca na primeira sessão.

**Por que NÃO colocar na SKILL.md:** instrução ao LLM do tipo "pré-requisito: context-mode" é ignorável. Infraestrutura = responsabilidade do CLI.

**Alternativa rejeitada:** soft warning — usuário descobre tarde demais.

---

### D5 — Init Idempotency

```bash
dag init          → aborta se Compiled Skill já existe no target path
dag init --force  → sobrescreve (aviso: perde edições locais)
dag update        → caminho normal de upgrade
```

**Por quê:** `init` = bootstrap; `update` = upgrade. Misturar gera ambiguidade sobre edições manuais em `references/tasks.md`.

---

### D5b — Project Scaffold

**Problema:** `hooks/setup_indexer.sh` (sendo removido) só criava `.specs/dags/` chmod 555. ADR-0005/0006 exigem **Topology Separation** completa: staging aberto, vaults trancados. Em projeto virgem, o primeiro `commit_spec.sh` falha sem `.specs/features/` — o script faz `chmod 755 .specs/features` na linha 30, mas o diretório pai pode não existir com permissão correta.

**Decisão:** `dag init` cria o **Project Scaffold** completo — três dirs com chmod correto:

| Dir | chmod | Papel |
|-----|-------|-------|
| `.specs/staging/` | 755 | Staging Area — Orchestrator rascunha antes dos Bash Gates |
| `.specs/features/` | 555 | Vault de specs — só `commit_spec.sh` / `commit_design.sh` escrevem |
| `.specs/dags/` | 555 | Vault de JSON DAGs — só `write_dag.sh` escreve |

**Comportamento idempotente:**
- Dirs existentes: preservar conteúdo; corrigir chmod se drift (ex.: usuário rodou `chmod 777` manualmente)
- Dirs ausentes: criar com chmod correto
- **Fora do scaffold init:** `.specs/runs/` (criado por `dag_runner.py` linha 35) e `.specs/hotfixes/` (Quick Mode) — lazy, em runtime

**Por que no CLI e não na SKILL.md:** mesmo raciocínio de D4 — bootstrap de infraestrutura é determinístico; LLM pode ignorar instrução de criar dirs.

**Alternativa rejeitada:** só `dags/` — primeiro Specify falha em projeto virgem; repete o bug parcial do `setup_indexer.sh`.

---

### D6 — Auditor Gate Contract (invariante)

**O que é:** muitas tasks usam `done_when_gate` com LLM-as-a-judge — o worker CLI avalia código e responde PASS/FAIL. O `auditor.py` executa esse comando e decide se a task passou.

**Contrato (V1 — não alterar sem ADR):**
1. Subprocesso do `done_when_gate` termina com **exit code 0**
2. **stdout contém a substring `"PASS"`** (case-sensitive)

**Drift no codebase (você deve corrigir na Fase 5):** `scripts/auditor.py` linhas 53–56 hoje só checam `exit_code == 0` e **não** verificam `"PASS"` no stdout. O contrato documentado em ADR-0008 e benchmarks assume ambos. Alinhe `auditor.py` ao contrato — **não** torne o auditor runtime-aware; corrija a lógica de validação única.

**Por que não tornar `auditor.py` runtime-aware:** multiplicaria branches por CLI; o escape hatch é `auditor_wrapper` no manifest do worker (script shell que normaliza stdout).

**Worker Runtime Validation Spike (§5.12):** antes de publicar manifest de worker **não validado**, rodar spike manual. Se falhar → `auditor_wrapper` no manifest. **Gate por worker** — infra compartilhada (compilador, init, scaffold) não espera spike; só publicação do manifest daquele worker.

**Workers validados V1 (S1 + S2 2026-06-20):** `agy` (antigravity), `cursor agent` com flags §5.13.

**Fora do escopo V1:** `claude` CLI — adiado; não bloqueia implementação.

---

### D7 — `dag manifest scaffold --extends` obrigatório

**Por quê:** sem `extends`, usuário precisa criar `partials/spawn-subagent.md` do zero — conhecimento interno. Manifest incompleto compila mas o LLM recebe instrução truncada (pior que erro explícito).

```bash
# ✅
dag manifest scaffold --extends=cursor --output=./my-runtime/

# ❌ erro com lista de built-ins
dag manifest scaffold --output=./my-runtime/
```

---

### D8 — Built-ins V1: `antigravity` + `cursor`; `claude` adiado

**V1 — implementar e shipar:**
| Built-in | Papel | Por quê nesta ordem |
|----------|-------|---------------------|
| `antigravity` | Paridade + gate de ouro | Usuários atuais; valida compilador sem mudar comportamento |
| `cursor` | Primeiro runtime multi-runtime real | Alvo pós-infra — orchestrator `pre_tool_use` + worker `cursor agent` (S1 ✅) |

**Adiado pós-V1 (desejos futuros):**
| Runtime | Status |
|---------|--------|
| `claude` | Fora do escopo V1 — sem manifest built-in, sem Fase dedicada. Usuário pode adicionar depois via `dag manifest scaffold --extends=cursor` e adaptar worker CLI. |

**Por quê remover gemini-cli:** Google descontinuou o CLI cru; default Gemini é Antigravity (`agy`).

**Por quê não shipar `claude` em V1:** decisão de produto — após construir infra multi-runtime, o runtime que importa implementar é **Cursor**. Claude não bloqueia compilador, init, hooks nem paridade Antigravity.

**Alternativa rejeitada:** três built-ins obrigatórios na Fase 7 — manutenção de manifest + spike sem usuário V1.

---

### D9 — Eliminar `references/discovery.md`

**Por quê:** conteúdo duplicava `SKILL.md` (trigger, goal, link para discovery.md). Dependia de `setup_indexer.sh` (morrendo). O protocolo útil resume-se a: `ctx_search` only → sintetizar `CONTEXT.md` em pedido explícito do usuário.

**Ação:** inline ~5 linhas na seção Discovery de `SKILL.md`; deletar arquivo; remover links órfãos.

---

### D10 — Matar `hooks/setup_indexer.sh`

**O que o script faz hoje (dois papéis misturados):**
1. `mkdir .specs/dags && chmod 555` — **dag-flow**
2. `context-mode hook cursor sessionstart`, copia `.mdc`, gera `GEMINI.md` de indexing — **context-mode (não dag-flow)**

**Decisão:** remover do fluxo de instalação dag-flow. **Project Scaffold** (D5b) vai para `dag init`. Indexing FTS5 = usuário instala context-mode separadamente (pré-requisito verificado pelo CLI).

**Alternativa rejeitada:** `dag init` configurar context-mode — acopla dois produtos, confunde responsabilidades.

---

### D11 — dag-flow Hook (Guard + Router) — implementar de verdade

**Contexto histórico (benchmark e2e S3/S4):** sem proteção física em `src/`, o Orchestrator editava código direto em vez de seguir Quick Mode — LLMs capazes ignoram instrução comportamental. ADR-0005 resolveu `.specs/dags/` com chmod 555; o hook resolve `src/`, `lib/`, `api/`, `test/`.

**Drift crítico:** `agent_planner_v2_implementation_plan.md` diz que `hooks/dag-flow-src-guard.sh` existe. **Não existe.** Você deve implementar em `cli/hooks/dag-flow-guard.mjs`.

**Erro de design a evitar (debate grill):** não trate Antigravity (ou Cursor) como caso especial no CLI. Runtimes sem API de hook nativa são uma **classe** — não exceções ad hoc. O manifest declara **Hook Wiring Tier**; o CLI executa o protocolo do tier.

**Dois papéis (não só bloquear src/):**

#### Guard
- Intercepta writes em `src/`, `lib/`, `api/`, `test/`
- Bypass: env `DAG_FLOW_WORKER=1` setada por `dag_runner.py` ao spawnar worker CLI
- Orchestrator e sessões sem dag-flow: bloqueados

#### Router
- Quando bloqueia, lê o prompt do usuário e sugere caminho dag-flow
- **Problema original:** usuário usa IDE sem carregar skill dag-flow e tenta editar código — hook educa
- **Evolução rejeitada:** sempre sugerir Quick Mode — pedidos grandes precisam de Specify

**Heurística (viés Specify se ambíguo):**
```
Quick Mode se:
  - frase canônica no prompt: "Fix bug", "Hotfix", "Hot-patch", "Quick mode"
  OU
  - (1–2 arquivos E erro/sintoma/regressão E sem requisitos novos)
Senão → Specify
```
Frases canônicas em `references/quick-mode.md`.

**Mensagem adaptativa única** (sem detectar se sessão dag-flow está ativa):
```text
❌ Edição direta em {path} bloqueada — dag-flow exige execução via DAG.

{classificação}:
  → {comando concreto sugerido}

Já no dag-flow?
  → {staging, vault via gates, run_dag.sh}
```

**Localização:** `cli/hooks/dag-flow-guard.mjs` no pacote npm — **não** na Compiled Skill.

**Hook Wiring Tier** (campo do manifest do **Orchestrator**, não do worker):

| Tier | Quando usar | `dag init` wiring | Guard físico? |
|------|-------------|-------------------|---------------|
| `pre_tool_use` | Runtime expõe interceptação pré-tool-call | Hook Config Upsert (§5.10) em `HOOK_CONFIG_PATH` | **Sim** |
| `boot_file` | Sem API de hook nativa | Append idempotente de regra cognitiva em `BOOT_FILE` | **Não** — degradação honesta |
| `none` | Nem hook nem boot file confiável | Skip + `console.warn` no CLI | **Não** |

**Built-ins V1:**

| Built-in | Tier | Notas |
|----------|------|-------|
| `cursor` | `pre_tool_use` | Orchestrator + worker (`cursor agent`); S1 ✅ |
| `antigravity` | `boot_file` | `BOOT_FILE: GEMINI.md`; worker `agy` |

**`claude`:** não é built-in V1 — ver D8.

**`BOOT_FILE` não é campo “do Antigravity”** — é o mecanismo do tier `boot_file`, reutilizável por qualquer orchestrator sem hook nativo.

Manifests custom herdam tier via `extends`. ADR-0010 documenta limitação do tier `boot_file` (enforcement cognitivo ≠ bloqueio físico).

**Alternativa rejeitada:** `if (runtime === 'antigravity')` no CLI — não escala; cada runtime novo vira branch.

---

### D12 — `dag update` re-wire hooks

**Por quê:** hooks vivem no pacote npm (`cli/hooks/`). Melhoria no Router deve chegar ao usuário via `dag update` sem `dag init --force`.

**Comportamento:** após recompilar skill, `dag update` re-executa wiring idempotente — **mesmo protocolo** que `dag init` (§5.5 passo 6).

**Hook Config Upsert** (tier `pre_tool_use` apenas — algoritmo completo em §5.10):

| Campo manifest | Papel |
|----------------|-------|
| `HOOK_CONFIG_PATH` | Arquivo de config de hooks do Orchestrator (ex.: `.cursor/hooks.json`) |
| `HOOK_EVENT` | Nome do slot de evento naquele runtime (ex.: `preToolUse`) |
| `HOOK_ENTRY_ID` | ID estável para dedup — ex.: `"dag-flow-guard"` |
| `hook_config_adapter` | (opcional) Nome do adapter built-in se shape JSON não for genérico |

**Protocolo resumido:** ler config → upsert **somente** entrada `HOOK_ENTRY_ID` → nunca remover/sobrescrever entradas de terceiros (caveman, tool-routing, context-mode no repo de dev).

**Erro de design a evitar:** sobrescrever `HOOK_CONFIG_PATH` inteiro — apaga hooks do usuário. Append cego sem dedup — duplica entradas a cada `dag update`.

**Tier `boot_file`:** append idempotente em `BOOT_FILE` com marker HTML `<!-- dag-flow-hook -->` para re-upsert. **Tier `none`:** skip.

**Alternativa rejeitada:** arquivo separado `hooks.dag-flow.json` — runtimes V1 não garantem include de arquivo externo.

---

### D13 — MCP sem mudanças

**Por quê:** `mcp/` serve Task Skills de paths configurados (`./.dag-flow/skills`). A Compiled Skill do dag-flow é carregada pelo runtime no path do orchestrator (`.cursor/skills/dag-flow/`). São canais diferentes.

---

## 4. Escopo V1

### In scope
Tudo em D1–D13 + D5b + pacote `cli/`, compiler dois passes, `extends`, manifests externos, herança. **Built-ins V1:** `antigravity` + `cursor` apenas (D8).

### Out of scope
Registry comunidade, UI gráfica, migração automática dag.json legado, testes pós-instalação de Compiled Skills, configurar context-mode, **built-in `claude`** (adiado pós-V1).

---

## 5. Solução técnica

### 5.1 Arquitetura

```
Source Skill (repo dev)                    Projeto do usuário
───────────────────────                    ───────────────────
SKILL.md + references/ <<<DAG:>>>     ──►   {SKILL_INSTALL_PATH}/dag-flow/
scripts/ (cópia)                           ├── SKILL.md, references/, scripts/
cli/manifests/                               └── dag-config.json
cli/hooks/                             ──►   wired via Hook Config Upsert (tier pre_tool_use)
                                              or BOOT_FILE append (tier boot_file)
```

### 5.2 Placeholders

Sintaxe: `<<<DAG:NAME>>>`

**Por que não `{{}}` ou `__`:** colisão com templates JS, Python dunders, markdown.

**Inventário V1 (escalares — D1):**

| Placeholder | Cat. | Manifest |
|-------------|------|----------|
| `CLI_COMMAND_PREFIX` | A | worker |
| `AUDITOR_COMMAND_TEMPLATE` | A | worker |
| `TOOL_RUN_COMMAND` | B | orchestrator |
| `TOOL_VIEW_FILE` | B | orchestrator |
| `RUNTIME_NAME` | C | orchestrator |

**Partials spawn (orchestrator — Passe 1):** mapeamento em `orchestrator.partials` (§5.7). Cada chave é o nome do placeholder; o valor é o arquivo em `partials/`.

**Antigravity (três placeholders — paridade gate de ouro):** a prose atual de `define_subagent` **não é idêntica** em todos os arquivos. Um único `SPAWN_SUBAGENT_BLOCK` quebraria `verify-antigravity-parity.sh` (§5.11).

| Placeholder | Partial | Onde injetar na Source Skill (Task 3) | Contexto fora do placeholder |
|-------------|---------|---------------------------------------|------------------------------|
| `SPAWN_SUBAGENT_BLOCK` | `spawn-subagent.md` | `references/tasks.md` passo 3 | prefixo `3. ` |
| `SPAWN_SUBAGENT_SKILL_BLOCK` | `spawn-subagent-skill.md` | `SKILL.md` § Tasks — Subagent Relay | linhas anteriores até `system prompt. ` |
| `SPAWN_SUBAGENT_QUICK_BLOCK` | `spawn-subagent-quick.md` | `references/quick-mode.md` Step 3 | heading `**Step 3 - Spawn:**` |

Runtimes com uma única forma de spawn (ex. Cursor `Task`) podem declarar só as entradas necessárias em `orchestrator.partials`. Filhos `extends` herdam e sobrescrevem entradas (§5.8).

**`AUDITOR_COMMAND_TEMPLATE`:** usar colchetes `[OUTPUT_FILES]` e `[CONTEXT_REF]` — igual ao repo Source Skill atual (`references/tasks.md`, `references/quick-mode.md`), não chaves `{…}`.

### 5.3 Runtime Compiler

**Passe 1:** para cada entrada em `orchestrator.partials`, ler `partials/{arquivo}` e substituir `<<<DAG:{chave}>>>` pelo conteúdo verbatim
**Passe 2:** substituir escalares de `orchestrator.placeholders` e `worker.placeholders`
**Validação:** grep zero `<<<DAG:` na saída

**Por que ordem importa:** partial pode conter `<<<DAG:RUNTIME_NAME>>>` que só resolve no passe 2.

### 5.4 dag-config.json

```json
{
  "_meta": {
    "orchestrator": "cursor",
    "worker": "cursor",
    "dag_flow_version": "2.0.0",
    "schema_version": "1"
  },
  "worker": {
    "command_template": ["cursor", "agent", "--print", "--output-format", "text", "--trust", "--force", "--approve-mcps", "-p", "<<<PROMPT>>>"]
  }
}
```

*(Exemplo V1 default — `dag init --orchestrator=cursor`. Dual-worker ex. `orchestrator=cursor worker=agy` possível via flags.)*

**Por que JSON e não placeholder no Python:**
1. Risco de quebrar sintaxe Python
2. Debuggável pelo usuário
3. `_meta` permite `dag update` saber runtimes usados

`dag_runner.py` busca config no mesmo diretório dos scripts. Falha explícita se ausente.

### 5.5 Comando `dag init` — fluxo completo

1. Verificar `context-mode` + `rtk` no PATH (D4)
2. Abortar se Compiled Skill existe no `skill_install_path` (D5; salvo `--force`)
3. Resolver manifests (orchestrator + worker; built-in ou path externo com `/` ou `.`)
4. Dual Manifest Compilation → instalar em `{skill_install_path}/dag-flow/`
5. Copiar **Compiled Skill Scripts** (whitelist §5.9) — não copiar `migrate_*` / `test_*`
6. **Project Scaffold** (D5b) — salvo `--project-scaffold=false` (útil em testes):
   - `mkdir -p .specs/staging && chmod 755 .specs/staging`
   - `mkdir -p .specs/features && chmod 555 .specs/features`
   - `mkdir -p .specs/dags && chmod 555 .specs/dags`
   - Idempotente: preservar conteúdo; corrigir chmod se drift
7. Wire hooks conforme `hook_wiring_tier` (D11, D12, §5.10)
8. Escrever `dag-config.json` com `_meta` + `worker.command_template`

### 5.6 Comando `dag update`

1. Pending DAG Guard (D2)
2. Recompilar markdowns
3. Preservar `dag-config.json` → seção `worker`
4. Atualizar `_meta.dag_flow_version`
5. Re-wire hooks

### 5.7 Manifests built-in e schema `manifest.json`

**Estrutura de diretório (cada built-in):**
```
cli/manifests/{runtime_id}/
├── manifest.json
└── partials/
    ├── spawn-subagent.md         # Antigravity: <<<DAG:SPAWN_SUBAGENT_BLOCK>>>
    ├── spawn-subagent-skill.md   # Antigravity: <<<DAG:SPAWN_SUBAGENT_SKILL_BLOCK>>>
    └── spawn-subagent-quick.md   # Antigravity: <<<DAG:SPAWN_SUBAGENT_QUICK_BLOCK>>>
```

**Schema `manifest.json` (V1):**

```json
{
  "schema_version": 1,
  "runtime_id": "cursor",
  "extends": null,

  "orchestrator": {
    "hook_wiring_tier": "pre_tool_use",
    "hook_config_path": ".cursor/hooks.json",
    "hook_event": "preToolUse",
    "hook_entry_id": "dag-flow-guard",
    "hook_config_adapter": "cursor",
    "boot_file": null,
    "skill_install_path": ".cursor/skills",
    "placeholders": {
      "TOOL_RUN_COMMAND": "Shell",
      "TOOL_VIEW_FILE": "Read",
      "RUNTIME_NAME": "Cursor"
    }
  },

  "worker": {
    "command_template": ["cursor", "agent", "--print", "--output-format", "text", "--trust", "--force", "--approve-mcps", "-p", "<<<PROMPT>>>"],
    "worker_validation_status": "validated",
    "auditor_wrapper": null,
    "placeholders": {
      "CLI_COMMAND_PREFIX": "cursor agent --print --output-format text --trust --force --approve-mcps",
      "AUDITOR_COMMAND_TEMPLATE": "cursor agent --print --output-format text --trust --force --approve-mcps -p \"Role: Independent Auditor. Evaluate if the code in [OUTPUT_FILES] strictly obeys this rule: '[CONTEXT_REF]'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>\""
    }
  }
}
```

**Campos obrigatórios por role:**

| Campo | Role | Quando |
|-------|------|--------|
| `orchestrator.placeholders.*` | Orchestrator | Sempre que manifest usado como orchestrator |
| `orchestrator.partials` | Orchestrator | Mapa `PLACEHOLDER → partials/*.md` (Passe 1); omitir se runtime não usa spawn partial |
| `orchestrator.hook_wiring_tier` | Orchestrator | Sempre |
| `orchestrator.hook_config_path` + `hook_event` + `hook_entry_id` | Orchestrator | Se `hook_wiring_tier === "pre_tool_use"` |
| `orchestrator.boot_file` | Orchestrator | Se `hook_wiring_tier === "boot_file"` |
| `worker.command_template` | Worker | Sempre que manifest usado como worker |
| `worker.placeholders.CLI_COMMAND_PREFIX` | Worker | Sempre |
| `worker.placeholders.AUDITOR_COMMAND_TEMPLATE` | Worker | Sempre |
| `worker.worker_validation_status` | Worker | `"validated"` \| `"pending"` \| `"failed"` |
| `worker.auditor_wrapper` | Worker | Path relativo no manifest se spike falhar |

**Exemplo `antigravity/manifest.json` (orchestrator + worker — `--worker` omitido):**

```json
{
  "schema_version": 1,
  "runtime_id": "antigravity",
  "extends": null,
  "orchestrator": {
    "hook_wiring_tier": "boot_file",
    "hook_config_path": null,
    "hook_event": null,
    "hook_entry_id": null,
    "boot_file": "GEMINI.md",
    "skill_install_path": ".agents/skills",
    "partials": {
      "SPAWN_SUBAGENT_BLOCK": "spawn-subagent.md",
      "SPAWN_SUBAGENT_SKILL_BLOCK": "spawn-subagent-skill.md",
      "SPAWN_SUBAGENT_QUICK_BLOCK": "spawn-subagent-quick.md"
    },
    "placeholders": {
      "TOOL_RUN_COMMAND": "run_command",
      "TOOL_VIEW_FILE": "view_file",
      "RUNTIME_NAME": "Antigravity"
    }
  },
  "worker": {
    "command_template": ["agy", "--dangerously-skip-permissions", "--prompt", "<<<PROMPT>>>"],
    "worker_validation_status": "validated",
    "auditor_wrapper": null,
    "placeholders": {
      "CLI_COMMAND_PREFIX": "agy --dangerously-skip-permissions",
      "AUDITOR_COMMAND_TEMPLATE": "agy --dangerously-skip-permissions --prompt \"Role: Independent Auditor. Evaluate if the code in [OUTPUT_FILES] strictly obeys this rule: '[CONTEXT_REF]'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>\""
    }
  }
}
```

**Exemplo dual-manifest (ilustrativo — D1):** `--orchestrator=cursor --worker=claude` mostra por que Category A vem do worker. **V1 default ship:** `--orchestrator=cursor` sem `--worker` → cursor serve orchestrator e worker (`cursor agent`).

**`extends`:** filho declara `"extends": "cursor"` — deep merge; filho sobrescreve; detectar ciclos (§5.8).

**Compilação:** Passe 1 — cada par em `orchestrator.partials` injeta o arquivo em `<<<DAG:KEY>>>`; Passe 2 — escalares de `placeholders` (§5.3). Mapa de injeção na Source Skill: §5.2.

### 5.8 Herança `extends`

Deep merge; filho sobrescreve; parciais do filho sobrescrevem mesmo nome; detectar ciclos.

### 5.9 Scripts na Compiled Skill

**Decisão:** whitelist explícita no compilador — só **Compiled Skill Scripts**:

| Incluir | Excluir |
|---------|---------|
| `dag_runner.py`, `auditor.py`, `run_dag.sh` | `migrate_*.py` |
| `commit_spec.sh`, `commit_design.sh`, `write_dag.sh` | `test_*.py` |
| `update_task_status.py`, `validate_*.py`, `validate_pagrl.py`, `extract_json_dag.py` | |

**Por quê:** migrate/test são ferramentas de desenvolvimento do repo, não do usuário final.

**Por que rebaseline do gate de ouro:** instalação manual copiava o repo inteiro para `.agents/skills/dag-flow/` — incluía `migrate_*.py` e `test_*.py`. Isso era processo defeituoso, não spec. O gate de ouro compara **o que deve estar instalado**, não a cópia literal do repo (§5.11).

---

### 5.10 Hook Config Upsert (algoritmo)

**Entrada:** manifest orchestrator com `hook_wiring_tier: "pre_tool_use"`, path do pacote npm instalado.

**Saída:** `HOOK_CONFIG_PATH` atualizado; demais entradas intactas.

```
1. RESOLVER hookCommand = absolutePath(npmRoot + "/hooks/dag-flow-guard.mjs")

2. SE NOT exists(HOOK_CONFIG_PATH):
     config = adapter.emptyConfig()   // ex. cursor: { version: 1, hooks: {} }
   SENÃO:
     config = JSON.parse(read(HOOK_CONFIG_PATH))

3. SE NOT config.hooks[HOOK_EVENT]:
     config.hooks[HOOK_EVENT] = []

4. entry = config.hooks[HOOK_EVENT].find(e =>
       e.id === HOOK_ENTRY_ID OU e.command.includes("dag-flow-guard"))

5. newEntry = {
     id: HOOK_ENTRY_ID,
     command: hookCommand,
     timeout: 15
     // adapter pode adicionar matcher, etc. — só na criação, não sobrescrever matcher existente
   }

6. SE entry: atualizar entry.command (e timeout); preservar entry.matcher e demais campos
   SENÃO: config.hooks[HOOK_EVENT].push(newEntry)

7. write(HOOK_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n")

8. NUNCA deletar outros HOOK_EVENT nem entradas sem HOOK_ENTRY_ID
```

**Adapter `cursor` (`hook_config_adapter: "cursor"`):**
- `emptyConfig()`: `{ "version": 1, "hooks": {} }`
- Novo entry em `preToolUse` **sem** `matcher` por padrão — Guard filtra por path internamente; não replicar matcher do tool-routing

**Ordem de execução entre hooks `preToolUse`:** não garantida pelo runtime. Guard deve ser autossuficiente (decide bloqueio só pelo path da tool call).

**Tier `boot_file` (algoritmo resumido):**
```
1. marker = "<!-- dag-flow-hook -->"
2. block = marker + "\n" + BOOT_FILE_RULE_TEXT   // regra Guard+Router cognitiva
3. SE BOOT_FILE contém marker: substituir bloco após marker
   SENÃO: append ao final
```

---

### 5.11 Gate de ouro — script de paridade Antigravity

**Objetivo:** garantir que `dag init --orchestrator=antigravity` não altera comportamento dos usuários atuais (markdown + scripts operacionais).

**Baseline (`cli/test/fixtures/antigravity-parity-golden/`):** gerar **uma vez** na Fase 1:
```bash
# Capturar estado compilado equivalente ao Antigravity atual (pré-placeholders)
# Conteúdo do golden:
#   SKILL.md
#   references/*.md
#   scripts/{whitelist §5.9}
# NÃO incluir: migrate_*, test_*, docs/, hooks/, mcp/
```

**Pré-requisito (Q3 — instalação local):** o binário `dag` deve estar no PATH via `npm link` no pacote `cli/` (não usar `node dist/index.js` no gate). Build antes do link:
```bash
cd cli && npm install && npm run build && npm link
```

**Path de saída:** antigravity manifest define `orchestrator.skill_install_path: ".agents/skills"` — output compilado em `{target}/.agents/skills/dag-flow/`. Não usar `--skill-install-path` no gate salvo testes unitários isolados.

**Script `cli/scripts/verify-antigravity-parity.sh` (Fase 2):**
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT

# D4 — stubs para context-mode + rtk (init aborta sem eles no PATH)
printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

if ! command -v dag >/dev/null 2>&1; then
  echo "❌ dag not on PATH — run: cd cli && npm run build && npm link" >&2
  exit 1
fi

dag init --orchestrator=antigravity --target="$OUT" --project-scaffold=false

GOLDEN="$CLI_ROOT/test/fixtures/antigravity-parity-golden"
COMPILED="$OUT/.agents/skills/dag-flow"

diff -ru "$GOLDEN" "$COMPILED" \
  --exclude=dag-config.json \
  || { echo "❌ Gate de ouro falhou"; exit 1; }

echo "✅ Paridade Antigravity OK"
```

**Nota:** `dag-config.json` é artefato novo — excluído do diff. `dag init` em testes deve aceitar `--project-scaffold=false` para não poluir workspace do teste. O script **não** roda `npm run build` — build + link são pré-requisito do ambiente (local ou CI).

**Grep negativo na Source Skill (Fase 2):**
```bash
rg -l 'agy|run_command|view_file|define_subagent' SKILL.md references/ \
  && { echo "❌ Source Skill ainda tem acoplamento hardcoded"; exit 1; } || true
```

---

### 5.12 Worker Runtime Validation Spike (protocolo S1)

**Quando executar:** antes de marcar `worker_validation_status: "validated"` e publicar manifest na Fase 7.

**Por worker não validado:**

```bash
# Template — substituir {CLI} e {FLAGS} pelos valores reais do manifest
{CLI} {FLAGS} "Respond EXACTLY: PASS"
echo "exit=$?"
```

**Exemplos a testar (flags documentadas S1/S2 2026-06-20):**
```bash
agy --dangerously-skip-permissions --prompt "Respond EXACTLY: PASS"
cursor agent --print --output-format text --trust --force --approve-mcps -p "Respond EXACTLY: PASS"
# claude: adiado pós-V1 — quando built-in existir, usar --dangerously-skip-permissions -p
```

**Nota `cursor agent`:** não existe `--dangerously-skip-permissions`. Equivalente ADR-0003 em §5.13. `--print` é obrigatório para headless; `--trust --force --approve-mcps` recomendados para worker unsandboxed (spike S2).

**Critério de sucesso:** exit code 0 **e** stdout contém `PASS`.

**Se falhar:**
1. Criar `cli/manifests/{runtime}/auditor_wrapper.sh` que invoca CLI, parseia output, imprime `PASS`/`FAIL`, exit 0/1
2. Setar `worker.auditor_wrapper` no manifest
3. `AUDITOR_COMMAND_TEMPLATE` compilado usa wrapper — **não** alterar `auditor.py`

**Registrar resultado em §12 S1/S2** com data, comando exato, stdout truncado, exit code.

---

### 5.13 Worker Permission Flags (equivalente ADR-0003)

ADR-0003 exige workers **unsandboxed** — MCP, shell e write sem prompt humano no meio do `dag_runner.py`. Cada CLI expressa isso com flags diferentes (**ADR-0017**). **Não** usar `--dangerously-skip-permissions` no manifest `cursor` — a flag não existe.

| Worker | Flags de permissão (incluir em `command_template` e templates Category A) | Papel |
|--------|---------------------------------------------------------------------------|-------|
| `agy` | `--dangerously-skip-permissions` | Auto-aprova tools (Antigravity) |
| `claude` | `--dangerously-skip-permissions` (+ `-p` headless) | Adiado pós-V1 |
| `cursor agent` | `--print --output-format text --trust --force --approve-mcps` | Headless + workspace trust + force commands + auto-approve MCPs |

**Spike S2 (2026-06-20) — `cursor agent`:**

| Teste | Comando | Resultado |
|-------|---------|-----------|
| Auditor PASS | `... --trust --force --approve-mcps -p "Respond EXACTLY: PASS"` | exit 0, stdout `PASS` |
| Write arquivo | mesmo prefixo + prompt criar `.specs/staging/cursor-spike-write.txt` | exit 0, arquivo `SPIKE_OK` |
| Write sem trust/force | só `--print --output-format text -p` + write prompt | exit 0, arquivo criado *(workspace já confiável — não confiar para CI/projeto virgem)* |

**Decisão:** manifest `cursor` **sempre** inclui `--trust --force --approve-mcps` — paridade de intenção com ADR-0003 mesmo quando `--print` sozinho funcionar em workspace warm.

**Implementador:** `command_template` e `AUDITOR_COMMAND_TEMPLATE` devem usar o **mesmo prefixo de flags** — auditor e runner invocam o mesmo perfil de permissão.

---

## 6. Plano de migração

**Invariante absoluta:** `dag init --orchestrator=antigravity` passa em `verify-antigravity-parity.sh` (§5.11).

**Baseline de paridade (o que o gate compara):**

| Incluído no diff | Excluído do diff |
|------------------|------------------|
| `SKILL.md` + `references/*` compilados | `dag-config.json` (artefato novo) |
| Compiled Skill Scripts (whitelist §5.9) | `migrate_*`, `test_*` |
| | Project Scaffold (`.specs/`) |
| | Hooks wired no projeto |

**Por que rebaseline:** cópia manual do repo para `.agents/skills/` incluía scripts de dev — não é spec desejada.

Passos:
1. Manifest antigravity **antes** de placeholders
2. Placeholders em `SKILL.md` + `references/*.md` only
3. Parity script automatizado
4. Grep negativo: zero `agy|run_command|view_file|define_subagent` na Source Skill

**Não modificar `dag_runner.py` até Fase 5** — paridade Antigravity (Fase 2) compara só markdown compilado + scripts whitelist (cópia literal dos operacionais).

---

## 7. Estrutura monorepo alvo

```
dag-flow/
├── SKILL.md
├── references/           # sem discovery.md
├── scripts/
├── mcp/                  # inalterado
├── cli/
│   ├── hooks/dag-flow-guard.mjs
│   ├── package.json      # bin: {"dag": "dist/index.js"}
│   └── src/
│       ├── commands/{init,update,manifest/scaffold}.ts
│       ├── compiler/{runtime-compiler,manifest-resolver}.ts
│       └── manifests/{antigravity,cursor}/   # claude: pós-V1
└── docs/adr/
```

Remover ou deprecar `hooks/setup_indexer.sh` na raiz.

---

## 8. Estratégia de testes

| Teste | Por quê existe |
|-------|----------------|
| Unit compiler dois passes | Regressão de ordem e placeholders |
| Unit resolver extends | Herança é footgun comum |
| Unit Pending DAG Guard | Bloqueio é safety-critical |
| Unit Hook Router | Classificação Specify vs Quick — regressão S3 |
| Integration dag init | Paridade + prerequisites + hooks |
| Regression Antigravity parity | **Gate de ouro** — `verify-antigravity-parity.sh` |
| Unit hook config upsert | Não apagar hooks terceiros — regressão real no repo dev |
| Integration dag update | Guard + hooks re-wire |

---

## 9. Riscos

| Risco | Por quê importa | Mitigação |
|-------|-----------------|-----------|
| Paridade Antigravity quebrada | Usuários atuais quebram | Fase 2 gate |
| Hook não implementado | S3/S4 regressam | Fase 9 obrigatória |
| Vault status não atualizado | Guard falso positivo | Fase 5 corrige runner |
| CLI sem PASS/FAIL | Auditor quebra em worker não validado | Worker Runtime Validation Spike + `auditor_wrapper` |
| Hook config upsert | Quebra hooks de terceiros no projeto | Hook Config Upsert por `HOOK_ENTRY_ID` |

---

## 10. Plano de implementação

| Fase | Entrega | Por quê nesta ordem |
|------|---------|---------------------|
| **1** | Manifest antigravity + auditoria placeholders | Base de paridade |
| **2** | Placeholders + **diff zero** | Gate — nada mais sem isso |
| **3** | Pacote cli + compiler + resolver | Infra de compilação |
| **4** | `dag init` completo | Primeiro fluxo usuário |
| **5** | `dag_runner.py` + vault status | Workers usam config |
| **6** | `dag update` | Upgrade path |
| **7** | Manifest `cursor` publicado (`worker_validation_status: validated`) | Primeiro multi-runtime real pós-infra |
| **8** | `dag manifest scaffold` | Extensibilidade |
| **9** | dag-flow Hook Guard+Router | Proteção src — drift hoje |
| **10** | discovery.md → SKILL.md | Cleanup |
| **11** | Remover setup_indexer.sh | Cleanup |

Estimativa: ~22 dias. Fase 5 ∥ 4 após 3. Fase 9 ∥ 7.

**Checklist implementador (sessão zerada):**

| Fase | Antes de avançar, verificar |
|------|----------------------------|
| 1 | `cli/manifests/antigravity/manifest.json` captura estado atual; golden fixture gerada |
| 2 | `verify-antigravity-parity.sh` passa; grep negativo na Source Skill |
| 3 | Compiler 2 passes; `extends` com detecção de ciclo; zero `<<<DAG:` na saída |
| 4 | Prerequisites gate; Project Scaffold; hook upsert não apaga `.cursor/hooks.json` |
| 5 | `dag_runner.py` lê `dag-config.json`; vault status atualizado; `auditor.py` checa PASS |
| 6 | Pending DAG Guard bloqueia `Failed`; `dag update` re-wire hooks |
| 7 | Manifest `cursor` shipped; S1 cursor ✅ | Multi-runtime real |
| 9 | `DAG_FLOW_WORKER=1` no runner; Guard bloqueia write em `src/` |

---

## 11. ADRs a criar antes da implementação

Criar em `docs/adr/` **antes** de codar — o implementador não deve inferir o porquê:

| ADR | Título | Conteúdo mínimo |
|-----|--------|-----------------|
| 0010 | dag-flow Hook (Guard + Router) | Tiers, upsert, boot_file marker, anti-padrão C1/C2 |
| 0011 | Dual Manifest Compilation | Tabela D1; dual-manifest quando orchestrator ≠ worker |
| 0012 | Pending DAG Guard | Vault fonte de verdade, Failed bloqueia, abort total |
| 0013 | Manifest Inheritance | extends, merge, ciclos |
| 0014 | Orchestrator/Worker split | dois flags, dag-config.json, schema §5.7 |
| 0015 | Compiled Skill Scripts whitelist | §5.9, rebaseline gate de ouro |
| 0016 | V1 runtime scope | D8 — antigravity + cursor; claude pós-V1 |
| 0017 | Per-runtime worker permission flags | §5.13; extends ADR-0003; spike S2 cursor |

---

## 12. Questões em Aberto

Esta seção preserva **histórico de debates** (grill 2026-06-20). O implementador em sessão zerada deve seguir §3 e §5 — não reabrir questões já em ✅.

**S1 fechado para escopo V1** (2026-06-20). `claude` adiado pós-V1 (Q18) — não bloqueia implementação.

#### S1 — Resultados Worker Runtime Validation Spike

| Campo | Conteúdo |
|-------|----------|
| **Escopo V1** | `agy` + `cursor agent` apenas |
| **Status** | ✅ Completo para V1 |

**Resultados (spike 2026-06-20):**

| Worker | Comando exato | Exit | PASS no stdout? | Ação V1 |
|--------|---------------|------|-----------------|---------|
| `agy` | `agy --dangerously-skip-permissions --prompt "Respond EXACTLY: PASS"` | 0 | ✅ sim (ruído indexing antes do `PASS`) | `validated` — antigravity |
| `cursor agent` | `cursor agent --print --output-format text --trust --force --approve-mcps -p "Respond EXACTLY: PASS"` | 0 | ✅ sim | `validated` — §5.13 |
| `claude` | — | — | — | **Adiado pós-V1** (Q18) — não implementar manifest built-in |

**Nota `claude`:** spike tentado retornou erro de org/subscription — irrelevante para V1; reavaliar quando built-in for adicionado. Usar `--dangerously-skip-permissions` como `agy`.

#### S2 — Worker Permission Flags (`cursor agent`)

| Campo | Conteúdo |
|-------|----------|
| **Pergunta** | Qual o equivalente a `--dangerously-skip-permissions` no `cursor agent`? |
| **Resolução** | `--print --output-format text --trust --force --approve-mcps` (§5.13) |
| **Status** | ✅ Completo 2026-06-20 — PASS + write validados |

---

### ✅ Resolvidas (grill 2026-06-20)

| # | Questão | Por que importava | Resolução | Impacto se tivesse ido para o outro lado |
|---|---------|-------------------|-----------|------------------------------------------|
| **Q2** | `dag manifest scaffold` sem `--extends`? | Manifest incompleto compila mas o LLM recebe `spawn-subagent.md` vazio ou genérico — falha silenciosa pior que erro explícito | `--extends` **obrigatório**; sem flag → erro listando built-ins | Usuários criariam manifests quebrados sem perceber |
| **Q3** | Pending DAG Guard: status por task ou só existência de arquivo? | Define se `dag update` bloqueia com DAG já executado (falso positivo) ou deixa passar DAG nunca rodado (falso negativo) | Status por task no **vault** `.specs/dags/*.json`; runner deve atualizar vault (não só `.specs/runs/`) | Só checar existência bloquearia para sempre; só runs ignoraria DAGs gerados e não executados |
| **Q4** | MCP (`mcp/`) precisa mudar para servir Compiled Skill? | Risco de escopo creep no pacote MCP; confusão entre dag-flow skill e Task Skills | **Sem mudanças.** MCP serve Task Skills em `./.dag-flow/skills`. Compiled Skill vai para path do orchestrator (`.cursor/skills/`, etc.) | Refatorar MCP sem necessidade; acoplar install path da skill ao protocolo MCP |
| **Q5** | Compiled Skill inclui `getting-started.md` e hooks? | Define tamanho do artefato instalado e o que o Orchestrator realmente lê | Só Agent Skill (`SKILL.md`, `references/`, `scripts/`, `dag-config.json`). Hooks no npm CLI. Docs no README | Skill inchada com conteúdo que o agente não usa; hooks duplicados por runtime |
| **Q6** | Categoria A (CLI) vem de qual manifest quando orchestrator ≠ worker? | `done_when_gate` no JSON gerado pelo Planner deve usar o CLI do **worker**, não da IDE | Categoria A do manifest do **worker**; B/C do **orchestrator** | DAG gerado com `cursor agent` mas worker `claude` — auditor e runner quebram |
| **Q7** | Incluir `gemini-cli` como quarto built-in? | Cada built-in = partial spawn-subagent + spike PASS/FAIL + manutenção | **Não.** Gemini cru descontinuado | Quarto manifest sem usuários |
| **Q18** | Built-in `claude` em V1? | Manutenção de terceiro runtime sem ser alvo de produto | **Não.** V1 shipa `antigravity` + `cursor` apenas. Claude = pós-V1 via scaffold custom | Fase 7 inflada; spike bloqueado por credenciais |
| **Q8** | Manter `references/discovery.md`? | Arquivo duplicava SKILL.md e dependia de `setup_indexer.sh` | Eliminar; protocolo inline no `SKILL.md` | Referências órfãs; instrução ao LLM para ler arquivo que não existe na Compiled Skill |
| **Q9** | `setup_indexer.sh` continua no `dag init`? | Misturava bootstrap dag-flow com configuração context-mode (outro produto) | **Matar** script do fluxo install. Bootstrap `.specs/` no `dag init`. context-mode = pré-requisito do usuário | dag-flow acoplado ao lifecycle do context-mode; responsabilidades confusas |
| **Q10** | `dag init` em cima de instalação existente? | Edições locais em `references/` perdidas silenciosamente | Aborta se existe; `--force` reinstala; `dag update` para upgrade | Sobrescrita silenciosa de customizações do usuário |
| **Q11** | Como wirear dag-flow Hook em runtimes sem API nativa? | Tratar runtime sem hook como exceção ad hoc não escala | **Hook Wiring Tier** no manifest: `pre_tool_use`, `boot_file`, `none`. V1: `cursor` tier 1; `antigravity` tier 2 | Branch por runtime no CLI |
| **Q12** | Papel do `BOOT_FILE` no manifest? | Campo órfão após remoção de getting-started da Compiled Skill | `BOOT_FILE` = mecanismo do tier `boot_file`; não específico do Antigravity | Confusão em manifests custom; acoplamento incorreto a onboarding |
| **Q13** | `Failed` bloqueia `dag update`? | Define se usuário pode atualizar skill com DAG em Escalation pendente | **`Failed` bloqueia** — mesmo critério que `Pending`; DAG incompleto. Resolver falha ou remover DAG do vault antes de update | Update com DAG falho mistura templates novos com execução velha |
| **Q14** | Como wirear hook sem apagar config de terceiros? | Projetos existentes já têm hooks; sobrescrever é inaceitável | **Hook Config Upsert**: manifest declara `HOOK_CONFIG_PATH`, `HOOK_EVENT`, `HOOK_ENTRY_ID`; `dag init`/`dag update` fazem upsert idempotente só da entrada dag-flow. Schema JSON por built-in adapter | Sobrescrever hook config; lógica hardcoded por runtime no CLI |
| **Q15** | Quais `scripts/` entram na Compiled Skill? | Instalação manual copiava repo inteiro; dev tools não pertencem ao artefato instalado | **Whitelist explícita** (§5.9) + **rebaseline** do gate de ouro para markdown compilado + Compiled Skill Scripts — não cópia literal do repo | Skill inchada; paridade presa a processo manual defeituoso |
| **Q16** | Bootstrap do projeto no `dag init`? | ADR-0005/0006 exigem topology completa; `setup_indexer.sh` só criava `dags/` | **Project Scaffold** completo: staging (755) + features (555) + dags (555). Idempotente. `runs/` e `hotfixes/` em runtime | Primeiro Specify falha em projeto virgem |
| **Q17** | Spike PASS/FAIL bloqueia implementação global ou por worker? | Spike mal posicionado atrasa infra runtime-agnostic | **Gate por Worker Runtime** — spike bloqueia só publicação do manifest daquele worker; infra e built-ins com worker já validado seguem sem esperar | Spike global atrasa compilador/init; ship sem validar quebra gates LLM |


---

### Como usar esta seção (grill futuro)

1. Novas questões → debate → mover para ✅ com data
2. Não remover linhas ✅ — histórico evita reabrir debates
3. Atualizar §3 (D*) quando decisão afetar implementação

---

## 13. Status de decisões

**Todas as decisões de design estão fechadas** (grill 2026-06-20). Implemente conforme §3 e §5.

| Área | Onde está |
|------|-----------|
| Compilação dual manifest | D1, §5.3–5.4 |
| Hook tiers + upsert | D11, D12, §5.10 |
| Project Scaffold | D5b, §5.5 passo 6 |
| Scripts whitelist | D3, §5.9 |
| Gate de ouro | §5.11, §6 |
| Spike worker | D6, §5.12 — **fechado V1** (`agy` + `cursor`) |
| Worker permission flags | ADR-0017, §5.13 |
| Built-ins V1 | D8 — `antigravity` + `cursor` |
| `claude` | Fora de escopo V1 — Q18 |

---

## 14. Referências

| Arquivo | Por que ler |
|---------|-------------|
| `CONTEXT.md` | Glossário |
| `scripts/dag_runner.py` | Hardcode agy; bug runs vs vault |
| `scripts/update_task_status.py` | Status update hoje |
| `scripts/commit_spec.sh` | Padrão chmod unlock vault |
| `SKILL.md` | Default Policy, Discovery inline |
| `references/quick-mode.md` | Frases canônicas Router |
| `docs/adr/0003-worker-unsandboxed-cli-execution.md` | Princípio worker unsandboxed; addendum multi-runtime |
| `docs/adr/0017-per-runtime-worker-permission-flags.md` | Flags por worker (`agy` vs `cursor agent`) |
| `docs/adr/0005-os-level-gating-and-topology-separation.md` | chmod vaults |
| `docs/adr/0006-staging-area-and-subagent-relay.md` | staging vs vault |
| `cli/test/fixtures/antigravity-parity-golden/` | Baseline gate de ouro (criar Fase 1) |
| `.cursor/hooks.json` | Exemplo real de hooks terceiros — upsert não pode apagar |
| `docs/planning/archive/agent_planner_v2_implementation_plan.md` | Contexto S3/S4 — **não** confiar em "já implementado" |

---

## Apêndice A — Evidência de drift documental

O plano `agent_planner_v2_implementation_plan.md` afirma:

> `hooks/dag-flow-src-guard.sh` — **completamente implementado**
> `DAG_FLOW_WORKER=1` no `dag_runner.py` — **implementado**

**Verificação no disco (2026-06-20):**
- `hooks/dag-flow-src-guard.sh` — **ausente**
- `DAG_FLOW_WORKER` em `dag_runner.py` — **ausente**

**Ação do implementador:** tratar como greenfield na Fase 9, não como "não tocar".

---

## Apêndice B — Confusões comuns (não repita)

| Confusão | Verdade |
|----------|---------|
| MCP deve servir Compiled Skill dag-flow | Não — MCP serve Task Skills do usuário |
| setup_indexer faz parte do dag init | Não — context-mode é pré-requisito externo |
| discovery.md continua existindo | Não — inline no SKILL.md |
| gemini-cli é built-in V1 | Não — descontinuado |
| claude é built-in V1 | Não — adiado pós-V1; alvo V1 é **cursor** (D8) |
| Compilar getting-started na skill | Não |
| Categoria A vem do orchestrator | Não — vem do **worker** |
| Guard só bloqueia, não educa | Não — Router sugere Specify vs Quick |
| Detectar sessão dag-flow ativa para mensagem | Não — mensagem adaptativa única |
| `if (runtime === 'cursor')` no CLI | Não — usar manifest + adapters (Apêndice C) |
| Gate de ouro compara repo inteiro | Não — whitelist §5.9 + golden fixture §5.11 |
| Spike bloqueia Fases 1–6 | Não — gate por worker §5.12 |
| `auditor.py` só checa exit code | Não — contrato exige `PASS` no stdout (D6) |
| `cursor` usa `--dangerously-skip-permissions` | Não — flag não existe; usar §5.13 |

---

## Apêndice C — Anti-padrões de implementação

**Você está em sessão zerada.** Estes erros foram debatidos e rejeitados na grill — não os reintroduza.

### C1 — Lógica hardcoded por nome de runtime no CLI

```typescript
// ❌ PROIBIDO
if (orchestrator === 'antigravity') { appendGeminiMd(); }
if (orchestrator === 'cursor') { mergeHooksJson(); }

// ✅ CORRETO
switch (manifest.orchestrator.hook_wiring_tier) {
  case 'pre_tool_use': hookConfigUpsert(manifest.orchestrator); break;
  case 'boot_file': bootFileAppend(manifest.orchestrator); break;
  case 'none': warn('No hook wiring'); break;
}
```

**Por quê:** cada runtime novo não pode exigir PR no CLI. O manifest declara capacidade; o CLI executa protocolo.

### C2 — Tratar Antigravity ou Cursor como “caso especial” na documentação/código

**Sintoma:** comentários tipo “Antigravity não tem preToolUse”; funções `wireAntigravityHook()`.

**Correto:** “tier `boot_file`” / “tier `pre_tool_use`”. Antigravity é instância do tier 2; Cursor é instância do tier 1.

### C3 — Sobrescrever `hooks.json` inteiro

**Sintoma:** `writeFileSync('.cursor/hooks.json', dagFlowHooksOnly)`.

**Correto:** Hook Config Upsert (§5.10) — projetos reais têm caveman, tool-routing, context-mode.

### C4 — Copiar todos os `scripts/` para Compiled Skill

**Sintoma:** `cp -r scripts/ $OUT/` no compilador.

**Correto:** whitelist §5.9 — migrate/test ficam no repo dev.

### C5 — Gate de ouro contra cópia manual do repo

**Sintoma:** diff contra `.agents/skills/dag-flow/` com 33 arquivos em scripts/.

**Correto:** golden fixture curada (§5.11) — só operacionais.

### C6 — Spike global bloqueando compilador

**Sintoma:** CI falha se `claude` CLI não estiver instalado na Fase 2.

**Correto:** spike V1 só exige `agy` + `cursor`; `claude` fora de escopo (D8).

### C7 — Reintroduzir `setup_indexer.sh` no `dag init`

**Por quê rejeitado:** mistura dag-flow (scaffold) com context-mode (indexing FTS5). D10.

### C8 — Alterar `auditor.py` para cada runtime

**Correto:** `auditor_wrapper` no manifest do worker. D6.
