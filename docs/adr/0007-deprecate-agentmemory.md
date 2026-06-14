# 0007: Deprecate agentmemory

**Status:** Accepted

## Context
O sistema `dag-flow` dependia de um servidor MCP chamado `agentmemory` para armazenar as Invariantes Arquiteturais, estabelecidas na fase de Discovery. Esta solução de estado residia fora do sistema de arquivos versionado (como um banco de dados solto gerido pelo plugin). Ao mesmo tempo, o sistema já estava mantendo uma cópia física da arquitetura de alto nível através do `CONTEXT.md` e dos registros de decisão em `docs/adr/`. 

Esta redundância ia contra os princípios de "Observabilidade via Git" e aumentava o acoplamento do Core Toolchain a dependências externas que muitas vezes não escalam bem no modo "context-mode" sem adicionar complexidade na persistência do disco.

## Decision
Foi decidido **depreciar completamente o uso do servidor MCP `agentmemory`** e suas ferramentas (`memory_save`, `memory_recall`).

A "Living Memory" do sistema será mantida exclusivamente por arquivos físicos versionáveis:
- `CONTEXT.md`: Mantém as Invariantes Arquiteturais e o Domain Dictionary.
- `docs/adr/`: Mantém o registro histórico de decisões.

As regras do Orchestrator, o T-Final do Worker, e a rotina de Discovery foram atualizados para consultar e atualizar esses arquivos físicos (apenas indexando no motor de busca via `ctx_index`), em vez de guardar informações num banco de dados invisível de memórias.

## Consequences
- **Visibilidade:** Todo estado do projeto passa a ser observável, inspecionável e auditável através do histórico do Git.
- **Simplificação do Toolchain:** A dependência da ferramenta `agentmemory` é removida. O sistema agora requer apenas ferramentas que suportam execução de linha de comando (`rtk-ai`) ou indexação out-of-band (`context-mode`).
- **Alinhamento com SDD:** Reforça o paradigma de "Software-Defined Development", assegurando que as abstrações residam em arquivos estáticos controlados pelo Orchestrator durante a fase de Design.
