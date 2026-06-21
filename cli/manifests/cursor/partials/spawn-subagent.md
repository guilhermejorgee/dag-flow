Spawn a Subagent Planner (`Task` with `subagent_type=generalPurpose`) with a single `prompt` that contains:
   - The verbatim content of `references/planner-template.md` as system instructions
   - User context: (a) the content of `tasks.pagrl.xml` just written, verbatim;
     (b) paths to `.specs/features/[feature]/spec.md`,
     `.specs/features/[feature]/design.md`, `references/tasks.md`;
     (c) path to `CONTEXT.md` if it exists at the project root;
     (d) instruction: "Call search_skills in parallel for all technical domains in the
     spec, then call read_skill on each found skill before generating the JSON. Return
     your response using the two-block format specified in the Output Contract."
