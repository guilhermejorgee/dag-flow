# Diagnosis Summary
The password validation in `auth.js` throws synchronous errors (e.g., `throw new Error()`) when validation fails. In Express, unhandled synchronous errors in routes or middleware result in a 500 Internal Server Error. The fix is to modify the validation logic to respond with a 400 Bad Request status code and a JSON error message instead of throwing an error.

# Mini-DAG

| ID | Description | Context Ref | Skill | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|---|---|
| T1 | Update password validation to return 400 | The password validation logic throws synchronous errors which cause 500 errors. It must be updated to return a 400 Bad Request HTTP response with a JSON error message when validation fails instead of throwing an Error. | nodejs | | src/middleware/auth.js, src/routes/auth.js | src/middleware/auth.js, src/routes/auth.js | agy --dangerously-skip-permissions --prompt "Role: Independent Auditor. Evaluate if the code in src/middleware/auth.js, src/routes/auth.js strictly obeys this rule: 'The password validation logic throws synchronous errors which cause 500 errors. It must be updated to return a 400 Bad Request HTTP response with a JSON error message when validation fails instead of throwing an Error.'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>" | Pending |
| T-Final | Update project memory | Orchestrator Rule | none | T1 | .specs/hotfixes/500-error-auth.md, src/middleware/auth.js, src/routes/auth.js | none | agy --dangerously-skip-permissions --prompt "Call ctx_index for .specs/hotfixes/500-error-auth.md and src/middleware/auth.js, src/routes/auth.js. Call memory_save to add the synthesized invariant if architecture changed." | Pending |
