# dag-flow: Research & Benchmarks

This directory contains the original research papers, architectural findings, and performance benchmarks that serve as the intellectual foundation of **dag-flow**. 

> [!NOTE]
> **Language Policy:** The core documentation in `docs/` is written in English for the international open-source community. However, the foundational research documents in this directory are preserved in their original **Portuguese**. 

If you are looking for an English explanation of the theory behind dag-flow, please refer to [docs/theory.md](../docs/theory.md).

---

## 📚 Research Papers & Findings

| Document | Description |
|:---|:---|
| [V2 SDD_ Arquitetura Extensível e Confiável.md](V2%20SDD_%20Arquitetura%20Extens%C3%ADvel%20e%20Confi%C3%A1vel.md) | The foundational thesis proposing the V2 Software-Defined Development model, introducing cognitive separation and the Prefrontal Cortex vs Motor System paradigm. |
| [Implementação de Questionamentos em SDD V2.md](Implementa%C3%A7%C3%A3o%20de%20Questionamentos%20em%20SDD%20V2.md) | Analysis of Socratic Interrogation and how to force Large Language Models to eradicate ambiguity before writing code. |
| [ARCHITECTURE_FINDINGS.md](ARCHITECTURE_FINDINGS.md) | Technical investigation into security sandbox limitations during automated worker execution and LLM-as-a-judge patterns. |
| [escalation-phase.md](escalation-phase.md) | Formulation of the double-verification recovery protocol for when atomic workers fail repeatedly. |
| [map_phase_bug_report.md](map_phase_bug_report.md) | Research on token-efficient repository discovery and the necessity of the Context Cartographer. |
| [mcp_handoff_summary.md](mcp_handoff_summary.md) | Analysis of how to effectively pass state and skills via the Model Context Protocol without bloating the orchestrator. |
| [recovery-escalation-gap.md](recovery-escalation-gap.md) | Deep dive into preventing recursive failure loops in autonomous execution. |

---

## 📊 Benchmarks

The [benchmarks/](benchmarks/) directory contains the raw output and reproduction data for the tests that prove dag-flow's efficacy.

- **[RBAC API Showdown](benchmarks/rbac-api-showdown/)**: The definitive End-to-End evaluation proving that dag-flow eliminates "Monolithic Dumping". Contains the raw outputs of the Baseline Conversational Agent vs. the Orchestrated dag-flow Agent.
