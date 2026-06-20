"""
Shared prompt assembly for dag-flow E2E sessions.

The Socratic harness detects user-facing questions via find_question() — at least
one line in the agent's message must contain '?'. Real users often set output
preferences; we encode that as a default communication contract on every
dag_flow prompt so the simulation stays realistic without mocking answers.
"""

from __future__ import annotations

DEFAULT_AGENT_COMMUNICATION_RULES = """\
Communication rules (user preference — follow for every message to the user):
- When you need information or have doubts, write in flowing prose (complete sentences).
- Do not use bullet lists or numbered lists when asking the user questions.
- Ask one question at a time.
- Every question to the user MUST end with a question mark (?)."""


def build_dag_flow_prompt(
    task_prompt: str,
    communication_rules: str | None = DEFAULT_AGENT_COMMUNICATION_RULES,
) -> str:
    """Assemble the full dag-flow agent prompt with optional communication rules."""
    base = f"Use the dag-flow skill to: {task_prompt.strip()}"
    if communication_rules and communication_rules.strip():
        return f"{base}\n\n{communication_rules.strip()}"
    return base


def communication_rules_from_scenario(scenario: dict) -> str | None:
    """
    Resolve communication rules from scenario.json.

    - Key absent → default rules
    - Key present (including empty string) → use that value; empty disables rules
    """
    if "agent_communication_rules" not in scenario:
        return DEFAULT_AGENT_COMMUNICATION_RULES
    return scenario["agent_communication_rules"]
