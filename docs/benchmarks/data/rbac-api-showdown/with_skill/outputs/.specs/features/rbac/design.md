# Design: Role-Based Access Control (RBAC) API

## Architecture
- **Framework**: Express.js
- **Token Management**: `jsonwebtoken` (JWT) library.
- **Testing**: `node:test` native runner, `supertest` for API assertions.
- **Persistence**: A simple in-memory object or array holding pre-seeded users.

## Data Structures
- **User Object**: `{ id, username, password, role }`
- **JWT Payload**: `{ id, username, role }`

## Middleware Strategy
- `authenticate(req, res, next)`: Extracts Bearer token, verifies via `jsonwebtoken`, attaches decoded user to `req.user`.
- `authorize(allowedRoles)`: Returns middleware that checks `allowedRoles.includes(req.user.role)`.
