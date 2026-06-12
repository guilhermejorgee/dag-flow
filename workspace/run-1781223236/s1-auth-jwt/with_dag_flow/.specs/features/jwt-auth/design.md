# Design: JWT Authentication

## Patterns Reused
N/A - This feature introduces only new code with no reuse because the existing `src/` directories (like `routes`, `middleware`, `models`) are currently empty.

## New Patterns Introduced
1. **Express Router modularization**: Routes will be encapsulated in `src/routes/auth.js` and mounted by `src/app.js`.
2. **In-memory Repository**: `src/models/user.js` will act as a simple array-backed repository with basic `find` and `create` methods.

## Cross-Cutting Concerns
- **Authentication**: Introduces JWT token issuance for subsequent request authorization.
- **Security**: Introduces password hashing (via `bcrypt`) to ensure plaintext passwords are never stored.
- **Logging**: N/A - No centralized logging strategy is defined yet.
- **Error Handling**: N/A - Basic HTTP 400/401 status codes will be returned directly from the route handlers.

## ADRs Required
N/A - No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off). The use of JWT and in-memory storage are temporary or straightforward standard implementations.

## Confidence
High confidence. The design relies on standard Node.js/Express conventions for simple authentication without a database.
