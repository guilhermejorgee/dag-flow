# Design: RBAC Role Management

## Solution Components
- **JWT Authentication Middleware**: Verifies token from `Authorization` header and attaches the user payload (including role) to `req.user`.
- **Role Authorization Middleware**: Factory function `requireRole(role)` that checks `req.user.role` against the required role, returning HTTP 403 `{"error": "Forbidden"}` if unauthorized.
- **In-Memory Models**: Simple JS arrays exported from `src/models/user.js` and `src/models/task.js` to persist data.
- **Task Routes**: Endpoints to manage tasks, applying `requireRole('Admin')` on the creation (`POST`) and deletion (`DELETE`) routes.

## Patterns Reused
- Express middleware pattern for handling requests before reaching route logic.
- Modular routing pattern using `express.Router()`.

## New Patterns Introduced
- Role-based authorization middleware pattern for consistent HTTP 403 responses across secured endpoints.

## Cross-Cutting Concerns
- **Auth**: JWT verification happens before routing logic.
- **Authorization**: Implemented via middleware applied to specific routes.
- **Error Handling**: Standardized JSON format (`{"error": "Forbidden"}`) for unauthorized access.

## ADRs Required
N/A. No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off).

## Confidence
High confidence; the approach relies on well-established Express.js middleware patterns.
