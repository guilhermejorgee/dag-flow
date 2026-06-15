# 0008: Cognitive Hardening and JSON DAG

**Status:** Accepted

## Context
O sistema `dag-flow` originalmente utilizava tabelas Markdown para representar os DAGs de execução das tarefas, processadas através de scripts bash textuais frágeis (`awk`/`grep`). Adicionalmente, verificou-se a falha de "Context Blindness" e "Overconfidence Bias", onde o modelo gerava as tarefas ignorando validações ou omitindo a relação correta de arquivos, resultando em "few-shot ossification". Tabelas Markdown, sendo blocos visuais, não ofereciam garantia para esquemas complexos e dificultavam o enforcement de coerência (inputs e outputs).

## Decision
Foi decidido **abandonar as tabelas Markdown** como AST para definição de tarefas de execução.

A nova arquitetura implementa:
1. **JSON DAGs:** A topologia das execuções passa a ser unicamente definida por arquivos `.json` nativos, aplicando restrições rígidas baseadas em array de objetos (ex: campos obrigatórios para input_files, output_files e skill).
2. **Cognitive Rationale Field:** Adiciona-se o campo `cognitive_rationale` em cada nó da tarefa. O Subagent Planner deve justificar *por que* definiu um teste estrutural ou cognitivo (`agy`) antes de gravar a instrução no terminal (`done_when_gate`).
3. **PAGRL TaskPlanning XML:** A fase final do Planejador agora emite obrigatoriamente um bloco estruturado em XML `<PAGRL phase="TaskPlanning">` antes de gerar a DAG, assegurando que as regras lógicas essenciais tenham sido lidas e consideradas antes do output do JSON.
4. **Python-Native State Mutation:** `dag_runner.py` foi reestruturado para ser 100% nativo JSON. O motor de execução também implementa a Separação de Runtime copiando o plano mestre do Vault (`.specs/dags/`) para um diretório mutável de estado (`.specs/runs/`). Isso permitiu reescrever os validadores (`auditor.py`, `update_task_status.py`) com operações atômicas exclusivas baseadas em `fcntl.flock`.

## Consequences
- **Validação Físico-Lógica Determinística:** `validate_dag_coherence.py` foi introduzido para inspecionar, pré-execução, a coerência da dependência (arquivos referenciados devem existir ou ser output de um parente anterior), rejeitando alucinações de input.
- **Isolamento de Estado de Execução:** O Vault mestre da arquitetura continua protegido com bloqueios a nível de Sistema Operacional (`chmod 555`), sendo o estado modificado exclusivamente num runtime separado. As dependências arcaicas no `bash` foram erradicadas da engine principal.
