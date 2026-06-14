# E2E Benchmark Execution Instructions — v0.3

## Seu papel: Orquestrador Mestre

Você é o **agente orquestrador** do benchmark E2E do `dag-flow`.

Você é o **único** que sabe que isso é um benchmark.  
Você vai coordenar a execução de **dois agentes cegos** por cenário:

| Agente | O que sabe | O que não sabe |
|--------|-----------|----------------|
| **Você** (orquestrador) | Tudo. É um benchmark. Há 6 cenários. | — |
| **Agente dag-flow** | Recebeu uma feature request para implementar | Que está sendo avaliado. Que há um benchmark. Que o "usuário" é simulado. |
| **User Emulator** | Que é um desenvolvedor respondendo perguntas do arquiteto | Que está num benchmark. Que o arquiteto é um agente. Que as respostas serão avaliadas. |

**O cenário real que acontece a cada feature:**
> Um desenvolvedor (User Emulator) quer implementar uma feature no sistema.  
> Ele entrega o pedido para o arquiteto de software da equipe (dag-flow Agent).  
> O arquiteto usa o dag-flow para conduzir uma sessão socrática, fazendo perguntas  
> técnicas até ter clareza suficiente para gerar o Design e o plano de tarefas (DAG).  
> Você observa silenciosamente, gerencia o canal de comunicação entre os dois,  
> e ao final avalia a qualidade do artefato produzido pelo arquiteto.

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
- Manually triggering `run_dag.sh` on behalf of any agent
- Answering the dag-flow agent's Socratic questions yourself

These actions invalidate the E2E integrity of the benchmark.

**DO monitor and unstick the harness** if it pauses waiting for `[y/N]` input  
(e.g., after a scenario fails). Send `y` via `manage_task` `send_input` to continue.

---

## Como o canal de comunicação funciona (detalhes técnicos)

O `run_socratic_session.py` é o **canal de comunicação** entre os dois agentes cegos.  
Ele não é um agente — é o intermediário transparente que:

```
┌─────────────────────────────────────────────────────┐
│  dag-flow Agent  (Gemini 3.1 Pro High)              │
│  · Pensa que está tendo uma conversa normal         │
│  · Recebe a feature request e faz perguntas        │
│  · NÃO sabe que está sendo benchmarked             │
└──────────────────────┬──────────────────────────────┘
                       │ pergunta detectada via pyte.Screen
┌──────────────────────▼──────────────────────────────┐
│  run_socratic_session.py  (canal transparente)      │
│  · VT100 emulator captura a tela do dag-flow        │
│  · Extrai a pergunta do bloco PAGRL                 │
│  · Encaminha para o User Emulator                   │
│  · Injeta a resposta de volta via PTY (\r submit)  │
│  · Detecta conclusão via glob(.specs/dags/*.md)    │
└──────────────────────┬──────────────────────────────┘
                       │ "o arquiteto perguntou X, o que respondo?"
┌──────────────────────▼──────────────────────────────┐
│  User Emulator  (Gemini 3.5 Flash Low)              │
│  · Pensa que é um dev respondendo perguntas        │
│  · Recebe o contexto da feature (user_context)     │
│  · NÃO sabe que está num benchmark                 │
└─────────────────────────────────────────────────────┘
```

The Socratic interrogation is a **feature**, not a bug. The dag-flow agent is
supposed to pause and ask clarifying questions. The harness handles this automatically.

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

## What Each Scenario Tests

| ID | Feature | Key dag-flow Phases |
|----|---------|---------------------|
| `s1-auth-jwt` | JWT authentication (register + login) | Specify, Design, Tasks |
| `s2-rbac-roles` | RBAC with Admin/User roles | Specify, Design, Tasks |
| `s3-file-upload` | Multer file upload with validation | Specify, Design, Tasks |
| `s4-brownfield` | Redis rate limiter on existing API | Discovery, Specify, Design, Tasks |
| `s5-ambiguous-spec` | Notifications (vague prompt — tests Specify quality) | Specify only |
| `s6-quick-mode-hotfix` | Fix missing `await` in bcrypt.compare | Quick Mode (no Specify/Design) |

---

## Monitoring

The `run_all.sh` script runs sequentially. Monitor via:

```bash
manage_task status <task-id>
```

