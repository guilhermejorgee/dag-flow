# Tasks: JWT Authentication

| ID | Description | Context Ref | Skill | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|---|---|
| T1 | Implement User Model | Spec: In-memory array in `src/models/user.js`. No database. | None | None | `src/models/user.js` | `src/models/user.js` | `npx eslint src/models/user.js` | Pending |
| T2 | Implement Auth Routes | Spec: `POST /api/auth/register` (email, pass, bcrypt hash) and `POST /api/auth/login` (email, pass, JWT response payload `{id}`, `24h` expiration). | None | T1 | `src/routes/auth.js`, `src/models/user.js` | `src/routes/auth.js` | `npx eslint src/routes/auth.js` | Pending |
| T3 | Mount Auth Routes | Spec: Mount auth routes in `src/app.js` at `/api/auth`. | None | T2 | `src/app.js`, `src/routes/auth.js` | `src/app.js` | `agy --dangerously-skip-permissions --prompt "Role: Independent Auditor. Evaluate if the code in src/app.js strictly obeys this rule: 'Mount auth routes in src/app.js at /api/auth'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>"` | Pending |
| T-Final | Living Memory Delta Update | Orchestrator Rule | None | T3 | `N/A` | `N/A` | `agy --dangerously-skip-permissions --prompt "Call ctx_index for src/models/user.js, src/routes/auth.js, src/app.js. Call memory_save to add the synthesized invariant: 'Uses JWT authentication with in-memory array under /api/auth' to Architectural Invariants."` | Pending |
