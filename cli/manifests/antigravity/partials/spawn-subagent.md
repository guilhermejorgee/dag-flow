Spawn a Subagent Planner (`define_subagent` with `enable_mcp_tools=true`,
   `enable_write_tools=false`) with:
   - system_prompt: the verbatim content of `references/planner-template.md`
   - first_message: (a) the content of `tasks.pagrl.xml` just written, verbatim;
     (b) paths to `.specs/features/[feature]/spec.md`,
     `.specs/features/[feature]/design.md`, `references/tasks.md`;
     (c) path to `CONTEXT.md` if it exists at the project root;
     (d) instruction: "Call search_skills in parallel for all technical domains in the
     spec, then call read_skill on each found skill before generating the JSON. Return
     your response using the two-block format specified in the Output Contract."
