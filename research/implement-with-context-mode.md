# Consolidação: Autonomia Total na Fase Implement via `context-mode`

Esta é uma nota de pesquisa gerada a partir de uma sessão de *grill-with-docs*, desenhada para documentar um potencial avanço arquitetural no `dag-flow`.

## 1. O Paradoxo Atual (A Fricção Humana)
A arquitetura do `dag-flow` proíbe o Orquestrador de executar testes e compilações para evitar **exaustão de contexto** (poluição da janela com *stack traces* e ruídos de terminal). 
Por causa disso, os documentos fundacionais (`references/tasks.md` e `references/quick-mode.md`) estabeleceram a regra: o Orquestrador gera a tabela de tarefas e pede para o **humano** abrir o terminal e rodar o `./scripts/run_dag.sh`.

## 2. A Descoberta
O ecossistema já possui uma ferramenta capaz de resolver esse paradoxo: o **`context-mode`** (atualmente usado apenas na fase Map para varrer arquivos sem poluir o contexto).

O protocolo MCP do `context-mode` disponibiliza a ferramenta `ctx_execute`, que cria um *sandbox* (isolamento) para a execução de comandos Shell. A regra central do `ctx_execute` é que **apenas a saída final (stdout) é enviada para a janela de contexto**, enquanto os ruídos massivos de execução ficam retidos no banco de dados local.

## 3. A Mecânica da Autonomia Total
Se a teoria se confirmar em testes futuros, o fluxo evoluirá da seguinte forma:

1. O Orquestrador termina o planejamento (gera o `.md`).
2. Em vez de pedir ação humana, o Orquestrador chama o MCP:
   `mcp__context-mode__ctx_execute(language: "shell", code: "./scripts/run_dag.sh .specs/features/nova-feature.md")`
3. O `run_dag.sh` roda dentro do *sandbox*. Ele spawna os subagentes (*workers*), roda os *auditors* e faz o *auto-healing* em background.
4. **O Escudo Perfeito:** Centenas de megabytes de logs de erro quebram nos subagentes dentro do sandbox. A janela de tokens do Orquestrador permanece imaculada.
5. Ao finalizar, o Orquestrador recebe apenas o veredito: `"🎉 All tasks executed successfully!"` e pode continuar o trabalho.

## 4. Próximos Passos (Sessão de Investigação)
Para validar esta tese no futuro, precisaremos investigar:
- **Timeouts:** O `ctx_execute` permite execuções longas (assíncronas) que um DAG inteiro pode exigir?
- **Streaming:** O Orquestrador ficaria "congelado" esperando o sandbox terminar, ou precisamos usar um modelo de *polling* (ex: enviar para o background e ler o status)?
- **Recursividade:** O `run_dag.sh` dispara o Gemini CLI via terminal. O `ctx_execute` permite que ferramentas CLI que instanciam novos agentes rodem corretamente dentro de seu ambiente isolado?

> [!TIP]
> Se isso for validado, o `dag-flow` atinge o Nível 5 de Autonomia, onde o humano apenas revisa a arquitetura e o sistema faz o chão de fábrica rodar de forma invisível.
