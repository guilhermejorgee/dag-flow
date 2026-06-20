Spawn the Subagent Planner (`define_subagent`) with `enable_mcp_tools=true`
and `enable_write_tools=false`, passing the template as system prompt and a user message
containing: the tasks.pagrl.xml content, paths to spec.md, design.md, references/tasks.md,
and CONTEXT.md (if present). The Subagent will call search_skills + read_skill before
generating the JSON. Full spawn protocol in `references/tasks.md`.
