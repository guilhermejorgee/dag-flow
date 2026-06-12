# Domain Dictionary

**Feature Spec**: Full specification for a new feature, resulting in a complex `tasks.md` defining the execution DAG. _Avoid_: especificação genérica, plano longo.
**Mini-DAG**: Simplified, sequential task table for hotfixes/quick patches saved in `.specs/hotfixes/`. _Avoid_: quick mode output, small spec.
**Continuous Flow**: Journey where Orchestrator generates the Feature Spec or Mini-DAG and immediately launches execution in the same session. _Avoid_: execução acoplada, jornada 1.
**Disjoint Flow**: Journey where Orchestrator executes a previously generated Feature Spec or Mini-DAG in a new, independent session. _Avoid_: execução desacoplada, jornada 2.
**Intentional Manual Execution**: Running execution scripts (like `./scripts/run_dag.sh`) manually in the user's terminal to preserve observability and trust, rather than autonomously inside a sandbox. _Avoid_: execução autônoma, ctx_execute.
**Escalation Phase**: Formal recovery protocol triggered when a worker task fails repeatedly. Orchestrator reads the failure log and plans a hotfix. _Avoid_: manual fixing, ad-hoc patching.
**Double Verification**: Two-step validation during Escalation: first running the Mini-DAG execution, then manually running `auditor.sh` against the main DAG's gate to prove the hotfix works before resuming. _Avoid_: single check, blind resume.
**Core Infrastructure**: The mandatory trinity of tools (`rtk-ai` for token-optimized CLI execution, `context-mode` for Orchestrator out-of-band file parsing, and `agentmemory` for state) required to run `dag-flow`. _Avoid_: ferramentas opcionais.
**Global Indexing Hook**: Pre-boot script or session rule that populates `context-mode` FTS5 database with all repository files incrementally using Upsert. _Avoid_: map phase crawler, orchestrator indexing.
**Discovery Phase**: Initial initialization phase where the Orchestrator strictly uses `ctx_search` against the FTS5 index to discover the project state and synthesize the baseline architecture. _Avoid_: Map Phase, global crawling.
**Architectural Invariants**: The synthesized, high-level map of the project structure, sub-contexts, and technical stack stored in `agentmemory`. _Avoid_: Context Map, High-Level State.
**Living Memory**: The ongoing property of keeping Architectural Invariants synchronized with reality via T-Final Delta Updates after execution, avoiding full re-scans. _Avoid_: Map Phase (as a continuous state).
**Design Phase**: The architectural step between Specify and Tasks that defines the concrete technical interfaces, components, and patterns to be implemented. _Avoid_: pattern definition only, abstract architecture.
**DAG Validator Gate**: A mandatory shell-level interceptor script (`scripts/write_dag.sh`) that validates the DAG table schema before saving it, acting as the sole authorized writer to the physical file. _Avoid_: soft validation, read-time gate.
**Topology Separation**: The architectural division of artifacts where free-text specs live in open directories (`.specs/features/`) and executable DAG tables live in locked directories (`.specs/dags/`), enabling OS-level physical gating. _Avoid_: unified specs folder.
