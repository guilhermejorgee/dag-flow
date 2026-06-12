# Design: RBAC Feature

## Solution Components
- Express middleware function (`requireAdmin`) in `src/middleware/rbac.js` to extract JWT from headers, decode it, lookup the user via `UserModel`, and verify the 'Admin' role.
- Task router (`src/routes/tasks.js`) defining `POST /` and `DELETE /:id`.
- Express app (`src/app.js`) updated to mount the task router at `/api/tasks`.
- Basic `UserModel` in `src/models/user.js` to store and retrieve users by ID from memory.

## Patterns Reused
- Express routing pattern (modular routers).
- Express middleware pattern (`(req, res, next)`).

## New Patterns Introduced
- N/A: This feature introduces no new pattern; it strictly conforms to standard Express routing and middleware architecture.

## Cross-Cutting Concerns
- Authentication: Middleware parses `Authorization` header for JWT.
- Authorization: Middleware verifies 'Admin' role and blocks access with HTTP 403 if insufficient.
- Error Handling: Missing/invalid token returns HTTP 401; insufficient privileges returns HTTP 403.

## ADRs Required
- N/A: No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off). Standard JWT-based middleware is used.

## Confidence
High confidence; relies on established Express patterns for authentication middleware and routing.
