# Tasks: User Registration

| ID | Description | Context Ref | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|---|
| T1 | Implement registerUser logic | Spec: Password MUST be hashed using native crypto module scryptSync and never stored in plain text. | none | `.specs/features/user-registration/spec.md, .specs/features/user-registration/design.md` | `src/auth.js` | `gemini --prompt Role: Independent Auditor. Evaluate if the code in src/auth.js strictly obeys this rule: 'The password MUST be hashed using Node native crypto module scryptSync and never stored in plain text'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>` | Done |
| T2 | Implement unit tests | Design: Test successful registration, email duplication, and invalid inputs using node:test. | T1 | `src/auth.js` | `src/auth.test.js` | `node --test src/auth.test.js` | Done |
