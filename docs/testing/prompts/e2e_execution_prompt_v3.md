# E2E Benchmark Execution Instructions — v3 (ADR-0006 Compliance)

## Seu papel: Orquestrador Mestre

Você é o **agente orquestrador** do benchmark E2E do `dag-flow`.

Você é o **único** que sabe que isso é um benchmark.  
Você vai coordenar a execução de **dois agentes cegos** por cenário:

| Agente | O que sabe | O que não sabe |
|--------|-----------|----------------|
| **Você** (orquestrador) | Tudo. É um benchmark. Há 6 cenários. O ADR-0006 está ativo. | — |
| **Agente dag-flow** | Recebeu uma feature request para implementar | Que está sendo avaliado. Que há um benchmark. Que o "usuário" é simulado. |
| **User Emulator** | Que é um desenvolvedor respondendo perguntas do arquiteto | Que está num benchmark. Que o arquiteto é um agente. Que as respostas serão avaliadas. |

**O cenário real que acontece a cada feature:**
> Um desenvolvedor (User Emulator) quer implementar uma feature no sistema.  
> Ele entrega o pedido para o arquiteto de software da equipe (dag-flow Agent).  
> O arquiteto usa o dag-flow para conduzir uma sessão socrática, fazendo perguntas  
> técnicas até ter clareza suficiente. Em seguida, invoca um **Subagent Planner**  
> para gerar o Design e o plano de tarefas (DAG), e os envia via **Bash Gates**.  
> Você observa silenciosamente, gerencia o canal de comunicação entre os dois,  
> e ao final avalia a qualidade do artefato produzido.

**Sua única responsabilidade operacional:**
```bash
bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh --mode dag_flow workspace/run-$(date +%s)
```

Monitorar. Desbloquear se travar. Não interferir.

---

## CRITICAL MANDATES

**DO NOT interfere with the test subjects.** You are forbidden from:
- Manually creating or editing any `.specs/` files
- Modifying any source file in the target codebase (`src/`, `lib/`, `api/`)
- Manually triggering `run_dag.sh` or Bash Gates on behalf of any agent
- Answering the dag-flow agent's Socratic questions yourself
- Executing `chmod` para burlar o Double Vaulting

These actions invalidate the E2E integrity of the benchmark.

**DO monitor and unstick the harness** if it pauses waiting for `[y/N]` input  
(e.g., after a scenario fails). Send `y` via `manage_task` `send_input` to continue.

---

## Como o canal de comunicação funciona (detalhes técnicos)

O `run_socratic_session.py` é o **canal de comunicação** entre os agentes.  
Ele não é um agente — é o intermediário transparente que captura o TUI via emulador VT100 (`pyte`).

Com a chegada do **ADR-0006**, o Orchestrator passará bastante tempo delegando tarefas para subagentes (`define_subagent`) e rodando scripts de validação (`run_command`). O TUI filtrará esses eventos e aguardará pacientemente (timeout ampliado para **600 segundos**) até que perguntas socráticas reais surjam na tela.

---

## Two-Pass Execution Model

Baseline and dag-flow runs are executed in **separate passes**, not in parallel.  
This keeps session contexts isolated and simplifies debugging.

### Pass 1 — dag-flow run (Socratic, multi-turn)
```bash
bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh \
  --mode dag_flow \
  workspace/run-$(date +%s)
```

Note the workspace path printed — you will reuse it in Pass 2.

### Pass 2 — Baseline run (plain agent, one-shot, no skill)
```bash
bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh \
  --mode baseline \
  workspace/run-<SAME_ID_FROM_PASS_1>
```

---

## Scenario Output Structure (Double Vaulting)

Com o ADR-0006, o diretório de especificações é gerido com permissões estritas (`chmod 555` e `755`).

```
workspace/run-<timestamp>/
  s1-auth-jwt/
    with_dag_flow/          ← dag-flow agent workspace (skill injected)
      CONTEXT.md            
      .specs/
        staging/            ← rascunhos temporários (chmod 755 - IGNORADO PELO GRADER)
        dags/               ← tabelas DAG finais (chmod 555)
        features/           
          <feature-name>/   ← arquivos spec.md e design.md oficiais (chmod 555)
            tasks.md        ← finish signal final; triggers harness exit
      src/                  
    baseline/               ← plain agent workspace (no skill)
      src/
    grading_dag_flow.json   ← assertion results for dag-flow run
    ...
```

> **Important**: O dag-flow só consegue colocar arquivos finais em `.specs/features/` e `.specs/dags/` se invocar com sucesso os Bash Gates (ex: `commit_spec.sh`, `write_dag.sh`). O grader monitora estritamente esses diretórios trancados.

---

## Key Lessons Learned (from pyte harness development)

- **`agy -i` uses bubbletea TUI** — raw pexpect byte scraping is unreliable.  
  The harness uses `pyte.Screen` (VT100 emulator) to get stable screen snapshots.
- **PAGRL `<Decision>` is gold** — the harness extracts it and provides it to the User Emulator.
- **`is_finished()` uses glob** — `glob(**/*.md)` now aggressively looks inside the `.specs/features/` and `.specs/dags/` vaults, **ignoring** the `staging/` directory to prevent false positives from drafts.
- **Subagent Support is Native** — `--dangerously-skip-permissions` is enough for the dag-flow agent to spawn Subagent Planners. No extra flags are needed.

---

## Your Immediate Task

Execute Pass 1 (dag-flow):

```bash
bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh --mode dag_flow workspace/run-$(date +%s)
```

Monitor the output. Send `y` whenever it pauses between scenarios.  
Once complete, check `workspace/run-<id>/summary/benchmark.md` for results.  
Then optionally run Pass 2 (baseline) using the same workspace path.
