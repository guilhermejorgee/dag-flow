# Design: RBAC Roles

## Solution Components
- In-memory `users` and `tasks` arrays in a central store module.
- `authController` handling `/login` and `/register`.
- `taskController` handling `/tasks` routes.
- `authMiddleware` to verify JWTs.
- `rbacMiddleware` factory to enforce required roles.

## Patterns Reused
N/A - The project is currently a bare Express skeleton with no existing patterns. We will establish standard Express controllers and middlewares.

## New Patterns Introduced
- Controller/Route separation: Routes define endpoints, controllers handle logic.
- Middleware composition: `app.use('/routes', authMiddleware, rbacMiddleware('Admin'), controller)`.

## Cross-Cutting Concerns
- **Auth:** JWT-based stateless authentication.
- **Authorization:** RBAC via custom middleware checking `req.user.role`.
- **Error Handling:** Centralized Express error handler for 401/403 responses.

## ADRs Required
N/A - No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off). Choosing in-memory arrays for a basic skeleton is standard and easily reversible by swapping the store module.

## Confidence
High confidence, as the requested RBAC logic is standard JWT implementation on a basic Express server.