If the task stabilizes waiting for `[y/N]`, send `y\n` via `manage_task send_input`.

You do **not** need to manually grade anything — `grade_scenario.py` runs automatically.

---

## Scenario Output Structure

```
workspace/run-<timestamp>/
  s1-auth-jwt/
    with_dag_flow/          ← dag-flow agent workspace (skill injected)
      CONTEXT.md            ← written at workspace root by dag-flow
      .specs/
        dags/
          <feature-name>.md ← finish signal; triggers harness exit
        features/
          <feature-name>/   ← dag-flow scopes specs under features/<name>/
            design.md
      src/                  ← existing app files (no implementation yet)
    baseline/               ← plain agent workspace (no skill)
      src/
    grading_dag_flow.json   ← assertion results for dag-flow run
    grading_baseline.json   ← assertion results for baseline run
    grading.json            ← latest grading (used by aggregate)
    socratic_dag_flow.log   ← raw pyte session bytes
    socratic_dag_flow_transcript.json  ← Q&A turn-by-turn record
  ...
  summary/
    benchmark.json          ← pass rates, per-scenario results
    benchmark.md            ← human-readable summary
```

> **Important**: dag-flow writes specs to `.specs/features/<feature-name>/` and executable DAGs to `.specs/dags/`.  
> All assertions use `glob_exists` and `glob_grep` types to handle this path variability.

---

## Key Lessons Learned (from pyte harness development)

- **`agy -i` uses bubbletea TUI** — raw pexpect byte scraping is unreliable.  
  The harness uses `pyte.Screen` (VT100 emulator) to get stable screen snapshots.

- **bubbletea submits input via `\r`** — sending `\n` (newline) inserts a newline  
  inside the input field without submitting. Always use `child.send(text + b'\r')`.

- **Questions span multiple rows** — bubbletea wraps long lines. The harness  
  reconstructs the full question by joining all lines after `</PAGRL>`.

- **PAGRL `<Decision>` is gold** — the harness extracts it and provides it to the  
  User Emulator as context, giving richer answers than just the question text.

- **Survey dialogs appear mid-session** — the harness auto-dismisses them with `b'0\r'`  
  (Skip) before sending any answer, preventing input routing issues.

- **`is_finished()` uses glob** — `glob(.specs/dags/*.md)` handles the  
  new OS-level separated DAG output paths.

- **Assertions use `glob_exists` / `glob_grep`** — static paths like `.specs/tasks.md`  
  will always fail; use glob patterns to be path-agnostic.

- **`agy --print` does not persist sessions** — the harness uses `pexpect` + `agy -i`  
  (interactive) to maintain multi-turn state.

- **Baseline runs are intentionally one-shot** — they assume and execute without questioning.  
  This contrast is what makes the comparison meaningful.

- **Grade paths are mode-aware** — `grade_scenario.py --mode dag_flow` checks `with_dag_flow/`;  
  `--mode baseline` checks `baseline/`. Both modes write their own `grading_<mode>.json`.

---

## Scenario Creation (New!)

To create a new scenario interactively, run:
```bash
python3 docs/benchmarks/data/e2e-v0.1.0/harness/create_scenario.py
```
This script will prompt you for the scenario ID, target state, prompts, and requirements, and then automatically generate the `scenario.json` and folder structure.
The `setup_workspace.sh` script is now completely centralized and agnostic. Scenarios no longer need their own `setup.sh` script.

---

## Model Configuration

| Agent | Model | Why |
|-------|-------|-----|
| dag-flow agent | `Gemini 3.1 Pro (High)` | Best reasoning for Specify/Design/Tasks quality |
| User Emulator | `Gemini 3.5 Flash (Low)` | Just needs to answer questions briefly |
| Baseline agent | `Gemini 3.1 Pro (High)` | Same capability as dag-flow for fair comparison |

These are set in `harness/run_scenario.sh` via `--dag-flow-model` and `--emulator-model`.

---

## Your Immediate Task

Execute Pass 1 (dag-flow):

```bash
bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh --mode dag_flow workspace/run-$(date +%s)
```

Monitor the output. Send `y` whenever it pauses between scenarios.  
Once complete, check `workspace/run-<id>/summary/benchmark.md` for results.  
Then optionally run Pass 2 (baseline) using the same workspace path.
