# 🚨 DAG-FLOW: Architecture & Integration Findings

**Data do Teste:** Junho 2026  
**Objetivo:** Testar o fluxo integrado de `run_dag.sh` e `auditor.sh` acionando a CLI do Gemini como Worker.

---

## 🛑 1. O Problema de Bloqueio do Worker (Security Sandbox)

A arquitetura atual do `dag-flow` define que o orquestrador Shell (`run_dag.sh`) instancia os Workers utilizando a CLI:
```bash
gemini --prompt "Execute SDD Task $id..."
```

**O que foi descoberto:**
Ao invocar o comando local de forma programática (sem ser um chat interativo / sem interface), o Agente Local roda num ambiente *Sandbox* restrito (Stateless Worker cego e paralisado).

**Ferramentas Bloqueadas automaticamente:**
- `write_file`, `write`, `create_file` (Impede o worker de escrever o código final)
- `run_command`, `run_shell_command` (Impede rodar lints, testes, ou instalar pacotes via shell)
- `mcp__context-mode__ctx_execute` (Impede buscar dados de contexto mais complexos)
- `invoke_agent` (Impede chamar outros subagentes)

**Efeito na Orquestração:**
O Worker entra num "loop de desespero" tentando chamar várias ferramentas para criar o arquivo (ex: `src/discount.js`), falha em todas e o processo termina. O `auditor.sh` roda logo após, não encontra o arquivo criado/alterado, e falha o Gate da tarefa, forçando o `run_dag.sh` a iniciar a **Attempt 2/3**, até estourar o limite e escalar o erro.

---

## 🪲 2. Bug Identificado nos Agentes Cavecrew

Durante a execução da CLI, o log reportou falhas na inicialização dos subagentes `cavecrew` atrelados à sua conta local.

**Motivo:** O arquivo `cavecrew-builder.md` (e similares) define ferramentas com nomes inválidos para a Engine do Antigravity / Gemini CLI.
- **Como está:** `tools: [Read, Edit, Write, Grep, Glob]`
- **Como a Engine espera (Snake Case literal da API):** `tools: [read_file, replace_file_content, write_to_file, grep_search, list_dir]`

Esse erro de parse de sintaxe faz o ExtensionManager rejeitar a extensão e o subagente "nasce morto" ou desprovido de habilidades.

---

## 🛠️ 3. Próximos Passos (Para sua próxima sessão)

Para que o orquestrador `dag-flow` funcione em produção, você precisará decidir como dar permissões ao Worker:

1. **Investigar Flags da CLI:** Descobrir se existe um argumento (ex: `gemini --allow-write` ou `--tools=write_to_file,run_command`) para embutir no `run_dag.sh`.
2. **Uso de Agentes Específicos:** Chamar um Agente com permissões pré-aprovadas (`gemini --agent=developer --prompt=...`).
3. **Mudança de Pipeline (Patch/Diff):** Em vez do Worker editar o arquivo diretamente, ele cospe um Patch (Git Diff) no stdout, e o *Orquestrador Bash* aplica o patch. Isso tira a responsabilidade de I/O do Worker e resolve problemas de permissão.
