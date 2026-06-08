# Feature: User Registration

## 1. Business Context
We need a basic user registration system to allow users to create an account. This is the first step in our identity management module.

## 2. Requirements

### 2.1. Registration Endpoint
- The system MUST expose a function or module `registerUser(email, password)` that handles registration. (For this E2E test, we'll keep it as a module rather than a full HTTP server to reduce overhead, but it must validate inputs).

### 2.2. Validation Rules
- `email`: MUST be a valid email format containing an `@` symbol.
- `password`: MUST be at least 8 characters long.

### 2.3. Security
- The password MUST NOT be stored in plain text.
- The password MUST be hashed using Node's native `crypto` module (e.g., `scryptSync` or `pbkdf2Sync`) with a salt.

### 2.4. Storage
- Users MUST be stored in memory via a simple array (e.g., `global.users` or a module-scoped variable) for the scope of this feature.
- A registered user object MUST contain: `id` (random string/UUID), `email`, and `passwordHash`.

### 2.5. Error Handling
- If validation fails, it MUST throw an Error with a descriptive message (e.g., "Invalid email format").
- If the email is already registered, it MUST throw an Error "Email already exists".

## 3. Acceptance Criteria
- Unit tests must cover successful registration.
- Unit tests must cover validation failures.
- Unit tests must verify the password is not stored in plain text.
