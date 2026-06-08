# Tasks

| ID | Description | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|
| T1 | Implement getDiscount logic | none | `.specs/features/discount/spec.md` | `src/discount.js` | `gemini --prompt Role: Independent Auditor. Read src/discount.js. Evaluate if it exports a getDiscount function that finds PROMO and returns the next word, or null. Respond EXACTLY with PASS or FAIL.` | `Pending` | Done |
| T2 | Implement unit tests | T1 | `src/discount.js` | `src/discount.test.js` | `node --test src/discount.test.js` | `Pending` | Done |
