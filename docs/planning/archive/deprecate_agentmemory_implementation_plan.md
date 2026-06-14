# Implementation Plan: Deprecate Agentmemory

## Overview
A ferramenta `agentmemory` será expurgada da arquitetura do `dag-flow`. A "Living Memory" (Invariantes Arquiteturais) passará a residir exclusivamente em camadas de arquivo físico persistente, especificamente `CONTEXT.md`, `ADRs` e as próprias especificações (specs/dags).

## Proposed Changes

### 1. Novo ADR: `docs/adr/0007-deprecate-agentmemory.md`
- **Context:** O sistema já possuía `CONTEXT.md`, `ADRs` e artefatos de spec como memória física persistente. Manter o `agentmemory` criava uma redundância invisível (estado solto no banco de dados do plugin) e aumentava a dependência de dependências de terceiros.
- **Decision:** Depreciar o uso de `agentmemory`, `memory_save` e `memory_recall`. A "Living Memory" passa a ser garantida por edições físicas no `CONTEXT.md` e criação de ADRs.
- **Consequences:** Simplifica o Core Toolchain, remove uma dependência complexa, e força a memória do agente a ser 100% visível, editável por humanos e versionável via Git.

### 2. Atualização dos Templates (A Morte do T-Final com `memory_save`)
- **[MODIFY] `references/tasks.md`:** Alterar a task obrigatória `T-Final`. Remover a instrução para usar `memory_save`. O comando do T-Final agora deverá apenas usar `ctx_index` para atualizar o banco de dados de busca do agente, enquanto a manutenção do vocabulário arquitetural ocorre no `CONTEXT.md` durante a fase de Design.
- **[MODIFY] `references/quick-mode.md`:** Mesmo procedimento de remoção no Mini-DAG.

### 3. Limpeza de Documentação Core
- **[MODIFY] `README.md`:** Remover `agentmemory` da tabela "Core Toolchain" e das descrições de fluxo.
- **[MODIFY] `CONTEXT.md`:** Remover menções de `agentmemory`. Redefinir `Architectural Invariants` como o estado mantido fisicamente no `CONTEXT.md` e na pasta de ADRs.
- **[MODIFY] `docs/architecture.md`:** Limpar referências de `agentmemory` e reescrever a seção de Inicialização/Discovery para focar na leitura de arquivos.
- **[MODIFY] `SKILL.md`:** Remover instruções que mandam o Orchestrator ler/salvar no `agentmemory`.

### 4. Refatoração de `references/discovery.md`
- **[MODIFY] `references/discovery.md`:** A fase de Discovery verificará a existência do `CONTEXT.md` com a seção 'Architectural Invariants'. Se existir, pula a fase. Caso contrário, mapeará o projeto usando `ctx_search` para construir/atualizar o `CONTEXT.md` (Domain Dictionary).

### 5. Arquivos Esquecidos (Gaps Identificados)
- **[MODIFY] `docs/examples.md`:** Remover menções do Orchestrator populando `agentmemory`.
- **[MODIFY] `research/suite_e2e_implementation_plan.md`:** Atualizar a métrica de teste de `agentmemory new entries` para verificar modificações no `CONTEXT.md` via diff ou timestamp.
- **[MODIFY] `.gitignore`:** Remover exclusões referentes a `agentmemory`.

## Open Questions
Nenhum. A substituição por `CONTEXT.md` e ADRs já fornece um sistema de estado maduro e totalmente alinhado com o princípio de "Observabilidade via Git" do `dag-flow`. Aguardo aprovação para proceder.
