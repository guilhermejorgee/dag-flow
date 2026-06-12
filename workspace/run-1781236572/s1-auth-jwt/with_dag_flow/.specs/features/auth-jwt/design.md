# Design: JWT Authentication

## Solution Components
- JWT Authentication Middleware: Validates JWT token on protected routes.
- Auth Controller: Handles login and registration endpoints in `src/routes/`.
- User Model: Manages the in-memory user array and password hashing using bcrypt in `src/models/user.js`.

## Patterns Reused
- Express routes pattern (existing `src/routes/`).
- Express middleware pattern (existing `src/middleware/`).

## New Patterns Introduced
N/A - This feature introduces no new pattern; it strictly conforms to existing Express route and middleware patterns.

## Cross-Cutting Concerns
- Authentication: Validates and issues JWTs for stateless sessions.
- Authorization: N/A - Auth token is required but no specific RBAC implemented yet.
- Error Handling: Returns 401 for invalid credentials or tokens.

## ADRs Required
N/A - No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off).

## Confidence
High confidence, as it is a standard implementation of JWT over Express.
