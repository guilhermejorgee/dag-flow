# Design: User Registration

## 1. Architecture Overview
The user registration logic will be encapsulated in a pure Node.js module `src/auth.js`. This allows easy unit testing and separation of concerns before integrating into an HTTP layer.

## 2. Components

### `src/auth.js`
- **State:** Will export an array `users = []` to hold the in-memory state.
- **Function `registerUser(email, password)`:**
  - Performs validation (`email.includes('@')`, `password.length >= 8`).
  - Checks if `users.find(u => u.email === email)` exists.
  - Generates a random `salt` using `crypto.randomBytes`.
  - Hashes the password using `crypto.scryptSync(password, salt, 64)`.
  - Pushes a new object `{ id, email, passwordHash, salt }` to the `users` array.
  - Returns the new user object (omitting the password).

### `src/auth.test.js`
- Uses the native `node:test` runner and `node:assert`.
- Tests successful registration, email duplication, and invalid inputs.

## 3. Decisions & Trade-offs
- **Storage:** In-memory array chosen to keep the E2E test self-contained without external dependencies like a database.
- **Hashing Algorithm:** `scryptSync` is chosen as it's built into Node.js native `crypto` and provides strong security. No external `bcrypt` dependency is required, which keeps the test fast.
