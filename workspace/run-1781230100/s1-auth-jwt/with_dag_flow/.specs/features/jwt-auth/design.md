# Design: jwt-auth

## Solution Components
- `auth.js` routes containing `POST /api/auth/register` and `POST /api/auth/login`.
- `authController.js` to handle request validation, bcrypt hashing/verification, and jsonwebtoken signing.
- `app.js` update to mount `/api/auth` router.

## Patterns Reused
Express routing pattern. In-memory data access pattern via `src/models/user.js`.

## New Patterns Introduced
JWT Token generation pattern for user sessions.

## Cross-Cutting Concerns
- Auth: Establishes the foundational JWT generation for future authenticated endpoints.
- Error Handling: N/A - standard Express error responses (400 for bad input, 401 for unauthorized).

## ADRs Required
No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off).

## Confidence
High confidence; standard JWT implementation in Express without complex storage constraints.
